'use client'

import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '@/config'

interface HealthStatus {
  status: string
  db_available: boolean
  ws_connections: number
  active_doctors: number
  total_open_cases: number
  encryption: string
}

interface LiveCase {
  case_id: string
  h3_sector: string
  severity: string
  symptoms: string[]
  zones: string[]
  timestamp: string
  status: string
}

export default function AdminPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [cases, setCases] = useState<LiveCase[]>([])
  const [history, setHistory] = useState<LiveCase[]>([])
  const [outbreaks, setOutbreaks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState<string | null>(null)
  const [tab, setTab] = useState<'overview' | 'cases' | 'history' | 'outbreaks'>('overview')

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [h, c, hist, ob] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/health`).then(r => r.json()),
        fetch(`${API_BASE_URL}/api/v3/cases`).then(r => r.json()),
        fetch(`${API_BASE_URL}/api/v3/cases/history`).then(r => r.json()),
        fetch(`${API_BASE_URL}/api/v3/outbreak/detect`).then(r => r.json()),
      ])
      if (h.status === 'fulfilled') setHealth(h.value)
      if (c.status === 'fulfilled' && Array.isArray(c.value)) setCases(c.value)
      if (hist.status === 'fulfilled' && Array.isArray(hist.value)) setHistory(hist.value)
      if (ob.status === 'fulfilled') setOutbreaks(ob.value.alerts || [])
    } catch { }
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 15000) // refresh every 15s
    return () => clearInterval(interval)
  }, [])

  const seedTestCase = async () => {
    setSeeding(true)
    setSeedResult(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/v3/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration: { name: 'Test Patient', age: '35', phone: '9876543210', photo: null },
          location: { lat: 12.9716 + (Math.random() - 0.5) * 0.1, lng: 77.5946 + (Math.random() - 0.5) * 0.1 },
          zones: ['Chest', 'Head'],
          symptoms: ['fever', 'breathless'],
          severity: 'urgent',
          duration: 'hours',
          public_key: '',
        }),
      })
      const data = await res.json()
      setSeedResult(`✅ Case seeded: ${data.case_id}`)
      await fetchAll()
    } catch (e) {
      setSeedResult('❌ Failed to seed — is the backend running?')
    } finally {
      setSeeding(false)
    }
  }

  const SEV_COLOR: Record<string, string> = {
    critical: '#ef4444', urgent: '#f59e0b', stable: '#10d98a'
  }

  const StatCard = ({ label, value, sub, color = '#10d98a' }: { label: string; value: any; sub?: string; color?: string }) => (
    <div style={{ background: 'rgba(8,20,45,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 24px' }}>
      <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 32, fontWeight: 900, color, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#334155', marginTop: 6 }}>{sub}</p>}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#030a16', color: '#f1f5f9', fontFamily: 'Inter,system-ui,sans-serif' }}>
      {/* Header */}
      <header style={{ padding: '16px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(3,10,22,0.97)', backdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⚙️</div>
          <div>
            <p style={{ fontWeight: 900, fontSize: 16, letterSpacing: '-0.03em' }}>Admin Dashboard</p>
            <p style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace' }}>Rural Health Connect • System Monitor</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: health?.status === 'ok' ? '#10d98a' : '#ef4444', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 11, color: health?.status === 'ok' ? '#10d98a' : '#ef4444', fontWeight: 700, fontFamily: 'monospace' }}>
              {health?.status === 'ok' ? 'BACKEND ONLINE' : 'BACKEND OFFLINE'}
            </span>
          </div>
          <button onClick={fetchAll} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
            🔄 Refresh
          </button>
          <a href="/" style={{ fontSize: 11, color: '#475569', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 12px' }}>← Patient App</a>
          <a href="/hospital" style={{ fontSize: 11, color: '#475569', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 12px' }}>🏥 Hospital</a>
        </div>
      </header>

      <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>
        {loading && !health ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ width: 48, height: 48, border: '3px solid rgba(124,58,237,0.3)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ color: '#475569' }}>Connecting to backend…</p>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
              <StatCard label="Backend Status" value={health?.status === 'ok' ? '✅ Online' : '❌ Offline'} sub="FastAPI + PostgreSQL" color={health?.status === 'ok' ? '#10d98a' : '#ef4444'} />
              <StatCard label="DB Mode" value={health?.db_available ? 'Supabase' : 'In-Memory'} sub={health?.db_available ? 'PostgreSQL connected' : 'Fallback active'} color={health?.db_available ? '#10d98a' : '#f59e0b'} />
              <StatCard label="WS Connections" value={health?.ws_connections ?? '—'} sub="Live hospital dashboards" color="#3b82f6" />
              <StatCard label="On-Shift Doctors" value={health?.active_doctors ?? '—'} sub="Registered for dispatch" color="#10d98a" />
              <StatCard label="Open Cases" value={health?.total_open_cases ?? cases.filter(c => c.status === 'open').length} sub="Awaiting dispatch" color="#f59e0b" />
              <StatCard label="Closed Cases" value={history.length} sub="Accepted or discharged" color="#a855f7" />
              <StatCard label="Encryption" value={health?.encryption === 'fernet_aes' ? '🔐 AES' : '⚠️ Base64'} sub={health?.encryption === 'fernet_aes' ? 'Fernet AES-128 active' : 'Upgrade: install cryptography'} color={health?.encryption === 'fernet_aes' ? '#10d98a' : '#ef4444'} />
              <StatCard label="Outbreaks" value={outbreaks.length} sub="Active H3 cluster alerts" color={outbreaks.length > 0 ? '#ef4444' : '#334155'} />
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 0 }}>
              {(['overview', 'cases', 'history', 'outbreaks'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 20px', background: 'none', border: 'none', borderBottom: tab === t ? '2px solid #7c3aed' : '2px solid transparent', color: tab === t ? '#a855f7' : '#475569', cursor: 'pointer', fontWeight: 800, fontSize: 13, textTransform: 'capitalize' }}>
                  {t === 'cases' ? `Live Cases (${cases.length})` : t === 'history' ? `History (${history.length})` : t === 'outbreaks' ? `Outbreaks (${outbreaks.length})` : 'Overview'}
                </button>
              ))}
            </div>

            {/* Overview Tab */}
            {tab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Seed Test Case */}
                <div style={{ background: 'rgba(8,20,45,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 24 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>🧪 Seed Test Case</p>
                  <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16, lineHeight: 1.5 }}>
                    Creates a realistic dummy patient case with fever + breathless symptoms in your sector. Opens on the hospital dashboard immediately.
                  </p>
                  <button
                    onClick={seedTestCase}
                    disabled={seeding}
                    style={{ width: '100%', padding: '14px', borderRadius: 12, background: seeding ? 'rgba(124,58,237,0.2)' : 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', color: 'white', fontWeight: 800, cursor: seeding ? 'not-allowed' : 'pointer', fontSize: 14 }}
                  >
                    {seeding ? '⏳ Creating…' : '🚀 Seed a Test Case'}
                  </button>
                  {seedResult && (
                    <p style={{ fontSize: 12, marginTop: 12, color: seedResult.startsWith('✅') ? '#10d98a' : '#ef4444', fontFamily: 'monospace' }}>{seedResult}</p>
                  )}
                </div>

                {/* System Info */}
                <div style={{ background: 'rgba(8,20,45,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 24 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>⚙️ System Configuration</p>
                  {[
                    ['Backend URL', API_BASE_URL],
                    ['DB Mode', health?.db_available ? 'Supabase PostgreSQL' : 'In-Memory (SQLite fallback)'],
                    ['Encryption', health?.encryption ?? 'Unknown'],
                    ['WebSocket Path', '/ws/hospital'],
                    ['Triage Engine', 'Meditron (Ollama) + Rule-based fallback'],
                    ['AI Vision', 'Gemini 1.5 Flash (set GEMINI_API_KEY)'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#475569', fontWeight: 700, flexShrink: 0 }}>{k}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', textAlign: 'right', wordBreak: 'break-all' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Cases Tab */}
            {tab === 'cases' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cases.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.4 }}>
                    <span style={{ fontSize: 48 }}>📭</span>
                    <p style={{ fontSize: 14, marginTop: 12, color: '#475569' }}>No open cases. Use "Seed Test Case" to create one.</p>
                  </div>
                ) : cases.map(c => (
                  <div key={c.case_id} style={{ background: 'rgba(8,20,45,0.8)', border: `1px solid ${SEV_COLOR[c.severity] || '#334155'}33`, borderRadius: 14, padding: '14px 20px', display: 'grid', gridTemplateColumns: '180px 1fr auto', gap: 16, alignItems: 'center' }}>
                    <div>
                      <p style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>{c.case_id}</p>
                      <p style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>{new Date(c.timestamp).toLocaleString('en-IN')}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ background: `${SEV_COLOR[c.severity]}22`, color: SEV_COLOR[c.severity], border: `1px solid ${SEV_COLOR[c.severity]}44`, fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase' }}>{c.severity}</span>
                      {(c.zones || []).map((z: string) => <span key={z} style={{ background: 'rgba(16,217,138,0.06)', color: '#10d98a', border: '1px solid rgba(16,217,138,0.15)', borderRadius: 10, padding: '2px 8px', fontSize: 10 }}>📍{z}</span>)}
                      {(c.symptoms || []).map((s: string) => <span key={s} style={{ background: 'rgba(255,255,255,0.03)', color: '#64748b', borderRadius: 10, padding: '2px 8px', fontSize: 10 }}>{s}</span>)}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#10d98a', background: 'rgba(16,217,138,0.08)', padding: '4px 10px', borderRadius: 20, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{c.status}</span>
                  </div>
                ))}
              </div>
            )}

            {/* History Tab */}
            {tab === 'history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {history.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.4 }}>
                    <span style={{ fontSize: 48 }}>📖</span>
                    <p style={{ fontSize: 14, marginTop: 12, color: '#475569' }}>No closed cases yet.</p>
                  </div>
                ) : history.map(c => (
                  <div key={c.case_id} style={{ background: 'rgba(8,20,45,0.8)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                    <div>
                      <p style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>{c.case_id}</p>
                      <p style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>{new Date(c.timestamp).toLocaleString('en-IN')}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                      {(c.zones || []).map((z: string) => <span key={z} style={{ background: 'rgba(16,217,138,0.06)', color: '#10d98a', borderRadius: 10, padding: '2px 8px', fontSize: 10 }}>📍{z}</span>)}
                      {(c.symptoms || []).map((s: string) => <span key={s} style={{ background: 'rgba(255,255,255,0.03)', color: '#64748b', borderRadius: 10, padding: '2px 8px', fontSize: 10 }}>{s}</span>)}
                    </div>
                    <span style={{ background: c.status === 'discharged' ? 'rgba(16,217,138,0.1)' : 'rgba(245,158,11,0.1)', color: c.status === 'discharged' ? '#10d98a' : '#f59e0b', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{c.status}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Outbreaks Tab */}
            {tab === 'outbreaks' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {outbreaks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.4 }}>
                    <span style={{ fontSize: 48 }}>✅</span>
                    <p style={{ fontSize: 14, marginTop: 12, color: '#475569' }}>No outbreak clusters detected. System is clear.</p>
                  </div>
                ) : outbreaks.map((o: any, i: number) => (
                  <div key={i} style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 20 }}>⚠️</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#ef4444' }}>Outbreak Detected</span>
                    </div>
                    <p style={{ fontSize: 13, color: '#fca5a5', lineHeight: 1.5 }}>{o.message}</p>
                    {o.sector && <p style={{ fontSize: 11, color: '#475569', marginTop: 6, fontFamily: 'monospace' }}>H3 Sector: {o.sector}</p>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.3} }
        @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}
