import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, CheckSquare } from 'lucide-react'
import { usePost } from '../context/PostContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import FacebookPageItem from '../components/FacebookPageItem'
import TikTokAccountItem from '../components/TikTokAccountItem'
import toast from 'react-hot-toast'

const PLATFORMS_CONFIG = [
  { key: 'youtube', label: 'YouTube', icon: '▶️', color: '#FF0000' },
  { key: 'instagram_reels', label: 'Instagram Reels', icon: '🎬', color: '#E1306C' },
  { key: 'instagram_feed', label: 'Instagram Feed', icon: '📸', color: '#833AB4' },
  { key: 'facebook', label: 'Facebook Pages', icon: '🔵', color: '#1877F2' },
  { key: 'tiktok', label: 'TikTok', icon: '🎵', color: '#69C9D0' },
  { key: 'twitter', label: 'X (Twitter)', icon: '✖️', color: '#FFFFFF' }
]

const POST_DELAYS = [10, 30, 60, 120]

export default function SelectTargets() {
  const navigate = useNavigate()
  const { postState, updatePost } = usePost()
  const { user, profile } = useAuth()
  const [fbPages, setFbPages] = useState([])
  const [tikTokAccounts, setTikTokAccounts] = useState([])
  const [fbSearch, setFbSearch] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [postDelay, setPostDelay] = useState(profile?.post_delay_seconds || 30)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) loadAccounts() }, [user])

  const loadAccounts = async () => {
    setLoading(true)
    const [pages, tik] = await Promise.all([
      supabase.from('facebook_pages').select('*').eq('user_id', user.id).eq('is_active', true).eq('is_selected_default', true).order('fan_count', { ascending: false }),
      supabase.from('tiktok_accounts').select('*').eq('user_id', user.id).eq('is_active', true)
    ])
    setFbPages(pages.data || [])
    setTikTokAccounts(tik.data || [])
    if (pages.data) updatePost({ selectedFacebookPages: pages.data.map(p => p.page_id) })
    if (tik.data) updatePost({ selectedTikTokAccounts: tik.data.map(a => a.id) })
    setLoading(false)
  }

  const toggleTarget = (key) => {
    updatePost({ targets: { ...postState.targets, [key]: !postState.targets[key] } })
  }

  const toggleFbPage = (pageId) => {
    const set = new Set(postState.selectedFacebookPages)
    set.has(pageId) ? set.delete(pageId) : set.add(pageId)
    updatePost({ selectedFacebookPages: [...set] })
  }

  const toggleTikTok = (accId) => {
    const set = new Set(postState.selectedTikTokAccounts)
    set.has(accId) ? set.delete(accId) : set.add(accId)
    updatePost({ selectedTikTokAccounts: [...set] })
  }

  const selectAllFb = () => {
    updatePost({ selectedFacebookPages: fbPages.map(p => p.page_id) })
    toast.success(`All ${fbPages.length} pages selected`)
  }

  const calcEstimatedReach = () => {
    let reach = 0
    if (postState.targets.facebook) reach += fbPages.filter(p => postState.selectedFacebookPages.includes(p.page_id)).reduce((s, p) => s + (p.fan_count || 0), 0)
    if (postState.targets.tiktok) reach += tikTokAccounts.filter(a => postState.selectedTikTokAccounts.includes(a.id)).reduce((s, a) => s + (a.follower_count || 0), 0)
    return reach.toLocaleString()
  }

  const calcEstimatedTime = () => {
    const fbCount = postState.targets.facebook ? postState.selectedFacebookPages.length : 0
    const tikCount = postState.targets.tiktok ? postState.selectedTikTokAccounts.length : 0
    const total = fbCount + tikCount + (postState.targets.youtube ? 1 : 0) + (postState.targets.instagram_reels ? 1 : 0) + (postState.targets.twitter ? 1 : 0)
    const seconds = total * postDelay
    if (seconds < 60) return `~${seconds} seconds`
    return `~${Math.round(seconds / 60)} minutes`
  }

  const handlePublish = () => {
    const anySelected = Object.values(postState.targets).some(Boolean)
    if (!anySelected) { toast.error('Select at least one platform'); return }
    updatePost({ scheduledAt: scheduledAt || null, postDelay })
    navigate('/publishing')
  }

  const filteredFbPages = fbPages.filter(p => p.page_name.toLowerCase().includes(fbSearch.toLowerCase()))
  const selectedCount = Object.values(postState.targets).filter(Boolean).length

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ padding: '20px 0 16px' }}>
        <div style={{ fontSize: 22, fontFamily: 'Syne', fontWeight: 800 }}>Select Targets</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Step 4 of 4 — Choose where to publish</div>
      </div>

      {/* Platform toggles */}
      <div style={{ marginBottom: 20 }}>
        {PLATFORMS_CONFIG.map(({ key, label, icon, color }) => {
          const enabled = postState.targets[key]
          return (
            <div key={key}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: enabled ? `${color}10` : 'rgba(255,255,255,0.03)', border: `1px solid ${enabled ? `${color}30` : 'rgba(255,255,255,0.06)'}`, borderRadius: 12, marginBottom: 8, cursor: 'pointer' }} onClick={() => toggleTarget(key)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{icon}</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
                </div>
                <div className={`toggle ${enabled ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleTarget(key) }} />
              </div>

              {/* FB Pages expanded */}
              {key === 'facebook' && enabled && (
                <div className="card" style={{ padding: '14px', marginBottom: 8, marginTop: -4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{postState.selectedFacebookPages.length} of {fbPages.length} pages selected</span>
                    <button onClick={selectAllFb} style={{ background: 'none', border: 'none', color: '#1877F2', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><CheckSquare size={14} /> Select All</button>
                  </div>
                  <div style={{ position: 'relative', marginBottom: 10 }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                    <input className="input" style={{ paddingLeft: 32, padding: '8px 8px 8px 32px', fontSize: 13 }} placeholder="Search pages..." value={fbSearch} onChange={e => setFbSearch(e.target.value)} />
                  </div>
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {filteredFbPages.map(page => (
                      <FacebookPageItem key={page.id} page={page} selected={postState.selectedFacebookPages.includes(page.page_id)} onToggle={toggleFbPage} />
                    ))}
                  </div>
                </div>
              )}

              {/* TikTok accounts expanded */}
              {key === 'tiktok' && enabled && (
                <div className="card" style={{ padding: '14px', marginBottom: 8, marginTop: -4 }}>
                  {tikTokAccounts.map(acc => (
                    <TikTokAccountItem key={acc.id} account={acc} selected={postState.selectedTikTokAccounts.includes(acc.id)} onToggle={toggleTikTok} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Schedule */}
      <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📅 Schedule</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setScheduledAt('')} style={{ flex: 1, padding: 12, borderRadius: 10, border: `1px solid ${!scheduledAt ? '#7c3aed' : 'rgba(255,255,255,0.1)'}`, background: !scheduledAt ? 'rgba(124,58,237,0.15)' : 'transparent', color: !scheduledAt ? '#c4b5fd' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            🚀 Publish Now
          </button>
          <button onClick={() => setScheduledAt(new Date(Date.now() + 3600000).toISOString().slice(0, 16))} style={{ flex: 1, padding: 12, borderRadius: 10, border: `1px solid ${scheduledAt ? '#7c3aed' : 'rgba(255,255,255,0.1)'}`, background: scheduledAt ? 'rgba(124,58,237,0.15)' : 'transparent', color: scheduledAt ? '#c4b5fd' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            📅 Schedule
          </button>
        </div>
        {scheduledAt && (
          <input type="datetime-local" className="input" style={{ marginTop: 12 }} value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
        )}
      </div>

      {/* Delay settings */}
      <div className="card" style={{ padding: '16px', marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>⏱️ Delay Between Posts</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>Recommended: 30 seconds to avoid rate limits</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {POST_DELAYS.map(d => (
            <button key={d} onClick={() => setPostDelay(d)} style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `1px solid ${postDelay === d ? '#7c3aed' : 'rgba(255,255,255,0.1)'}`, background: postDelay === d ? 'rgba(124,58,237,0.15)' : 'transparent', color: postDelay === d ? '#c4b5fd' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              {d >= 60 ? `${d / 60}m` : `${d}s`}{d === 30 ? ' ✅' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="card" style={{ padding: '16px', marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📊 Summary</div>
        {[
          ['Platforms selected', selectedCount],
          ['Facebook pages', postState.targets.facebook ? postState.selectedFacebookPages.length : 0],
          ['TikTok accounts', postState.targets.tiktok ? postState.selectedTikTokAccounts.length : 0],
          ['Estimated reach', calcEstimatedReach()],
          ['Estimated time', calcEstimatedTime()]
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
            <span style={{ fontWeight: 700 }}>{value}</span>
          </div>
        ))}
      </div>

      <button className="btn-primary" onClick={handlePublish} style={{ fontSize: 16, fontWeight: 800 }}>
        {scheduledAt ? '📅 Confirm Schedule' : '🚀 Confirm & Publish'}
      </button>
    </div>
  )
}
