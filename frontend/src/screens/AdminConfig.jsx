import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'

const FIELDS = [
  { group: 'Meta (Facebook + Instagram)', emoji: '📘', fields: [
    { key: 'META_APP_ID', label: 'App ID' },
    { key: 'META_APP_SECRET', label: 'App Secret' }
  ]},
  { group: 'YouTube / Google', emoji: '▶️', fields: [
    { key: 'YOUTUBE_CLIENT_ID', label: 'Client ID' },
    { key: 'YOUTUBE_CLIENT_SECRET', label: 'Client Secret' },
    { key: 'GOOGLE_CLOUD_API_KEY', label: 'Cloud API Key' }
  ]},
  { group: 'TikTok', emoji: '🎵', fields: [
    { key: 'TIKTOK_CLIENT_KEY', label: 'Client Key' },
    { key: 'TIKTOK_CLIENT_SECRET', label: 'Client Secret' }
  ]},
  { group: 'Twitter / X', emoji: '🐦', fields: [
    { key: 'TWITTER_CLIENT_ID', label: 'Client ID' },
    { key: 'TWITTER_CLIENT_SECRET', label: 'Client Secret' }
  ]},
  { group: 'AI Services', emoji: '🤖', fields: [
    { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key' },
    { key: 'OPENAI_API_KEY', label: 'OpenAI API Key' }
  ]}
]

export default function AdminConfig() {
  const navigate = useNavigate()
  const [values, setValues] = useState({})
  const [show, setShow] = useState({})
  const [open, setOpen] = useState({ 'Meta (Facebook + Instagram)': true })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/admin/config')
      .then(r => { if (r && typeof r === 'object') setValues(r) })
      .catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.post('/admin/config', values)
      toast.success('API keys saved!')
      const r = await api.get('/admin/config')
      if (r && typeof r === 'object') setValues(r)
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const val = (key) => (values || {})[key] || ''

  return (
    <div style={{ padding: '0 16px 100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0 8px' }}>
        <button onClick={() => navigate('/settings')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ fontSize: 22, fontFamily: 'Syne', fontWeight: 800 }}>API Keys</div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>
        Saved to your database — no server restarts needed.
      </div>

      {FIELDS.map(({ group, emoji, fields }) => {
        const isOpen = !!open[group]
        const filled = fields.filter(f => val(f.key) && !val(f.key).startsWith('••')).length
        const masked = fields.filter(f => val(f.key) && val(f.key).startsWith('••')).length
        const total = fields.length
        const done = filled + masked

        return (
          <div key={group} className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
            <div
              style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={() => setOpen(o => ({ ...o, [group]: !o[group] }))}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>{emoji}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{group}</div>
                  <div style={{ fontSize: 11, color: done === total ? '#4ade80' : 'var(--text-tertiary)', marginTop: 2 }}>
                    {done}/{total} configured
                  </div>
                </div>
              </div>
              {isOpen ? <ChevronDown size={16} color="var(--text-tertiary)" /> : <ChevronRight size={16} color="var(--text-tertiary)" />}
            </div>

            {isOpen && (
              <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                {fields.map(({ key, label }) => (
                  <div key={key} style={{ marginTop: 14 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>{label}</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="input"
                        type={show[key] ? 'text' : 'password'}
                        placeholder={`Enter ${label}`}
                        value={val(key)}
                        onChange={e => setValues(v => ({ ...(v || {}), [key]: e.target.value }))}
                        style={{ paddingRight: 44, fontFamily: 'monospace', fontSize: 13 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShow(s => ({ ...s, [key]: !s[key] }))}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
                      >
                        {show[key] ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      <button className="btn-primary" onClick={save} disabled={saving} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {saving ? <div className="spinner" style={{ width: 18, height: 18 }} /> : <><Save size={16} /> Save All Keys</>}
      </button>
    </div>
  )
}
