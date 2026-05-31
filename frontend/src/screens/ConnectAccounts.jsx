import { useState, useEffect } from 'react'
import { Search, Plus, CheckSquare, ArrowLeft, AlertTriangle, RefreshCw, Link as LinkIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PlatformCard from '../components/PlatformCard'
import FacebookPageItem from '../components/FacebookPageItem'
import TikTokAccountItem from '../components/TikTokAccountItem'
import PlatformIcon from '../components/PlatformIcon'
import LoadingSkeleton from '../components/LoadingSkeleton'
import toast from 'react-hot-toast'
import { getOAuthUrl, syncFacebookPages, diagnoseFacebook } from '../lib/api'

export default function ConnectAccounts() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [platforms, setPlatforms] = useState({})
  const [fbPages, setFbPages] = useState([])
  const [tikTokAccounts, setTikTokAccounts] = useState([])
  const [selectedPages, setSelectedPages] = useState(new Set())
  const [fbSearch, setFbSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [connectLoading, setConnectLoading] = useState({})
  const [tab, setTab] = useState(searchParams.get('tab') === 'facebook' ? 'facebook' : 'platforms')
  const [diag, setDiag] = useState(null)
  const [diagLoading, setDiagLoading] = useState(false)

  useEffect(() => { if (user) loadAll() }, [user])
  useEffect(() => { if (tab === 'facebook' && user) runDiagnose() }, [tab, user])

  const loadAll = async () => {
    setLoading(true)
    const [plat, pages, tik] = await Promise.all([
      supabase.from('connected_platforms').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('facebook_pages').select('*').eq('user_id', user.id).eq('is_active', true).order('fan_count', { ascending: false }),
      supabase.from('tiktok_accounts').select('*').eq('user_id', user.id).eq('is_active', true)
    ])
    const platMap = {}
    plat.data?.forEach(p => { platMap[p.platform] = p })
    setPlatforms(platMap)
    setFbPages(pages.data || [])
    setTikTokAccounts(tik.data || [])
    setSelectedPages(new Set(pages.data?.filter(p => p.is_selected_default).map(p => p.page_id)))
    setLoading(false)
  }

  const runDiagnose = async () => {
    setDiagLoading(true)
    try {
      const d = await diagnoseFacebook()
      setDiag(d)
    } catch (err) {
      setDiag({ error: err?.error || err?.message || 'Failed to diagnose Facebook connection' })
    } finally {
      setDiagLoading(false)
    }
  }

  const connectPlatform = async (platform) => {
    setConnectLoading(prev => ({ ...prev, [platform]: true }))
    try {
      const { url } = await getOAuthUrl(platform, user.id)
      window.location.href = url
    } catch (err) {
      toast.error(`Failed to connect ${platform}: ${err.message}`)
    } finally {
      setConnectLoading(prev => ({ ...prev, [platform]: false }))
    }
  }

  const disconnectPlatform = async (platform) => {
    const account = platforms[platform]
    if (!account) return
    const { error } = await supabase.from('connected_platforms').update({ is_active: false }).eq('id', account.id)
    if (error) toast.error(error.message)
    else { toast.success(`${platform} disconnected`); loadAll() }
  }

  const handleSyncPages = async () => {
    try {
      setConnectLoading(prev => ({ ...prev, fb_sync: true }))
      const result = await syncFacebookPages(user.id)
      if (result?.count > 0) {
        toast.success(`Synced ${result.count} Facebook pages`)
      } else if (result?.warning) {
        toast(result.warning, { icon: '⚠️', duration: 6000 })
      } else {
        toast.success('Facebook pages synced')
      }
      await loadAll()
      await runDiagnose()
    } catch (err) {
      const errMsg = err?.error || err?.message || 'Failed to sync pages'
      toast.error(errMsg, { duration: 6000 })
      if (err?.needsReconnect) {
        await runDiagnose()
      }
    } finally {
      setConnectLoading(prev => ({ ...prev, fb_sync: false }))
    }
  }

  const togglePage = async (pageId) => {
    const next = new Set(selectedPages)
    if (next.has(pageId)) next.delete(pageId)
    else next.add(pageId)
    setSelectedPages(next)
    await supabase.from('facebook_pages').update({ is_selected_default: next.has(pageId) }).eq('page_id', pageId).eq('user_id', user.id)
  }

  const selectAllPages = async () => {
    const allIds = new Set(fbPages.map(p => p.page_id))
    setSelectedPages(allIds)
    await supabase.from('facebook_pages').update({ is_selected_default: true }).eq('user_id', user.id)
    toast.success(`All ${fbPages.length} pages selected`)
  }

  const filteredPages = fbPages.filter(p => p.page_name.toLowerCase().includes(fbSearch.toLowerCase()))

  // Decide which diagnostic state to show
  const renderDiag = () => {
    if (diagLoading || !diag) return null

    // Hard error
    if (diag.error) {
      return (
        <div className="card" style={{ padding: 14, marginBottom: 14, borderColor: 'rgba(239,68,68,0.28)', background: 'var(--danger-soft)' }}>
          <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
            <div className="grow">
              <div className="t-h3" style={{ color: 'var(--danger)', marginBottom: 4 }}>Diagnostic failed</div>
              <div className="t-body-sm">{diag.error}</div>
            </div>
          </div>
        </div>
      )
    }

    // Not connected
    if (!diag.connected) {
      return (
        <div className="card" style={{ padding: 14, marginBottom: 14, borderColor: 'var(--accent)', background: 'var(--accent-soft)' }}>
          <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
            <div className="grow">
              <div className="t-h3" style={{ marginBottom: 4 }}>Facebook is not connected</div>
              <div className="t-body-sm" style={{ marginBottom: 10 }}>{diag.hint || 'Connect Facebook to start publishing to your pages.'}</div>
              {diag.inactivePages > 0 && (
                <div className="t-caption" style={{ marginBottom: 10 }}>
                  We still have <span className="t-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{diag.inactivePages}</span> saved pages — they'll reactivate after you reconnect.
                </div>
              )}
              <button onClick={() => connectPlatform('facebook')} className="btn-primary btn-sm" style={{ width: 'auto', padding: '0 16px' }}>
                <LinkIcon size={14} /> Reconnect Facebook
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Token expired
    if (diag.tokenHealth && !diag.tokenHealth.ok) {
      return (
        <div className="card" style={{ padding: 14, marginBottom: 14, borderColor: 'rgba(245,158,11,0.32)', background: 'var(--warning-soft)' }}>
          <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={18} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
            <div className="grow">
              <div className="t-h3" style={{ color: 'var(--warning)', marginBottom: 4 }}>Facebook session expired</div>
              <div className="t-body-sm" style={{ marginBottom: 10 }}>
                Your Facebook access has expired. Reconnect Facebook to refresh your pages.
                {diag.inactivePages > 0 && <> Your <span className="t-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{diag.inactivePages}</span> saved pages will reactivate automatically.</>}
              </div>
              <div className="t-caption" style={{ marginBottom: 10 }}>{diag.tokenHealth.error}</div>
              <button onClick={() => connectPlatform('facebook')} className="btn-primary btn-sm" style={{ width: 'auto', padding: '0 16px' }}>
                <LinkIcon size={14} /> Reconnect Facebook
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Connected, valid token, but no active pages
    if (diag.activePages === 0) {
      return (
        <div className="card" style={{ padding: 14, marginBottom: 14, borderColor: 'var(--accent)', background: 'var(--accent-soft)' }}>
          <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <RefreshCw size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
            <div className="grow">
              <div className="t-h3" style={{ marginBottom: 4 }}>No pages loaded yet</div>
              <div className="t-body-sm" style={{ marginBottom: 10 }}>
                Connected as <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{diag.username || 'Facebook user'}</span>.
                {diag.inactivePages > 0 && <> We have <span className="t-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{diag.inactivePages}</span> deactivated pages saved.</>}
                {' '}Tap Sync Pages to import.
              </div>
              <button onClick={handleSyncPages} disabled={connectLoading.fb_sync} className="btn-primary btn-sm" style={{ width: 'auto', padding: '0 16px' }}>
                <RefreshCw size={14} /> {connectLoading.fb_sync ? 'Syncing…' : 'Sync pages'}
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Healthy
    return (
      <div className="card" style={{ padding: 12, marginBottom: 14 }}>
        <div className="row" style={{ gap: 10 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'rgba(24,119,242,0.18)', color: '#1877F2',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
          }}><PlatformIcon platform="facebook" size={14} /></span>
          <div className="grow t-body-sm">
            Connected as <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{diag.username || 'Facebook user'}</span>
            {' · '}
            <span className="t-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{diag.activePages}</span> active pages
          </div>
          <button onClick={runDiagnose} className="icon-btn" aria-label="Refresh diagnostics" style={{ width: 32, height: 32 }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen-pad">
      <div className="page-header">
        <button onClick={() => navigate('/settings')} className="icon-btn" aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div className="grow">
          <div className="t-display">Connected accounts</div>
          <div className="t-caption" style={{ marginTop: 4 }}>Manage your platform connections.</div>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4,
        background: 'var(--bg-elevated)', padding: 4, borderRadius: 12,
        border: '1px solid var(--border-subtle)', marginBottom: 20
      }}>
        {[
          { key: 'platforms', label: 'Platforms' },
          { key: 'facebook', label: 'FB Pages' },
          { key: 'tiktok', label: 'TikTok' }
        ].map(({ key, label }) => {
          const active = tab === key
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                minHeight: 40, border: 'none', borderRadius: 9,
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? 'white' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}
            >{label}</button>
          )
        })}
      </div>

      {loading ? <LoadingSkeleton count={4} /> : (
        <>
          {tab === 'platforms' && ['youtube', 'instagram', 'facebook', 'twitter'].map(p => (
            <PlatformCard key={p} platform={p} account={platforms[p]} loading={connectLoading[p]} onConnect={() => connectPlatform(p)} onDisconnect={() => disconnectPlatform(p)} />
          ))}

          {tab === 'facebook' && (
            <div>
              {renderDiag()}

              {fbPages.length > 0 && (
                <>
                  <div className="row-between" style={{ marginBottom: 12 }}>
                    <div className="t-body-sm">
                      <span className="t-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedPages.size}</span>
                      {' / '}{fbPages.length} pages selected
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <button onClick={handleSyncPages} disabled={connectLoading.fb_sync} className="btn-secondary btn-sm" style={{ width: 'auto', padding: '0 12px' }}>
                        <RefreshCw size={13} /> {connectLoading.fb_sync ? 'Syncing…' : 'Sync'}
                      </button>
                      <button onClick={selectAllPages} className="btn-secondary btn-sm" style={{ width: 'auto', padding: '0 12px', borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                        <CheckSquare size={13} /> All
                      </button>
                    </div>
                  </div>

                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input className="input" style={{ paddingLeft: 36, fontSize: 14, minHeight: 40 }} placeholder="Search pages…" value={fbSearch} onChange={e => setFbSearch(e.target.value)} />
                  </div>

                  {filteredPages.length === 0 ? (
                    <div className="t-body-sm" style={{ textAlign: 'center', padding: '40px 0' }}>
                      No pages match your search.
                    </div>
                  ) : filteredPages.map(page => (
                    <FacebookPageItem key={page.id} page={page} selected={selectedPages.has(page.page_id)} onToggle={togglePage} />
                  ))}
                </>
              )}
            </div>
          )}

          {tab === 'tiktok' && (
            <div>
              <div className="row-between" style={{ marginBottom: 16 }}>
                <div className="t-body-sm">
                  <span className="t-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{tikTokAccounts.length}</span> accounts
                </div>
                <button onClick={() => connectPlatform('tiktok_new')} className="btn-secondary btn-sm" style={{ width: 'auto', padding: '0 14px' }}>
                  <Plus size={14} /> Add account
                </button>
              </div>

              {tikTokAccounts.length === 0 ? (
                <div className="card" style={{ padding: 32, textAlign: 'center' }}>
                  <div className="avatar-icon" style={{ margin: '0 auto 14px', width: 48, height: 48 }}>
                    <PlatformIcon platform="tiktok" size={20} />
                  </div>
                  <div className="t-body" style={{ marginBottom: 6 }}>No TikTok accounts yet</div>
                  <div className="t-body-sm" style={{ marginBottom: 16 }}>Add your first TikTok account to publish to it.</div>
                  <button onClick={() => connectPlatform('tiktok_new')} className="btn-primary" style={{ maxWidth: 240, margin: '0 auto' }}>
                    <Plus size={16} /> Add first account
                  </button>
                </div>
              ) : tikTokAccounts.map(acc => (
                <TikTokAccountItem key={acc.id} account={acc} onRemove={async (id) => {
                  await supabase.from('tiktok_accounts').update({ is_active: false }).eq('id', id)
                  toast.success('Account removed')
                  loadAll()
                }} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
