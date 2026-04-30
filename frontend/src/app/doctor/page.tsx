'use client'
import React from 'react'
import Link from 'next/link'
import { API_BASE_URL } from '@/config'

type AuthMode = 'login' | 'register'

export default function DoctorAuthPage() {
  const [mode, setMode] = React.useState<AuthMode>('login')
  const [loading, setLoading] = React.useState(false)
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [onShift, setOnShift] = React.useState(true)
  const [loggedIn, setLoggedIn] = React.useState(false)
  const [doctorInfo, setDoctorInfo] = React.useState({ name: '', hospital: '', specialization: '' })

  React.useEffect(() => {
    const token = localStorage.getItem('doctor_token')
    const name = localStorage.getItem('doctor_name') || ''
    const hospital = localStorage.getItem('doctor_hospital') || ''
    const specialization = localStorage.getItem('doctor_specialization') || ''
    if (token) { setLoggedIn(true); setDoctorInfo({ name, hospital, specialization }) }
  }, [])

  // Login form
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')

  // Register form
  const [reg, setReg] = React.useState({
    name: '', email: '', password: '', hospital: '',
    specialization: '', license_number: '', phone: ''
  })

  const handleLogin = async () => {
    setLoading(true); setMessage(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/v3/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      localStorage.setItem('doctor_token', data.token)
      localStorage.setItem('doctor_name', data.name)
      localStorage.setItem('doctor_hospital', data.hospital)
      localStorage.setItem('doctor_specialization', data.specialization || 'MBBS, General Physician')
      window.location.href = '/hospital'
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message })
    } finally { setLoading(false) }
  }

  const handleRegister = async () => {
    setLoading(true); setMessage(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/v3/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reg),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      setMessage({ type: 'success', text: data.message })
      setTimeout(() => setMode('login'), 3000)
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message })
    } finally { setLoading(false) }
  }

  const INPUT = {
    width: '100%', padding: '13px 16px', borderRadius: 12,
    background: 'rgba(8,20,45,0.9)', border: '1px solid rgba(255,255,255,0.08)',
    color: '#f1f5f9', fontSize: 14, fontFamily: 'Inter,sans-serif', outline: 'none',
    boxSizing: 'border-box' as const,
  }

  // If already logged in — show profile dashboard
  if (loggedIn) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#050e1a', fontFamily: 'Inter,sans-serif' }}>
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 70% 50% at 30% 40%, rgba(16,217,138,0.07) 0%, transparent 60%)', pointerEvents: 'none' }} />
      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        {/* Profile Card */}
        <div style={{ background: 'rgba(8,20,45,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 24, padding: '32px 28px', backdropFilter: 'blur(20px)', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#059669,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 16px', boxShadow: '0 0 30px rgba(16,217,138,0.3)' }}>👨‍⚕️</div>
          <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Dr. {doctorInfo.name}</h2>
          <p style={{ fontSize: 13, color: '#10d98a', marginBottom: 4 }}>{doctorInfo.specialization}</p>
          <p style={{ fontSize: 12, color: '#475569', marginBottom: 24 }}>🏥 {doctorInfo.hospital}</p>
          {/* Shift Toggle */}
          <button onClick={() => setOnShift(s => !s)} style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: onShift ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#dc2626,#ef4444)', color: 'white', fontSize: 15, fontWeight: 800, cursor: 'pointer', marginBottom: 12, boxShadow: onShift ? '0 4px 20px rgba(5,150,105,0.35)' : '0 4px 20px rgba(239,68,68,0.35)' }}>
            {onShift ? '🟢 On Shift — Click to Go Off Shift' : '🔴 Off Shift — Click to Go On Shift'}
          </button>
          <a href="/hospital" style={{ display: 'block', width: '100%', padding: '14px', borderRadius: 14, background: 'rgba(16,217,138,0.08)', border: '1px solid rgba(16,217,138,0.2)', color: '#10d98a', fontSize: 14, fontWeight: 800, textAlign: 'center', textDecoration: 'none', marginBottom: 8, boxSizing: 'border-box' }}>→ Open Command Center</a>
          <button onClick={() => { localStorage.clear(); setLoggedIn(false) }} style={{ width: '100%', padding: '10px', borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: '#334155', fontSize: 12, cursor: 'pointer' }}>Sign Out</button>
        </div>
      </div>
    </div>
  )


  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#050e1a', fontFamily: 'Inter,sans-serif' }}>
      {/* Background glow */}
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 70% 50% at 30% 40%, rgba(16,217,138,0.07) 0%, transparent 60%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 480, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg,#059669,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 16px', boxShadow: '0 0 30px rgba(16,217,138,0.3)' }}>🏥</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.04em', color: '#f1f5f9', marginBottom: 6 }}>
            {mode === 'login' ? 'Doctor Sign In' : 'Doctor Registration'}
          </h1>
          <p style={{ fontSize: 13, color: '#475569' }}>
            {mode === 'login' ? 'Access your command center' : 'Join the healthcare network'}
          </p>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(8,20,45,0.85)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 24, padding: '32px 28px', backdropFilter: 'blur(20px)' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 0, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, marginBottom: 24 }}>
            {(['login', 'register'] as AuthMode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setMessage(null) }} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: mode === m ? 'rgba(16,217,138,0.15)' : 'transparent', color: mode === m ? '#10d98a' : '#475569', transition: 'all 0.2s', textTransform: 'capitalize' }}>
                {m}
              </button>
            ))}
          </div>

          {message && (
            <div style={{ padding: '12px 16px', borderRadius: 12, background: message.type === 'success' ? 'rgba(16,217,138,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${message.type === 'success' ? 'rgba(16,217,138,0.25)' : 'rgba(239,68,68,0.25)'}`, marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: message.type === 'success' ? '#10d98a' : '#ef4444', margin: 0 }}>{message.text}</p>
            </div>
          )}

          {mode === 'login' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>📧 Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="doctor@hospital.in" style={INPUT} /></div>
              <div><label style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>🔑 Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={INPUT} /></div>
              <button onClick={handleLogin} disabled={loading} style={{ width: '100%', padding: '16px', borderRadius: 14, background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: 'white', fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8, opacity: loading ? 0.7 : 1, boxShadow: '0 4px 20px rgba(5,150,105,0.35)' }}>
                {loading ? 'Signing in…' : '→ Access Command Center'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { key: 'name', label: '👤 Full Name', type: 'text', placeholder: 'Dr. Priya Sharma' },
                { key: 'email', label: '📧 Email', type: 'email', placeholder: 'doctor@hospital.in' },
                { key: 'password', label: '🔑 Password', type: 'password', placeholder: '••••••••' },
                { key: 'hospital', label: '🏥 Hospital Name', type: 'text', placeholder: 'Dist. Govt. Hospital, Mysuru' },
                { key: 'specialization', label: '⚕️ Specialization', type: 'text', placeholder: 'General Physician' },
                { key: 'license_number', label: '🪪 Medical License #', type: 'text', placeholder: 'KAR-2019-12345' },
                { key: 'phone', label: '📞 Phone', type: 'tel', placeholder: '9876543210' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>{f.label}</label>
                  <input type={f.type} value={(reg as any)[f.key]} onChange={e => setReg(r => ({ ...r, [f.key]: e.target.value }))} placeholder={f.placeholder} style={INPUT} />
                </div>
              ))}
              <button onClick={handleRegister} disabled={loading} style={{ width: '100%', padding: '15px', borderRadius: 14, background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: 'white', fontSize: 14, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Submitting…' : '→ Submit for Verification'}
              </button>
              <p style={{ fontSize: 11, color: '#334155', textAlign: 'center' }}>Your license number will be verified before access is granted.</p>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#1e293b', display: 'flex', justifyContent: 'center', gap: 20 }}>
          <Link href="/" style={{ color: '#475569', textDecoration: 'none' }}>← Back to Patient App</Link>
          <Link href="/admin" style={{ color: '#475569', textDecoration: 'none', opacity: 0.6 }}>⚙️ Admin Portal</Link>
        </p>
      </div>
    </div>
  )
}
