import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, CheckCircle, Loader } from 'lucide-react'
import { usePost } from '../context/PostContext'
import { processVideo } from '../lib/api'
import toast from 'react-hot-toast'

const EDIT_FEATURES = [
  { key: 'crop', label: 'Auto Crop & Resize Per Platform', desc: 'Automatically reformats video to each platform\'s specs', icon: '✂️' },
  { key: 'cut', label: 'Auto Cut To Platform Length', desc: 'Trims video to max allowed per platform', icon: '⏱️' },
  { key: 'captions', label: 'Auto Generate Captions (Whisper AI)', desc: 'Transcribes speech and burns subtitles into video', icon: '💬' },
  { key: 'highlights', label: 'Auto Detect Highlights & Create Clips', desc: 'Detects most engaging moments and creates short clips', icon: '⚡' },
  { key: 'thumbnail', label: 'Auto Generate Thumbnail', desc: 'Picks best frame and shows 5 thumbnail options', icon: '🖼️' }
]

const PROGRESS_STEPS = [
  { key: 'crop', label: 'Cropping for platforms...' },
  { key: 'cut', label: 'Cutting to platform length...' },
  { key: 'captions', label: 'Generating captions...' },
  { key: 'highlights', label: 'Detecting highlights...' },
  { key: 'thumbnail', label: 'Creating thumbnails...' }
]

export default function AutoEdit() {
  const navigate = useNavigate()
  const { postState, updatePost } = usePost()
  const [processing, setProcessing] = useState(false)
  const [stepsDone, setStepsDone] = useState({})

  const toggleOption = (key) => {
    updatePost({ editOptions: { ...postState.editOptions, [key]: !postState.editOptions[key] } })
  }

  const handleProcess = async () => {
    if (!postState.videoId) { toast.error('No video uploaded'); navigate('/upload'); return }
    setProcessing(true)
    setStepsDone({})
    try {
      // Simulate step-by-step progress via polling/SSE
      const activeSteps = PROGRESS_STEPS.filter(s => postState.editOptions[s.key])
      for (let i = 0; i < activeSteps.length; i++) {
        await new Promise(r => setTimeout(r, 800))
        setStepsDone(prev => ({ ...prev, [activeSteps[i].key]: 'processing' }))
      }
      const result = await processVideo(postState.videoId, postState.editOptions)
      updatePost({ processedClips: result.clips || [], thumbnailOptions: result.thumbnails || [], highlights: result.highlights || [] })
      for (const step of activeSteps) setStepsDone(prev => ({ ...prev, [step.key]: 'done' }))
      await new Promise(r => setTimeout(r, 600))
      navigate('/hashtags')
    } catch (err) {
      toast.error(err.message || 'Processing failed')
      setProcessing(false)
    }
  }

  if (processing) return (
    <div style={{ padding: '0 16px', minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
        <div style={{ fontSize: 22, fontFamily: 'Syne', fontWeight: 800, marginBottom: 8 }}>Processing your video...</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>This may take a few minutes</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {PROGRESS_STEPS.filter(s => postState.editOptions[s.key]).map(step => {
          const status = stepsDone[step.key]
          return (
            <div key={step.key} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                {status === 'done' ? <CheckCircle size={20} color="#22c55e" /> : status === 'processing' ? <Loader size={20} color="#7c3aed" style={{ animation: 'spin 1s linear infinite' }} /> : <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />}
              </div>
              <div style={{ fontSize: 14, color: status === 'done' ? '#22c55e' : status === 'processing' ? '#c4b5fd' : 'rgba(255,255,255,0.4)' }}>{step.label}</div>
              {status === 'done' && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#22c55e' }}>✓</span>}
            </div>
          )
        })}
      </div>
    </div>
  )

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
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{feature.label}</div>
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

      {/* Platform specs reference */}
      <div className="card" style={{ padding: '14px 16px', marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#a78bfa' }}>📐 Platform Specs (Auto Applied)</div>
        {[
          ['YouTube Full', '16:9', '1920×1080', '12h'],
          ['YouTube Shorts', '9:16', '1080×1920', '60s'],
          ['Instagram Reels', '9:16', '1080×1920', '90s'],
          ['Instagram Feed', '1:1', '1080×1080', '60s'],
          ['Facebook Video', '16:9', '1920×1080', '240m'],
          ['TikTok', '9:16', '1080×1920', '10m'],
          ['X/Twitter', '16:9', '1280×720', '140s']
        ].map(([name, ratio, res, max]) => (
          <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12 }}>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>{name}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>{ratio} · {res} · max {max}</span>
          </div>
        ))}
      </div>

      <button className="btn-primary" onClick={handleProcess} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        Start Processing <ChevronRight size={18} />
      </button>
    </div>
  )
}
