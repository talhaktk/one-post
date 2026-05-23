import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, CheckCircle, Loader } from 'lucide-react'
import { usePost } from '../context/PostContext'
import { useAuth } from '../context/AuthContext'
import { processVideo } from '../lib/api'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

const EDIT_FEATURES = [
  { key: 'crop', label: 'Auto Crop & Resize Per Platform', desc: "Reformats video to each platform's specs", icon: '✂️', serverOnly: true },
  { key: 'cut', label: 'Auto Cut To Platform Length', desc: 'Trims video to max allowed per platform', icon: '⏱️', serverOnly: true },
  { key: 'captions', label: 'Auto Generate Captions (Whisper AI)', desc: 'Transcribes speech and burns subtitles into video', icon: '💬', serverOnly: true },
  { key: 'highlights', label: 'Auto Detect Highlights', desc: 'Detects most engaging moments and creates clips', icon: '⚡', serverOnly: true },
  { key: 'thumbnail', label: 'Generate Thumbnails', desc: 'Picks best frames — runs in your browser, instant', icon: '🖼️', serverOnly: false }
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
  const [phase, setPhase] = useState('') // 'thumbnails' | 'server' | 'done'
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
    } catch (e) {
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
      // Show thumbnail picker — user picks one then we continue
      setPhase('pick')
      setProcessing(false)
    } else {
      // No thumbnails to pick — go straight to hashtags
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
      toast.success('Thumbnail saved!')
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
      <div style={{ padding: '0 16px 24px' }}>
        <div style={{ padding: '20px 0 16px' }}>
          <div style={{ fontSize: 22, fontFamily: 'Syne', fontWeight: 800 }}>Pick a Thumbnail</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Tap one to use it — or skip to continue</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {thumbUrls.map((url, i) => (
            <div key={i} onClick={() => uploadSelectedThumbnail(thumbBlobs[i], i)} style={{ borderRadius: 10, overflow: 'hidden', border: `2px solid ${selectedThumb === i ? '#7c3aed' : 'rgba(255,255,255,0.08)'}`, cursor: uploadingThumb ? 'default' : 'pointer', position: 'relative', aspectRatio: '16/9' }}>
              <img src={url} alt={`Frame ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {selectedThumb === i && uploadingThumb && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader size={24} color="#7c3aed" style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              )}
            </div>
          ))}
        </div>
        <button onClick={() => { updatePost({ thumbnailOptions: [] }); navigate('/hashtags') }} style={{ width: '100%', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 14, cursor: 'pointer', padding: '10px 0', textAlign: 'center' }}>
          Skip → Use no thumbnail
        </button>
      </div>
    )
  }

  // Processing screen
  if (processing) {
    const serverFeatures = EDIT_FEATURES.filter(f => f.serverOnly && postState.editOptions[f.key])
    return (
      <div style={{ padding: '0 16px', minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{phase === 'thumbnails' ? '🖼️' : '⚙️'}</div>
          <div style={{ fontSize: 22, fontFamily: 'Syne', fontWeight: 800, marginBottom: 8 }}>
            {phase === 'thumbnails' ? 'Extracting thumbnails...' : 'Processing your video...'}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            {phase === 'thumbnails' ? 'Running in your browser — no upload needed' : 'This may take a few minutes'}
          </div>
        </div>
        {serverFeatures.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {serverFeatures.map(f => {
              const status = stepsDone[f.key]
              return (
                <div key={f.key} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div>
                    {status === 'done' ? <CheckCircle size={20} color="#22c55e" /> : status === 'processing' ? <Loader size={20} color="#7c3aed" style={{ animation: 'spin 1s linear infinite' }} /> : status === 'skipped' ? <span style={{ fontSize: 16 }}>⚠️</span> : <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />}
                  </div>
                  <div style={{ fontSize: 14, color: status === 'done' ? '#22c55e' : status === 'skipped' ? '#f59e0b' : status === 'processing' ? '#c4b5fd' : 'rgba(255,255,255,0.4)' }}>{f.label}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ padding: '20px 0 16px' }}>
        <div style={{ fontSize: 22, fontFamily: 'Syne', fontWeight: 800 }}>Auto Edit Options</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Step 2 of 4 — Choose what to apply</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {EDIT_FEATURES.map(feature => {
          const enabled = postState.editOptions[feature.key]
          return (
            <div key={feature.key} className="card" style={{ padding: '16px', border: `1px solid ${enabled ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer' }} onClick={() => toggleOption(feature.key)}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ fontSize: 24, width: 36, flexShrink: 0 }}>{feature.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{feature.label}</div>
                    {feature.serverOnly
                      ? <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>Cloud</span>
                      : <span style={{ fontSize: 10, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 6px', borderRadius: 4 }}>Browser</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{feature.desc}</div>
                  {feature.key === 'captions' && enabled && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                      {['urdu', 'english', 'both'].map(lang => (
                        <button key={lang} onClick={(e) => { e.stopPropagation(); updatePost({ editOptions: { ...postState.editOptions, caption_language: lang } }) }} style={{ flex: 1, padding: '6px 4px', borderRadius: 8, border: `1px solid ${postState.editOptions.caption_language === lang ? '#7c3aed' : 'rgba(255,255,255,0.1)'}`, background: postState.editOptions.caption_language === lang ? 'rgba(124,58,237,0.2)' : 'transparent', color: postState.editOptions.caption_language === lang ? '#c4b5fd' : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                          {lang}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className={`toggle ${enabled ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleOption(feature.key) }} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="card" style={{ padding: '12px 16px', marginBottom: 20, borderLeft: '3px solid rgba(124,58,237,0.5)' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
          <span style={{ color: '#22c55e', fontWeight: 600 }}>Browser</span> features run instantly on your device.{' '}
          <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>Cloud</span> features use the server — if unavailable, they're skipped and you continue with the original video.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="btn-primary" onClick={handleProcess} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          Start Processing <ChevronRight size={18} />
        </button>
        <button onClick={() => navigate('/hashtags')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 14, cursor: 'pointer', padding: '8px 0', textAlign: 'center' }}>
          Skip → Continue with original video
        </button>
      </div>
    </div>
  )
}
