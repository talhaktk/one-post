import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Eye, EyeOff } from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'

const FIELDS = [
  { group: 'Meta (Facebook + Instagram)', fields: [
    { key: 'META_APP_ID', label: 'App ID' },
    { key: 'META_APP_SECRET', label: 'App Secret' }
  ]},
  { group: 'YouTube / Google', fields: [
    { key: 'YOUTUBE_CLIENT_ID', label: 'Client ID' },
    { key: 'YOUTUBE_CLIENT_SECRET', label: 'Client Secret' },
    { key: 'GOOGLE_CLOUD_API_KEY', label: 'Cloud API Key' }
  ]},
  { group: 'TikTok', fields: [
    { key: 'TIKTOK_CLIENT_KEY', label: 'Client Key' },
    { key: 'TIKTOK_CLIENT_SECRET', label: 'Client Secret' }
  ]},
  { group: 'Twitter / X', fields: [
    { key: 'TWITTER_CLIENT_ID', label: 'Client ID' },
    { key: 'TWITTER_CLIENT_SECRET', label: 'Client Secret' }
  ]},
  { group: 'AI Services', fields: [
    { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key' },
    { key: 'OPENAI_API_KEY', label: 'OpenAI API Key' }
  ]}
]

export default function AdminConfig() {
  const navigate = useNavigate()
  const [values, setValues] = useState({})
  const [show, setShow] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/admin/config').then(r => setValues(r.data)).catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.post('/admin/config', values)
      toast.success('API keys saved!')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ padding: '0 16px 100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0 16px' }}>
        <button onClick={() => navigate('/settings')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ fontSize: 22, fontFamily: 'Syne', fontWeight: 800 }}>API Keys</div>
      </div>

      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
        Enter your platform API credentials. These are saved securely in your database — no server restarts needed.
      </div>

      {FIELDS.map(({ group, fields }) => (
        <div key={group} className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#a78bfa' }}>{group}</div>
          {fields.map(({ key, label }) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>{label}</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={show[key] ? 'text' : 'password'}
                  placeholder={`Enter ${label}`}
                  value={values[key] || ''}
                  onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
                  style={{ paddingRight: 44, fontFamily: 'monospace', fontSize: 13 }}
                />
                <button
                  type="button"
                  onClick={() => setShow(s => ({ ...s, [key]: !s[key] }))}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}
                >
                  {show[key] ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      <button className="btn-primary" onClick={save} disabled={saving} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {saving ? <div className="spinner" style={{ width: 18, height: 18 }} /> : <><Save size={16} /> Save All Keys</>}
      </button>
    </div>
  )
}
