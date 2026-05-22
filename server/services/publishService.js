const { wait } = require('./helpers')
const path = require('path')
const os = require('os')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')

const supabase = require('../lib/supabase')

// Global SSE clients store
if (!global.sseProgressClients) global.sseProgressClients = {}

const emit = (jobId, data) => {
  const clients = global.sseProgressClients[jobId] || []
  const msg = `data: ${JSON.stringify(data)}\n\n`
  clients.forEach(res => { try { res.write(msg) } catch {} })
}

const downloadClip = async (clipUrl, destPath) => {
  const fetch = require('node-fetch')
  const res = await fetch(clipUrl)
  const buffer = await res.buffer()
  fs.writeFileSync(destPath, buffer)
  return destPath
}

const getClipPath = async (clipId, platform, videoId) => {
  if (clipId) {
    const { data } = await supabase.from('processed_clips').select('clip_url').eq('id', clipId).single()
    if (data?.clip_url) {
      const tmpPath = path.join(os.tmpdir(), `clip_${uuidv4()}.mp4`)
      await downloadClip(data.clip_url, tmpPath)
      return tmpPath
    }
  }
  // Fall back to original video
  const { data } = await supabase.from('videos').select('original_url').eq('id', videoId).single()
  if (data?.original_url) {
    const tmpPath = path.join(os.tmpdir(), `original_${uuidv4()}.mp4`)
    await downloadClip(data.original_url, tmpPath)
    return tmpPath
  }
  throw new Error('No video file found')
}

const getImageUrl = async (videoId) => {
  const { data } = await supabase.from('videos').select('original_url').eq('id', videoId).single()
  if (!data?.original_url) throw new Error('Image not found')
  return data.original_url
}

const downloadToTemp = async (url, ext = '.jpg') => {
  const fetch = require('node-fetch')
  const res = await fetch(url)
  const buffer = await res.buffer()
  const tmpPath = path.join(os.tmpdir(), `img_${uuidv4()}${ext}`)
  fs.writeFileSync(tmpPath, buffer)
  return tmpPath
}

const publishJob = async (jobId, payload, userId) => {
  const { video_id, targets, hashtags_per_platform, title, description, post_delay_seconds = 30, media_type = 'video' } = payload
  const isImage = media_type === 'image'

  emit(jobId, { type: 'started', job_id: jobId })

  const results = []

  for (const target of targets) {
    const { platform, clip_id, page_ids, account_ids } = target

    if (platform === 'youtube') {
      emit(jobId, { type: 'progress', platform, target_id: 'youtube', target_name: 'YouTube', status: 'uploading', progress: 10 })
      try {
        const { data: account } = await supabase.from('connected_platforms').select('*').eq('user_id', userId).eq('platform', 'youtube').eq('is_active', true).single()
        if (!account) throw new Error('YouTube not connected')
        const filePath = await getClipPath(clip_id, platform, video_id)
        const youtube = require('./youtube')
        const tags = hashtags_per_platform?.youtube || []
        const res = await youtube.uploadVideo(account.access_token, account.refresh_token, { filePath, title, description: `${description || ''}\n\n${tags.map(t => `#${t}`).join(' ')}`, tags })
        emit(jobId, { type: 'progress', platform, target_id: 'youtube', target_name: 'YouTube', status: 'published', progress: 100, post_url: res.post_url })
        results.push({ platform, target_id: 'youtube', target_name: 'YouTube', status: 'published', platform_post_url: res.post_url })
        await supabase.from('posts').insert({ video_id, user_id: userId, platform, target_id: 'youtube', target_name: 'YouTube', status: 'published', published_at: new Date().toISOString(), platform_post_url: res.post_url, hashtags_used: tags })
        fs.unlinkSync(filePath)
      } catch (err) {
        emit(jobId, { type: 'progress', platform, target_id: 'youtube', target_name: 'YouTube', status: 'failed', error_message: err.message })
        results.push({ platform, target_id: 'youtube', target_name: 'YouTube', status: 'failed', error: err.message })
        await supabase.from('posts').insert({ video_id, user_id: userId, platform, status: 'failed', error_message: err.message })
      }
      await wait(post_delay_seconds)
    }

    if (platform === 'instagram_reels' || platform === 'instagram_feed' || platform === 'instagram_image') {
      const targetName = platform === 'instagram_reels' ? 'Instagram Reels' : platform === 'instagram_image' ? 'Instagram Image' : 'Instagram Feed'
      emit(jobId, { type: 'progress', platform, target_id: platform, target_name: targetName, status: 'uploading', progress: 20 })
      try {
        const { data: account } = await supabase.from('connected_platforms').select('*').eq('user_id', userId).eq('platform', 'instagram').eq('is_active', true).single()
        if (!account) throw new Error('Instagram not connected')
        const instagram = require('./instagram')
        const igAccountId = account.platform_user_id
        const caption = `${description || title}\n${(hashtags_per_platform?.instagram || []).map(t => `#${t}`).join(' ')}`
        let res
        if (isImage || platform === 'instagram_image') {
          const imageUrl = await getImageUrl(video_id)
          res = await instagram.uploadImage(account.access_token, igAccountId, { imageUrl, caption })
        } else {
          const { data: clip } = await supabase.from('processed_clips').select('clip_url').eq('id', clip_id).single()
          res = await instagram.uploadReel(account.access_token, igAccountId, { videoUrl: clip?.clip_url, caption })
        }
        emit(jobId, { type: 'progress', platform, target_id: platform, target_name: targetName, status: 'published', progress: 100, post_url: res.post_url })
        results.push({ platform, status: 'published', platform_post_url: res.post_url })
        await supabase.from('posts').insert({ video_id, user_id: userId, platform, status: 'published', published_at: new Date().toISOString(), platform_post_url: res.post_url })
      } catch (err) {
        emit(jobId, { type: 'progress', platform, target_id: platform, target_name: targetName, status: 'failed', error_message: err.message })
        results.push({ platform, status: 'failed', error: err.message })
        await supabase.from('posts').insert({ video_id, user_id: userId, platform, status: 'failed', error_message: err.message })
      }
      await wait(post_delay_seconds)
    }

    if (platform === 'facebook' && page_ids?.length) {
      const { data: pages } = await supabase.from('facebook_pages').select('*').eq('user_id', userId).in('page_id', page_ids).eq('is_active', true)
      if (pages?.length) {
        const fb = require('./facebook')
        if (isImage) {
          const imageUrl = await getImageUrl(video_id)
          const caption = `${title}\n\n${description || ''}\n${(hashtags_per_platform?.facebook || []).map(t => `#${t}`).join(' ')}`
          await fb.uploadPhotosToAllPages(pages, imageUrl, caption, post_delay_seconds, (event) => emit(jobId, event))
        } else {
          const filePath = await getClipPath(clip_id, 'facebook', video_id)
          await fb.uploadToAllPages(pages, filePath, title, description, post_delay_seconds, (event) => emit(jobId, event))
          fs.unlinkSync(filePath)
        }
      }
    }

    if (platform === 'tiktok' && account_ids?.length) {
      const { data: accounts } = await supabase.from('tiktok_accounts').select('*').eq('user_id', userId).in('id', account_ids).eq('is_active', true)
      if (accounts?.length) {
        const filePath = await getClipPath(clip_id, 'tiktok', video_id)
        const tiktok = require('./tiktok')
        await tiktok.uploadToAllAccounts(accounts, filePath, title, description, hashtags_per_platform?.tiktok || [], post_delay_seconds, (event) => emit(jobId, event))
        fs.unlinkSync(filePath)
      }
    }

    if (platform === 'twitter') {
      emit(jobId, { type: 'progress', platform, target_id: 'twitter', target_name: 'X / Twitter', status: 'uploading', progress: 20 })
      try {
        const { data: account } = await supabase.from('connected_platforms').select('*').eq('user_id', userId).eq('platform', 'twitter').eq('is_active', true).single()
        if (!account) throw new Error('Twitter not connected')
        const twitter = require('./twitter')
        const tags = hashtags_per_platform?.twitter || []
        let res
        if (isImage) {
          const imageUrl = await getImageUrl(video_id)
          const ext = path.extname(imageUrl) || '.jpg'
          const tmpPath = await downloadToTemp(imageUrl, ext)
          res = await twitter.uploadAndTweetImage(account.access_token, { imagePath: tmpPath, text: title, hashtags: tags })
          fs.unlinkSync(tmpPath)
        } else {
          const filePath = await getClipPath(clip_id, platform, video_id)
          res = await twitter.uploadAndTweet(account.access_token, { videoPath: filePath, text: title, hashtags: tags })
          fs.unlinkSync(filePath)
        }
        emit(jobId, { type: 'progress', platform, target_id: 'twitter', target_name: 'X / Twitter', status: 'published', progress: 100, post_url: res.post_url })
        results.push({ platform, status: 'published', platform_post_url: res.post_url })
        await supabase.from('posts').insert({ video_id, user_id: userId, platform, status: 'published', published_at: new Date().toISOString(), platform_post_url: res.post_url, hashtags_used: tags })
      } catch (err) {
        emit(jobId, { type: 'progress', platform, target_id: 'twitter', target_name: 'X / Twitter', status: 'failed', error_message: err.message })
        results.push({ platform, status: 'failed', error: err.message })
        await supabase.from('posts').insert({ video_id, user_id: userId, platform, status: 'failed', error_message: err.message })
      }
    }
  }

  emit(jobId, { type: 'done', results })
  // Clean up SSE clients after delay
  setTimeout(() => { delete global.sseProgressClients[jobId] }, 30000)
  return results
}

const publishScheduledPost = async (post) => {
  // Adapt scheduled post to publish format
  const targets = []
  if (post.target_platforms?.youtube) targets.push({ platform: 'youtube' })
  if (post.target_platforms?.instagram_reels) targets.push({ platform: 'instagram_reels' })
  if (post.target_platforms?.instagram_feed) targets.push({ platform: 'instagram_feed' })
  if (post.target_facebook_pages?.length) targets.push({ platform: 'facebook', page_ids: post.target_facebook_pages })
  if (post.target_tiktok_accounts?.length) targets.push({ platform: 'tiktok', account_ids: post.target_tiktok_accounts })
  if (post.target_platforms?.twitter) targets.push({ platform: 'twitter' })

  const jobId = `scheduled_${post.id}`
  return await publishJob(jobId, { video_id: post.video_id, targets, hashtags_per_platform: post.hashtags_per_platform || {}, title: post.title, description: post.caption_english }, post.user_id)
}

module.exports = { publishJob, publishScheduledPost }
