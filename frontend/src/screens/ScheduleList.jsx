import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Edit2, Clock, X, Zap } from 'lucide-react'
import { getScheduledPosts, cancelScheduledPost, publishNow, reschedulePost } from '../lib/api'
import LoadingSkeleton from '../components/LoadingSkeleton'
import toast from 'react-hot-toast'

const PLATFORM_ICONS = { youtube: '▶️', instagram: '📸', facebook: '🔵', tiktok: '🎵', twitter: '✖️' }

export default function ScheduleList() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState([])
  const [filter, setFilter] = useState('upcoming')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadPosts() }, [filter])

  const loadPosts = async () => {
    setLoading(true)
    try {
      const data = await getScheduledPosts(filter === 'upcoming' ? { status: 'scheduled' } : filter === 'all' ? {} : { status: filter })
      setPosts(data.posts || [])
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  const handleCancel = async (id) => {
    if (!confirm('Cancel this scheduled post?')) return
    await cancelScheduledPost(id)
    toast.success('Post cancelled')
    loadPosts()
  }

  const handlePublishNow = async (id) => {
    if (!confirm('Publish this post now?')) return
    await publishNow(id)
    toast.success('Publishing started')
    loadPosts()
  }

  const getPlatformIcons = (platforms) => {
    if (!platforms) return []
    return Object.entries(platforms).filter(([_, v]) => v).map(([k]) => k)
  }

  const FILTERS = ['upcoming', 'all', 'published', 'failed', 'cancelled']

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/schedule')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 0 }}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ fontSize: 18, fontFamily: 'Syne', fontWeight: 800 }}>Scheduled Posts</div>
        </div>
        <button onClick={() => navigate('/schedule/create')} style={{ background: '#7c3aed', border: 'none', color: 'white', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}>
          <Plus size={15} /> New
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 999, border: 'none', background: filter === f ? '#7c3aed' : 'rgba(255,255,255,0.08)', color: filter === f ? 'white' : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
            {f}
          </button>
        ))}
      </div>

      {loading ? <LoadingSkeleton count={4} /> : posts.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>No scheduled posts</div>
          <button className="btn-primary" onClick={() => navigate('/schedule/create')}>Create Scheduled Post</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {posts.map(post => {
            const scheduledDate = new Date(post.scheduled_at)
            const isPast = scheduledDate < new Date()
            const platforms = getPlatformIcons(post.target_platforms)
            return (
              <div key={post.id} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  {post.thumbnail_url ? (
                    <img src={post.thumbnail_url} alt="" style={{ width: 56, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 56, height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🎬</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{post.title || 'Scheduled Post'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                      <Clock size={12} />
                      {scheduledDate.toLocaleDateString()} · {scheduledDate.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' })} PKT
                    </div>
                  </div>
                  <span className={`badge badge-${post.status}`}>{post.status}</span>
                </div>

                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  {platforms.map(p => <span key={p} style={{ fontSize: 16 }}>{PLATFORM_ICONS[p]}</span>)}
                  {post.target_facebook_pages?.length > 0 && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>+{post.target_facebook_pages.length} FB pages</span>}
                  {post.target_tiktok_accounts?.length > 0 && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>+{post.target_tiktok_accounts.length} TikTok</span>}
                </div>

                {post.status === 'scheduled' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => navigate(`/schedule/${post.id}/results`)} style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', borderRadius: 8, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <Edit2 size={12} /> Edit
                    </button>
                    <button onClick={() => handlePublishNow(post.id)} style={{ flex: 1, padding: '8px', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#c4b5fd', borderRadius: 8, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <Zap size={12} /> Post Now
                    </button>
                    <button onClick={() => handleCancel(post.id)} style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 8, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <X size={12} /> Cancel
                    </button>
                  </div>
                )}

                {(post.status === 'published' || post.status === 'failed') && (
                  <button onClick={() => navigate(`/schedule/${post.id}/results`)} style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    View Results →
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
