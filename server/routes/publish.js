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
