const express = require('express')
const { v4: uuidv4 } = require('uuid')
const auth = require('../middleware/auth')
const { publishJob } = require('../services/publishService')

const router = express.Router()

if (!global.sseProgressClients) global.sseProgressClients = {}

router.post('/', auth, async (req, res) => {
  try {
    const jobId = uuidv4()
    if (!global.sseProgressClients[jobId]) global.sseProgressClients[jobId] = []

    res.json({ job_id: jobId })

    // Run publish asynchronously
    publishJob(jobId, req.body, req.user.id).catch(err => {
      console.error('Publish error:', err)
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/progress/:jobId', auth, (req, res) => {
  const { jobId } = req.params

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  if (!global.sseProgressClients[jobId]) global.sseProgressClients[jobId] = []
  global.sseProgressClients[jobId].push(res)

  res.write(`data: ${JSON.stringify({ type: 'connected', job_id: jobId })}\n\n`)

  req.on('close', () => {
    global.sseProgressClients[jobId] = (global.sseProgressClients[jobId] || []).filter(c => c !== res)
  })
})

module.exports = router
