const axios = require('axios')
const xml2js = require('xml2js')
const Anthropic = require('@anthropic-ai/sdk')
const thumbnailGenerator = require('./thumbnailGenerator')
const pushNotification = require('./pushNotification')

const supabase = require('../lib/supabase')
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

let isRunning = false

const RSS_FEEDS = [
  { name: 'GEO News', url: 'https://www.geo.tv/rss', language: 'urdu' },
  { name: 'ARY News', url: 'https://urdu.arynews.tv/feed', language: 'urdu' },
  { name: 'Dawn', url: 'https://www.dawn.com/feeds/home', language: 'english' },
  { name: 'Express News', url: 'https://www.express.pk/feed', language: 'urdu' },
  { name: 'Samaa TV', url: 'https://www.samaa.tv/feed', language: 'urdu' },
  { name: 'Dunya News', url: 'https://dunyanews.tv/feed', language: 'urdu' },
  { name: 'BOL News', url: 'https://www.bolnews.com/feed', language: 'urdu' },
  { name: 'The News', url: 'https://www.thenews.com.pk/rss', language: 'english' }
]

const fetchFeed = async ({ name, url, language }) => {
  try {
    const res = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'OnePost/1.0' } })
    const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: false })
    const items = parsed.rss?.channel?.item || []
    return (Array.isArray(items) ? items : [items]).map(item => ({
      source_name: name,
      language,
      headline: item.title || '',
      article_url: item.link || item.guid?.$text || item.guid || '',
      full_text: item.description || item['content:encoded'] || '',
      pubDate: item.pubDate || new Date().toISOString()
    }))
  } catch (err) {
    console.error(`RSS fetch failed for ${name}: ${err.message}`)
    return []
  }
}

const calculatePriority = async (headline, fullText) => {
  const { data: keywords } = await supabase.from('breaking_keywords').select('*').eq('is_active', true)
  if (!keywords?.length) return { score: 0, matched: [], priority: 'normal' }

  const text = `${headline} ${fullText}`.toLowerCase()
  let totalScore = 0
  const matched = []

  for (const kw of keywords) {
    if (text.includes(kw.keyword.toLowerCase())) {
      totalScore += kw.score
      matched.push(kw.keyword)
    }
  }

  let priority = 'normal'
  if (totalScore >= 20) priority = 'urgent'
  else if (totalScore >= 10) priority = 'breaking'
  else if (totalScore >= 5) priority = 'important'
  else if (totalScore >= 1) priority = 'normal'

  return { score: totalScore, matched, priority }
}

const generateCaptions = async (headline, sourceName, fullText) => {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `You are a Pakistan news social media manager.
Generate TWO captions for this breaking news:

Headline: ${headline}
Source: ${sourceName}
Full text: ${fullText?.slice(0, 500) || ''}

Generate:
1. Urdu caption (150 words max):
   - Start with 🚨 بریکنگ نیوز 🚨
   - News summary in simple Urdu
   - 5 relevant Urdu hashtags

2. English caption (150 words max):
   - Start with 🚨 BREAKING NEWS 🚨
   - News summary in simple English
   - 5 relevant English hashtags

Return ONLY valid JSON:
{"urdu": "caption here", "english": "caption here"}`
      }]
    })
    const text = message.content[0].text
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    return { urdu: `🚨 بریکنگ نیوز 🚨\n${headline}`, english: `🚨 BREAKING NEWS 🚨\n${headline}` }
  } catch (err) {
    console.error('Caption generation error:', err.message)
    return { urdu: `🚨 بریکنگ نیوز 🚨\n${headline}`, english: `🚨 BREAKING NEWS 🚨\n${headline}` }
  }
}

const processNewArticles = async (articles) => {
  if (!articles.length) return

  // Check which URLs are already seen
  const urls = articles.map(a => a.article_url).filter(Boolean)
  const { data: seen } = await supabase.from('seen_articles').select('article_url').in('article_url', urls)
  const seenUrls = new Set(seen?.map(s => s.article_url) || [])

  const newArticles = articles.filter(a => a.article_url && !seenUrls.has(a.article_url))
  if (!newArticles.length) return

  // Mark as seen
  await supabase.from('seen_articles').upsert(newArticles.map(a => ({ article_url: a.article_url })), { onConflict: 'article_url', ignoreDuplicates: true })

  for (const article of newArticles) {
    try {
      const { score, matched, priority } = await calculatePriority(article.headline, article.full_text)
      if (score < 1) continue

      const captions = await generateCaptions(article.headline, article.source_name, article.full_text)
      let thumbnailUrl = null
      try {
        thumbnailUrl = await thumbnailGenerator.generateBreakingThumbnail({
          headline: article.headline, sourceName: article.source_name, priority
        })
      } catch {}

      const { data: alertData } = await supabase.from('breaking_alerts').insert({
        source_name: article.source_name,
        headline: article.headline,
        article_url: article.article_url,
        full_text: article.full_text?.slice(0, 2000),
        priority, priority_score: score,
        keywords_matched: matched,
        generated_caption_urdu: captions.urdu,
        generated_caption_english: captions.english,
        thumbnail_url: thumbnailUrl,
        status: 'pending',
        detected_at: new Date().toISOString()
      }).select().single()

      if (alertData) {
        // Send push notification for urgent/breaking
        if (priority === 'urgent' || priority === 'breaking') {
          await pushNotification.sendBreakingAlert(alertData).catch(() => {})
        }
        // Broadcast via SSE (stored in module-level array)
        if (global.sseClients) {
          const msg = `data: ${JSON.stringify(alertData)}\n\n`
          global.sseClients.forEach(client => { try { client.write(msg) } catch {} })
        }
      }
    } catch (err) {
      console.error('Article processing error:', err.message)
    }
  }
}

const checkFeeds = async () => {
  if (isRunning) return
  isRunning = true
  console.log('[RSS Monitor] Checking feeds...')
  try {
    const results = await Promise.allSettled(RSS_FEEDS.map(fetchFeed))
    const all = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
    await processNewArticles(all)
  } catch (err) {
    console.error('[RSS Monitor] Error:', err.message)
  } finally {
    isRunning = false
  }
}

const start = () => {
  console.log('[RSS Monitor] Starting — checks every 2 minutes')
  checkFeeds()
  setInterval(checkFeeds, 2 * 60 * 1000)
}

module.exports = { start, checkFeeds }
