import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { ArrowLeft, ChevronRight, Upload, TrendingUp, Video, Image as ImageIcon, FileVideo, FileImage, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { createScheduledPost, fetchTrendingHashtags } from '../lib/api'
import FacebookPageItem from '../components/FacebookPageItem'
import TikTokAccountItem from '../components/TikTokAccountItem'
import HashtagChip from '../components/HashtagChip'
import PlatformIcon, { PLATFORM_BRAND_COLOR } from '../components/PlatformIcon'
import toast from 'react-hot-toast'

const BEST_TIMES = [
  { time: '8:00 AM – 9:00 AM', label: 'Morning', score: 2 },
  { time: '1:00 PM – 2:00 PM', label: 'Afternoon', score: 2 },
  { time: '7:00 PM – 9:00 PM', label: 'Evening', score: 3, best: true }
]

const VIDEO_PLATFORMS = [
  { key: 'youtube',         label: 'YouTube' },
  { key: 'instagram_reels', label: 'Instagram Reels' },
  { key: 'instagram_feed',  label: 'Instagram Feed' },
  { key: 'twitter',         label: 'X (Twitter)' }
]

const IMAGE_PLATFORMS = [
  { key: 'instagram_image', label: 'Instagram' },
  { key: 'twitter',         label: 'X (Twitter)' }
]

export default function CreateSchedule() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [mediaType, setMediaType] = useState('video')
  const [videoFile, setVideoFile] = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)
  const [title, setTitle] = useState('')
  const [captionUrdu, setCaptionUrdu] = useState('')
  const [captionEnglish, setCaptionEnglish] = useState('')
  const [captionTab, setCaptionTab] = useState('urdu')
  const [hashtags, setHashtags] = useState({ youtube: [], instagram: [], facebook: [], tiktok: [], twitter: [] })
  const [platforms, setPlatforms] = useState({ youtube: false, instagram_reels: false, instagram_feed: false, instagram_image: false, twitter: false })
  const [fbPages, setFbPages] = useState([])
  const [tikTok, setTikTok] = useState([])
  const [selectedPages, setSelectedPages] = useState(new Set())
  const [selectedTikTok, setSelectedTikTok] = useState(new Set())
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('19:00')
  const [timezone] = useState('Asia/Karachi')
  const [recurring, setRecurring] = useState(false)
  const [recurrenceRule, setRecurrenceRule] = useState('weekly')
  const [trending, setTrending] = useState([])
  const [saving, setSaving] = useState(false)

  const isImage = mediaType === 'image'
  const PLATFORMS_CONFIG = isImage ? IMAGE_PLATFORMS : VIDEO_PLATFORMS

  useEffect(() => {
    if (user) {
      supabase.from('facebook_pages').select('*').eq('user_id', user.id).eq('is_active', true).then(({ data }) => {
        setFbPages(data || [])
        setSelectedPages(new Set(data?.filter(p => p.is_selected_default).map(p => p.page_id) || []))
      })
      supabase.from('tiktok_accounts').select('*').eq('user_id', user.id).eq('is_active', true).then(({ data }) => {
        setTikTok(data || [])
        setSelectedTikTok(new Set(data?.map(a => a.id) || []))
      })
      const tomorrow = new Date(Date.now() + 86400000)
      setScheduledDate(tomorrow.toISOString().split('T')[0])
    }
  }, [user])

  const switchMode = (mode) => {
    if (videoFile) {
      if (videoPreview) URL.revokeObjectURL(videoPreview)
      setVideoFile(null)
      setVideoPreview(null)
    }
    setMediaType(mode)
    // Reset incompatible platform selections
    if (mode === 'image') {
      setPlatforms(prev => ({ ...prev, youtube: false, instagram_reels: false, instagram_feed: false }))
      setSelectedTikTok(new Set())
    } else {
      setPlatforms(prev => ({ ...prev, instagram_image: false }))
    }
  }

  const accept = isImage
    ? { 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'] }
    : { 'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm'] }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept, multiple: false, maxSize: 10 * 1024 * 1024 * 1024,
    onDrop: ([file]) => { if (file) { setVideoFile(file); setVideoPreview(URL.createObjectURL(file)) } }
  })

  const removeFile = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview)
    setVideoFile(null); setVideoPreview(null)
  }

  const loadTrending = async () => {
    try {
      const data = await fetchTrendingHashtags()
      setTrending(data.platforms?.twitter?.slice(0, 10) || [])
      toast.success('Trends fetched')
    } catch { toast.error('Failed to fetch trends') }
  }

  const addHashtag = (tag, platform = 'youtube') => {
    const clean = tag.replace(/^#/, '')
    if (!hashtags[platform].includes(clean)) {
      setHashtags(prev => ({ ...prev, [platform]: [...prev[platform], clean] }))
    }
  }

  const getNextOccurrences = () => {
    if (!scheduledDate || !recurring) return []
    const base = new Date(`${scheduledDate}T${scheduledTime}`)
    return Array.from({ length: 5 }).map((_, i) => {
      const d = new Date(base)
      if (recurrenceRule === 'daily') d.setDate(d.getDate() + i)
      if (recurrenceRule === 'weekly') d.setDate(d.getDate() + i * 7)
      if (recurrenceRule === 'monthly') d.setMonth(d.getMonth() + i)
      return d.toLocaleDateString('en-PK', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    })
  }

  const handleSave = async (postNow = false) => {
    if (!videoFile && !title) { toast.error(`Please add a ${isImage ? 'image' : 'video'} and title`); return }
    if (!postNow && !scheduledDate) { toast.error('Please select a date'); return }
    setSaving(true)
    try {
      const scheduledAt = postNow ? new Date().toISOString() : new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
      const formData = new FormData()
      if (videoFile) formData.append('video', videoFile)
      formData.append('title', title)
      formData.append('caption_urdu', captionUrdu)
      formData.append('caption_english', captionEnglish)
      formData.append('hashtags_per_platform', JSON.stringify(hashtags))
      formData.append('target_platforms', JSON.stringify(platforms))
      formData.append('target_facebook_pages', JSON.stringify([...selectedPages]))
      formData.append('target_tiktok_accounts', JSON.stringify(isImage ? [] : [...selectedTikTok]))
      formData.append('scheduled_at', scheduledAt)
      formData.append('timezone', timezone)
      formData.append('is_recurring', recurring)
      formData.append('media_type', mediaType)
      if (recurring) formData.append('recurrence_rule', recurrenceRule)
      await createScheduledPost(formData)
      toast.success(postNow ? 'Publishing now!' : 'Post scheduled!')
      navigate('/schedule/list')
    } catch (err) { toast.error(err.message || 'Failed to schedule') }
    finally { setSaving(false) }
  }

  const STEPS = ['Content', 'Captions', 'Platforms', 'Schedule', 'Review']

  return (
    <div className="screen-pad">
      <div className="page-header">
        <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/schedule')} className="icon-btn" aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div className="grow">
          <div className="t-label" style={{ marginBottom: 4 }}>Step {step} of 5</div>
          <div className="t-h1">{STEPS[step - 1]}</div>
        </div>
      </div>

      {/* Step progress */}
      <div className="row" style={{ gap: 4, marginBottom: 20 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 999, background: i < step ? 'var(--accent)' : 'var(--border-strong)' }} />
        ))}
      </div>

      {/* STEP 1: Content */}
      {step === 1 && (
        <div className="stack-lg">
          {/* Video / Image segmented control */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
            background: 'var(--bg-elevated)',
            padding: 4, borderRadius: 12,
            border: '1px solid var(--border-subtle)'
          }}>
            {[
              { mode: 'video', icon: <Video size={15} />, label: 'Video' },
              { mode: 'image', icon: <ImageIcon size={15} />, label: 'Image' }
            ].map(({ mode, icon, label }) => {
              const active = mediaType === mode
              return (
                <button
                  key={mode}
                  onClick={() => switchMode(mode)}
                  style={{
                    minHeight: 40, border: 'none', borderRadius: 9,
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? 'white' : 'var(--text-secondary)',
                    fontSize: 14, fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'background 0.15s, color 0.15s'
                  }}
                >
                  {icon} {label}
                </button>
              )
            })}
          </div>

          {/* Dropzone or preview */}
          {!videoFile ? (
            <div
              {...getRootProps()}
              style={{
                border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border-strong)'}`,
                borderRadius: 16,
                padding: '40px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                background: isDragActive ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                transition: 'all 0.15s'
              }}
            >
              <input {...getInputProps()} />
              <div className="avatar-icon" style={{ width: 56, height: 56, margin: '0 auto 14px' }}>
                {isDragActive ? <Upload size={26} /> : isImage ? <FileImage size={26} /> : <FileVideo size={26} />}
              </div>
              <div className="t-h2" style={{ marginBottom: 6 }}>
                {isDragActive ? 'Drop to upload' : isImage ? 'Tap to select image' : 'Tap to select video'}
              </div>
              <div className="t-body-sm">
                {isImage ? 'JPG, PNG, GIF, WebP — up to 10 GB' : 'MP4, MOV, AVI, MKV, WebM — up to 10 GB'}
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 12 }}>
              {isImage ? (
                <img src={videoPreview} alt="preview" style={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 10, marginBottom: 10, background: 'var(--bg-sunken)' }} />
              ) : (
                <video src={videoPreview} controls style={{ width: '100%', borderRadius: 10, marginBottom: 10, background: 'var(--bg-sunken)' }} />
              )}
              <div className="row-between" style={{ padding: '4px 4px 0' }}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="t-h3 truncate-1">{videoFile.name}</div>
                  <div className="t-caption" style={{ marginTop: 4 }}>{(videoFile.size / 1024 / 1024).toFixed(1)} MB</div>
                </div>
                <button onClick={removeFile} className="btn-danger btn-sm" style={{ width: 'auto', padding: '0 12px' }}>
                  <X size={14} /> Remove
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="input-label">Post title <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input className="input" placeholder="Enter a clear title…" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <button className="btn-primary" onClick={() => setStep(2)} disabled={!title || !videoFile}>
            Continue <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* STEP 2: Captions */}
      {step === 2 && (
        <div className="stack-lg">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {['urdu', 'english'].map(t => {
              const active = captionTab === t
              return (
                <button
                  key={t}
                  onClick={() => setCaptionTab(t)}
                  style={{
                    minHeight: 44, padding: '0 12px',
                    borderRadius: 10,
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border-strong)'}`,
                    background: active ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor: 'pointer', fontWeight: 600, fontSize: 14
                  }}
                >
                  {t === 'urdu' ? 'اردو Caption' : 'English Caption'}
                </button>
              )
            })}
          </div>
          <textarea
            className="input"
            rows={8}
            value={captionTab === 'urdu' ? captionUrdu : captionEnglish}
            onChange={e => captionTab === 'urdu' ? setCaptionUrdu(e.target.value) : setCaptionEnglish(e.target.value)}
            placeholder={captionTab === 'urdu' ? 'اردو میں کیپشن لکھیں...' : 'Write English caption...'}
            style={{ direction: captionTab === 'urdu' ? 'rtl' : 'ltr' }}
          />

          <div>
            <div className="t-h2" style={{ marginBottom: 10 }}>Hashtags</div>
            <button onClick={loadTrending} className="btn-secondary btn-sm" style={{ width: 'auto', padding: '0 14px' }}>
              <TrendingUp size={14} /> Fetch live trending
            </button>
            {trending.length > 0 && (
              <div className="chip-row" style={{ marginTop: 12 }}>
                {trending.map(t => <HashtagChip key={t.tag || t} tag={t.tag || t} trending onAdd={(tag) => addHashtag(tag)} />)}
              </div>
            )}
          </div>

          <button className="btn-primary" onClick={() => setStep(3)}>
            Continue <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* STEP 3: Platforms */}
      {step === 3 && (
        <div className="stack-lg">
          <div className="stack-sm">
            {PLATFORMS_CONFIG.map(({ key, label }) => {
              const enabled = platforms[key]
              const color = PLATFORM_BRAND_COLOR[key] || 'var(--accent)'
              return (
                <div
                  key={key}
                  className="card-interactive"
                  onClick={() => setPlatforms(prev => ({ ...prev, [key]: !prev[key] }))}
                  style={{
                    padding: '12px 14px',
                    borderColor: enabled ? 'var(--accent)' : 'var(--border-subtle)',
                    background: enabled ? 'var(--accent-soft)' : 'var(--bg-elevated)'
                  }}
                >
                  <div className="row" style={{ gap: 12 }}>
                    <span style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: `${color}1f`, color,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <PlatformIcon platform={key} size={18} />
                    </span>
                    <div className="grow t-h3" style={{ flex: 1 }}>{label}</div>
                    <div
                      className={`toggle ${enabled ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setPlatforms(prev => ({ ...prev, [key]: !prev[key] })) }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Facebook Pages */}
          <div className="card">
            <div className="row" style={{ gap: 10, marginBottom: 10 }}>
              <span style={{
                width: 28, height: 28, borderRadius: 7,
                background: 'rgba(24,119,242,0.18)', color: '#1877F2',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
              }}><PlatformIcon platform="facebook" size={14} /></span>
              <div className="t-h3">Facebook pages</div>
              <div className="t-body-sm grow" style={{ textAlign: 'right' }}>
                <span className="t-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedPages.size}</span>
                {' / '}{fbPages.length}
              </div>
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {fbPages.map(p => (
                <FacebookPageItem
                  key={p.id}
                  page={p}
                  selected={selectedPages.has(p.page_id)}
                  onToggle={(pid) => { const s = new Set(selectedPages); s.has(pid) ? s.delete(pid) : s.add(pid); setSelectedPages(s) }}
                />
              ))}
            </div>
          </div>

          {/* TikTok Accounts — video only */}
          {!isImage && (
            <div className="card">
              <div className="row" style={{ gap: 10, marginBottom: 10 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: 'rgba(0,0,0,0.85)', color: 'white',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                }}><PlatformIcon platform="tiktok" size={14} /></span>
                <div className="t-h3">TikTok accounts</div>
                <div className="t-body-sm grow" style={{ textAlign: 'right' }}>
                  <span className="t-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedTikTok.size}</span>
                  {' / '}{tikTok.length}
                </div>
              </div>
              {tikTok.map(a => (
                <TikTokAccountItem
                  key={a.id}
                  account={a}
                  selected={selectedTikTok.has(a.id)}
                  onToggle={(aid) => { const s = new Set(selectedTikTok); s.has(aid) ? s.delete(aid) : s.add(aid); setSelectedTikTok(s) }}
                />
              ))}
            </div>
          )}

          <button className="btn-primary" onClick={() => setStep(4)}>
            Continue <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* STEP 4: Schedule */}
      {step === 4 && (
        <div className="stack-lg">
          <div className="card">
            <div className="t-h2" style={{ marginBottom: 12 }}>Pick date & time</div>
            <div>
              <label className="input-label">Date</label>
              <input type="date" className="input" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
            </div>
            <div style={{ marginTop: 12 }}>
              <label className="input-label">Time (PKT)</label>
              <input type="time" className="input" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
            </div>
            {scheduledDate && scheduledTime && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 10 }}>
                <span className="t-body-sm" style={{ color: 'var(--accent)' }}>
                  {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString('en-PK', { timeZone: 'Asia/Karachi', weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} PKT
                </span>
              </div>
            )}
          </div>

          <div className="card">
            <div className="t-h3" style={{ marginBottom: 10 }}>Best times to post in Pakistan</div>
            {BEST_TIMES.map((t, i, arr) => (
              <div
                key={t.time}
                onClick={() => setScheduledTime(t.time.split('–')[0].trim().replace(' AM', '').replace(' PM', '').padStart(5, '0'))}
                className="row-between"
                style={{ padding: '10px 0', borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--border-subtle)', cursor: 'pointer' }}
              >
                <div>
                  <span className="t-h3">{t.label}</span>
                  <span className="t-caption" style={{ marginLeft: 8 }}>{t.time}</span>
                </div>
                {t.best && <span className="badge badge-important">🔥 Best</span>}
              </div>
            ))}
          </div>

          <div className="card">
            <div className="row-between" style={{ marginBottom: recurring ? 12 : 0 }}>
              <div className="t-h3">Repeat this post</div>
              <div className={`toggle ${recurring ? 'active' : ''}`} onClick={() => setRecurring(r => !r)} />
            </div>
            {recurring && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                  {['daily', 'weekly', 'monthly'].map(r => {
                    const active = recurrenceRule === r
                    return (
                      <button
                        key={r}
                        onClick={() => setRecurrenceRule(r)}
                        style={{
                          minHeight: 40, padding: '0 10px',
                          borderRadius: 9,
                          border: `1px solid ${active ? 'var(--accent)' : 'var(--border-strong)'}`,
                          background: active ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                          color: active ? 'var(--accent)' : 'var(--text-secondary)',
                          cursor: 'pointer', fontSize: 13, fontWeight: 600, textTransform: 'capitalize'
                        }}
                      >{r}</button>
                    )
                  })}
                </div>
                <div className="t-caption" style={{ marginBottom: 8 }}>Next 5 occurrences:</div>
                {getNextOccurrences().map((d, i) => (
                  <div key={i} className="t-body-sm" style={{ padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>{d}</div>
                ))}
              </>
            )}
          </div>

          <button className="btn-primary" onClick={() => setStep(5)}>
            Continue <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* STEP 5: Review */}
      {step === 5 && (
        <div className="stack-lg">
          <div className="card">
            <div className="t-h2" style={{ marginBottom: 12 }}>Review & confirm</div>
            {[
              ['Type', isImage ? 'Image' : 'Video'],
              ['Title', title],
              ['Scheduled', scheduledDate ? `${scheduledDate} · ${scheduledTime} PKT` : 'Not set'],
              ['Platforms', Object.entries(platforms).filter(([, v]) => v).map(([k]) => k.replace('_', ' ')).join(', ') || 'None'],
              ['Facebook pages', selectedPages.size > 0 ? `${selectedPages.size} pages` : 'None'],
              ...(isImage ? [] : [['TikTok accounts', selectedTikTok.size > 0 ? `${selectedTikTok.size} accounts` : 'None']]),
              ['Recurring', recurring ? recurrenceRule : 'No']
            ].map(([label, value], i, arr) => (
              <div
                key={label}
                className="row-between"
                style={{ padding: '10px 0', borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}
              >
                <span className="t-body-sm">{label}</span>
                <span style={{ fontWeight: 600, maxWidth: '60%', textAlign: 'right', color: 'var(--text-primary)', fontSize: 13 }}>{value}</span>
              </div>
            ))}
          </div>

          <div className="stack-sm">
            <button className="btn-primary" onClick={() => handleSave(false)} disabled={saving}>
              {saving ? 'Scheduling…' : 'Confirm schedule'}
            </button>
            <button className="btn-secondary" onClick={() => handleSave(true)} disabled={saving}>
              {saving ? 'Publishing…' : 'Post now instead'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
