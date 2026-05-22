import { useState, useEffect } from 'react'
import { Search, Plus, CheckSquare, Square } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PlatformCard from '../components/PlatformCard'
import FacebookPageItem from '../components/FacebookPageItem'
import TikTokAccountItem from '../components/TikTokAccountItem'
import LoadingSkeleton from '../components/LoadingSkeleton'
import toast from 'react-hot-toast'
import { getOAuthUrl, syncFacebookPages } from '../lib/api'

export default function ConnectAccounts() {
  const { user } = useAuth()
  const [platforms, setPlatforms] = useState({})
  const [fbPages, setFbPages] = useState([])
  const [tikTokAccounts, setTikTokAccounts] = useState([])
  const [selectedPages, setSelectedPages] = useState(new Set())
  const [fbSearch, setFbSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [connectLoading, setConnectLoading] = useState({})
  const [tab, setTab] = useState('platforms')

  useEffect(() => { if (user) loadAll() }, [user])

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

  const connectPlatform = async (platform) => {
    setConnectLoading(prev => ({ ...prev, [platform]: true }))
    try {
      const { url } = await getOAuthUrl(platform)
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
      await syncFacebookPages(user.id)
      toast.success('Facebook pages synced!')
      loadAll()
    } catch (err) {
      toast.error(err.message || 'Failed to sync pages')
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

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ padding: '20px 0 16px' }}>
        <div style={{ fontSize: 22, fontFamily: 'Syne', fontWeight: 800 }}>Connected Accounts</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Manage your platform connections</div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'rgba(255,255,255,0.04)', padding: 4, borderRadius: 12 }}>
        {['platforms', 'facebook', 'tiktok'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', background: tab === t ? '#7c3aed' : 'transparent', color: tab === t ? 'white' : 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.2s' }}>
            {t === 'facebook' ? 'FB Pages' : t === 'tiktok' ? 'TikTok' : 'Platforms'}
          </button>
        ))}
      </div>

      {loading ? <LoadingSkeleton count={4} /> : (
        <>
          {tab === 'platforms' && ['youtube', 'instagram', 'facebook', 'twitter'].map(p => (
            <PlatformCard key={p} platform={p} account={platforms[p]} loading={connectLoading[p]} onConnect={() => connectPlatform(p)} onDisconnect={() => disconnectPlatform(p)} />
          ))}

          {tab === 'facebook' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
                  {selectedPages.size} of {fbPages.length} pages selected
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleSyncPages} disabled={connectLoading.fb_sync} style={{ background: 'rgba(24,119,242,0.15)', border: '1px solid rgba(24,119,242,0.3)', color: '#60a5fa', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {connectLoading.fb_sync ? '⏳ Syncing...' : '🔄 Sync Pages'}
                  </button>
                  <button onClick={selectAllPages} style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckSquare size={14} /> All
                  </button>
                </div>
              </div>

              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input className="input" style={{ paddingLeft: 36, paddingTop: 10, paddingBottom: 10, fontSize: 14 }} placeholder="Search pages..." value={fbSearch} onChange={e => setFbSearch(e.target.value)} />
              </div>

              {!platforms.facebook ? (
                <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🔵</div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>Connect Facebook first to import your pages</div>
                  <button className="btn-primary" onClick={() => connectPlatform('facebook')}>Connect Facebook</button>
                </div>
              ) : filteredPages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.4)' }}>
                  {fbSearch ? 'No pages match your search' : 'No pages found. Tap Sync Pages to import.'}
                </div>
              ) : filteredPages.map(page => (
                <FacebookPageItem key={page.id} page={page} selected={selectedPages.has(page.page_id)} onToggle={togglePage} />
              ))}
            </div>
          )}

          {tab === 'tiktok' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>{tikTokAccounts.length} accounts connected</div>
                <button onClick={() => connectPlatform('tiktok_new')} style={{ background: 'rgba(105,201,208,0.15)', border: '1px solid rgba(105,201,208,0.3)', color: '#69C9D0', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={16} /> Add TikTok Account
                </button>
              </div>

              {tikTokAccounts.length === 0 ? (
                <div className="card" style={{ padding: 32, textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🎵</div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>No TikTok accounts connected yet</div>
                  <button className="btn-primary" onClick={() => connectPlatform('tiktok_new')}>Add First Account</button>
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
