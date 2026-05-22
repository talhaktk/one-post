const supabase = require('../lib/supabase')

const cache = {}
let cacheTime = 0
const CACHE_TTL = 60 * 1000 // 1 minute

const getAll = async () => {
  if (Date.now() - cacheTime < CACHE_TTL) return cache
  const { data } = await supabase.from('app_config').select('key, value')
  if (data) {
    data.forEach(row => { cache[row.key] = row.value })
    cacheTime = Date.now()
  }
  return cache
}

const get = async (key) => {
  const cfg = await getAll()
  return cfg[key] || process.env[key.toUpperCase()] || null
}

const setMany = async (pairs) => {
  const rows = Object.entries(pairs).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }))
  await supabase.from('app_config').upsert(rows, { onConflict: 'key' })
  // Bust cache
  Object.assign(cache, pairs)
  cacheTime = Date.now()
}

module.exports = { get, getAll, setMany }
