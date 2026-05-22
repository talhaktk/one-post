// Redirects to accounts route for backward compat
const express = require('express')
const auth = require('../middleware/auth')
const { createClient } = require('@supabase/supabase-js')
const router = express.Router()
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

router.get('/:userId', auth, async (req, res) => {
  const { data } = await supabase.from('facebook_pages').select('*').eq('user_id', req.params.userId).eq('is_active', true).order('fan_count', { ascending: false })
  res.json({ pages: data || [] })
})

module.exports = router
