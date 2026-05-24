import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, List, Calendar as CalIcon } from 'lucide-react'
import { getScheduleCalendar } from '../lib/api'
import LoadingSkeleton from '../components/LoadingSkeleton'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function getStatusColor(statuses) {
  if (!statuses || !statuses.length) return null
  if (statuses.includes('failed')) return '#ef4444'
  if (statuses.includes('published')) return '#22c55e'
  return '#3b82f6'
}

export default function ScheduleCalendar() {
  const navigate = useNavigate()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [calData, setCalData] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(null)

  useEffect(() => { loadCalendar() }, [year, month])

  const loadCalendar = async () => {
    setLoading(true)
    try {
      const data = await getScheduleCalendar()
      const grouped = {}
      data.posts?.forEach(post => {
        const d = new Date(post.scheduled_at).toDateString()
        if (!grouped[d]) grouped[d] = []
        grouped[d].push(post)
      })
      setCalData(grouped)
    } catch {}
    finally { setLoading(false) }
  }

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1))
  while (cells.length % 7 !== 0) cells.push(null)

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const getDayPosts = (day) => {
    if (!day) return []
    const key = new Date(year, month, day).toDateString()
    return calData[key] || []
  }

  const selectedPosts = selectedDay ? getDayPosts(selectedDay) : []

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0 16px' }}>
        <div style={{ fontSize: 22, fontFamily: 'Syne', fontWeight: 800 }}>Schedule</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/schedule/list')} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
            <List size={15} /> List
          </button>
          <button onClick={() => navigate('/schedule/create')} style={{ background: '#f97316', border: 'none', color: 'white', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}>
            <Plus size={15} /> New
          </button>
        </div>
      </div>

      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 20, padding: '0 8px' }}>‹</button>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{MONTHS[month]} {year}</div>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 20, padding: '0 8px' }}>›</button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
        {DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-disabled)', fontWeight: 600, padding: '4px 0' }}>{d}</div>)}
      </div>

      {/* Calendar grid */}
      {loading ? <LoadingSkeleton type="card" count={1} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map((day, i) => {
            const posts = day ? getDayPosts(day) : []
            const isToday = day && new Date(year, month, day).toDateString() === today.toDateString()
            const isSelected = day === selectedDay
            const statusColor = getStatusColor(posts.map(p => p.status))
            return (
              <div key={i} onClick={() => day && setSelectedDay(day === selectedDay ? null : day)} style={{ minHeight: 44, padding: '6px 4px', borderRadius: 8, background: isSelected ? 'rgba(249,115,22,0.2)' : isToday ? 'rgba(249,115,22,0.08)' : 'transparent', border: `1px solid ${isSelected ? '#f97316' : isToday ? 'rgba(249,115,22,0.3)' : 'transparent'}`, cursor: day ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                {day && <>
                  <span style={{ fontSize: 13, fontWeight: isToday ? 800 : 400, color: isToday ? '#fb923c' : posts.length ? 'white' : 'var(--text-secondary)' }}>{day}</span>
                  {posts.length > 0 && (
                    <div style={{ width: 20, height: 14, background: statusColor || '#3b82f6', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 9, color: 'white', fontWeight: 700 }}>{posts.length}</span>
                    </div>
                  )}
                </>}
              </div>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, marginBottom: 16 }}>
        {[['🟢', 'Published', '#22c55e'], ['🔵', 'Scheduled', '#3b82f6'], ['🔴', 'Failed', '#ef4444']].map(([icon, label, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            {label}
          </div>
        ))}
      </div>

      {/* Selected day posts */}
      {selectedDay && selectedPosts.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
            {MONTHS[month]} {selectedDay} — {selectedPosts.length} post{selectedPosts.length !== 1 ? 's' : ''}
          </div>
          {selectedPosts.map(post => (
            <div key={post.id} className="card" style={{ padding: '12px 14px', marginBottom: 8, cursor: 'pointer' }} onClick={() => navigate(`/schedule/${post.id}/results`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{post.title || 'Scheduled Post'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    {new Date(post.scheduled_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' })} PKT
                  </div>
                </div>
                <span className={`badge badge-${post.status}`}>{post.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedDay && selectedPosts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-disabled)', fontSize: 14 }}>
          No posts on {MONTHS[month]} {selectedDay}
          <br /><br />
          <button className="btn-primary" onClick={() => navigate('/schedule/create')} style={{ padding: '10px 20px' }}>Schedule a Post</button>
        </div>
      )}
    </div>
  )
}
