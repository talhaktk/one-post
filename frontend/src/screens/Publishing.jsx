import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, ExternalLink, Calendar, Sparkles, Home, Plus } from 'lucide-react'
import { usePost } from '../context/PostContext'
import { useAuth } from '../context/AuthContext'
import { publishPost, getPublishProgress } from '../lib/api'
import { supabase } from '../lib/supabase'
import ProgressCard from '../components/ProgressCard'
import toast from 'react-hot-toast'

export default function Publishing() {
  const navigate = useNavigate()
  const { postState, resetPost } = usePost()
  const { user } = useAuth()
  const [, setJobId] = useState(null)
  const [targets, setTargets] = useState([])
  const [done, setDone] = useState(false)
  const [, setFailed] = useState(false)
  const sseRef = useRef(null)

  useEffect(() => { startPublishing() }, [])
  useEffect(() => { return () => { if (sseRef.current) sseRef.current.close() } }, [])

  const startPublishing = async () => {
    try {
      const payload = {
        video_id: postState.videoId,
        title: postState.title,
        description: postState.description,
        targets: buildTargets(),
        hashtags_per_platform: postState.hashtags,
        scheduled_at: postState.scheduledAt || null,
        post_delay_seconds: postState.postDelay || 30,
        media_type: postState.mediaType || 'video'
      }

      const initTargets = await buildInitialTargets()
      setTargets(initTargets)

      const { job_id } = await publishPost(payload)
      setJobId(job_id)
      connectSSE(job_id)
    } catch (err) {
      toast.error(err.message || 'Failed to start publishing')
      setFailed(true)
    }
  }

  const buildTargets = () => {
    const t = []
    if (postState.targets.youtube) t.push({ platform: 'youtube', clip_id: getClipId('youtube') })
    if (postState.targets.instagram_reels) t.push({ platform: 'instagram_reels', clip_id: getClipId('instagram_reels') })
    if (postState.targets.instagram_feed) t.push({ platform: 'instagram_feed', clip_id: getClipId('instagram_feed') })
    if (postState.targets.instagram_image) t.push({ platform: 'instagram_image' })
    if (postState.targets.facebook && postState.selectedFacebookPages.length) t.push({ platform: 'facebook', page_ids: postState.selectedFacebookPages, clip_id: getClipId('facebook') })
    if (postState.targets.tiktok && postState.selectedTikTokAccounts.length) t.push({ platform: 'tiktok', account_ids: postState.selectedTikTokAccounts, clip_id: getClipId('tiktok') })
    if (postState.targets.twitter) t.push({ platform: 'twitter', clip_id: getClipId('twitter') })
    return t
  }

  const buildInitialTargets = async () => {
    const t = []
    if (postState.targets.youtube) t.push({ id: 'youtube', platform: 'youtube', target_name: 'YouTube', status: 'queued', progress: 0 })
    if (postState.targets.instagram_reels) t.push({ id: 'ig_reels', platform: 'instagram_reels', target_name: 'Instagram Reels', status: 'queued', progress: 0 })
    if (postState.targets.instagram_feed) t.push({ id: 'ig_feed', platform: 'instagram_feed', target_name: 'Instagram Feed', status: 'queued', progress: 0 })

    // Fetch real Facebook page names so cards match SSE target_ids and progress counter is accurate
    if (postState.targets.facebook && postState.selectedFacebookPages.length) {
      try {
        const { data: pages } = await supabase
          .from('facebook_pages')
          .select('page_id, page_name, fan_count')
          .eq('user_id', user.id)
          .in('page_id', postState.selectedFacebookPages)
          .eq('is_active', true)
          .order('fan_count', { ascending: false })
        if (pages?.length) {
          pages.forEach(p => {
            t.push({
              id: `fb_${p.page_id}`,
              platform: 'facebook',
              target_name: p.page_name,
              status: 'queued',
              progress: 0
            })
          })
        } else {
          // Fallback if DB call fails: minimal placeholders by id
          postState.selectedFacebookPages.forEach(pageId => {
            t.push({ id: `fb_${pageId}`, platform: 'facebook', target_name: 'Facebook page', status: 'queued', progress: 0 })
          })
        }
      } catch {
        postState.selectedFacebookPages.forEach(pageId => {
          t.push({ id: `fb_${pageId}`, platform: 'facebook', target_name: 'Facebook page', status: 'queued', progress: 0 })
        })
      }
    }

    // Fetch real TikTok account names
    if (postState.targets.tiktok && postState.selectedTikTokAccounts.length) {
      try {
        const { data: accts } = await supabase
          .from('tiktok_accounts')
          .select('id, username, display_name')
          .eq('user_id', user.id)
          .in('id', postState.selectedTikTokAccounts)
          .eq('is_active', true)
        if (accts?.length) {
          accts.forEach(a => {
            t.push({
              id: `tiktok_${a.id}`,
              platform: 'tiktok',
              target_name: a.display_name || a.username || 'TikTok',
              status: 'queued',
              progress: 0
            })
          })
        } else {
          postState.selectedTikTokAccounts.forEach(accId => {
            t.push({ id: `tiktok_${accId}`, platform: 'tiktok', target_name: 'TikTok account', status: 'queued', progress: 0 })
          })
        }
      } catch {
        postState.selectedTikTokAccounts.forEach(accId => {
          t.push({ id: `tiktok_${accId}`, platform: 'tiktok', target_name: 'TikTok account', status: 'queued', progress: 0 })
        })
      }
    }

    if (postState.targets.twitter) t.push({ id: 'twitter', platform: 'twitter', target_name: 'X / Twitter', status: 'queued', progress: 0 })
    return t
  }

  const getClipId = (platform) => {
    const clip = postState.processedClips?.find(c => c.platform === platform)
    return clip?.id || null
  }

  const connectSSE = (jid) => {
    const es = getPublishProgress(jid)
    sseRef.current = es

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'progress') {
          setTargets(prev => {
            const hasExactMatch = prev.some(t => t.id === data.target_id)
            if (hasExactMatch) {
              return prev.map(t => t.id === data.target_id ? { ...t, ...data } : t)
            }
            const multiAccountPlatforms = ['facebook', 'tiktok']
            if (!multiAccountPlatforms.includes(data.platform)) {
              return prev.map(t => t.platform === data.platform ? { ...t, ...data } : t)
            }
            return [...prev, { id: data.target_id, ...data }]
          })
        }
        if (data.type === 'done') { setDone(true); es.close() }
        if (data.type === 'countdown') {
          setTargets(prev => prev.map(t => t.id === data.target_id ? { ...t, status: 'waiting', countdown: data.countdown } : t))
        }
      } catch {}
    }

    es.onerror = () => es.close()
  }

  const publishedTargets = targets.filter(t => t.status === 'published')
  const failedTargets = targets.filter(t => t.status === 'failed')
  const totalTargets = targets.filter(t => t.id !== 'fb_more').length

  const copyAllLinks = () => {
    const links = publishedTargets.map(t => t.post_url).filter(Boolean).join('\n')
    navigator.clipboard.writeText(links)
    toast.success('All links copied')
  }

  if (done) {
    const allOk = failedTargets.length === 0
    return (
      <div className="screen-pad">
        <div style={{ textAlign: 'center', padding: '32px 0 24px' }}>
          <div className="avatar-icon" style={{
            margin: '0 auto 18px', width: 64, height: 64,
            background: allOk ? 'var(--success-soft)' : 'var(--warning-soft)',
            color: allOk ? 'var(--success)' : 'var(--warning)'
          }}>
            <Sparkles size={28} />
          </div>
          <div className="t-display" style={{ marginBottom: 6 }}>
            {allOk ? 'All posted successfully' : `Posted with ${failedTargets.length} failure${failedTargets.length === 1 ? '' : 's'}`}
          </div>
          <div className="t-body-sm">
            <span className="t-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {publishedTargets.length}
            </span> of <span className="t-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{totalTargets}</span> published
          </div>
        </div>

        {publishedTargets.length > 0 && (
          <button onClick={copyAllLinks} className="btn-secondary" style={{ marginBottom: 16 }}>
            <Copy size={16} /> Copy all links
          </button>
        )}

        <div className="stack-sm" style={{ marginBottom: 20 }}>
          {publishedTargets.map(t => (
            <div key={t.id} className="card row-between" style={{ padding: '12px 14px' }}>
              <div className="t-h3 truncate-1">{t.target_name}</div>
              {t.post_url && (
                <a
                  href={t.post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="row"
                  style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600, textDecoration: 'none', gap: 4 }}
                >
                  Open <ExternalLink size={13} />
                </a>
              )}
            </div>
          ))}
          {failedTargets.map(t => (
            <div key={t.id} className="card" style={{ padding: '12px 14px', borderColor: 'rgba(239,68,68,0.28)' }}>
              <div className="t-h3" style={{ color: 'var(--danger)' }}>{t.target_name}</div>
              {t.error_message && <div className="t-body-sm" style={{ marginTop: 4 }}>{t.error_message}</div>}
            </div>
          ))}
        </div>

        <div className="stack-sm">
          <button className="btn-primary" onClick={() => { resetPost(); navigate('/upload') }}>
            <Plus size={16} /> Post another
          </button>
          <button className="btn-secondary" onClick={() => { resetPost(); navigate('/') }}>
            <Home size={16} /> Back to home
          </button>
        </div>
      </div>
    )
  }

  const publishedCount = targets.filter(t => t.status === 'published').length
  const totalCount = targets.filter(t => t.id !== 'fb_more').length
  const activeTarget = targets.find(t => t.status === 'uploading' || t.status === 'processing')
  const progressPct = totalCount ? Math.round((publishedCount / totalCount) * 100) : 0

  return (
    <div className="screen-pad">
      <div style={{ marginBottom: 20 }}>
        <div className="t-label" style={{ marginBottom: 6 }}>Publishing</div>
        <div className="t-display">Sending to platforms…</div>
        <div className="row-between" style={{ marginTop: 8 }}>
          <div className="t-body-sm">
            <span className="t-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{publishedCount}</span>
            <span> / </span>
            <span className="t-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{totalCount}</span>
            <span> published</span>
            {activeTarget && <span className="t-muted"> · next: {activeTarget.target_name}</span>}
          </div>
          <div className="t-mono" style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>{progressPct}%</div>
        </div>
        <div className="progress-bar" style={{ marginTop: 10 }}>
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {postState.scheduledAt ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <div className="avatar-icon" style={{ margin: '0 auto 14px', width: 56, height: 56 }}>
            <Calendar size={24} />
          </div>
          <div className="t-h2" style={{ marginBottom: 6 }}>Scheduled successfully</div>
          <div className="t-body-sm">
            Publishing at {new Date(postState.scheduledAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })} PKT
          </div>
        </div>
      ) : (
        <div className="stack-sm">
          {targets.map(t => <ProgressCard key={t.id} target={t} />)}
        </div>
      )}
    </div>
  )
}
