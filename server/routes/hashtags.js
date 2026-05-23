const express = require('express')
const auth = require('../middleware/auth')
const { fetchAllTrending, generateAISuggestions } = require('../services/hashtags')

const router = express.Router()

router.get('/trending', auth, async (req, res) => {
  try {
    const data = await fetchAllTrending()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/ai-suggest', auth, async (req, res) => {
  try {
    const { title, description, category } = req.body
    const hashtags = await generateAISuggestions(title, description, category)
    res.json({ hashtags })
  } catch (err) {
    console.error('AI hashtags error:', err.message)
    // Return fallback Pakistan political hashtags if AI unavailable
    res.json({ hashtags: ['Pakistan', 'PTI', 'ImranKhan', 'PMLN', 'PPP', 'PakistanPolitics', 'PakistanNews', 'Islamabad', 'Lahore', 'Karachi', 'BreakingNews', 'CurrentAffairs', 'پاکستان', 'عمرانخان', 'سیاست'], warning: 'AI unavailable, showing defaults' })
  }
})

module.exports = router
