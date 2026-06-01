import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, ExternalLink, Trash2, ChevronDown, ChevronUp, ArrowLeft, Inbox, Send, RotateCcw } from 'lucide-react'
import api from '../lib/api'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import PlatformIcon, { PLATFORM_BRAND_COLOR } from '../components/PlatformIcon'
import { usePost } from '../context/PostContext'

const STATUS_COLOR = {
  published: 'var(--success)',
  failed: 'var(--danger)',
  publishing: 'var(--warning)',
  scheduled: 'var(--info)',
  uploaded: 'var(--text-tertiary)'
}

function getOverallStatus(posts) {
  if (!posts || posts.length === 0) return 'uploaded'
  if (posts.every(p => p.status === 'published')) return 'published'
  if (posts.some(p => p.status === 'publishing')) return 'publishing'
  if (posts.some(p => p.status === 'failed') && !posts.some(p => p.status === 'published')) return 'failed'
  if (posts.every(p => p.status === 'scheduled')) return 'scheduled'
  return 'partial'
}

const PlatformBadge = ({ platform, size = 22 }) => (
  <span style={{
    width: size, height: size, borderRadius: 6,
    background: `${PLATFORM_BRAND_COLOR[platform] || 'var(--accent)'}1f`,
    color: PLATFORM_BRAND_COLOR[platform] || 'var(--accent)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
  }}>
    <PlatformIcon platform={platform} size={size === 22 ? 12 : Math.round(size * 0.55)} />
  </span>
)

export default function History() {
  const { user } = useAuth()
  const { updatePost, resetPost } = usePost()
  const navigate = useNavigate()
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

  // Publish an existing upload (or retry a failed one) — loads the video into
  // PostContext so SelectTargets can pick up from there. Skips upload/edit steps.
  const publishExisting = async (video, retry = false) => {
    // Pull existing processed clips so each platform uses the right aspect-ratio clip
    let processedClips = []
    try {
      const { data } = await supabase
        .from('processed_clips').select('*')
        .eq('video_id', video.id)
      processedClips = data || []
    } catch {}

    if (retry) {
      // Clean up old failed post rows so the next attempt starts fresh
      await supabase.from('posts').delete().eq('video_id', video.id).eq('status', 'failed')
    }

    resetPost()
    updatePost({
      mediaType: video.media_type || 'video',
      videoId: video.id,
      title: video.title || '',
      description: video.description || '',
      originalUrl: video.original_url || null,
      thumbnailOptions: video.thumbnail_url ? [video.thumbnail_url] : [],
      selectedThumbnail: video.thumbnail_url || null,
      processedClips,
      // Default targets to whatever already succeeded — user can toggle on Select Targets
      hashtags: { youtube: [], instagram: [], facebook: [], tiktok: [], twitter: [] }
    })
    navigate('/targets')
  }

  const STATUS_FILTERS = ['all', 'uploaded', 'published', 'failed', 'publishing', 'scheduled']
  const PLATFORM_FILTERS = ['all', 'youtube', 'instagram', 'facebook', 'tiktok', 'twitter']

  return (
    <div className="screen-pad">
      <div className="page-header">
        <button onClick={() => navigate('/')} className="icon-btn" aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div className="grow">
          <div className="t-display">Upload history</div>
          <div className="t-caption" style={{ marginTop: 4 }}>
            <span className="t-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{videos.length}</span> uploads
          </div>
        </div>
        <button onClick={loadHistory} className="icon-btn" aria-label="Refresh">
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="chip-row" style={{ marginBottom: 10 }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`chip ${filter === f ? 'active' : ''}`}
            style={{ textTransform: 'capitalize' }}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="chip-row" style={{ marginBottom: 20 }}>
        {PLATFORM_FILTERS.map(p => (
          <button
            key={p}
            onClick={() => setPlatformFilter(p)}
            className={`chip ${platformFilter === p ? 'active' : ''}`}
            style={{ textTransform: 'capitalize', minHeight: 32, padding: '6px 12px', fontSize: 12 }}
          >
            {p !== 'all' && <PlatformBadge platform={p} />} {p}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="stack-sm">
          {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 76 }} />)}
        </div>
      ) : videos.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div className="avatar-icon" style={{ margin: '0 auto 14px', width: 48, height: 48 }}>
            <Inbox size={22} />
          </div>
          <div className="t-body">No uploads found</div>
          <div className="t-body-sm" style={{ marginTop: 4 }}>Try a different filter or upload your first media.</div>
        </div>
      ) : (
        <div className="stack-sm">
          {videos.map(video => {
            const isImage = video.media_type === 'image'
            const status = getOverallStatus(video.posts)
            const platforms = [...new Set((video.posts || []).map(p => p.platform))]
            const isExpanded = expanded === video.id
            const preview = video.thumbnail_url || (isImage ? video.original_url : null)

            return (
              <div key={video.id} className="card" style={{ padding: 0 }}>
                <div
                  className="row"
                  style={{ padding: '14px 16px', gap: 12, cursor: 'pointer' }}
                  onClick={() => setExpanded(isExpanded ? null : video.id)}
                >
                  <div style={{ width: 56, height: 56, borderRadius: 10, background: 'var(--bg-sunken)', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border-subtle)' }}>
                    {preview
                      ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: 'var(--text-tertiary)' }}>{isImage ? '🖼' : '🎬'}</div>}
                  </div>

                  <div className="grow" style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-h3 truncate-1">{video.title || 'Untitled'}</div>
                    <div className="row" style={{ marginTop: 6, gap: 6, flexWrap: 'wrap' }}>
                      <span className="badge" style={{
                        background: 'var(--bg-hover)', color: 'var(--text-tertiary)',
                        borderColor: 'var(--border-subtle)', fontSize: 10
                      }}>{isImage ? 'Image' : 'Video'}</span>
                      {platforms.length > 0
                        ? platforms.map(p => <PlatformBadge key={p} platform={p} />)
                        : <span className="t-caption">Not published yet</span>}
                    </div>
                    <div className="t-caption" style={{ marginTop: 6 }}>
                      {new Date(video.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>

                  <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                    <span className={`badge badge-${status === 'partial' ? 'partial' : status}`} style={{ textTransform: 'capitalize' }}>{status}</span>
                    {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-tertiary)' }} />}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                    {(video.posts || []).length === 0 ? (
                      <div className="t-body-sm" style={{ textAlign: 'center', padding: '14px 0' }}>
                        Not published to any platform yet
                      </div>
                    ) : (
                      <div style={{ marginTop: 8 }}>
                        {video.posts.map((p, i) => (
                          <div
                            key={p.id}
                            className="row-between"
                            style={{
                              padding: '10px 0',
                              borderBottom: i === video.posts.length - 1 ? 'none' : '1px solid var(--border-subtle)'
                            }}
                          >
                            <div className="row" style={{ gap: 8 }}>
                              <PlatformBadge platform={p.platform} />
                              <span className="t-body-sm" style={{ color: 'var(--text-primary)' }}>{p.target_name || p.platform}</span>
                            </div>
                            <div className="row" style={{ gap: 10 }}>
                              <span style={{ color: STATUS_COLOR[p.status] || 'var(--text-secondary)', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
                                {p.status}
                              </span>
                              {p.platform_post_url && (
                                <a href={p.platform_post_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                                  <ExternalLink size={13} />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="stack-sm" style={{ marginTop: 12 }}>
                      {status === 'uploaded' && (
                        <button onClick={() => publishExisting(video)} className="btn-primary btn-sm">
                          <Send size={13} /> Publish now
                        </button>
                      )}
                      {(status === 'failed' || status === 'partial') && (
                        <button onClick={() => publishExisting(video, true)} className="btn-primary btn-sm">
                          <RotateCcw size={13} /> {status === 'partial' ? 'Publish remaining' : 'Retry publish'}
                        </button>
                      )}
                      <button onClick={() => deleteVideo(video.id)} className="btn-danger btn-sm" style={{ width: '100%' }}>
                        <Trash2 size={13} /> Delete upload
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
