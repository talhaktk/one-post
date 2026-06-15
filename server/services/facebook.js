const axios = require('axios')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { v4: uuidv4 } = require('uuid')
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
  try {
    while (url) {
      const res = await axios.get(url, { params: { access_token: accessToken } })
      pages.push(...(res.data.data || []))
      url = res.data.paging?.next || null
    }
    return pages
  } catch (err) {
    const fbErr = err.response?.data?.error
    if (fbErr) {
      const isExpired = fbErr.code === 190 || /expired|invalid|session/i.test(fbErr.message || '')
      const msg = isExpired
        ? `Facebook session expired. Please reconnect Facebook. (${fbErr.message})`
        : `${fbErr.message} (FB code ${fbErr.code})`
      const e = new Error(msg)
      e.fbCode = fbErr.code
      e.fbExpired = isExpired
      throw e
    }
    throw err
  }
}

// Quick health check — does the access token still work?
const checkTokenHealth = async (accessToken) => {
  try {
    const res = await axios.get(`${BASE}/me`, { params: { access_token: accessToken, fields: 'id,name' } })
    return { ok: true, user: res.data }
  } catch (err) {
    const fbErr = err.response?.data?.error
    return { ok: false, error: fbErr?.message || err.message, code: fbErr?.code }
  }
}

const uploadVideoToPageByUrl = async (pageAccessToken, pageId, { videoUrl, title, description }) => {
  try {
    const res = await axios.post(`${BASE}/${pageId}/videos`, null, {
      params: { file_url: videoUrl, title: title || '', description: description || '', published: 'true', access_token: pageAccessToken },
      timeout: 90_000 // 90s — Facebook usually responds in seconds; if it hangs longer, fail and retry
    })
    return { post_id: res.data.id, post_url: `https://www.facebook.com/${pageId}/videos/${res.data.id}` }
  } catch (err) {
    if (err.code === 'ECONNABORTED') throw new Error('Facebook timed out fetching the video URL after 90s')
    const fbErr = err.response?.data?.error
    const msg = fbErr ? `${fbErr.message} (FB code ${fbErr.code})` : err.message
    throw new Error(msg)
  }
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

const uploadToAllPagesByUrl = async (pages, videoUrl, title, description, delaySeconds = 30, onProgress) => {
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
      onProgress && onProgress({ type: 'progress', platform: 'facebook', target_id: `fb_${page.page_id}`, target_name: page.page_name, status: 'uploading', progress: 20 })
      const result = await retry(
        () => uploadVideoToPageByUrl(page.page_access_token, page.page_id, { videoUrl, title, description }),
        3, 15,
        ({ attempt, maxRetries, error }) => onProgress && onProgress({
          type: 'progress', platform: 'facebook',
          target_id: `fb_${page.page_id}`, target_name: page.page_name,
          status: 'uploading', progress: 10,
          error_message: `Retry ${attempt}/${maxRetries - 1}: ${error}`
        })
      )
      results.push({ page_id: page.page_id, page_name: page.page_name, status: 'published', ...result })
      onProgress && onProgress({ type: 'progress', platform: 'facebook', target_id: `fb_${page.page_id}`, target_name: page.page_name, status: 'published', progress: 100, post_url: result.post_url })
    } catch (err) {
      results.push({ page_id: page.page_id, page_name: page.page_name, status: 'failed', error: err.message })
      onProgress && onProgress({ type: 'progress', platform: 'facebook', target_id: `fb_${page.page_id}`, target_name: page.page_name, status: 'failed', error_message: err.message })
    }
  }
  return results
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
  const fetch = require('node-fetch')
  const FormData = require('form-data')
  // Download to temp file so Facebook doesn't need to reach our private storage URL
  const response = await fetch(imageUrl, { timeout: 60_000 })
  if (!response.ok) throw new Error(`Failed to download image: HTTP ${response.status}`)
  const buffer = await response.buffer()
  const tmpPath = path.join(os.tmpdir(), `fb_img_${uuidv4()}.jpg`)
  fs.writeFileSync(tmpPath, buffer)
  try {
    const formData = new FormData()
    formData.append('source', fs.createReadStream(tmpPath))
    formData.append('caption', caption || '')
    formData.append('access_token', pageAccessToken)
    const res = await axios.post(`${BASE}/${pageId}/photos`, formData, {
      headers: formData.getHeaders ? formData.getHeaders() : { 'Content-Type': 'multipart/form-data' },
      maxContentLength: Infinity, maxBodyLength: Infinity,
      timeout: 60_000
    })
    return { post_id: res.data.id, post_url: `https://www.facebook.com/${pageId}/posts/${res.data.post_id || res.data.id}` }
  } catch (err) {
    if (err.code === 'ECONNABORTED') throw new Error('Facebook timed out uploading the image after 60s')
    const fbErr = err.response?.data?.error
    const msg = fbErr ? `${fbErr.message} (FB code ${fbErr.code})` : err.message
    throw new Error(msg)
  } finally {
    try { fs.unlinkSync(tmpPath) } catch {}
  }
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
      onProgress && onProgress({ type: 'progress', platform: 'facebook', target_id: `fb_${page.page_id}`, target_name: page.page_name, status: 'uploading', progress: 20 })
      const result = await retry(
        () => uploadPhotoToPage(page.page_access_token, page.page_id, { imageUrl, caption }),
        3, 15,
        ({ attempt, maxRetries, error }) => onProgress && onProgress({
          type: 'progress', platform: 'facebook',
          target_id: `fb_${page.page_id}`, target_name: page.page_name,
          status: 'uploading', progress: 10,
          error_message: `Retry ${attempt}/${maxRetries - 1}: ${error}`
        })
      )
      results.push({ page_id: page.page_id, page_name: page.page_name, status: 'published', ...result })
      onProgress && onProgress({ type: 'progress', platform: 'facebook', target_id: `fb_${page.page_id}`, target_name: page.page_name, status: 'published', progress: 100, post_url: result.post_url })
    } catch (err) {
      results.push({ page_id: page.page_id, page_name: page.page_name, status: 'failed', error: err.message })
      onProgress && onProgress({ type: 'progress', platform: 'facebook', target_id: `fb_${page.page_id}`, target_name: page.page_name, status: 'failed', error_message: err.message })
    }
  }
  return results
}

module.exports = { getAuthUrl, exchangeCode, getAllPages, checkTokenHealth, uploadVideoToPageByUrl, uploadVideoToPage, uploadToAllPagesByUrl, uploadToAllPages, uploadPhotoToPage, uploadPhotosToAllPages }
