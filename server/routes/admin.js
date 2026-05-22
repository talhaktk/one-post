const express = require('express')
const router = express.Router()
const config = require('../services/configService')

const KEYS = [
  'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET',
  'META_APP_ID', 'META_APP_SECRET',
  'TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET',
  'TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET',
  'OPENAI_API_KEY', 'ANTHROPIC_API_KEY',
  'GOOGLE_CLOUD_API_KEY'
]

router.get('/config', async (req, res) => {
  try {
    const cfg = await config.getAll()
    const result = {}
    KEYS.forEach(k => {
      const val = cfg[k] || process.env[k] || ''
      // Mask value — show only last 4 chars
      result[k] = val ? '••••••••' + val.slice(-4) : ''
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/config', async (req, res) => {
  try {
    const pairs = {}
    KEYS.forEach(k => {
      if (req.body[k] && !req.body[k].startsWith('••••')) {
        pairs[k] = req.body[k]
      }
    })
    if (Object.keys(pairs).length) await config.setMany(pairs)
    res.json({ success: true, updated: Object.keys(pairs) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
