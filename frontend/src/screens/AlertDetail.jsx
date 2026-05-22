import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Image, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { postAlert, regenerateCaption, updateAlertThumbnail } from '../lib/api'
import FacebookPageItem from '../components/FacebookPageItem'
import TikTokAccountItem from '../components/TikTokAccountItem'
import HashtagChip from '../components/HashtagChip'
import LoadingSkeleton from '../components/LoadingSkeleton'
import toast from 'react-hot-toast'

export default function AlertDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [alert, setAlert] = useState(null)
  const [captionTab, setCaptionTab] = useState('urdu')
  const [captionUrdu, setCaptionUrdu] = useState('')
  const [captionEnglish, setCaptionEnglish] = useState('')
  const [fbPages, setFbPages] = useState([])
  const [tikTok, setTikTok] = useState([])
  const [selectedPages, setSelectedPages] = useState(new Set())
  const [selectedTikTok, setSelectedTikTok] = useState(new Set())
  const [targets, setTargets] = useState({ youtube: false, instagram: false, twitter: false, facebook: false, tiktok: false })
  const [posting, setPosting] = useState(false)
  const [regenLoading, setRegenLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [id])

  const loadData = async () => {
    setLoading(true)
    const [alertRes, pagesRes, tikRes] = await Promise.all([
      supabase.from('breaking_alerts').select('*').eq('id', id).single(),
      supabase.from('facebook_pages').select('*').eq('user_id', user.id).eq('is_active', true).eq('is_selected_default', true),
      supabase.from('tiktok_accounts').select('*').eq('user_id', user.id).eq('is_active', true)
    ])
    if (alertRes.data) {
      setAlert(alertRes.data)
      setCaptionUrdu(alertRes.data.generated_caption_urdu || '')
      setCaptionEnglish(alertRes.data.generated_caption_english || '')
    }
    setFbPages(pagesRes.data || [])
    setTikTok(tikRes.data || [])
    setSelectedPages(new Set(pagesRes.data?.map(p => p.page_id) || []))
    setSelectedTikTok(new Set(tikRes.data?.map(a => a.id) || []))
    setLoading(false)
  }

  const handleRegenCaption = async () => {
    setRegenLoading(true)
    try {
      const data = await regenerateCaption(id)
      setCaptionUrdu(data.urdu || '')
      setCaptionEnglish(data.english || '')
      toast.success('Caption regenerated')
    } catch { toast.error('Failed to regenerate') }
    finally { setRegenLoading(false) }
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('photo', file)
    try {
      const data = await updateAlertThumbnail(id, formData)
      setAlert(prev => ({ ...prev, thumbnail_url: data.thumbnail_url }))
      toast.success('Thumbnail updated')
    } catch { toast.error('Failed to update thumbnail') }
  }

  const handlePost = async (now = true) => {
    setPosting(true)
    try {
      const platforms = {
        ...targets,
        facebook_page_ids: [...selectedPages],
        tiktok_account_ids: [...selectedTikTok],
        caption_urdu: captionUrdu,
        caption_english: captionEnglish
      }
      await postAlert(id, platforms)
      toast.success('Posted successfully!')
      navigate('/alerts')
    } catch (err) {
      toast.error(err.message || 'Failed to post')
    } finally { setPosting(false) }
  }

  if (loading) return <div style={{ padding: 24 }}><LoadingSkeleton count={4} /></div>
  if (!alert) return <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>Alert not found</div>

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0 16px' }}>
        <button onClick={() => navigate('/alerts')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 0 }}>
          <ArrowLeft size={22} />
        </button>
        <div style={{ fontSize: 18, fontFamily: 'Syne', fontWeight: 800 }}>Alert Detail</div>
      </div>

      {/* Thumbnail */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        {alert.thumbnail_url ? (
          <img src={alert.thumbnail_url} alt="thumbnail" style={{ width: '100%', borderRadius: 14, maxHeight: 200, objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: 160, background: 'rgba(255,255,255,0.04)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 40 }}>🖼️</div>
        )}
        <label style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Image size={13} /> Replace Photo
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
        </label>
      </div>

      <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.4, marginBottom: 6 }}>{alert.headline}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>Source: {alert.source_name} · {new Date(alert.detected_at).toLocaleString()}</div>

      {/* Captions */}
      <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {['urdu', 'english'].map(t => (
              <button key={t} onClick={() => setCaptionTab(t)} style={{ padding: '5px 14px', borderRadius: 8, border: 'none', background: captionTab === t ? '#7c3aed' : 'rgba(255,255,255,0.08)', color: captionTab === t ? 'white' : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                {t === 'urdu' ? 'اردو' : 'English'}
              </button>
            ))}
          </div>
          <button onClick={handleRegenCaption} disabled={regenLoading} style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
            <RefreshCw size={13} /> Regenerate
          </button>
        </div>
        <textarea className="input" rows={6} value={captionTab === 'urdu' ? captionUrdu : captionEnglish} onChange={e => captionTab === 'urdu' ? setCaptionUrdu(e.target.value) : setCaptionEnglish(e.target.value)} style={{ direction: captionTab === 'urdu' ? 'rtl' : 'ltr', textAlign: captionTab === 'urdu' ? 'right' : 'left', fontFamily: captionTab === 'urdu' ? 'sans-serif' : 'DM Sans' }} />
      </div>

      {/* Platform selection */}
      <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Select Platforms</div>
        {['youtube', 'instagram', 'facebook', 'tiktok', 'twitter'].map(p => (
          <div key={p} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>{p === 'twitter' ? 'X (Twitter)' : p}</span>
            <div className={`toggle ${targets[p] ? 'active' : ''}`} onClick={() => setTargets(prev => ({ ...prev, [p]: !prev[p] }))} />
          </div>
        ))}

        {targets.facebook && fbPages.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>{selectedPages.size} pages selected</div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {fbPages.map(page => (
                <FacebookPageItem key={page.id} page={page} selected={selectedPages.has(page.page_id)} onToggle={(pid) => {
                  const s = new Set(selectedPages)
                  s.has(pid) ? s.delete(pid) : s.add(pid)
                  setSelectedPages(s)
                }} />
              ))}
            </div>
          </div>
        )}

        {targets.tiktok && tikTok.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {tikTok.map(acc => (
              <TikTokAccountItem key={acc.id} account={acc} selected={selectedTikTok.has(acc.id)} onToggle={(aid) => {
                const s = new Set(selectedTikTok)
                s.has(aid) ? s.delete(aid) : s.add(aid)
                setSelectedTikTok(s)
              }} />
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn-primary" onClick={() => handlePost(true)} disabled={posting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {posting ? <div className="spinner" style={{ width: 18, height: 18 }} /> : <Send size={18} />}
          {posting ? 'Posting...' : '🚀 Post Now'}
        </button>
      </div>
    </div>
  )
}
