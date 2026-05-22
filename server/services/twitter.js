const { TwitterApi } = require('twitter-api-v2')
const fs = require('fs')

const getAuthUrl = async () => {
  const client = new TwitterApi({ clientId: process.env.TWITTER_CLIENT_ID, clientSecret: process.env.TWITTER_CLIENT_SECRET })
  const { url, codeVerifier, state } = client.generateOAuth2AuthLink(process.env.TWITTER_REDIRECT_URI, {
    scope: ['tweet.write', 'users.read', 'offline.access', 'media.write']
  })
  return { url, codeVerifier, state }
}

const exchangeCode = async (code, codeVerifier) => {
  const client = new TwitterApi({ clientId: process.env.TWITTER_CLIENT_ID, clientSecret: process.env.TWITTER_CLIENT_SECRET })
  const { accessToken, refreshToken, expiresIn } = await client.loginWithOAuth2({ code, codeVerifier, redirectUri: process.env.TWITTER_REDIRECT_URI })
  return { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn }
}

const uploadAndTweet = async (accessToken, { videoPath, text, hashtags }) => {
  const client = new TwitterApi(accessToken)
  const rwClient = client.readWrite

  // Upload media
  const mediaId = await rwClient.v1.uploadMedia(videoPath, { mimeType: 'video/mp4' })

  // Create tweet
  const tweetText = `${text} ${hashtags.map(t => `#${t}`).join(' ')}`.slice(0, 280)
  const tweet = await rwClient.v2.tweet({ text: tweetText, media: { media_ids: [mediaId] } })

  return { post_id: tweet.data.id, post_url: `https://twitter.com/i/status/${tweet.data.id}` }
}

module.exports = { getAuthUrl, exchangeCode, uploadAndTweet }
