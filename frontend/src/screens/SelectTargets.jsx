import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, CheckSquare, Calendar, Clock, BarChart3, Rocket } from 'lucide-react'
import { usePost } from '../context/PostContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import FacebookPageItem from '../components/FacebookPageItem'
import TikTokAccountItem from '../components/TikTokAccountItem'
import toast from 'react-hot-toast'

const PLATFORM_COLORS = {
  youtube: '#FF0000', instagram_reels: '#E1306C', instagram_feed: '#833AB4',
  instagram_image: '#E1306C', facebook: '#1877F2', tiktok: '#69C9D0', twitter: '#ffffff'
}

const PLATFORM_LETTERS = {
  youtube: 'YT', instagram_reels: 'IG', instagram_feed: 'IG',
  instagram_image: 'IG', facebook: 'f', tiktok: 'TT', twitter: '𝕏'
}

const VIDEO_PLATFORMS = [
  { key: 'youtube',         label: 'YouTube' },
  { key: 'instagram_reels', label: 'Instagram Reels' },
  { key: 'instagram_feed',  label: 'Instagram Feed' },
  { key: 'facebook',        label: 'Facebook Pages' },
  { key: 'tiktok',          label: 'TikTok' },
  { key: 'twitter',         label: 'X (Twitter)' }
]

const IMAGE_PLATFORMS = [
  { key: 'instagram_image', label: 'Instagram' },
  { key: 'facebook',        label: 'Facebook Pages' },
  { key: 'twitter',         label: 'X (Twitter)' }
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
  const [, setLoading] = useState(true)

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
    if (seconds < 60) return `~${seconds}s`
    return `~${Math.round(seconds / 60)}m`
  }

  const handlePublish = () => {
    const anySelected = Object.values(postState.targets).some(Boolean)
    if (!anySelected) { toast.error('Select at least one platform'); return }
    updatePost({ scheduledAt: scheduledAt || null, postDelay })
    navigate('/publishing')
  }

  const isImage = postState.mediaType === 'image'
  const PLATFORMS_CONFIG = isImage ? IMAGE_PLATFORMS : VIDEO_PLATFORMS
  const filteredFbPages = fbPages.filter(p => p.page_name.toLowerCase().includes(fbSearch.toLowerCase()))
  const selectedCount = Object.values(postState.targets).filter(Boolean).length

  const PlatformDot = ({ pkey, size = 36 }) => (
    <span style={{
      width: size, height: size, borderRadius: 9,
      background: `${PLATFORM_COLORS[pkey] || 'var(--accent)'}22`,
      color: PLATFORM_COLORS[pkey] || 'var(--accent)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 700, flexShrink: 0
    }}>{PLATFORM_LETTERS[pkey] || '·'}</span>
  )

  return (
    <div className="screen-pad">
      <div style={{ marginBottom: 20 }}>
        <div className="t-label" style={{ marginBottom: 6 }}>Step {isImage ? '3 of 3' : '4 of 4'}</div>
        <div className="t-display">Where to publish</div>
        <div className="t-body-sm" style={{ marginTop: 4 }}>Pick platforms and choose when to go live.</div>
      </div>

      {/* Platform list */}
      <div className="stack-sm" style={{ marginBottom: 20 }}>
        {PLATFORMS_CONFIG.map(({ key, label }) => {
          const enabled = postState.targets[key]
          return (
            <div key={key}>
              <div
                className="card-interactive"
                onClick={() => toggleTarget(key)}
                style={{
                  padding: '12px 14px',
                  borderColor: enabled ? 'var(--accent)' : 'var(--border-subtle)',
                  background: enabled ? 'var(--accent-soft)' : 'var(--bg-elevated)'
                }}
              >
                <div className="row" style={{ gap: 12 }}>
                  <PlatformDot pkey={key} />
                  <div className="grow t-h3" style={{ flex: 1 }}>{label}</div>
                  <div
                    className={`toggle ${enabled ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); toggleTarget(key) }}
                  />
                </div>
              </div>

              {key === 'facebook' && enabled && (
                <div className="card" style={{ padding: 14, marginTop: 6 }}>
                  <div className="row-between" style={{ marginBottom: 10 }}>
                    <span className="t-body-sm">
                      <span className="t-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        {postState.selectedFacebookPages.length}
                      </span>
                      {' of '}{fbPages.length} pages
                    </span>
                    <button onClick={selectAllFb} className="btn-ghost btn-xs" style={{ color: 'var(--accent)' }}>
                      <CheckSquare size={13} /> Select all
                    </button>
                  </div>

                  <div style={{ position: 'relative', marginBottom: 10 }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input
                      className="input"
                      style={{ paddingLeft: 34, fontSize: 14, minHeight: 40 }}
                      placeholder="Search pages…"
                      value={fbSearch}
                      onChange={e => setFbSearch(e.target.value)}
                    />
                  </div>

                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {filteredFbPages.map(page => (
                      <FacebookPageItem
                        key={page.id}
                        page={page}
                        selected={postState.selectedFacebookPages.includes(page.page_id)}
                        onToggle={toggleFbPage}
                      />
                    ))}
                  </div>
                </div>
              )}

              {key === 'tiktok' && enabled && (
                <div className="card" style={{ padding: 14, marginTop: 6 }}>
                  {tikTokAccounts.map(acc => (
                    <TikTokAccountItem
                      key={acc.id}
                      account={acc}
                      selected={postState.selectedTikTokAccounts.includes(acc.id)}
                      onToggle={toggleTikTok}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Schedule */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div className="row" style={{ gap: 10, marginBottom: 12 }}>
          <Calendar size={16} style={{ color: 'var(--text-secondary)' }} />
          <div className="t-h3">Schedule</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Publish now', active: !scheduledAt, onClick: () => setScheduledAt('') },
            { label: 'Schedule for later', active: !!scheduledAt, onClick: () => setScheduledAt(new Date(Date.now() + 3600000).toISOString().slice(0, 16)) }
          ].map(({ label, active, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              style={{
                minHeight: 44, padding: '0 10px',
                borderRadius: 10,
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border-strong)'}`,
                background: active ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 13, fontWeight: 600
              }}
            >{label}</button>
          ))}
        </div>
        {scheduledAt && (
          <input
            type="datetime-local"
            className="input"
            style={{ marginTop: 12 }}
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
          />
        )}
      </div>

      {/* Delay between posts */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div className="row" style={{ gap: 10, marginBottom: 4 }}>
          <Clock size={16} style={{ color: 'var(--text-secondary)' }} />
          <div className="t-h3">Delay between posts</div>
        </div>
        <div className="t-caption" style={{ marginBottom: 12 }}>30 seconds is recommended to avoid rate limits.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {POST_DELAYS.map(d => {
            const active = postDelay === d
            return (
              <button
                key={d}
                onClick={() => setPostDelay(d)}
                style={{
                  minHeight: 40, padding: '0 6px',
                  borderRadius: 9,
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border-strong)'}`,
                  background: active ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600
                }}
              >{d >= 60 ? `${d / 60}m` : `${d}s`}</button>
            )
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div className="row" style={{ gap: 10, marginBottom: 12 }}>
          <BarChart3 size={16} style={{ color: 'var(--text-secondary)' }} />
          <div className="t-h3">Summary</div>
        </div>
        {[
          ['Platforms selected',  selectedCount],
          ['Facebook pages',      postState.targets.facebook ? postState.selectedFacebookPages.length : 0],
          ['TikTok accounts',     postState.targets.tiktok ? postState.selectedTikTokAccounts.length : 0],
          ['Estimated reach',     calcEstimatedReach()],
          ['Estimated duration',  calcEstimatedTime()]
        ].map(([label, value], i, arr) => (
          <div
            key={label}
            className="row-between"
            style={{ padding: '10px 0', borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}
          >
            <span className="t-body-sm">{label}</span>
            <span className="t-mono" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>{value}</span>
          </div>
        ))}
      </div>

      <button className="btn-primary" onClick={handlePublish}>
        {scheduledAt ? <><Calendar size={16} /> Confirm schedule</> : <><Rocket size={16} /> Confirm & publish</>}
      </button>
    </div>
  )
}
