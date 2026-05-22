const axios = require('axios')
const cfg = require('./configService')

const BASE = 'https://graph.facebook.com/v18.0'

const getAuthUrl = async () => {
  const params = new URLSearchParams({
    client_id: await cfg.get('META_APP_ID'),
    redirect_uri: process.env.META_REDIRECT_URI,
    scope: 'instagram_basic,instagram_content_publish,pages_show_list',
    response_type: 'code',
    state: 'instagram'
  })
  return `https://www.facebook.com/dialog/oauth?${params}`
}

const exchangeCode = async (code) => {
  const res = await axios.get(`${BASE}/oauth/access_token`, {
    params: { client_id: await cfg.get('META_APP_ID'), client_secret: await cfg.get('META_APP_SECRET'), redirect_uri: process.env.META_REDIRECT_URI, code }
  })
  return res.data
}

const getInstagramAccountId = async (accessToken) => {
  const res = await axios.get(`${BASE}/me/accounts`, { params: { access_token: accessToken } })
  const page = res.data.data[0]
  if (!page) throw new Error('No Facebook page found')
  const igRes = await axios.get(`${BASE}/${page.id}`, { params: { fields: 'instagram_business_account', access_token: page.access_token } })
  return igRes.data.instagram_business_account?.id
}

const uploadReel = async (accessToken, igAccountId, { videoUrl, caption }) => {
  const containerRes = await axios.post(`${BASE}/${igAccountId}/media`, {
    video_url: videoUrl, caption, media_type: 'REELS', access_token: accessToken
  })
  const containerId = containerRes.data.id
  let status = ''
  while (status !== 'FINISHED') {
    await new Promise(r => setTimeout(r, 5000))
    const check = await axios.get(`${BASE}/${containerId}`, { params: { fields: 'status_code', access_token: accessToken } })
    status = check.data.status_code
    if (status === 'ERROR') throw new Error('Instagram container processing failed')
  }
  const publishRes = await axios.post(`${BASE}/${igAccountId}/media_publish`, { creation_id: containerId, access_token: accessToken })
  return { post_id: publishRes.data.id, post_url: `https://www.instagram.com/p/${publishRes.data.id}/` }
}

module.exports = { getAuthUrl, exchangeCode, getInstagramAccountId, uploadReel }
