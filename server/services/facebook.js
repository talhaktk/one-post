const axios = require('axios')
const fs = require('fs')
const { wait, retry } = require('./helpers')
const cfg = require('./configService')

const BASE = 'https://graph.facebook.com/v18.0'

const getAuthUrl = async (state) => {
  const params = new URLSearchParams({
    client_id: await cfg.get('META_APP_ID'),
    redirect_uri: process.env.META_REDIRECT_URI,
    scope: 'pages_manage_posts,pages_read_engagement,pages_show_list,business_management',
    response_type: 'code',
    state: state || 'facebook'
  })
  return `https://www.facebook.com/dialog/oauth?${params}`
}

const exchangeCode = async (code) => {
  const res = await axios.get(`${BASE}/oauth/access_token`, {
    params: { client_id: await cfg.get('META_APP_ID'), client_secret: await cfg.get('META_APP_SECRET'), redirect_uri: process.env.META_REDIRECT_URI, code }
  })
  return res.data
}

const getAllPages = async (accessToken) => {
  const pages = []
  let url = `${BASE}/me/accounts?limit=200&fields=id,name,picture,category,fan_count,access_token`
  while (url) {
    const res = await axios.get(url, { params: { access_token: accessToken } })
    pages.push(...(res.data.data || []))
    url = res.data.paging?.next || null
  }
  return pages
}

const uploadVideoToPage = async (pageAccessToken, pageId, { videoPath, title, description }) => {
  const FormData = require('form-data')
  const formData = new FormData()
  formData.append('source', fs.createReadStream(videoPath))
  formData.append('title', title || '')
  formData.append('description', description || '')
  formData.append('published', 'true')
  formData.append('access_token', pageAccessToken)
  const res = await axios.post(`${BASE}/${pageId}/videos`, formData, {
    headers: formData.getHeaders ? formData.getHeaders() : { 'Content-Type': 'multipart/form-data' },
    maxContentLength: Infinity, maxBodyLength: Infinity
  })
  return { post_id: res.data.id, post_url: `https://www.facebook.com/${pageId}/videos/${res.data.id}` }
}

const uploadToAllPages = async (pages, videoPath, title, description, delaySeconds = 30, onProgress) => {
  const results = []
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    if (i > 0) {
      for (let countdown = delaySeconds; countdown > 0; countdown--) {
        onProgress && onProgress({ type: 'countdown', target_id: `fb_${page.page_id}`, countdown, next_page: pages[i]?.page_name })
        await wait(1)
      }
    }
    try {
      const result = await retry(async () => {
        onProgress && onProgress({ type: 'progress', platform: 'facebook', target_id: `fb_${page.page_id}`, target_name: page.page_name, status: 'uploading', progress: 0 })
        return await uploadVideoToPage(page.page_access_token, page.page_id, { videoPath, title, description })
      }, 3, 60)
      results.push({ page_id: page.page_id, page_name: page.page_name, status: 'published', ...result })
      onProgress && onProgress({ type: 'progress', platform: 'facebook', target_id: `fb_${page.page_id}`, target_name: page.page_name, status: 'published', progress: 100, post_url: result.post_url })
    } catch (err) {
      results.push({ page_id: page.page_id, page_name: page.page_name, status: 'failed', error: err.message })
      onProgress && onProgress({ type: 'progress', platform: 'facebook', target_id: `fb_${page.page_id}`, target_name: page.page_name, status: 'failed', error_message: err.message })
    }
  }
  return results
}

const uploadPhotoToPage = async (pageAccessToken, pageId, { imageUrl, caption }) => {
  const res = await axios.post(`${BASE}/${pageId}/photos`, null, {
    params: { url: imageUrl, caption: caption || '', access_token: pageAccessToken }
  })
  return { post_id: res.data.id, post_url: `https://www.facebook.com/${pageId}/posts/${res.data.post_id || res.data.id}` }
}

const uploadPhotosToAllPages = async (pages, imageUrl, caption, delaySeconds = 30, onProgress) => {
  const results = []
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    if (i > 0) {
      for (let countdown = delaySeconds; countdown > 0; countdown--) {
        onProgress && onProgress({ type: 'countdown', target_id: `fb_${page.page_id}`, countdown, next_page: pages[i]?.page_name })
        await wait(1)
      }
    }
    try {
      const result = await retry(async () => {
        onProgress && onProgress({ type: 'progress', platform: 'facebook', target_id: `fb_${page.page_id}`, target_name: page.page_name, status: 'uploading', progress: 0 })
        return await uploadPhotoToPage(page.page_access_token, page.page_id, { imageUrl, caption })
      }, 3, 30)
      results.push({ page_id: page.page_id, page_name: page.page_name, status: 'published', ...result })
      onProgress && onProgress({ type: 'progress', platform: 'facebook', target_id: `fb_${page.page_id}`, target_name: page.page_name, status: 'published', progress: 100, post_url: result.post_url })
    } catch (err) {
      results.push({ page_id: page.page_id, page_name: page.page_name, status: 'failed', error: err.message })
      onProgress && onProgress({ type: 'progress', platform: 'facebook', target_id: `fb_${page.page_id}`, target_name: page.page_name, status: 'failed', error_message: err.message })
    }
  }
  return results
}

module.exports = { getAuthUrl, exchangeCode, getAllPages, uploadVideoToPage, uploadToAllPages, uploadPhotoToPage, uploadPhotosToAllPages }
