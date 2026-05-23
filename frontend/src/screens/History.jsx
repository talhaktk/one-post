import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { RefreshCw, ExternalLink, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import api from '../lib/api'
import { supabase } from '../lib/supabase'
import LoadingSkeleton from '../components/LoadingSkeleton'
import toast from 'react-hot-toast'

const PLATFORM_ICONS = { youtube: '▶️', instagram: '📸', instagram_reels: '🎬', instagram_feed: '📸', instagram_image: '📸', facebook: '🔵', tiktok: '🎵', twitter: '✖️' }
const STATUS_COLORS = { published: '#22c55e', failed: '#ef4444', publishing: '#f59e0b', scheduled: '#3b82f6', uploaded: '#6b7280' }

function getOverallStatus(posts) {
  if (!posts || posts.length === 0) return 'uploaded'
  if (posts.every(p => p.status === 'published')) return 'published'
  if (posts.some(p => p.status === 'publishing')) return 'publishing'
  if (posts.some(p => p.status === 'failed') && !posts.some(p => p.status === 'published')) return 'failed'
  if (posts.every(p => p.status === 'scheduled')) return 'scheduled'
  return 'partial'
}

export default function History() {
  const { user } = useAuth()
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { if (user) loadHistory() }, [user, filter, platformFilter])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filter !== 'all') params.status = filter
      if (platformFilter !== 'all') params.platform = platformFilter
      const data = await api.get(`/posts/${user.id}/history`, { params })
      setVideos(data.videos || [])
    } catch {
      toast.error('Failed to load history')
    }
    setLoading(false)
  }

  const deleteVideo = async (videoId) => {
    if (!confirm('Delete this upload and all its post records?')) return
    await supabase.from('posts').delete().eq('video_id', videoId)
    await supabase.from('videos').delete().eq('id', videoId).eq('user_id', user.id)
    toast.success('Deleted')
    loadHistory()
  }

  const STATUS_FILTERS = ['all', 'uploaded', 'published', 'failed', 'publishing', 'scheduled']
  const PLATFORM_FILTERS = ['all', 'youtube', 'instagram', 'facebook', 'tiktok', 'twitter']

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0 16px' }}>
        <div>
          <div style={{ fontSize: 22, fontFamily: 'Syne', fontWeight: 800 }}>Upload History</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{videos.length} uploads</div>
        </div>
        <button onClick={loadHistory} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4 }}>
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Status filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', paddingBottom: 4 }}>
        {STATUS_FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 999, border: 'none', background: filter === f ? '#7c3aed' : 'rgba(255,255,255,0.08)', color: filter === f ? 'white' : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s', textTransform: 'capitalize' }}>
            {f}
          </button>
        ))}
      </div>

      {/* Platform filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {PLATFORM_FILTERS.map(p => (
          <button key={p} onClick={() => setPlatformFilter(p)} style={{ padding: '5px 12px', borderRadius: 999, border: 'none', background: platformFilter === p ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.06)', color: platformFilter === p ? 'white' : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
            {p !== 'all' && (PLATFORM_ICONS[p] || '')}{' '}{p}
          </button>
        ))}
      </div>

      {loading ? <LoadingSkeleton count={5} /> : videos.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 14 }}>No uploads found</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {videos.map(video => {
            const isImage = video.media_type === 'image'
            const status = getOverallStatus(video.posts)
            const platforms = [...new Set((video.posts || []).map(p => p.platform))]
            const isExpanded = expanded === video.id
            const preview = video.thumbnail_url || (isImage ? video.original_url : null)

            return (
              <div key={video.id} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : video.id)}>
                  <div style={{ width: 52, height: 52, borderRadius: 10, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', flexShrink: 0 }}>
                    {preview
                      ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{isImage ? '🖼️' : '🎬'}</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.title || 'Untitled'}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>{isImage ? 'Image' : 'Video'}</span>
                      {platforms.length > 0
                        ? platforms.map(p => <span key={p} style={{ fontSize: 14 }}>{PLATFORM_ICONS[p] || '🔗'}</span>)
                        : <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Not published yet</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                      {new Date(video.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge badge-${status === 'partial' ? 'scheduled' : status}`} style={{ textTransform: 'capitalize', fontSize: 11 }}>{status}</span>
                    {isExpanded ? <ChevronUp size={14} color="rgba(255,255,255,0.3)" /> : <ChevronDown size={14} color="rgba(255,255,255,0.3)" />}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                    {(video.posts || []).length === 0 ? (
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '8px 0' }}>
                        Not published to any platform yet
                      </div>
                    ) : (
                      video.posts.map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{PLATFORM_ICONS[p.platform] || '🔗'}</span>
                            <span style={{ color: 'rgba(255,255,255,0.7)' }}>{p.target_name || p.platform}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: STATUS_COLORS[p.status] || 'white', fontWeight: 600 }}>{p.status}</span>
                            {p.platform_post_url && (
                              <a href={p.platform_post_url} target="_blank" rel="noopener noreferrer" style={{ color: '#7c3aed' }}>
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={() => deleteVideo(video.id)} style={{ flex: 1, padding: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 8, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
