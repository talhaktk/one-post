const express = require('express')
const { v4: uuidv4 } = require('uuid')
const auth = require('../middleware/auth')
const { publishJob } = require('../services/publishService')

const router = express.Router()

if (!global.sseProgressClients) global.sseProgressClients = {}
if (!global.sseProgressBuffers) global.sseProgressBuffers = {}

router.post('/', auth, async (req, res) => {
  try {
    const jobId = uuidv4()
    if (!global.sseProgressClients[jobId]) global.sseProgressClients[jobId] = []
    if (!global.sseProgressBuffers[jobId]) global.sseProgressBuffers[jobId] = []

    res.json({ job_id: jobId })

    // Run publish asynchronously
    publishJob(jobId, req.body, req.user.id).catch(err => {
      console.error('Publish error:', err)
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DB-based progress: client can poll this if SSE fails. DB is the source of truth.
router.get('/status/:videoId', auth, async (req, res) => {
  try {
    const supabase = require('../lib/supabase')
    const { data, error } = await supabase
      .from('posts')
      .select('platform, target_id, target_name, status, platform_post_url, error_message, published_at, created_at')
      .eq('video_id', req.params.videoId)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })

    const published = (data || []).filter(p => p.status === 'published').length
    const failed = (data || []).filter(p => p.status === 'failed').length
    res.json({
      video_id: req.params.videoId,
      total: data?.length || 0,
      published,
      failed,
      posts: data || []
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/progress/:jobId', (req, res) => {
  const { jobId } = req.params

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  if (!global.sseProgressClients[jobId]) global.sseProgressClients[jobId] = []
  global.sseProgressClients[jobId].push(res)

  res.write(`data: ${JSON.stringify({ type: 'connected', job_id: jobId })}\n\n`)

  // Replay any events that fired before this client connected
  const buffered = global.sseProgressBuffers[jobId] || []
  for (const data of buffered) {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`) } catch {}
  }

  // Heartbeat so proxies (Cloudflare, Railway) don't close the idle connection
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n') } catch { clearInterval(heartbeat) }
  }, 15000)

  req.on('close', () => {
    clearInterval(heartbeat)
    global.sseProgressClients[jobId] = (global.sseProgressClients[jobId] || []).filter(c => c !== res)
  })
})

module.exports = router
