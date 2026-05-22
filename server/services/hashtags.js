const axios = require('axios')
const xml2js = require('xml2js')
const Anthropic = require('@anthropic-ai/sdk')

const getAnthropic = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'placeholder' })

const getTwitterBearerToken = async () => {
  if (process.env.TWITTER_BEARER_TOKEN) return process.env.TWITTER_BEARER_TOKEN
  const cfg = require('./configService')
  const clientId = await cfg.get('TWITTER_CLIENT_ID')
  const clientSecret = await cfg.get('TWITTER_CLIENT_SECRET')
  if (!clientId || !clientSecret) return null
  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await axios.post('https://api.twitter.com/oauth2/token',
    'grant_type=client_credentials',
    { headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  return res.data.access_token
}

const fetchTwitterTrends = async () => {
  try {
    const token = await getTwitterBearerToken()
    if (!token) return []
    const res = await axios.get('https://api.twitter.com/1.1/trends/place.json?id=23424922', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const trends = res.data[0]?.trends || []
    return trends.slice(0, 20).map(t => ({ tag: t.name.replace(/^#/, ''), volume: t.tweet_volume || 0 }))
  } catch (err) {
    console.error('Twitter trends error:', err.message)
    return []
  }
}

const fetchGoogleTrends = async () => {
  const URLS = [
    'https://trends.google.com/trending/rss?geo=PK',
    'https://trends.google.com/trends/trendingsearches/daily/rss?geo=PK'
  ]
  const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    'Accept-Language': 'en-US,en;q=0.9'
  }
  for (const url of URLS) {
    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: 8000 })
      const parsed = await xml2js.parseStringPromise(res.data)
      const items = parsed.rss?.channel?.[0]?.item || []
      const tags = items.slice(0, 20).map(item => ({
        tag: (item.title?.[0] || '').replace(/\s+/g, '_').replace(/[^\w_]/g, ''),
        volume: parseInt(item['ht:approx_traffic']?.[0] || '0') || 0
      })).filter(t => t.tag)
      if (tags.length) return tags
    } catch {}
  }
  // Fallback: Pakistan trending topics
  return [
    { tag: 'Pakistan', volume: 0 }, { tag: 'Islamabad', volume: 0 }, { tag: 'Lahore', volume: 0 },
    { tag: 'PTI', volume: 0 }, { tag: 'PMLN', volume: 0 }, { tag: 'ImranKhan', volume: 0 },
    { tag: 'PakistanNews', volume: 0 }, { tag: 'BreakingNews', volume: 0 }
  ]
}

const fetchTikTokTrends = async () => {
  try {
    const res = await axios.get('https://ads.tiktok.com/business/creativecenter/trending-hashtag/pc/en', {
      headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000
    })
    const matches = res.data.match(/"hashtag_name":"([^"]+)"/g) || []
    return matches.slice(0, 20).map(m => ({ tag: m.match(/"hashtag_name":"([^"]+)"/)?.[1] || '', volume: 0 })).filter(t => t.tag)
  } catch {
    return [
      { tag: 'Pakistan', volume: 0 }, { tag: 'PTI', volume: 0 }, { tag: 'ImranKhan', volume: 0 },
      { tag: 'PakistanPolitics', volume: 0 }, { tag: 'PMLN', volume: 0 }
    ]
  }
}

const getInstagramPreset = () => [
  { tag: 'Pakistan', volume: 0 }, { tag: 'PakistanPolitics', volume: 0 }, { tag: 'ImranKhan', volume: 0 },
  { tag: 'PTI', volume: 0 }, { tag: 'PakistanNews', volume: 0 }, { tag: 'PMLN', volume: 0 },
  { tag: 'PPP', volume: 0 }, { tag: 'Islamabad', volume: 0 }, { tag: 'Lahore', volume: 0 },
  { tag: 'Karachi', volume: 0 }, { tag: 'پاکستان', volume: 0 }, { tag: 'سیاست', volume: 0 },
  { tag: 'عمرانخان', volume: 0 }, { tag: 'BreakingNews', volume: 0 }, { tag: 'Politics', volume: 0 }
]

const getYouTubePreset = () => [
  { tag: 'PakistanPolitics', volume: 0 }, { tag: 'PTI', volume: 0 }, { tag: 'ImranKhan', volume: 0 },
  { tag: 'PMLN', volume: 0 }, { tag: 'PPP', volume: 0 }, { tag: 'PakistanNews', volume: 0 },
  { tag: 'Pakistan', volume: 0 }, { tag: 'BreakingNews', volume: 0 }, { tag: 'Islamabad', volume: 0 },
  { tag: 'LiveNews', volume: 0 }, { tag: 'PakistaniPolitics', volume: 0 }, { tag: 'CurrentAffairs', volume: 0 }
]

const fetchAllTrending = async () => {
  const [twitter, google, tiktok] = await Promise.allSettled([
    fetchTwitterTrends(),
    fetchGoogleTrends(),
    fetchTikTokTrends()
  ])

  return {
    fetched_at: new Date().toISOString(),
    platforms: {
      twitter: twitter.status === 'fulfilled' ? twitter.value : [],
      google: google.status === 'fulfilled' ? google.value : [],
      tiktok: tiktok.status === 'fulfilled' ? tiktok.value : [],
      instagram: getInstagramPreset(),
      youtube: getYouTubePreset()
    }
  }
}

const generateAISuggestions = async (title, description, category) => {
  const message = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Suggest 15 trending Pakistani political hashtags for this content:

Title: ${title}
Description: ${description || 'N/A'}
Category: ${category || 'Politics'}

Mix English and Urdu hashtags. Make them relevant to Pakistan politics, news, and current affairs.
Return ONLY a valid JSON array of strings, no explanation:
["hashtag1", "hashtag2", ...]`
    }]
  })

  const text = message.content[0].text.trim()
  const match = text.match(/\[[\s\S]*\]/)
  if (match) {
    const arr = JSON.parse(match[0])
    return arr.map(t => t.replace(/^#/, '').trim()).filter(Boolean)
  }
  return []
}

module.exports = { fetchAllTrending, generateAISuggestions }
