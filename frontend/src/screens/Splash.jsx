import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Upload, Zap, Globe } from 'lucide-react'

const slides = [
  { icon: <Upload size={48} color="#7c3aed" />, title: 'Upload Once', desc: 'Drop your video once — no re-uploading to different apps, ever again.' },
  { icon: <Zap size={48} color="#7c3aed" />, title: 'Auto Edit & Optimize', desc: 'AI auto-crops, captions, and detects highlights per platform automatically.' },
  { icon: <Globe size={48} color="#7c3aed" />, title: 'Post Everywhere', desc: 'YouTube, Instagram, 50+ Facebook Pages, TikTok, X — all at once, with live progress.' }
]

export default function Splash() {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => {
      if (current < slides.length - 1) setCurrent(c => c + 1)
    }, 3000)
    return () => clearTimeout(t)
  }, [current])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg, #07071a 0%, #0d0d2b 100%)', padding: '0 24px' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {/* Logo */}
        <div style={{ marginBottom: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 42, fontFamily: 'Syne', fontWeight: 800, background: 'linear-gradient(135deg, #7c3aed, #c4b5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: -1 }}>
            OnePost
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontStyle: 'italic' }}>Upload once. Post everywhere.</div>
        </div>

        {/* Slide content */}
        <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease-in-out', minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ width: 100, height: 100, borderRadius: 28, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {slides[current].icon}
          </div>
          <h2 style={{ fontSize: 26, fontFamily: 'Syne', fontWeight: 800, margin: 0 }}>{slides[current].title}</h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, maxWidth: 280, margin: 0 }}>{slides[current].desc}</p>
        </div>

        {/* Dots */}
        <div style={{ display: 'flex', gap: 8, marginTop: 40 }}>
          {slides.map((_, i) => (
            <div key={i} onClick={() => setCurrent(i)} style={{ width: i === current ? 24 : 8, height: 8, borderRadius: 999, background: i === current ? '#7c3aed' : 'rgba(255,255,255,0.2)', cursor: 'pointer', transition: 'all 0.3s' }} />
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '32px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button className="btn-primary" onClick={() => navigate('/auth')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          Get Started <ChevronRight size={18} />
        </button>
        <button onClick={() => navigate('/auth')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 14, cursor: 'pointer', padding: 12 }}>
          Already have an account? Sign in
        </button>
      </div>
    </div>
  )
}
