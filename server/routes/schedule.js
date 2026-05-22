const express = require('express')
const multer = require('multer')
const os = require('os')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const auth = require('../middleware/auth')
const { publishJob } = require('../services/publishService')

const router = express.Router()
const supabase = require('../lib/supabase')
const upload = multer({ storage: multer.diskStorage({ destination: os.tmpdir(), filename: (req, f, cb) => cb(null, `sched_${uuidv4()}${path.extname(f.originalname)}`) }) })

router.post('/create', auth, upload.single('video'), async (req, res) => {
  try {
    const { title, caption_urdu, caption_english, hashtags_per_platform, target_platforms, target_facebook_pages, target_tiktok_accounts, scheduled_at, timezone, is_recurring, recurrence_rule } = req.body

    if (!scheduled_at || new Date(scheduled_at) <= new Date()) {
      return res.status(400).json({ error: 'Scheduled time must be in the future' })
    }

    let videoId = null
    if (req.file) {
      const { data: videoData } = await supabase.from('videos').insert({
        user_id: req.user.id, title, duration_seconds: 0,
        file_size_mb: parseFloat((req.file.size / 1024 / 1024).toFixed(2))
      }).select().single()
      videoId = videoData.id
      fs.unlinkSync(req.file.path)
    }

    const { data, error } = await supabase.from('scheduled_posts').insert({
      user_id: req.user.id,
      video_id: videoId,
      title,
      caption_urdu,
      caption_english,
      hashtags_per_platform: hashtags_per_platform ? JSON.parse(hashtags_per_platform) : {},
      target_platforms: target_platforms ? JSON.parse(target_platforms) : {},
      target_facebook_pages: target_facebook_pages ? JSON.parse(target_facebook_pages) : [],
      target_tiktok_accounts: target_tiktok_accounts ? JSON.parse(target_tiktok_accounts) : [],
      scheduled_at,
      timezone: timezone || 'Asia/Karachi',
      status: 'scheduled',
      is_recurring: is_recurring === 'true',
      recurrence_rule: is_recurring === 'true' ? recurrence_rule : null
    }).select().single()

    if (error) return res.status(500).json({ error: error.message })
    res.json({ scheduled_post: data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/posts', auth, async (req, res) => {
  const { status } = req.query
  let query = supabase.from('scheduled_posts').select('*').eq('user_id', req.user.id).order('scheduled_at', { ascending: true })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json({ posts: data })
})

router.get('/calendar', auth, async (req, res) => {
  const { data } = await supabase.from('scheduled_posts').select('id,title,scheduled_at,status,target_platforms').eq('user_id', req.user.id).gte('scheduled_at', new Date(Date.now() - 30 * 86400000).toISOString()).order('scheduled_at')
  res.json({ posts: data || [] })
})

router.patch('/posts/:id', auth, async (req, res) => {
  const { data: post } = await supabase.from('scheduled_posts').select('status').eq('id', req.params.id).eq('user_id', req.user.id).single()
  if (!post) return res.status(404).json({ error: 'Not found' })
  if (post.status !== 'scheduled') return res.status(400).json({ error: 'Cannot edit a post that is not scheduled' })
  const { data, error } = await supabase.from('scheduled_posts').update(req.body).eq('id', req.params.id).eq('user_id', req.user.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json({ post: data })
})

router.delete('/posts/:id', auth, async (req, res) => {
  await supabase.from('scheduled_posts').update({ status: 'cancelled' }).eq('id', req.params.id).eq('user_id', req.user.id)
  res.json({ success: true })
})

router.post('/posts/:id/publish-now', auth, async (req, res) => {
  const { data: post } = await supabase.from('scheduled_posts').select('*').eq('id', req.params.id).eq('user_id', req.user.id).single()
  if (!post) return res.status(404).json({ error: 'Not found' })

  const { publishScheduledPost } = require('../services/publishService')
  publishScheduledPost(post).catch(console.error)
  res.json({ success: true })
})

router.post('/posts/:id/reschedule', auth, async (req, res) => {
  const { scheduled_at } = req.body
  if (!scheduled_at || new Date(scheduled_at) <= new Date()) return res.status(400).json({ error: 'Must be in the future' })
  const { data, error } = await supabase.from('scheduled_posts').update({ scheduled_at }).eq('id', req.params.id).eq('user_id', req.user.id).eq('status', 'scheduled').select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json({ post: data })
})

router.get('/posts/:id/results', auth, async (req, res) => {
  const { data: post } = await supabase.from('scheduled_posts').select('*').eq('id', req.params.id).eq('user_id', req.user.id).single()
  if (!post) return res.status(404).json({ error: 'Not found' })
  const { data: results } = await supabase.from('scheduled_post_results').select('*').eq('scheduled_post_id', req.params.id)
  res.json({ post, results: results || [] })
})

module.exports = router
