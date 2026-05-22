// Redirects to accounts route for backward compat
const express = require('express')
const auth = require('../middleware/auth')
const router = express.Router()
const supabase = require('../lib/supabase')

router.get('/:userId', auth, async (req, res) => {
  const { data } = await supabase.from('facebook_pages').select('*').eq('user_id', req.params.userId).eq('is_active', true).order('fan_count', { ascending: false })
  res.json({ pages: data || [] })
})

module.exports = router
