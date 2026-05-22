const axios = require('axios')
const fs = require('fs')
const { wait, retry } = require('./helpers')
const cfg = require('./configService')

const BASE = 'https://open.tiktokapis.com/v2'

const getAuthUrl = async (state) => {
  const params = new URLSearchParams({
    client_key: await cfg.get('TIKTOK_CLIENT_KEY'),
    redirect_uri: process.env.TIKTOK_REDIRECT_URI,
    response_type: 'code',
    scope: 'video.upload,user.info.basic',
    state: state || `tiktok_${Date.now()}`
  })
  return `https://www.tiktok.com/v2/auth/authorize/?${params}`
}

const exchangeCode = async (code) => {
  const res = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', new URLSearchParams({
    client_key: await cfg.get('TIKTOK_CLIENT_KEY'),
    client_secret: await cfg.get('TIKTOK_CLIENT_SECRET'),
    code, grant_type: 'authorization_code',
    redirect_uri: process.env.TIKTOK_REDIRECT_URI
  }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
  return res.data
}

const getUserInfo = async (accessToken) => {
  const res = await axios.get(`${BASE}/user/info/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { fields: 'open_id,union_id,avatar_url,display_name,follower_count' }
  })
  return res.data.data?.user
}

const uploadVideo = async (accessToken, { videoPath, title, description, hashtags }) => {
  const fileSize = fs.statSync(videoPath).size
  const initRes = await axios.post(`${BASE}/post/publish/video/init/`, {
    post_info: { title: `${title} ${hashtags.map(t => `#${t}`).join(' ')}`, privacy_level: 'PUBLIC_TO_EVERYONE', disable_duet: false, disable_comment: false, disable_stitch: false },
    source_info: { source: 'FILE_UPLOAD', video_size: fileSize, chunk_size: fileSize, total_chunk_count: 1 }
  }, { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' } })
  const { publish_id, upload_url } = initRes.data.data
  const videoBuffer = fs.readFileSync(videoPath)
  await axios.put(upload_url, videoBuffer, {
    headers: { 'Content-Type': 'video/mp4', 'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}` }
  })
  return { post_id: publish_id, post_url: 'https://www.tiktok.com' }
}

const uploadToAllAccounts = async (accounts, videoPath, title, description, hashtags, delaySeconds = 30, onProgress) => {
  const results = []
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i]
    if (i > 0) await wait(delaySeconds)
    try {
      const result = await retry(async () => {
        onProgress && onProgress({ type: 'progress', platform: 'tiktok', target_id: `tiktok_${account.id}`, target_name: account.account_label, status: 'uploading', progress: 50 })
        return await uploadVideo(account.access_token, { videoPath, title, description, hashtags })
      }, 3, 60)
      results.push({ account_id: account.id, account_label: account.account_label, status: 'published', ...result })
      onProgress && onProgress({ type: 'progress', platform: 'tiktok', target_id: `tiktok_${account.id}`, target_name: account.account_label, status: 'published', progress: 100 })
    } catch (err) {
      results.push({ account_id: account.id, account_label: account.account_label, status: 'failed', error: err.message })
      onProgress && onProgress({ type: 'progress', platform: 'tiktok', target_id: `tiktok_${account.id}`, target_name: account.account_label, status: 'failed', error_message: err.message })
    }
  }
  return results
}

module.exports = { getAuthUrl, exchangeCode, getUserInfo, uploadVideo, uploadToAllAccounts }
