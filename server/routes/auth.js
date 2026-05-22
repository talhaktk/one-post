const express = require('express')
const router = express.Router()
const crypto = require('crypto')

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

// Generate a unique state token
const genState = () => crypto.randomBytes(16).toString('hex')

router.get('/oauth-url/:platform', async (req, res) => {
  try {
    const { platform } = req.params
    const { user_id } = req.query
    const provider = OAUTH_PROVIDERS[platform === 'tiktok_new' ? 'tiktok' : platform]
    if (!provider) return res.status(400).json({ error: 'Unknown platform' })

    let result
    if (platform === 'twitter') {
      result = await provider.getAuthUrl()
      // Merge user_id into the Twitter-generated state record
      oauthStore[result.state] = { codeVerifier: result.codeVerifier, user_id }
    } else {
      const state = genState()
      oauthStore[state] = { user_id }
      result = { url: await provider.getAuthUrl(state) }
    }
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Shared callback logic for all platforms
async function handleCallback(platform, { code, state, user_id }, stored) {
  const basePlatform = platform === 'tiktok_new' ? 'tiktok' : platform

  if (basePlatform === 'youtube') {
    const tokens = await OAUTH_PROVIDERS.youtube.exchangeCode(code)
    await supabase.from('connected_platforms').upsert({
      user_id, platform: 'youtube',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      is_active: true, connected_at: new Date().toISOString()
    }, { onConflict: 'user_id,platform' })
  }

  if (basePlatform === 'facebook') {
    const tokens = await OAUTH_PROVIDERS.facebook.exchangeCode(code)
    const { data: platformData } = await supabase.from('connected_platforms').upsert({
      user_id, platform: 'facebook',
      access_token: tokens.access_token,
      is_active: true, connected_at: new Date().toISOString()
    }, { onConflict: 'user_id,platform' }).select('id').single()

    const pages = await OAUTH_PROVIDERS.facebook.getAllPages(tokens.access_token)
    if (pages.length && platformData?.id) {
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

  if (basePlatform === 'instagram') {
    const tokens = await OAUTH_PROVIDERS.instagram.exchangeCode(code)
    await supabase.from('connected_platforms').upsert({
      user_id, platform: 'instagram',
      access_token: tokens.access_token,
      is_active: true, connected_at: new Date().toISOString()
    }, { onConflict: 'user_id,platform' })
  }

  if (basePlatform === 'tiktok') {
    const tokens = await OAUTH_PROVIDERS.tiktok.exchangeCode(code)
    const userInfo = await OAUTH_PROVIDERS.tiktok.getUserInfo(tokens.access_token)
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

  if (basePlatform === 'twitter') {
    const tokens = await OAUTH_PROVIDERS.twitter.exchangeCode(code, stored.codeVerifier)
    await supabase.from('connected_platforms').upsert({
      user_id, platform: 'twitter',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      is_active: true, connected_at: new Date().toISOString()
    }, { onConflict: 'user_id,platform' })
    delete oauthStore[state]
  }
}

// GET — used by platforms that redirect back (Facebook, Google, TikTok, Twitter)
router.get('/oauth-callback/:platform', async (req, res) => {
  const { platform } = req.params
  const { code, state, error } = req.query
  const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173'

  if (error || !code) {
    return res.redirect(`${FRONTEND}/accounts?error=${encodeURIComponent(error || 'no_code')}`)
  }

  const stored = oauthStore[state] || {}
  const user_id = stored.user_id

  if (!user_id) {
    return res.redirect(`${FRONTEND}/accounts?error=session_expired`)
  }

  try {
    await handleCallback(platform, { code, state, user_id }, stored)
    delete oauthStore[state]
    res.redirect(`${FRONTEND}/accounts?connected=${platform}`)
  } catch (err) {
    console.error('OAuth callback error:', err)
    res.redirect(`${FRONTEND}/accounts?error=${encodeURIComponent(err.message)}`)
  }
})

// POST — kept for manual/API-driven flows
router.post('/oauth-callback/:platform', async (req, res) => {
  try {
    const { platform } = req.params
    const { code, state, user_id } = req.body
    const stored = oauthStore[state] || {}
    await handleCallback(platform, { code, state, user_id }, stored)
    res.json({ success: true, platform })
  } catch (err) {
    console.error('OAuth callback error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
