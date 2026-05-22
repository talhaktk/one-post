import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { RefreshCw, ExternalLink, RotateCcw, Trash2 } from 'lucide-react'
import LoadingSkeleton from '../components/LoadingSkeleton'
import toast from 'react-hot-toast'

const PLATFORM_ICONS = { youtube: '▶️', instagram: '📸', instagram_reels: '🎬', instagram_feed: '📸', facebook: '🔵', tiktok: '🎵', twitter: '✖️' }
const STATUS_COLORS = { published: '#22c55e', failed: '#ef4444', publishing: '#f59e0b', scheduled: '#3b82f6' }

export default function History() {
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { if (user) loadPosts() }, [user, filter, platformFilter])

  const loadPosts = async () => {
    setLoading(true)
    let query = supabase.from('posts').select(`*, videos(title, thumbnail_url, duration_seconds)`).eq('user_id', user.id).order('created_at', { ascending: false })
    if (filter !== 'all') query = query.eq('status', filter)
    if (platformFilter !== 'all') query = query.eq('platform', platformFilter)
    const { data } = await query.limit(100)

    // Group by video_id
    const grouped = {}
    data?.forEach(p => {
      const key = p.video_id || p.id
      if (!grouped[key]) grouped[key] = { ...p, allPosts: [] }
      grouped[key].allPosts.push(p)
    })
    setPosts(Object.values(grouped))
    setLoading(false)
  }

  const deletePost = async (videoId) => {
    if (!confirm('Delete this post record?')) return
    await supabase.from('posts').delete().eq('video_id', videoId).eq('user_id', user.id)
    toast.success('Post deleted')
    loadPosts()
  }

  const getGroupStatus = (posts) => {
    if (posts.every(p => p.status === 'published')) return 'published'
    if (posts.some(p => p.status === 'publishing')) return 'publishing'
    if (posts.some(p => p.status === 'failed') && !posts.some(p => p.status === 'published')) return 'failed'
    return 'partial'
  }

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0 16px' }}>
        <div>
          <div style={{ fontSize: 22, fontFamily: 'Syne', fontWeight: 800 }}>Post History</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{posts.length} videos posted</div>
        </div>
        <button onClick={loadPosts} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4 }}>
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
        {['all', 'published', 'failed', 'scheduled', 'publishing'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 999, border: 'none', background: filter === f ? '#7c3aed' : 'rgba(255,255,255,0.08)', color: filter === f ? 'white' : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s', textTransform: 'capitalize' }}>
            {f}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {['all', 'youtube', 'instagram', 'facebook', 'tiktok', 'twitter'].map(p => (
          <button key={p} onClick={() => setPlatformFilter(p)} style={{ padding: '5px 12px', borderRadius: 999, border: 'none', background: platformFilter === p ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.06)', color: platformFilter === p ? 'white' : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
            {p !== 'all' && (PLATFORM_ICONS[p] || '')}{' '}{p}
          </button>
        ))}
      </div>

      {loading ? <LoadingSkeleton count={5} /> : posts.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 14 }}>No posts found</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {posts.map(post => {
            const status = getGroupStatus(post.allPosts)
            const isExpanded = expanded === (post.video_id || post.id)
            return (
              <div key={post.video_id || post.id} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : (post.video_id || post.id))}>
                  <div style={{ width: 52, height: 52, borderRadius: 10, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', flexShrink: 0 }}>
                    {post.videos?.thumbnail_url ? <img src={post.videos.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎬</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.videos?.title || post.title || 'Untitled'}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      {[...new Set(post.allPosts.map(p => p.platform))].map(p => (
                        <span key={p} style={{ fontSize: 14 }}>{PLATFORM_ICONS[p] || '🔗'}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                      {post.allPosts.length} targets · {new Date(post.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`badge badge-${status}`}>{status}</span>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                    {post.allPosts.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{PLATFORM_ICONS[p.platform]}</span>
                          <span style={{ color: 'rgba(255,255,255,0.7)' }}>{p.target_name || p.platform}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: STATUS_COLORS[p.status] || 'white' }}>{p.status}</span>
                          {p.platform_post_url && <a href={p.platform_post_url} target="_blank" rel="noopener noreferrer" style={{ color: '#7c3aed' }}><ExternalLink size={12} /></a>}
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={() => deletePost(post.video_id)} style={{ flex: 1, padding: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 8, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <Trash2 size={13} /> Delete Record
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
