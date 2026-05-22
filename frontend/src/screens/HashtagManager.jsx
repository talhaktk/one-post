import { useState, useEffect } from 'react'
import { RefreshCw, Save, Copy, Sparkles, Loader, AlertCircle } from 'lucide-react'
import { usePost } from '../context/PostContext'
import { useNavigate } from 'react-router-dom'
import { fetchTrendingHashtags, fetchAIHashtags } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import HashtagChip from '../components/HashtagChip'
import toast from 'react-hot-toast'

const PLATFORMS = ['youtube', 'instagram', 'facebook', 'tiktok', 'twitter']
const PLATFORM_LIMITS = { youtube: 15, instagram: 30, facebook: 5, tiktok: 6, twitter: 3 }
const TREND_TABS = ['twitter', 'tiktok', 'google', 'instagram', 'youtube']
const PRESET_SETS = [
  { name: 'Pakistan Politics General', hashtags: ['PakistanPolitics', 'Pakistan', 'PTI', 'PMLN', 'PPP', 'ImranKhan', 'پاکستان', 'سیاست'] },
  { name: 'PTI Support', hashtags: ['PTI', 'ImranKhan', 'TehreekInsaf', 'عمران_خان', 'پی_ٹی_آئی', 'پاکستان', 'Justice', 'KaptaanForPM'] },
  { name: 'Breaking News Pakistan', hashtags: ['BreakingNews', 'Pakistan', 'بریکنگ_نیوز', 'پاکستان', 'لائیو', 'خبریں', 'ARYNews', 'GeoNews'] },
  { name: 'Pakistan Current Affairs', hashtags: ['PakistanNews', 'CurrentAffairs', 'Pakistani', 'پاکستان', 'آج_کی_خبریں', 'پارلیمنٹ', 'Islamabad'] }
]

export default function HashtagManager() {
  const { postState, updatePost } = usePost()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [trendTab, setTrendTab] = useState('twitter')
  const [platform, setPlatform] = useState('youtube')
  const [trending, setTrending] = useState(null)
  const [fetchedAt, setFetchedAt] = useState(null)
  const [loadingTrends, setLoadingTrends] = useState(false)
  const [loadingAI, setLoadingAI] = useState(false)
  const [aiTags, setAiTags] = useState([])
  const [savedSets, setSavedSets] = useState([])
  const [trendError, setTrendError] = useState(null)

  useEffect(() => {
    loadTrends()
    loadSavedSets()
  }, [])

  const loadTrends = async () => {
    setLoadingTrends(true)
    setTrendError(null)
    try {
      const data = await fetchTrendingHashtags()
      setTrending(data.platforms)
      setFetchedAt(new Date(data.fetched_at))
    } catch (err) {
      setTrendError('Could not fetch trends. Tap to retry.')
    } finally {
      setLoadingTrends(false)
    }
  }

  const loadSavedSets = async () => {
    if (!user) return
    const { data } = await supabase.from('saved_hashtag_sets').select('*').eq('user_id', user.id)
    setSavedSets(data || [])
  }

  const getAISuggestions = async () => {
    if (!postState.title) { toast.error('Add a title first'); return }
    setLoadingAI(true)
    try {
      const { hashtags } = await fetchAIHashtags(postState.title, postState.description, postState.category)
      setAiTags(hashtags || [])
    } catch (err) {
      toast.error('AI suggestion failed')
    } finally {
      setLoadingAI(false)
    }
  }

  const addTag = (tag, targetPlatform = platform) => {
    const clean = tag.replace(/^#/, '').trim()
    if (!clean) return
    const current = postState.hashtags[targetPlatform] || []
    const limit = PLATFORM_LIMITS[targetPlatform]
    if (current.includes(clean)) { toast.error('Already added'); return }
    if (current.length >= limit) { toast.error(`Max ${limit} hashtags for ${targetPlatform}`); return }
    updatePost({ hashtags: { ...postState.hashtags, [targetPlatform]: [...current, clean] } })
  }

  const removeTag = (tag, targetPlatform = platform) => {
    updatePost({ hashtags: { ...postState.hashtags, [targetPlatform]: postState.hashtags[targetPlatform].filter(t => t !== tag) } })
  }

  const copyFromTo = (from, to) => {
    const tags = postState.hashtags[from] || []
    const limit = PLATFORM_LIMITS[to]
    updatePost({ hashtags: { ...postState.hashtags, [to]: tags.slice(0, limit) } })
    toast.success(`Copied from ${from} to ${to}`)
  }

  const applyPreset = (preset) => {
    updatePost({ hashtags: { ...postState.hashtags, [platform]: preset.hashtags.slice(0, PLATFORM_LIMITS[platform]) } })
    toast.success(`Applied: ${preset.name}`)
  }

  const saveCurrentSet = async () => {
    const name = prompt('Set name:')
    if (!name || !user) return
    await supabase.from('saved_hashtag_sets').insert({ user_id: user.id, set_name: name, platform, hashtags: postState.hashtags[platform] })
    toast.success('Hashtag set saved')
    loadSavedSets()
  }

  const formatTime = (d) => d ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}` : ''

  const currentTrends = trending?.[trendTab] || []
  const currentHashtags = postState.hashtags[platform] || []
  const limit = PLATFORM_LIMITS[platform]

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ padding: '20px 0 12px' }}>
        <div style={{ fontSize: 22, fontFamily: 'Syne', fontWeight: 800 }}>Hashtag Manager</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Step 3 of 4</div>
      </div>

      {/* Trending Section */}
      <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>🔥 Trending Now in Pakistan</div>
            {fetchedAt && !loadingTrends && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                📍 Live trends — fetched at {formatTime(fetchedAt)}
              </div>
            )}
          </div>
          <button onClick={loadTrends} disabled={loadingTrends} style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: 0 }}>
            {loadingTrends ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
            {loadingTrends ? 'Fetching...' : 'Refresh'}
          </button>
        </div>

        {/* Source tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
          {TREND_TABS.map(t => (
            <button key={t} onClick={() => setTrendTab(t)} style={{ padding: '5px 12px', borderRadius: 999, border: 'none', background: trendTab === t ? '#7c3aed' : 'rgba(255,255,255,0.08)', color: trendTab === t ? 'white' : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s', textTransform: 'capitalize' }}>
              {t === 'twitter' ? '✖ X' : t === 'google' ? '🔍 Google' : `📱 ${t.charAt(0).toUpperCase() + t.slice(1)}`}
            </button>
          ))}
        </div>

        {loadingTrends ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            <Loader size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
            🔄 Fetching latest trends from X, TikTok, Google, Instagram, YouTube...
          </div>
        ) : trendError ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <AlertCircle size={20} color="#ef4444" style={{ margin: '0 auto 8px', display: 'block' }} />
            <div style={{ fontSize: 13, color: '#f87171', marginBottom: 10 }}>❌ {trendError}</div>
            <button onClick={loadTrends} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>Retry</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {currentTrends.slice(0, 20).map(t => (
              <HashtagChip key={t.tag || t} tag={t.tag || t} volume={t.volume} trending onAdd={(tag) => addTag(tag)} />
            ))}
            {currentTrends.length === 0 && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', padding: '8px 0' }}>No trends available for this source</div>}
          </div>
        )}
      </div>

      {/* AI Suggestions */}
      <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>✨ AI Hashtag Suggestions</div>
          <button onClick={getAISuggestions} disabled={loadingAI} style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {loadingAI ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} />}
            {loadingAI ? 'Generating...' : 'Generate'}
          </button>
        </div>
        {aiTags.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {aiTags.map(tag => <HashtagChip key={tag} tag={tag} onAdd={(t) => addTag(t)} />)}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Tap Generate to get AI-powered hashtag suggestions based on your video content.</div>
        )}
      </div>

      {/* Per Platform */}
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Per Platform Hashtags</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {PLATFORMS.map(p => (
          <button key={p} onClick={() => setPlatform(p)} style={{ padding: '6px 14px', borderRadius: 999, border: 'none', background: platform === p ? '#7c3aed' : 'rgba(255,255,255,0.08)', color: platform === p ? 'white' : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s', textTransform: 'capitalize' }}>
            {p} ({(postState.hashtags[p] || []).length}/{PLATFORM_LIMITS[p]})
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'capitalize' }}>{platform} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>(max {limit})</span></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => copyFromTo('twitter', platform)} style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Copy size={12} /> Copy from X</button>
            <button onClick={saveCurrentSet} style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Save size={12} /> Save Set</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {currentHashtags.map(tag => <HashtagChip key={tag} tag={tag} onRemove={(t) => removeTag(t)} />)}
          {currentHashtags.length === 0 && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>No hashtags added yet. Tap from trending or AI suggestions above.</div>}
        </div>

        {/* Quick add */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" style={{ fontSize: 13, padding: '10px 14px' }} placeholder="Type hashtag and press Enter..." onKeyDown={(e) => { if (e.key === 'Enter') { addTag(e.target.value); e.target.value = '' } }} />
        </div>
      </div>

      {/* Preset Sets */}
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>📦 Preset Sets</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {PRESET_SETS.map(set => (
          <button key={set.name} onClick={() => applyPreset(set)} style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: 'white', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{set.name}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{set.hashtags.length} tags → Apply</span>
          </button>
        ))}
      </div>

      {savedSets.length > 0 && (
        <>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>💾 My Saved Sets</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {savedSets.map(set => (
              <button key={set.id} onClick={() => applyPreset(set)} style={{ width: '100%', padding: '12px 14px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 12, color: 'white', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{set.set_name}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{set.hashtags?.length} tags · {set.platform} → Apply</span>
              </button>
            ))}
          </div>
        </>
      )}

      <button className="btn-primary" onClick={() => navigate('/targets')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        Next: Select Targets →
      </button>
    </div>
  )
}
