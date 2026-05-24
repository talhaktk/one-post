import { useState } from 'react'
import { LogOut, Link2, Trash2, Key, Sun, Moon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function Settings() {
  const { user, profile, signOut, updateProfile } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    default_country: profile?.default_country || 'pakistan',
    default_caption_language: profile?.default_caption_language || 'both',
    post_delay_seconds: profile?.post_delay_seconds || 30,
    auto_crop: profile?.auto_crop ?? true,
    auto_cut: profile?.auto_cut ?? true,
    auto_captions: profile?.auto_captions ?? false,
    auto_highlights: profile?.auto_highlights ?? false,
    auto_thumbnail: profile?.auto_thumbnail ?? true
  })

  const save = async () => {
    setSaving(true)
    try { await updateProfile(form); toast.success('Settings saved') }
    catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const clearCache = () => {
    if ('caches' in window) caches.keys().then(keys => keys.forEach(k => caches.delete(k)))
    localStorage.clear()
    toast.success('Cache cleared')
  }

  const Toggle = ({ value, onChange, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
      <div className={`toggle ${value ? 'active' : ''}`} onClick={() => onChange(!value)} />
    </div>
  )

  const NavCard = ({ icon, title, sub, to }) => (
    <div className="card" style={{ padding: 16, marginBottom: 12, cursor: 'pointer' }} onClick={() => navigate(to)}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(249,115,22,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{sub}</div>
          </div>
        </div>
        <span style={{ color: 'var(--text-disabled)', fontSize: 20 }}>›</span>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '0 16px 100px' }}>
      <div style={{ padding: '20px 0 16px' }}>
        <div style={{ fontSize: 22, fontFamily: 'Syne', fontWeight: 800 }}>Settings</div>
      </div>

      {/* Profile */}
      <div className="card" style={{ padding: '16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, flexShrink: 0 }}>
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (profile?.full_name?.[0] || 'U').toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{profile?.full_name || 'User'}</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{user?.email}</div>
          </div>
        </div>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Display Name</label>
        <input className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
      </div>

      {/* Theme */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: 'var(--text-primary)' }}>Appearance</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { key: 'light', label: 'Light', Icon: Sun },
            { key: 'dark',  label: 'Dark',  Icon: Moon }
          ].map(({ key, label, Icon }) => {
            const active = theme === key
            return (
              <button
                key={key}
                onClick={() => setTheme(key)}
                style={{
                  minHeight: 56,
                  borderRadius: 10,
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border-strong)'}`,
                  background: active ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 14, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                <Icon size={16} /> {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* API Keys + Connect */}
      <NavCard icon={<Key size={18} color="#f97316" />} title="API Keys" sub="Meta, YouTube, TikTok, Twitter, AI" to="/admin/config" />
      <NavCard icon={<Link2 size={18} color="#f97316" />} title="Connect Accounts" sub="OAuth login for each platform after adding API keys" to="/accounts" />

      {/* Defaults */}
      <div className="card" style={{ padding: '16px', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>🌍 Defaults</div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Country for Trends</label>
          <select className="input" value={form.default_country} onChange={e => setForm(f => ({ ...f, default_country: e.target.value }))}>
            <option value="pakistan">🇵🇰 Pakistan</option>
            <option value="india">🇮🇳 India</option>
            <option value="uk">🇬🇧 United Kingdom</option>
            <option value="usa">🇺🇸 United States</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Caption Language</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['urdu', 'english', 'both'].map(lang => (
              <button key={lang} onClick={() => setForm(f => ({ ...f, default_caption_language: lang }))}
                style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${form.default_caption_language === lang ? '#f97316' : 'var(--border-strong)'}`, background: form.default_caption_language === lang ? 'rgba(249,115,22,0.15)' : 'transparent', color: form.default_caption_language === lang ? '#fdba74' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
                {lang}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Delay */}
      <div className="card" style={{ padding: '16px', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>⏱️ Delay Between Posts</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[10, 30, 60, 120].map(d => (
            <button key={d} onClick={() => setForm(f => ({ ...f, post_delay_seconds: d }))}
              style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `1px solid ${form.post_delay_seconds === d ? '#f97316' : 'var(--border-strong)'}`, background: form.post_delay_seconds === d ? 'rgba(249,115,22,0.15)' : 'transparent', color: form.post_delay_seconds === d ? '#fdba74' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              {d >= 60 ? `${d/60}m` : `${d}s`}
            </button>
          ))}
        </div>
      </div>

      {/* Auto Edit */}
      <div className="card" style={{ padding: '16px', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>⚙️ Auto-Edit Defaults</div>
        <Toggle label="Auto Crop & Resize" value={form.auto_crop} onChange={v => setForm(f => ({ ...f, auto_crop: v }))} />
        <Toggle label="Auto Cut to Length" value={form.auto_cut} onChange={v => setForm(f => ({ ...f, auto_cut: v }))} />
        <Toggle label="Auto Captions" value={form.auto_captions} onChange={v => setForm(f => ({ ...f, auto_captions: v }))} />
        <Toggle label="Auto Highlight Detection" value={form.auto_highlights} onChange={v => setForm(f => ({ ...f, auto_highlights: v }))} />
        <Toggle label="Auto Thumbnail" value={form.auto_thumbnail} onChange={v => setForm(f => ({ ...f, auto_thumbnail: v }))} />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : '💾 Save Settings'}</button>
        <button className="btn-secondary" onClick={clearCache} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Trash2 size={16} /> Clear Cache</button>
        <button onClick={async () => { await signOut(); navigate('/auth') }} style={{ width: '100%', padding: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 12, cursor: 'pointer', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <LogOut size={18} /> Sign Out
        </button>
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-disabled)', paddingBottom: 8 }}>OnePost v1.0.0</div>
    </div>
  )
}
