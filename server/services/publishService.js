const { wait } = require('./helpers')
const path = require('path')
const os = require('os')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')

const supabase = require('../lib/supabase')

// Global SSE event buffers — keep events alive between job start and first client connect.
// Cleared when the job ends (or on TTL) by publishJob's finally block.
if (!global.sseProgressBuffers) global.sseProgressBuffers = {}

// Returns a 1-hour signed URL for a Supabase storage file (works even if bucket is private)
const getSignedUrl = async (publicUrl, expiresIn = 3600) => {
  try {
    const match = publicUrl.match(/\/storage\/v1\/object\/(?:public\/)?([^?#]+)/)
    if (!match) return publicUrl
    const parts = match[1].split('/')
    const bucket = parts[0]
    const filePath = parts.slice(1).join('/')
    const { data } = await supabase.storage.from(bucket).createSignedUrl(filePath, expiresIn)
    return data?.signedUrl || publicUrl
  } catch {
    return publicUrl
  }
}

// Global SSE clients store
if (!global.sseProgressClients) global.sseProgressClients = {}

const emit = (jobId, data) => {
  // Always buffer — this keeps a replayable history if a client reconnects.
  if (!global.sseProgressBuffers[jobId]) global.sseProgressBuffers[jobId] = []
  global.sseProgressBuffers[jobId].push(data)
  // Cap the buffer at 500 events to avoid memory growth on huge jobs
  if (global.sseProgressBuffers[jobId].length > 500) {
    global.sseProgressBuffers[jobId].splice(0, global.sseProgressBuffers[jobId].length - 500)
  }

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
  // Return a 1-hour signed URL so Facebook can fetch even when the storage bucket is private
  return await getSignedUrl(data.original_url)
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

  try {
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
      try {
        const { data: pages } = await supabase.from('facebook_pages').select('*').eq('user_id', userId).in('page_id', page_ids).eq('is_active', true)
        if (pages?.length) {
          const fb = require('./facebook')
          const tags = (hashtags_per_platform?.facebook || []).map(t => `#${t}`).join(' ')
          let fbResults = []
          if (isImage) {
            const imageUrl = await getImageUrl(video_id)
            const caption = `${title}\n\n${description || ''}\n${tags}`
            fbResults = await fb.uploadPhotosToAllPages(pages, imageUrl, caption, post_delay_seconds, (event) => emit(jobId, event))
          } else {
            // Generate signed URL so Facebook can fetch even if bucket is private
            const { data: vid } = await supabase.from('videos').select('original_url').eq('id', video_id).single()
            if (!vid?.original_url) throw new Error('Video URL not found')
            const videoUrl = await getSignedUrl(vid.original_url)
            const fullDesc = `${description || ''}\n${tags}`
            fbResults = await fb.uploadToAllPagesByUrl(pages, videoUrl, title, fullDesc, post_delay_seconds, (event) => emit(jobId, event))
          }
          // Save results to DB
          for (const r of fbResults) {
            await supabase.from('posts').insert({ video_id, user_id: userId, platform: 'facebook', target_id: r.page_id, target_name: r.page_name, status: r.status, published_at: r.status === 'published' ? new Date().toISOString() : null, platform_post_url: r.post_url || null, error_message: r.error || null })
          }
          results.push(...fbResults.map(r => ({ platform: 'facebook', ...r })))
        }
      } catch (err) {
        console.error('Facebook publish error:', err.message)
        emit(jobId, { type: 'progress', platform: 'facebook', target_id: 'fb_error', target_name: 'Facebook', status: 'failed', error_message: err.message })
        results.push({ platform: 'facebook', status: 'failed', error: err.message })
        await supabase.from('posts').insert({ video_id, user_id: userId, platform: 'facebook', status: 'failed', error_message: err.message }).catch(() => {})
      }
    }

    if (platform === 'tiktok' && account_ids?.length) {
      try {
        const { data: accounts } = await supabase.from('tiktok_accounts').select('*').eq('user_id', userId).in('id', account_ids).eq('is_active', true)
        if (accounts?.length) {
          const filePath = await getClipPath(clip_id, 'tiktok', video_id)
          const tiktok = require('./tiktok')
          await tiktok.uploadToAllAccounts(accounts, filePath, title, description, hashtags_per_platform?.tiktok || [], post_delay_seconds, (event) => emit(jobId, event))
          fs.unlinkSync(filePath)
        }
      } catch (err) {
        console.error('TikTok publish error:', err.message)
        emit(jobId, { type: 'progress', platform: 'tiktok', target_id: 'tiktok_error', target_name: 'TikTok', status: 'failed', error_message: err.message })
        results.push({ platform: 'tiktok', status: 'failed', error: err.message })
        await supabase.from('posts').insert({ video_id, user_id: userId, platform: 'tiktok', status: 'failed', error_message: err.message }).catch(() => {})
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
  } catch (err) {
    console.error('publishJob fatal error:', err.message)
  } finally {
    emit(jobId, { type: 'done', results })
    setTimeout(() => {
      delete global.sseProgressClients[jobId]
      delete global.sseProgressBuffers[jobId]
    }, 60000)
  }
  return results
}

const publishScheduledPost = async (post) => {
  // Adapt scheduled post to publish format
  const isImage = post.media_type === 'image'
  const targets = []
  if (post.target_platforms?.youtube && !isImage) targets.push({ platform: 'youtube' })
  if (post.target_platforms?.instagram_reels && !isImage) targets.push({ platform: 'instagram_reels' })
  if (post.target_platforms?.instagram_feed && !isImage) targets.push({ platform: 'instagram_feed' })
  if (post.target_platforms?.instagram_image && isImage) targets.push({ platform: 'instagram_image' })
  if (post.target_facebook_pages?.length) targets.push({ platform: 'facebook', page_ids: post.target_facebook_pages })
  if (post.target_tiktok_accounts?.length && !isImage) targets.push({ platform: 'tiktok', account_ids: post.target_tiktok_accounts })
  if (post.target_platforms?.twitter) targets.push({ platform: 'twitter' })

  const jobId = `scheduled_${post.id}`
  return await publishJob(jobId, {
    video_id: post.video_id,
    targets,
    hashtags_per_platform: post.hashtags_per_platform || {},
    title: post.title,
    description: post.caption_english,
    media_type: post.media_type || 'video'
  }, post.user_id)
}

module.exports = { publishJob, publishScheduledPost }
