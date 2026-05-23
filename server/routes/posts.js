const express = require('express')
const auth = require('../middleware/auth')

const router = express.Router()
const supabase = require('../lib/supabase')

router.get('/:userId', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('posts')
    .select('*, videos(title, thumbnail_url, duration_seconds)')
    .eq('user_id', req.params.userId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ posts: data })
})

// Recent uploads (videos + their post status) for Dashboard
router.get('/:userId/recent', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('videos')
    .select('id, title, thumbnail_url, original_url, media_type, created_at, posts(platform, status)')
    .eq('user_id', req.params.userId)
    .order('created_at', { ascending: false })
    .limit(15)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ videos: data })
})

// Full history — all uploads with nested post statuses
router.get('/:userId/history', auth, async (req, res) => {
  const { status, platform } = req.query
  const { data, error } = await supabase
    .from('videos')
    .select('id, title, thumbnail_url, original_url, media_type, created_at, posts(id, platform, status, target_name, platform_post_url, created_at)')
    .eq('user_id', req.params.userId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return res.status(500).json({ error: error.message })

  let videos = data || []

  if (status && status !== 'all') {
    videos = videos.filter(v => {
      const statuses = (v.posts || []).map(p => p.status)
      if (status === 'uploaded') return statuses.length === 0
      if (status === 'published') return statuses.length > 0 && statuses.every(s => s === 'published')
      if (status === 'failed') return statuses.includes('failed') && !statuses.includes('published')
      if (status === 'publishing') return statuses.includes('publishing')
      if (status === 'scheduled') return statuses.every(s => s === 'scheduled')
      return true
    })
  }

  if (platform && platform !== 'all') {
    videos = videos.filter(v => (v.posts || []).some(p => p.platform === platform || p.platform.startsWith(platform)))
  }

  res.json({ videos })
})

router.post('/:postId/repost', auth, async (req, res) => {
  try {
    const { data: post } = await supabase.from('posts').select('*').eq('id', req.params.postId).eq('user_id', req.user.id).single()
    if (!post) return res.status(404).json({ error: 'Post not found' })

    const { publishJob } = require('../services/publishService')
    const { v4: uuidv4 } = require('uuid')
    const jobId = uuidv4()

    const targets = [{ platform: post.platform, target_id: post.target_id, page_ids: post.target_id ? [post.target_id] : [] }]
    publishJob(jobId, { video_id: post.video_id, targets, hashtags_per_platform: {}, title: post.title }, req.user.id).catch(console.error)

    res.json({ job_id: jobId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
