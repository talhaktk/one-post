const express = require('express')
const auth = require('../middleware/auth')
const { getAllPages, checkTokenHealth } = require('../services/facebook')

const router = express.Router()
const supabase = require('../lib/supabase')

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
  const { error: err1 } = await supabase.from('connected_platforms').update({ is_active: false }).eq('id', accountId).eq('user_id', req.user.id)
  if (err1) {
    const { error: err2 } = await supabase.from('tiktok_accounts').update({ is_active: false }).eq('id', accountId).eq('user_id', req.user.id)
    if (err2) return res.status(500).json({ error: err2.message })
  }
  res.json({ success: true })
})

// Diagnostics — useful when "0 FB pages" but user expects more
router.get('/facebook/diagnose', auth, async (req, res) => {
  try {
    const { data: account } = await supabase
      .from('connected_platforms')
      .select('id, platform_username, access_token, is_active, created_at, updated_at')
      .eq('user_id', req.user.id)
      .eq('platform', 'facebook')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const { count: activeCount } = await supabase
      .from('facebook_pages').select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id).eq('is_active', true)

    const { count: inactiveCount } = await supabase
      .from('facebook_pages').select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id).eq('is_active', false)

    if (!account) {
      return res.json({
        connected: false,
        activePages: activeCount || 0,
        inactivePages: inactiveCount || 0,
        hint: 'Facebook is not connected. Tap "Connect Facebook" to start.'
      })
    }

    const tokenHealth = await checkTokenHealth(account.access_token)
    res.json({
      connected: account.is_active,
      username: account.platform_username,
      connectedAt: account.created_at,
      activePages: activeCount || 0,
      inactivePages: inactiveCount || 0,
      tokenHealth,
      hint: !tokenHealth.ok
        ? 'Facebook session has expired. Tap "Reconnect Facebook" to refresh access.'
        : (activeCount === 0 && inactiveCount > 0)
          ? `Found ${inactiveCount} deactivated pages. Tap "Sync Pages" to reactivate them.`
          : (activeCount === 0)
            ? 'No pages found yet. Tap "Sync Pages" to import from Facebook.'
            : null
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/facebook/sync-pages', auth, async (req, res) => {
  try {
    const { data: account } = await supabase.from('connected_platforms').select('*').eq('user_id', req.user.id).eq('platform', 'facebook').eq('is_active', true).single()
    if (!account) return res.status(400).json({ error: 'Facebook is not connected. Connect Facebook first, then sync.' })

    let pages
    try {
      pages = await getAllPages(account.access_token)
    } catch (err) {
      // Auto-mark connection as inactive if token expired so the UI shows "Reconnect"
      if (err.fbExpired) {
        await supabase.from('connected_platforms').update({ is_active: false }).eq('id', account.id)
      }
      return res.status(400).json({
        error: err.message,
        needsReconnect: !!err.fbExpired,
        fbCode: err.fbCode
      })
    }

    if (!pages.length) {
      return res.json({
        count: 0,
        warning: 'Facebook returned no pages for this account. Make sure your Facebook account manages at least one page and that you granted the pages_show_list permission.'
      })
    }

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
