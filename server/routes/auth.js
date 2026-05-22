const express = require('express')
const router = express.Router()

const supabase = require('../lib/supabase')

const OAUTH_PROVIDERS = {
  youtube: require('../services/youtube'),
  facebook: require('../services/facebook'),
  instagram: require('../services/instagram'),
  tiktok: require('../services/tiktok'),
  twitter: require('../services/twitter')
}

// Store OAuth state/verifiers temporarily (use Redis in prod)
const oauthStore = {}

router.get('/oauth-url/:platform', async (req, res) => {
  try {
    const { platform } = req.params
    const provider = OAUTH_PROVIDERS[platform === 'tiktok_new' ? 'tiktok' : platform]
    if (!provider) return res.status(400).json({ error: 'Unknown platform' })

    let result
    if (platform === 'twitter') {
      result = await provider.getAuthUrl()
      oauthStore[result.state] = { codeVerifier: result.codeVerifier }
    } else {
      result = { url: await provider.getAuthUrl() }
    }
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/oauth-callback/:platform', async (req, res) => {
  try {
    const { platform } = req.params
    const { code, state, user_id } = req.body

    let tokens, userInfo

    if (platform === 'youtube') {
      tokens = await OAUTH_PROVIDERS.youtube.exchangeCode(code)
      await supabase.from('connected_platforms').upsert({
        user_id, platform: 'youtube',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        is_active: true, connected_at: new Date().toISOString()
      }, { onConflict: 'user_id,platform' })
    }

    if (platform === 'facebook') {
      tokens = await OAUTH_PROVIDERS.facebook.exchangeCode(code)
      const { data: platformData } = await supabase.from('connected_platforms').upsert({
        user_id, platform: 'facebook',
        access_token: tokens.access_token,
        is_active: true, connected_at: new Date().toISOString()
      }, { onConflict: 'user_id,platform' }).select().single()

      // Auto-fetch all pages
      const pages = await OAUTH_PROVIDERS.facebook.getAllPages(tokens.access_token)
      if (pages.length) {
        const pageRecords = pages.map(p => ({
          user_id, connected_platform_id: platformData.id,
          page_id: p.id, page_name: p.name,
          page_avatar: p.picture?.data?.url,
          page_access_token: p.access_token,
          page_category: p.category,
          fan_count: p.fan_count || 0,
          is_selected_default: true, is_active: true
        }))
        await supabase.from('facebook_pages').upsert(pageRecords, { onConflict: 'user_id,page_id', ignoreDuplicates: false })
      }
    }

    if (platform === 'instagram') {
      tokens = await OAUTH_PROVIDERS.instagram.exchangeCode(code)
      await supabase.from('connected_platforms').upsert({
        user_id, platform: 'instagram',
        access_token: tokens.access_token,
        is_active: true, connected_at: new Date().toISOString()
      }, { onConflict: 'user_id,platform' })
    }

    if (platform === 'tiktok' || platform === 'tiktok_new') {
      tokens = await OAUTH_PROVIDERS.tiktok.exchangeCode(code)
      userInfo = await OAUTH_PROVIDERS.tiktok.getUserInfo(tokens.access_token)

      const count = await supabase.from('tiktok_accounts').select('id', { count: 'exact' }).eq('user_id', user_id)
      await supabase.from('tiktok_accounts').insert({
        user_id, account_label: `Account ${(count.count || 0) + 1}`,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        tiktok_user_id: userInfo?.open_id,
        tiktok_username: userInfo?.display_name,
        tiktok_avatar: userInfo?.avatar_url,
        follower_count: userInfo?.follower_count || 0,
        is_active: true
      })
    }

    if (platform === 'twitter') {
      const stored = oauthStore[state] || {}
      tokens = await OAUTH_PROVIDERS.twitter.exchangeCode(code, stored.codeVerifier)
      await supabase.from('connected_platforms').upsert({
        user_id, platform: 'twitter',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        is_active: true, connected_at: new Date().toISOString()
      }, { onConflict: 'user_id,platform' })
      delete oauthStore[state]
    }

    res.json({ success: true, platform })
  } catch (err) {
    console.error('OAuth callback error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
