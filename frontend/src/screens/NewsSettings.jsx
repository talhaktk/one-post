import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { getNewsSources, updateNewsSource, getNewsKeywords, addNewsKeyword, deleteNewsKeyword } from '../lib/api'
import LoadingSkeleton from '../components/LoadingSkeleton'
import toast from 'react-hot-toast'

export default function NewsSettings() {
  const navigate = useNavigate()
  const [sources, setSources] = useState([])
  const [keywords, setKeywords] = useState([])
  const [loading, setLoading] = useState(true)
  const [newKeyword, setNewKeyword] = useState('')
  const [newScore, setNewScore] = useState(5)
  const [newLang, setNewLang] = useState('english')

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [s, k] = await Promise.all([getNewsSources(), getNewsKeywords()])
      setSources(s.sources || [])
      setKeywords(k.keywords || [])
    } catch { toast.error('Failed to load settings') }
    finally { setLoading(false) }
  }

  const toggleSource = async (id, current) => {
    await updateNewsSource(id, { is_active: !current })
    setSources(prev => prev.map(s => s.id === id ? { ...s, is_active: !current } : s))
  }

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return
    try {
      const data = await addNewsKeyword({ keyword: newKeyword.trim(), score: newScore, language: newLang, category: 'politics' })
      setKeywords(prev => [...prev, data.keyword])
      setNewKeyword('')
      toast.success('Keyword added')
    } catch { toast.error('Failed to add keyword') }
  }

  const handleDeleteKeyword = async (id) => {
    await deleteNewsKeyword(id)
    setKeywords(prev => prev.filter(k => k.id !== id))
    toast.success('Keyword removed')
  }

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0 16px' }}>
        <button onClick={() => navigate('/alerts')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>
          <ArrowLeft size={22} />
        </button>
        <div style={{ fontSize: 18, fontFamily: 'Syne', fontWeight: 800 }}>News Monitor Settings</div>
      </div>

      {loading ? <LoadingSkeleton count={3} /> : (
        <>
          {/* News Sources */}
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>📡 News Sources</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {sources.map(src => (
              <div key={src.id} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{src.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{src.language} · checks every {src.check_interval_minutes}m</div>
                </div>
                <div className={`toggle ${src.is_active ? 'active' : ''}`} onClick={() => toggleSource(src.id, src.is_active)} />
              </div>
            ))}
          </div>

          {/* Keywords */}
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>🔍 Breaking Keywords</div>

          {/* Add keyword */}
          <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#fb923c' }}>Add New Keyword</div>
            <input className="input" placeholder="Keyword..." value={newKeyword} onChange={e => setNewKeyword(e.target.value)} style={{ marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4, display: 'block' }}>Score</label>
                <select className="input" value={newScore} onChange={e => setNewScore(Number(e.target.value))}>
                  {[1, 3, 5, 8, 10].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4, display: 'block' }}>Language</label>
                <select className="input" value={newLang} onChange={e => setNewLang(e.target.value)}>
                  <option value="english">English</option>
                  <option value="urdu">Urdu</option>
                </select>
              </div>
            </div>
            <button className="btn-primary" onClick={handleAddKeyword} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Plus size={16} /> Add Keyword
            </button>
          </div>

          {/* Keyword list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {keywords.map(k => (
              <div key={k.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-hover)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{k.keyword}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '2px 8px', background: 'var(--bg-elevated)', borderRadius: 999 }}>score {k.score}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>{k.language}</span>
                </div>
                <button onClick={() => handleDeleteKeyword(k.id)} style={{ background: 'none', border: 'none', color: 'var(--text-disabled)', cursor: 'pointer', padding: 4 }}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          {/* Priority info */}
          <div className="card" style={{ padding: '14px 16px', marginTop: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>📊 Priority Thresholds</div>
            {[
              ['🔴 URGENT', 'Score 20+'],
              ['🟠 BREAKING', 'Score 10+'],
              ['🟡 IMPORTANT', 'Score 5+'],
              ['🟢 NORMAL', 'Score 1+']
            ].map(([label, range]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--border-subtle)' }}>
                <span>{label}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>{range}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
