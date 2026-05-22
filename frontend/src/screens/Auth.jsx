import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function Auth() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // login | signup | reset
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (!rememberMe) localStorage.setItem('onepost_session_only', '1')
        navigate('/')
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
        if (error) throw error
        toast.success('Account created! Check your email to confirm.')
        setMode('login')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth` })
        if (error) throw error
        toast.success('Reset link sent to your email!')
        setMode('login')
      }
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const googleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } })
    if (error) toast.error(error.message)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '40px 24px 32px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 36, fontFamily: 'Syne', fontWeight: 800, background: 'linear-gradient(135deg, #7c3aed, #c4b5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>OnePost</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
          {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password'}
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        {mode === 'signup' && (
          <div style={{ position: 'relative' }}>
            <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
            <input className="input" style={{ paddingLeft: 40 }} type="text" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required />
          </div>
        )}

        <div style={{ position: 'relative' }}>
          <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
          <input className="input" style={{ paddingLeft: 40 }} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>

        {mode !== 'reset' && (
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
            <input className="input" style={{ paddingLeft: 40, paddingRight: 44 }} type={showPw ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        )}

        {mode === 'login' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setRememberMe(r => !r)}>
              <div style={{ width: 36, height: 20, borderRadius: 10, background: rememberMe ? '#7c3aed' : 'rgba(255,255,255,0.15)', transition: 'background 0.2s', position: 'relative', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2, left: rememberMe ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
              </div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Stay signed in</span>
            </div>
            <button type="button" onClick={() => setMode('reset')} style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: 13, cursor: 'pointer', padding: 0 }}>
              Forgot password?
            </button>
          </div>
        )}

        <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? <div className="spinner mx-auto" style={{ width: 20, height: 20 }} /> : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
        </button>

        {mode !== 'reset' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            </div>
            <button type="button" className="btn-secondary" onClick={googleSignIn} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>🇬</span> Continue with Google
            </button>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 'auto' }}>
          {mode === 'login' ? (
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
              No account?{' '}
              <button type="button" onClick={() => setMode('signup')} style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Sign up</button>
            </span>
          ) : (
            <button type="button" onClick={() => setMode('login')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 14 }}>
              ← Back to sign in
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
