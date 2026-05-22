import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, Copy, ExternalLink } from 'lucide-react'
import { usePost } from '../context/PostContext'
import { useAuth } from '../context/AuthContext'
import { publishPost, getPublishProgress } from '../lib/api'
import ProgressCard from '../components/ProgressCard'
import toast from 'react-hot-toast'

export default function Publishing() {
  const navigate = useNavigate()
  const { postState, resetPost } = usePost()
  const { user } = useAuth()
  const [jobId, setJobId] = useState(null)
  const [targets, setTargets] = useState([])
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState(false)
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

      const initTargets = buildInitialTargets()
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

  const buildInitialTargets = () => {
    const t = []
    if (postState.targets.youtube) t.push({ id: 'youtube', platform: 'youtube', target_name: 'YouTube', status: 'queued', progress: 0 })
    if (postState.targets.instagram_reels) t.push({ id: 'ig_reels', platform: 'instagram_reels', target_name: 'Instagram Reels', status: 'queued', progress: 0 })
    if (postState.targets.instagram_feed) t.push({ id: 'ig_feed', platform: 'instagram_feed', target_name: 'Instagram Feed', status: 'queued', progress: 0 })
    if (postState.targets.facebook) {
      // add wait card first then individual pages
      postState.selectedFacebookPages.slice(0, 3).forEach((pageId, i) => {
        t.push({ id: `fb_${pageId}`, platform: 'facebook', target_name: `Facebook Page ${i + 1}`, status: 'queued', progress: 0 })
      })
      if (postState.selectedFacebookPages.length > 3) {
        t.push({ id: 'fb_more', platform: 'facebook', target_name: `+ ${postState.selectedFacebookPages.length - 3} more pages`, status: 'queued', progress: 0 })
      }
    }
    if (postState.targets.tiktok) {
      postState.selectedTikTokAccounts.forEach((accId, i) => {
        t.push({ id: `tiktok_${accId}`, platform: 'tiktok', target_name: `TikTok Account ${i + 1}`, status: 'queued', progress: 0 })
      })
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
          setTargets(prev => prev.map(t => t.id === data.target_id || t.platform === data.platform ? { ...t, ...data } : t))
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
    toast.success('All links copied!')
  }

  if (done) return (
    <div style={{ padding: '24px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>{failedTargets.length === 0 ? '🎉' : '⚠️'}</div>
      <div style={{ fontSize: 24, fontFamily: 'Syne', fontWeight: 800, marginBottom: 8 }}>
        {failedTargets.length === 0 ? 'All Posted Successfully!' : `Posted with ${failedTargets.length} failures`}
      </div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>
        {publishedTargets.length} of {totalTargets} published
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
        <button onClick={copyAllLinks} className="btn-secondary" style={{ width: 'auto', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Copy size={16} /> Copy All Links
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24, textAlign: 'left' }}>
        {publishedTargets.map(t => (
          <div key={t.id} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{t.target_name}</div>
            {t.post_url && <a href={t.post_url} target="_blank" rel="noopener noreferrer" style={{ color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><ExternalLink size={14} /> View</a>}
          </div>
        ))}
        {failedTargets.length > 0 && failedTargets.map(t => (
          <div key={t.id} className="card" style={{ padding: '12px 14px', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f87171' }}>❌ {t.target_name}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{t.error_message}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="btn-primary" onClick={() => { resetPost(); navigate('/upload') }}>Post Another Video</button>
        <button className="btn-secondary" onClick={() => { resetPost(); navigate('/') }}>Back to Home</button>
      </div>
    </div>
  )

  const publishedCount = targets.filter(t => t.status === 'published').length
  const totalCount = targets.filter(t => t.id !== 'fb_more').length
  const activeTarget = targets.find(t => t.status === 'uploading' || t.status === 'processing')

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ padding: '20px 0 16px' }}>
        <div style={{ fontSize: 22, fontFamily: 'Syne', fontWeight: 800 }}>Publishing...</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
          {publishedCount}/{totalCount} published
          {activeTarget && <> · Next: {activeTarget.target_name}</>}
        </div>
        <div className="progress-bar" style={{ marginTop: 10 }}>
          <div className="progress-fill" style={{ width: `${(publishedCount / Math.max(totalCount, 1)) * 100}%` }} />
        </div>
      </div>

      {postState.scheduledAt ? (
        <div className="card" style={{ padding: '20px', textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📅</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Scheduled Successfully</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
            Will publish at {new Date(postState.scheduledAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })} PKT
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {targets.map(t => <ProgressCard key={t.id} target={t} />)}
        </div>
      )}
    </div>
  )
}
