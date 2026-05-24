import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, ChevronRight, Inbox } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import api from '../lib/api'
import LoadingSkeleton from '../components/LoadingSkeleton'

const PLATFORM_ICONS = { youtube: '▶', instagram: '📸', facebook: 'f', tiktok: '♪', twitter: '𝕏' }
const PLATFORM_COLORS = {
  youtube: '#FF0000', instagram: '#E1306C', facebook: '#1877F2',
  tiktok: '#69C9D0', twitter: '#ffffff'
}

export default function Dashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) loadData() }, [user])

  const loadData = async () => {
    setLoading(true)
    try {
      const [recentRes, pagesRes, tiktokRes, platformsRes] = await Promise.all([
        api.get(`/posts/${user.id}/recent`),
        supabase.from('facebook_pages').select('id', { count: 'exact' }).eq('user_id', user.id).eq('is_active', true),
        supabase.from('tiktok_accounts').select('id', { count: 'exact' }).eq('user_id', user.id).eq('is_active', true),
        supabase.from('connected_platforms').select('id', { count: 'exact' }).eq('user_id', user.id).eq('is_active', true)
      ])
      const videos = recentRes?.videos || []
      setStats({
        total: videos.length,
        platforms: platformsRes.count || 0,
        fbPages: pagesRes.count || 0,
        tikTok: tiktokRes.count || 0
      })
      setPosts(videos)
    } catch {}
    setLoading(false)
  }

  const getOverallStatus = (statuses) => {
    if (statuses.includes('publishing')) return 'publishing'
    if (statuses.includes('failed') && !statuses.includes('published')) return 'failed'
    if (statuses.every(s => s === 'published')) return 'published'
    if (statuses.every(s => s === 'scheduled')) return 'scheduled'
    return 'partial'
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const initial = (profile?.full_name || profile?.email || 'U')[0].toUpperCase()

  return (
    <div className="screen-pad">
      {/* Header */}
      <div className="page-header">
        <div className="grow">
          <div className="t-display">OnePost</div>
          <div className="t-caption" style={{ marginTop: 4 }}>Welcome back, {firstName}</div>
        </div>
        <button onClick={loadData} className="icon-btn" aria-label="Refresh">
          <RefreshCw size={18} />
        </button>
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border-strong)' }} />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700 }}>
            {initial}
          </div>
        )}
      </div>

      {/* Stats */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 76 }} />)}
        </div>
      ) : stats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Total posts', value: stats.total },
            { label: 'Platforms', value: stats.platforms },
            { label: 'FB pages', value: stats.fbPages },
            { label: 'TikTok', value: stats.tikTok }
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
              <div className="t-mono" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.1, color: 'var(--text-primary)' }}>{s.value}</div>
              <div className="t-label" style={{ marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Primary CTA */}
      <button onClick={() => navigate('/upload')} className="btn-primary" style={{ marginBottom: 28 }}>
        <Plus size={18} strokeWidth={2.4} /> New post
      </button>

      {/* Recent Posts */}
      <div className="row-between" style={{ marginBottom: 12 }}>
        <div className="t-h2">Recent uploads</div>
        <button onClick={() => navigate('/history')} className="btn-ghost btn-sm" style={{ color: 'var(--accent)', padding: '0 8px', minHeight: 32 }}>
          View all <ChevronRight size={14} />
        </button>
      </div>

      {loading ? (
        <div className="stack">
          {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 72 }} />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <div className="avatar-icon" style={{ margin: '0 auto 12px', width: 48, height: 48 }}>
            <Inbox size={22} />
          </div>
          <div className="t-body" style={{ marginBottom: 4 }}>No uploads yet</div>
          <div className="t-body-sm" style={{ marginBottom: 16 }}>Upload your first video or image to get started.</div>
          <button onClick={() => navigate('/upload')} className="btn-secondary" style={{ maxWidth: 220, margin: '0 auto' }}>
            <Plus size={16} /> Create post
          </button>
        </div>
      ) : (
        <div className="stack-sm">
          {posts.map(video => {
            const platforms = [...new Set((video.posts || []).map(p => p.platform))]
            const statuses = (video.posts || []).map(p => p.status)
            const status = statuses.length === 0 ? 'uploaded' : getOverallStatus(statuses)
            const isImage = video.media_type === 'image'
            const preview = video.thumbnail_url || (isImage ? video.original_url : null)
            return (
              <div key={video.id} className="card-interactive" style={{ padding: '12px 14px' }} onClick={() => navigate('/history')}>
                <div className="row" style={{ gap: 12 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 10, background: 'var(--bg-sunken)', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border-subtle)' }}>
                    {preview
                      ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--text-tertiary)' }}>{isImage ? '🖼' : '🎬'}</div>}
                  </div>
                  <div className="grow" style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-h3 truncate-1">{video.title || 'Untitled'}</div>
                    <div className="row" style={{ marginTop: 6, gap: 6 }}>
                      {platforms.length > 0
                        ? platforms.map(p => (
                            <span key={p} style={{
                              width: 18, height: 18, borderRadius: 5,
                              background: `${PLATFORM_COLORS[p] || 'var(--accent)'}22`,
                              color: PLATFORM_COLORS[p] || 'var(--accent)',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 700
                            }}>{PLATFORM_ICONS[p] || '·'}</span>
                          ))
                        : <span className="t-caption">Not published yet</span>}
                    </div>
                  </div>
                  <span className={`badge badge-${status}`} style={{ textTransform: 'capitalize' }}>{status}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
