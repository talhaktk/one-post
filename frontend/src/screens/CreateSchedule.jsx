import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { ArrowLeft, ChevronRight, Upload, TrendingUp } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { createScheduledPost, fetchTrendingHashtags } from '../lib/api'
import FacebookPageItem from '../components/FacebookPageItem'
import TikTokAccountItem from '../components/TikTokAccountItem'
import HashtagChip from '../components/HashtagChip'
import toast from 'react-hot-toast'

const CHAR_LIMITS = { facebook: 63206, instagram: 2200, tiktok: 2200, twitter: 280, youtube: 5000 }
const BEST_TIMES = [
  { time: '8:00 AM – 9:00 AM', label: 'Morning', score: 2 },
  { time: '1:00 PM – 2:00 PM', label: 'Afternoon', score: 2 },
  { time: '7:00 PM – 9:00 PM', label: 'Evening', score: 3, best: true }
]

export default function CreateSchedule() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [videoFile, setVideoFile] = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)
  const [title, setTitle] = useState('')
  const [captionUrdu, setCaptionUrdu] = useState('')
  const [captionEnglish, setCaptionEnglish] = useState('')
  const [captionTab, setCaptionTab] = useState('urdu')
  const [hashtags, setHashtags] = useState({ youtube: [], instagram: [], facebook: [], tiktok: [], twitter: [] })
  const [platforms, setPlatforms] = useState({ youtube: false, instagram_reels: false, instagram_feed: false, twitter: false })
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

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'video/*': [] }, multiple: false,
    onDrop: ([file]) => { setVideoFile(file); setVideoPreview(URL.createObjectURL(file)) }
  })

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
    if (!videoFile && !title) { toast.error('Please add a video and title'); return }
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
      formData.append('target_tiktok_accounts', JSON.stringify([...selectedTikTok]))
      formData.append('scheduled_at', scheduledAt)
      formData.append('timezone', timezone)
      formData.append('is_recurring', recurring)
      if (recurring) formData.append('recurrence_rule', recurrenceRule)
      await createScheduledPost(formData)
      toast.success(postNow ? 'Publishing now!' : 'Post scheduled!')
      navigate('/schedule/list')
    } catch (err) { toast.error(err.message || 'Failed to schedule') }
    finally { setSaving(false) }
  }

  const STEPS = ['Content', 'Captions', 'Platforms', 'Schedule', 'Review']

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0 8px' }}>
        <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/schedule')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>
          <ArrowLeft size={22} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontFamily: 'Syne', fontWeight: 800 }}>Create Scheduled Post</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Step {step} of 5 — {STEPS[step - 1]}</div>
        </div>
      </div>

      {/* Step progress */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {STEPS.map((_, i) => <div key={i} style={{ flex: 1, height: 3, borderRadius: 999, background: i < step ? '#f97316' : 'var(--border-strong)' }} />)}
      </div>

      {/* STEP 1: Content */}
      {step === 1 && (
        <div>
          {!videoFile ? (
            <div {...getRootProps()} style={{ border: '2px dashed var(--border-strong)', borderRadius: 20, padding: '40px 24px', textAlign: 'center', cursor: 'pointer', marginBottom: 20 }}>
              <input {...getInputProps()} />
              <Upload size={40} color="#f97316" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 700 }}>Upload Video</div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6 }}>MP4, MOV, AVI — tap to select</div>
            </div>
          ) : (
            <div className="card" style={{ padding: 14, marginBottom: 20 }}>
              <video src={videoPreview} controls style={{ width: '100%', borderRadius: 10, marginBottom: 10 }} />
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{videoFile.name} — {(videoFile.size / 1024 / 1024).toFixed(1)}MB</div>
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Post Title *</label>
            <input className="input" placeholder="Enter title..." value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={() => setStep(2)} disabled={!title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            Next <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* STEP 2: Captions */}
      {step === 2 && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {['urdu', 'english'].map(t => (
              <button key={t} onClick={() => setCaptionTab(t)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${captionTab === t ? '#f97316' : 'var(--border-strong)'}`, background: captionTab === t ? 'rgba(249,115,22,0.15)' : 'transparent', color: captionTab === t ? '#fdba74' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, textTransform: 'capitalize' }}>
                {t === 'urdu' ? 'اردو Caption' : 'English Caption'}
              </button>
            ))}
          </div>
          <textarea className="input" rows={8} value={captionTab === 'urdu' ? captionUrdu : captionEnglish} onChange={e => captionTab === 'urdu' ? setCaptionUrdu(e.target.value) : setCaptionEnglish(e.target.value)} placeholder={captionTab === 'urdu' ? 'اردو میں کیپشن لکھیں...' : 'Write English caption...'} style={{ direction: captionTab === 'urdu' ? 'rtl' : 'ltr', marginBottom: 14 }} />
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Hashtags</div>
          <button onClick={loadTrending} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', color: '#fb923c', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}>
            <TrendingUp size={14} /> Fetch Live Trending
          </button>
          {trending.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {trending.map(t => <HashtagChip key={t.tag || t} tag={t.tag || t} trending onAdd={(tag) => addHashtag(tag)} />)}
            </div>
          )}
          <button className="btn-primary" onClick={() => setStep(3)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            Next <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* STEP 3: Platforms */}
      {step === 3 && (
        <div>
          {['youtube', 'instagram_reels', 'instagram_feed', 'twitter'].map(p => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)', borderRadius: 12, marginBottom: 8 }}>
              <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{p.replace('_', ' ')}</span>
              <div className={`toggle ${platforms[p] ? 'active' : ''}`} onClick={() => setPlatforms(prev => ({ ...prev, [p]: !prev[p] }))} />
            </div>
          ))}

          {/* Facebook */}
          <div style={{ padding: '14px 16px', background: 'rgba(24,119,242,0.06)', border: '1px solid rgba(24,119,242,0.2)', borderRadius: 12, marginBottom: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>🔵 Facebook Pages ({selectedPages.size}/{fbPages.length} selected)</div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {fbPages.map(p => <FacebookPageItem key={p.id} page={p} selected={selectedPages.has(p.page_id)} onToggle={(pid) => { const s = new Set(selectedPages); s.has(pid) ? s.delete(pid) : s.add(pid); setSelectedPages(s) }} />)}
            </div>
          </div>

          {/* TikTok */}
          <div style={{ padding: '14px 16px', background: 'rgba(105,201,208,0.06)', border: '1px solid rgba(105,201,208,0.2)', borderRadius: 12, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>🎵 TikTok Accounts ({selectedTikTok.size}/{tikTok.length})</div>
            {tikTok.map(a => <TikTokAccountItem key={a.id} account={a} selected={selectedTikTok.has(a.id)} onToggle={(aid) => { const s = new Set(selectedTikTok); s.has(aid) ? s.delete(aid) : s.add(aid); setSelectedTikTok(s) }} />)}
          </div>
          <button className="btn-primary" onClick={() => setStep(4)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>Next <ChevronRight size={18} /></button>
        </div>
      )}

      {/* STEP 4: Schedule */}
      {step === 4 && (
        <div>
          <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📅 Pick Date & Time</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Date</label>
              <input type="date" className="input" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Time (PKT)</label>
              <input type="time" className="input" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
            </div>
            {scheduledDate && scheduledTime && (
              <div style={{ padding: '10px 12px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 10, fontSize: 13, color: '#fdba74' }}>
                📍 {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString('en-PK', { timeZone: 'Asia/Karachi', weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} PKT
              </div>
            )}
          </div>

          <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>📈 Best Times to Post in Pakistan</div>
            {BEST_TIMES.map(t => (
              <div key={t.time} onClick={() => setScheduledTime(t.time.split('–')[0].trim().replace(' AM', '').replace(' PM', '').padStart(5, '0'))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 8 }}>{t.time}</span>
                </div>
                {t.best && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>🔥 Best</span>}
              </div>
            ))}
          </div>

          {/* Recurring */}
          <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: recurring ? 12 : 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>🔁 Repeat this post</div>
              <div className={`toggle ${recurring ? 'active' : ''}`} onClick={() => setRecurring(r => !r)} />
            </div>
            {recurring && (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {['daily', 'weekly', 'monthly'].map(r => (
                    <button key={r} onClick={() => setRecurrenceRule(r)} style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `1px solid ${recurrenceRule === r ? '#f97316' : 'var(--border-strong)'}`, background: recurrenceRule === r ? 'rgba(249,115,22,0.15)' : 'transparent', color: recurrenceRule === r ? '#fdba74' : 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
                      {r}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>Next 5 occurrences:</div>
                {getNextOccurrences().map((d, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>📅 {d}</div>
                ))}
              </>
            )}
          </div>
          <button className="btn-primary" onClick={() => setStep(5)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>Next <ChevronRight size={18} /></button>
        </div>
      )}

      {/* STEP 5: Review */}
      {step === 5 && (
        <div>
          <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📋 Review & Confirm</div>
            {[
              ['Title', title],
              ['Scheduled', scheduledDate ? `${scheduledDate} at ${scheduledTime} PKT` : 'Not set'],
              ['Platforms', Object.entries(platforms).filter(([, v]) => v).map(([k]) => k).join(', ') || 'None'],
              ['Facebook Pages', selectedPages.size > 0 ? `${selectedPages.size} pages` : 'None'],
              ['TikTok Accounts', selectedTikTok.size > 0 ? `${selectedTikTok.size} accounts` : 'None'],
              ['Recurring', recurring ? recurrenceRule : 'No']
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontWeight: 600, maxWidth: '60%', textAlign: 'right', color: 'var(--text-primary)' }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn-primary" onClick={() => handleSave(false)} disabled={saving}>
              {saving ? 'Scheduling...' : '📅 Confirm Schedule'}
            </button>
            <button className="btn-secondary" onClick={() => handleSave(true)} disabled={saving}>
              {saving ? 'Publishing...' : '🚀 Post Now Instead'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
