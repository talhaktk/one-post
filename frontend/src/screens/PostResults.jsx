import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, RotateCcw, Copy } from 'lucide-react'
import { getScheduleResults, publishNow } from '../lib/api'
import LoadingSkeleton from '../components/LoadingSkeleton'
import toast from 'react-hot-toast'

const PLATFORM_ICONS = { youtube: '▶️', instagram: '📸', instagram_reels: '🎬', instagram_feed: '📸', facebook: '🔵', tiktok: '🎵', twitter: '✖️' }

export default function PostResults() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadResults() }, [id])

  const loadResults = async () => {
    setLoading(true)
    try {
      const data = await getScheduleResults(id)
      setResults(data)
    } catch { toast.error('Failed to load results') }
    finally { setLoading(false) }
  }

  const handleRetryFailed = async () => {
    await publishNow(id)
    toast.success('Retrying failed posts...')
    loadResults()
  }

  const copyAllLinks = () => {
    const links = results?.results?.filter(r => r.platform_post_url).map(r => r.platform_post_url).join('\n')
    if (links) { navigator.clipboard.writeText(links); toast.success('Links copied!') }
  }

  if (loading) return <div style={{ padding: 24 }}><LoadingSkeleton count={4} /></div>
  if (!results) return <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No results found</div>

  const total = results.results?.length || 0
  const published = results.results?.filter(r => r.status === 'published').length || 0
  const failed = results.results?.filter(r => r.status === 'failed').length || 0

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0 16px' }}>
        <button onClick={() => navigate('/schedule/list')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 0 }}>
          <ArrowLeft size={22} />
        </button>
        <div style={{ fontSize: 18, fontFamily: 'Syne', fontWeight: 800 }}>Post Results</div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total', value: total, color: '#7c3aed' },
          { label: 'Posted', value: published, color: '#22c55e' },
          { label: 'Failed', value: failed, color: '#ef4444' }
        ].map(s => (
          <div key={s.label} className="card" style={{ flex: 1, padding: '16px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {failed > 0 && (
          <button onClick={handleRetryFailed} style={{ flex: 1, padding: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <RotateCcw size={14} /> Retry Failed ({failed})
          </button>
        )}
        <button onClick={copyAllLinks} style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Copy size={14} /> Copy All Links
        </button>
      </div>

      {/* Per target results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {results.results?.map((r, i) => (
          <div key={i} className="card" style={{ padding: '12px 14px', border: `1px solid ${r.status === 'published' ? 'rgba(34,197,94,0.15)' : r.status === 'failed' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>{PLATFORM_ICONS[r.platform] || '🔗'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.target_name || r.platform}</div>
                {r.status === 'failed' && r.error_message && (
                  <div style={{ fontSize: 11, color: '#f87171', marginTop: 2 }}>{r.error_message}</div>
                )}
              </div>
              <div style={{ display: 'flex', align: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: r.status === 'published' ? '#22c55e' : r.status === 'failed' ? '#ef4444' : 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                  {r.status === 'published' ? '✅' : r.status === 'failed' ? '❌' : '⏳'} {r.status}
                </span>
                {r.platform_post_url && (
                  <a href={r.platform_post_url} target="_blank" rel="noopener noreferrer" style={{ color: '#7c3aed' }}>
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
