import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, CheckCircle, Loader, Scissors, Clock, MessageSquare, Sparkles, Image as ImageIcon, AlertTriangle } from 'lucide-react'
import { usePost } from '../context/PostContext'
import { useAuth } from '../context/AuthContext'
import { processVideo } from '../lib/api'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

const EDIT_FEATURES = [
  { key: 'crop',       label: 'Auto crop & resize',     desc: "Reformats video to each platform's spec",   Icon: Scissors,      serverOnly: true },
  { key: 'cut',        label: 'Auto cut to length',     desc: 'Trims video to max allowed per platform',   Icon: Clock,         serverOnly: true },
  { key: 'captions',   label: 'Auto captions (Whisper)',desc: 'Transcribes speech and burns subtitles',    Icon: MessageSquare, serverOnly: true },
  { key: 'highlights', label: 'Detect highlights',      desc: 'Detects the most engaging moments',         Icon: Sparkles,      serverOnly: true },
  { key: 'thumbnail',  label: 'Generate thumbnails',    desc: 'Picks 5 best frames — runs in your browser',Icon: ImageIcon,     serverOnly: false }
]

const seekTo = (video, time) => new Promise((resolve) => {
  const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve() }
  video.addEventListener('seeked', onSeeked)
  video.currentTime = time
})

const extractBrowserThumbnails = async (file, count = 5) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.src = url
    video.muted = true
    video.preload = 'metadata'

    video.addEventListener('error', () => { URL.revokeObjectURL(url); reject(new Error('Could not read video')) })

    video.addEventListener('loadedmetadata', async () => {
      try {
        const duration = video.duration
        if (!duration || !isFinite(duration)) { URL.revokeObjectURL(url); resolve([]); return }

        const canvas = document.createElement('canvas')
        const scale = Math.min(1, 640 / (video.videoWidth || 640))
        canvas.width = Math.round((video.videoWidth || 640) * scale)
        canvas.height = Math.round((video.videoHeight || 360) * scale)
        const ctx = canvas.getContext('2d')

        const blobs = []
        for (let i = 0; i < count; i++) {
          const t = (duration / (count + 1)) * (i + 1)
          await seekTo(video, t)
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85))
          if (blob) blobs.push(blob)
        }
        URL.revokeObjectURL(url)
        resolve(blobs)
      } catch (e) {
        URL.revokeObjectURL(url)
        reject(e)
      }
    })

    video.load()
  })
}

export default function AutoEdit() {
  const navigate = useNavigate()
  const { postState, updatePost } = usePost()
  const { user } = useAuth()
  const [processing, setProcessing] = useState(false)
  const [phase, setPhase] = useState('')
  const [stepsDone, setStepsDone] = useState({})
  const [thumbBlobs, setThumbBlobs] = useState([])
  const [thumbUrls, setThumbUrls] = useState([])
  const [selectedThumb, setSelectedThumb] = useState(null)
  const [uploadingThumb, setUploadingThumb] = useState(false)

  const toggleOption = (key) => {
    updatePost({ editOptions: { ...postState.editOptions, [key]: !postState.editOptions[key] } })
  }

  const doThumbnails = async () => {
    if (!postState.editOptions.thumbnail) return []
    const file = postState.videoFile
    if (!file || postState.mediaType === 'image') return []

    setPhase('thumbnails')
    try {
      const blobs = await extractBrowserThumbnails(file, 5)
      const urls = blobs.map(b => URL.createObjectURL(b))
      setThumbBlobs(blobs)
      setThumbUrls(urls)
      return blobs
    } catch {
      toast('Could not extract thumbnails from video', { icon: '⚠️' })
      return []
    }
  }

  const doServerProcessing = async () => {
    const serverOpts = ['crop', 'cut', 'captions', 'highlights']
    const hasServerWork = serverOpts.some(k => postState.editOptions[k])
    if (!hasServerWork) return { clips: [], thumbnails: [] }

    setPhase('server')
    const activeSteps = serverOpts.filter(k => postState.editOptions[k])
    for (const key of activeSteps) {
      setStepsDone(prev => ({ ...prev, [key]: 'processing' }))
      await new Promise(r => setTimeout(r, 400))
    }

    try {
      const result = await processVideo(postState.videoId, postState.editOptions)
      for (const key of activeSteps) setStepsDone(prev => ({ ...prev, [key]: 'done' }))
      return result
    } catch {
      for (const key of activeSteps) setStepsDone(prev => ({ ...prev, [key]: 'skipped' }))
      toast('Server processing unavailable — continuing with original video', { icon: '⚠️' })
      return { clips: [], thumbnails: [] }
    }
  }

  const handleProcess = async () => {
    if (!postState.videoId) { toast.error('No video uploaded'); navigate('/upload'); return }
    setProcessing(true)
    setStepsDone({})
    setThumbUrls([])
    setThumbBlobs([])
    setSelectedThumb(null)

    const extractedBlobs = await doThumbnails().catch(() => [])
    const serverData = await doServerProcessing().catch(() => ({ clips: [], thumbnails: [] }))

    updatePost({ processedClips: serverData?.clips || [], highlights: serverData?.highlights || [] })

    if (extractedBlobs.length > 0) {
      setPhase('pick')
      setProcessing(false)
    } else {
      updatePost({ thumbnailOptions: serverData?.thumbnails || [] })
      navigate('/hashtags')
    }
  }

  const uploadSelectedThumbnail = async (blob, index) => {
    if (!blob) return
    setSelectedThumb(index)
    setUploadingThumb(true)
    try {
      const path = `thumbnails/${user.id}/${postState.videoId}/${uid()}.jpg`
      const { error } = await supabase.storage.from('thumbnails').upload(path, blob, { contentType: 'image/jpeg' })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(path)
      await supabase.from('videos').update({ thumbnail_url: publicUrl }).eq('id', postState.videoId)
      updatePost({ thumbnailOptions: [publicUrl], selectedThumbnail: publicUrl })
      toast.success('Thumbnail saved')
      navigate('/hashtags')
    } catch (e) {
      toast.error('Failed to upload thumbnail: ' + e.message)
    } finally {
      setUploadingThumb(false)
    }
  }

  // Thumbnail picker screen
  if (phase === 'pick' && thumbUrls.length > 0) {
    return (
      <div className="screen-pad">
        <div style={{ marginBottom: 20 }}>
          <div className="t-label" style={{ marginBottom: 6 }}>Almost there</div>
          <div className="t-display">Pick a thumbnail</div>
          <div className="t-body-sm" style={{ marginTop: 4 }}>Tap a frame to use it, or skip to continue.</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {thumbUrls.map((url, i) => {
            const active = selectedThumb === i
            return (
              <div
                key={i}
                onClick={() => !uploadingThumb && uploadSelectedThumbnail(thumbBlobs[i], i)}
                style={{
                  borderRadius: 12, overflow: 'hidden',
                  border: `2px solid ${active ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  boxShadow: active ? '0 0 0 3px var(--accent-ring)' : 'none',
                  cursor: uploadingThumb ? 'default' : 'pointer',
                  position: 'relative', aspectRatio: '16/9',
                  background: 'var(--bg-sunken)',
                  transition: 'border-color 0.15s, box-shadow 0.15s'
                }}
              >
                <img src={url} alt={`Frame ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {active && uploadingThumb && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="spinner" />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button onClick={() => { updatePost({ thumbnailOptions: [] }); navigate('/hashtags') }} className="btn-ghost" style={{ width: '100%' }}>
          Skip — use no thumbnail
        </button>
      </div>
    )
  }

  // Processing screen
  if (processing) {
    const serverFeatures = EDIT_FEATURES.filter(f => f.serverOnly && postState.editOptions[f.key])
    return (
      <div className="screen-pad" style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="avatar-icon" style={{ margin: '0 auto 16px', width: 56, height: 56 }}>
            {phase === 'thumbnails' ? <ImageIcon size={26} /> : <Loader size={26} style={{ animation: 'spin 1.2s linear infinite' }} />}
          </div>
          <div className="t-display" style={{ marginBottom: 6 }}>
            {phase === 'thumbnails' ? 'Extracting thumbnails…' : 'Processing your video…'}
          </div>
          <div className="t-body-sm">
            {phase === 'thumbnails' ? 'Running in your browser — no upload needed.' : 'This may take a few minutes.'}
          </div>
        </div>

        {serverFeatures.length > 0 && (
          <div className="stack-sm">
            {serverFeatures.map(({ key, label, Icon }) => {
              const status = stepsDone[key]
              return (
                <div key={key} className="card row" style={{ padding: '12px 14px', gap: 12 }}>
                  <div className="avatar-icon" style={{ width: 32, height: 32 }}>
                    {status === 'done' ? <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                      : status === 'processing' ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      : status === 'skipped' ? <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
                      : <Icon size={16} />}
                  </div>
                  <div className="t-body" style={{
                    color: status === 'done' ? 'var(--success)'
                         : status === 'skipped' ? 'var(--warning)'
                         : status === 'processing' ? 'var(--text-primary)'
                         : 'var(--text-tertiary)'
                  }}>{label}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Main screen
  return (
    <div className="screen-pad">
      <div style={{ marginBottom: 20 }}>
        <div className="t-label" style={{ marginBottom: 6 }}>Step 2 of 4</div>
        <div className="t-display">Auto edit options</div>
        <div className="t-body-sm" style={{ marginTop: 4 }}>Choose what to apply before publishing.</div>
      </div>

      <div className="stack-sm" style={{ marginBottom: 20 }}>
        {EDIT_FEATURES.map(({ key, label, desc, Icon, serverOnly }) => {
          const enabled = postState.editOptions[key]
          return (
            <div
              key={key}
              className="card-interactive"
              onClick={() => toggleOption(key)}
              style={{
                padding: '14px 16px',
                borderColor: enabled ? 'var(--accent)' : 'var(--border-subtle)',
                background: enabled ? 'var(--accent-soft)' : 'var(--bg-elevated)'
              }}
            >
              <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                <div className="avatar-icon" style={{
                  background: enabled ? 'rgba(124,58,237,0.22)' : 'var(--bg-hover)',
                  color: enabled ? 'var(--accent)' : 'var(--text-secondary)'
                }}>
                  <Icon size={18} />
                </div>
                <div className="grow" style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 8, marginBottom: 2 }}>
                    <div className="t-h3">{label}</div>
                    <span className="badge" style={{
                      background: serverOnly ? 'var(--bg-hover)' : 'var(--success-soft)',
                      color: serverOnly ? 'var(--text-tertiary)' : 'var(--success)',
                      borderColor: serverOnly ? 'var(--border-subtle)' : 'rgba(16,185,129,0.28)'
                    }}>{serverOnly ? 'Cloud' : 'Browser'}</span>
                  </div>
                  <div className="t-body-sm">{desc}</div>
                  {key === 'captions' && enabled && (
                    <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                      {['urdu', 'english', 'both'].map(lang => {
                        const lActive = postState.editOptions.caption_language === lang
                        return (
                          <button
                            key={lang}
                            onClick={(e) => { e.stopPropagation(); updatePost({ editOptions: { ...postState.editOptions, caption_language: lang } }) }}
                            style={{
                              minHeight: 36, padding: '0 8px',
                              borderRadius: 8,
                              border: `1px solid ${lActive ? 'var(--accent)' : 'var(--border-strong)'}`,
                              background: lActive ? 'rgba(124,58,237,0.22)' : 'var(--bg-elevated)',
                              color: lActive ? 'var(--accent)' : 'var(--text-secondary)',
                              fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize'
                            }}
                          >
                            {lang}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div
                  className={`toggle ${enabled ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); toggleOption(key) }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="card" style={{ padding: '12px 14px', marginBottom: 24, borderLeft: '3px solid var(--accent)' }}>
        <div className="t-body-sm">
          <span style={{ color: 'var(--success)', fontWeight: 600 }}>Browser</span> features run instantly on your device.{' '}
          <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>Cloud</span> features use the server — if it's unavailable, they're skipped and you continue with the original video.
        </div>
      </div>

      <div className="stack-sm">
        <button className="btn-primary" onClick={handleProcess}>
          Start processing <ChevronRight size={18} />
        </button>
        <button onClick={() => navigate('/hashtags')} className="btn-ghost" style={{ width: '100%' }}>
          Skip — continue with original
        </button>
      </div>
    </div>
  )
}
