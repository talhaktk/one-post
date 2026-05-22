import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import api from '../lib/api'
import LoadingSkeleton from '../components/LoadingSkeleton'

const STATUS_COLORS = { published: '#22c55e', failed: '#ef4444', publishing: '#f59e0b', scheduled: '#3b82f6' }
const PLATFORM_ICONS = { youtube: '▶️', instagram: '📸', facebook: '🔵', tiktok: '🎵', twitter: '✖️' }

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

  return (
    <div style={{ padding: '0 16px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0 16px' }}>
        <div>
          <div style={{ fontSize: 22, fontFamily: 'Syne', fontWeight: 800 }}>OnePost</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Welcome, {profile?.full_name?.split(' ')[0] || 'there'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={loadData} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4 }}>
            <RefreshCw size={18} />
          </button>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar" style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid #7c3aed' }} />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>
              {(profile?.full_name || profile?.email || 'U')[0].toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      {loading ? <LoadingSkeleton type="stat" /> : stats && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Total Posts', value: stats.total, color: '#7c3aed' },
            { label: 'Platforms', value: stats.platforms, color: '#3b82f6' },
            { label: 'FB Pages', value: stats.fbPages, color: '#1877F2' },
            { label: 'TikTok', value: stats.tikTok, color: '#69C9D0' }
          ].map(s => (
            <div key={s.label} className="card" style={{ flex: 1, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2, lineHeight: 1.2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* New Post CTA */}
      <button onClick={() => navigate('/upload')} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
        <Plus size={20} /> Upload & Post New Video
      </button>

      {/* Recent Posts */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Recent Posts</div>
        <button onClick={() => navigate('/history')} style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: 13, cursor: 'pointer' }}>View all</button>
      </div>

      {loading ? <LoadingSkeleton count={4} /> : posts.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 14 }}>No uploads yet. Upload your first video or image!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {posts.map(video => {
            const platforms = [...new Set((video.posts || []).map(p => p.platform))]
            const statuses = (video.posts || []).map(p => p.status)
            const status = statuses.length === 0 ? 'uploaded' : getOverallStatus(statuses)
            const isImage = video.media_type === 'image'
            const preview = video.thumbnail_url || (isImage ? video.original_url : null)
            return (
              <div key={video.id} className="card" style={{ padding: '12px 14px', cursor: 'pointer' }} onClick={() => navigate('/history')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 10, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', flexShrink: 0 }}>
                    {preview
                      ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{isImage ? '🖼️' : '🎬'}</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{video.title || 'Untitled'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      {platforms.length > 0
                        ? platforms.map(p => <span key={p} style={{ fontSize: 14 }}>{PLATFORM_ICONS[p] || '🔗'}</span>)
                        : <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Not published yet</span>}
                    </div>
                  </div>
                  <span className={`badge badge-${status === 'uploaded' ? 'scheduled' : status}`} style={{ textTransform: 'capitalize', fontSize: 11 }}>{status}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
