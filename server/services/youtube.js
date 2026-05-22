const { google } = require('googleapis')
const fs = require('fs')

const createOAuthClient = () => new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  process.env.YOUTUBE_REDIRECT_URI
)

const getAuthUrl = () => {
  const client = createOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/youtube.upload'],
    prompt: 'consent'
  })
}

const exchangeCode = async (code) => {
  const client = createOAuthClient()
  const { tokens } = await client.getToken(code)
  return tokens
}

const uploadVideo = async (accessToken, refreshToken, { filePath, title, description, tags, thumbnail }) => {
  const client = createOAuthClient()
  client.setCredentials({ access_token: accessToken, refresh_token: refreshToken })

  const youtube = google.youtube({ version: 'v3', auth: client })

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: { title, description, tags: tags || [], categoryId: '25' },
      status: { privacyStatus: 'public' }
    },
    media: { mimeType: 'video/*', body: fs.createReadStream(filePath) }
  }, {
    onUploadProgress: (evt) => {
      const progress = Math.round(evt.bytesRead / evt.contentLength * 100)
      // Emit via SSE if needed
    }
  })

  return { post_id: res.data.id, post_url: `https://www.youtube.com/watch?v=${res.data.id}` }
}

module.exports = { getAuthUrl, exchangeCode, uploadVideo }
