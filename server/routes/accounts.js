const express = require('express')
const auth = require('../middleware/auth')
const { createClient } = require('@supabase/supabase-js')
const { getAllPages } = require('../services/facebook')

const router = express.Router()
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

router.get('/facebook-pages/:userId', auth, async (req, res) => {
  const { data, error } = await supabase.from('facebook_pages').select('*').eq('user_id', req.params.userId).eq('is_active', true).order('fan_count', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ pages: data })
})

router.get('/tiktok-accounts/:userId', auth, async (req, res) => {
  const { data, error } = await supabase.from('tiktok_accounts').select('*').eq('user_id', req.params.userId).eq('is_active', true)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ accounts: data })
})

router.delete('/:accountId', auth, async (req, res) => {
  const { accountId } = req.params
  // Try connected_platforms first, then tiktok_accounts
  const { error: err1 } = await supabase.from('connected_platforms').update({ is_active: false }).eq('id', accountId).eq('user_id', req.user.id)
  if (err1) {
    const { error: err2 } = await supabase.from('tiktok_accounts').update({ is_active: false }).eq('id', accountId).eq('user_id', req.user.id)
    if (err2) return res.status(500).json({ error: err2.message })
  }
  res.json({ success: true })
})

router.post('/facebook/sync-pages', auth, async (req, res) => {
  try {
    const { data: account } = await supabase.from('connected_platforms').select('*').eq('user_id', req.user.id).eq('platform', 'facebook').eq('is_active', true).single()
    if (!account) return res.status(400).json({ error: 'Facebook not connected' })

    const pages = await getAllPages(account.access_token)
    if (!pages.length) return res.json({ count: 0 })

    const records = pages.map(p => ({
      user_id: req.user.id,
      connected_platform_id: account.id,
      page_id: p.id, page_name: p.name,
      page_avatar: p.picture?.data?.url,
      page_access_token: p.access_token,
      page_category: p.category,
      fan_count: p.fan_count || 0,
      is_selected_default: true, is_active: true
    }))

    const { error } = await supabase.from('facebook_pages').upsert(records, { onConflict: 'user_id,page_id' })
    if (error) return res.status(500).json({ error: error.message })
    res.json({ count: records.length, pages: records.map(r => r.page_name) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
