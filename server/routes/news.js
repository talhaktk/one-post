const express = require('express')
const multer = require('multer')
const os = require('os')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const auth = require('../middleware/auth')
const { createClient } = require('@supabase/supabase-js')
const { generateBreakingThumbnail } = require('../services/thumbnailGenerator')
const Anthropic = require('@anthropic-ai/sdk')
const { publishJob } = require('../services/publishService')

const router = express.Router()
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const upload = multer({ storage: multer.diskStorage({ destination: os.tmpdir(), filename: (req, f, cb) => cb(null, `photo_${uuidv4()}${path.extname(f.originalname)}`) }) })

// Global SSE clients for live alerts
if (!global.sseClients) global.sseClients = []

router.get('/alerts', auth, async (req, res) => {
  const { status, priority } = req.query
  let query = supabase.from('breaking_alerts').select('*').order('detected_at', { ascending: false }).limit(100)
  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)
  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json({ alerts: data })
})

router.get('/alerts/live', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)

  global.sseClients.push(res)
  req.on('close', () => { global.sseClients = global.sseClients.filter(c => c !== res) })
})

router.post('/alerts/:id/post', auth, async (req, res) => {
  try {
    const { data: alert } = await supabase.from('breaking_alerts').select('*').eq('id', req.params.id).single()
    if (!alert) return res.status(404).json({ error: 'Alert not found' })

    const { platforms, caption_urdu, caption_english, facebook_page_ids, tiktok_account_ids } = req.body
    const jobId = uuidv4()
    const targets = []
    if (platforms.youtube) targets.push({ platform: 'youtube' })
    if (platforms.instagram) targets.push({ platform: 'instagram_reels' })
    if (platforms.facebook && facebook_page_ids?.length) targets.push({ platform: 'facebook', page_ids: facebook_page_ids })
    if (platforms.tiktok && tiktok_account_ids?.length) targets.push({ platform: 'tiktok', account_ids: tiktok_account_ids })
    if (platforms.twitter) targets.push({ platform: 'twitter' })

    // For alerts, we create a text post (no video) — pass thumbnail as image
    publishJob(jobId, { video_id: null, targets, title: alert.headline, description: caption_english || caption_urdu, hashtags_per_platform: {} }, req.user.id).catch(console.error)

    await supabase.from('breaking_alerts').update({ status: 'posted', posted_at: new Date().toISOString() }).eq('id', req.params.id)
    res.json({ success: true, job_id: jobId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/alerts/:id/dismiss', auth, async (req, res) => {
  await supabase.from('breaking_alerts').update({ status: 'dismissed' }).eq('id', req.params.id)
  res.json({ success: true })
})

router.post('/alerts/:id/thumbnail', auth, upload.single('photo'), async (req, res) => {
  try {
    const { data: alert } = await supabase.from('breaking_alerts').select('*').eq('id', req.params.id).single()
    if (!alert) return res.status(404).json({ error: 'Alert not found' })

    const thumbnailUrl = await generateBreakingThumbnail({
      headline: alert.headline,
      sourceName: alert.source_name,
      priority: alert.priority,
      backgroundImagePath: req.file?.path
    })

    await supabase.from('breaking_alerts').update({ thumbnail_url: thumbnailUrl }).eq('id', req.params.id)
    if (req.file) fs.unlinkSync(req.file.path)
    res.json({ thumbnail_url: thumbnailUrl })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/alerts/:id/regenerate-caption', auth, async (req, res) => {
  try {
    const { data: alert } = await supabase.from('breaking_alerts').select('*').eq('id', req.params.id).single()
    if (!alert) return res.status(404).json({ error: 'Alert not found' })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Generate breaking news captions for: "${alert.headline}" from ${alert.source_name}.
Return JSON: {"urdu": "🚨 بریکنگ نیوز 🚨\\n...", "english": "🚨 BREAKING NEWS 🚨\\n..."}`
      }]
    })

    const text = message.content[0].text
    const match = text.match(/\{[\s\S]*\}/)
    const captions = match ? JSON.parse(match[0]) : { urdu: alert.generated_caption_urdu, english: alert.generated_caption_english }

    await supabase.from('breaking_alerts').update({ generated_caption_urdu: captions.urdu, generated_caption_english: captions.english }).eq('id', req.params.id)
    res.json(captions)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/sources', auth, async (req, res) => {
  const { data } = await supabase.from('news_sources').select('*').order('name')
  res.json({ sources: data })
})

router.patch('/sources/:id', auth, async (req, res) => {
  const { data, error } = await supabase.from('news_sources').update(req.body).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json({ source: data })
})

router.get('/keywords', auth, async (req, res) => {
  const { data } = await supabase.from('breaking_keywords').select('*').order('score', { ascending: false })
  res.json({ keywords: data })
})

router.post('/keywords', auth, async (req, res) => {
  const { data, error } = await supabase.from('breaking_keywords').insert(req.body).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json({ keyword: data })
})

router.delete('/keywords/:id', auth, async (req, res) => {
  await supabase.from('breaking_keywords').delete().eq('id', req.params.id)
  res.json({ success: true })
})

module.exports = router
