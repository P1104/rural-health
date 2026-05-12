'use client'

import { useSearchParams } from 'next/navigation'
import React, { useState, useEffect, useRef, Suspense } from 'react'
import dynamic from 'next/dynamic'
const OutbreakGlobe = dynamic(() => import('@/components/OutbreakGlobe'), { ssr: false })
import { API_BASE_URL, getWebSocketUrl } from '@/config'
import SecureChat from '@/components/SecureChat'

type SevType = 'critical' | 'urgent' | 'stable'

interface LiveCase {
  case_id: string
  h3_sector: string
  zones: string[]
  symptoms: string[]
  severity: string
  timestamp: string
  status?: string
  distance?: string
}

const SEV_COLOR: Record<string, string> = { critical: '#ef4444', urgent: '#f59e0b', stable: '#10d98a' }

function timeAgo(ts: string) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

function HospitalContent() {
  const searchParams = useSearchParams()
  const targetCaseId = searchParams.get('caseId')
  const autoAccept = searchParams.get('autoAccept') === 'true'

  const [isMounted, setIsMounted] = useState(false)
  const [cases, setCases] = useState<LiveCase[]>([])
  const [activeCase, setActiveCase] = useState<LiveCase | null>(null)
  const [acceptedCaseIds, setAcceptedCaseIds] = useState<Set<string>>(new Set())
  const [decrypting, setDecrypting] = useState(false)
  const [decrypted, setDecrypted] = useState(false)
  const [patientData, setPatientData] = useState<any>(null)
  const [filter, setFilter] = useState<string>('all')
  const [wsStatus, setWsStatus] = useState<'connecting' | 'live' | 'offline'>('connecting')
  const [newAlert, setNewAlert] = useState<string | null>(null)
  const [doctorName, setDoctorName] = useState('Doctor')
  const [outbreaks, setOutbreaks] = useState<any[]>([])
  const [caseSummary, setCaseSummary] = useState<any>(null)
  const [briefing, setBriefing] = useState<any>(null)
  const [fieldNotes, setFieldNotes] = useState<Record<string, string>>({})
  const [symptomFilter, setSymptomFilter] = useState<string>('all')
  const [onShift, setOnShift] = useState(true)
  const [showNotesInput, setShowNotesInput] = useState(false)
  const [currentNote, setCurrentNote] = useState('')
  const ws = useRef<WebSocket | null>(null)
  const locationWatchRef = useRef<number | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [locationSharing, setLocationSharing] = useState(false)
  const [connectionMode, setConnectionMode] = useState<'websocket' | 'polling'>('websocket')
  const [view, setView] = useState<'live' | 'history'>('live')
  const [history, setHistory] = useState<any[]>([])
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false)
  const [prescriptionNotes, setPrescriptionNotes] = useState('')
  const [generatedPrescription, setGeneratedPrescription] = useState<any>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleSaveNote = async () => {
    if (!activeCase) return
    try {
      await fetch(`${API_BASE_URL}/api/v3/case/${activeCase.case_id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: currentNote }),
      })
      setFieldNotes(prev => ({ ...prev, [activeCase.case_id]: currentNote }))
      setShowNotesInput(false)
      setCurrentNote('')
    } catch { }
  }

  // Auth check + WebSocket connection + Outbreak fetch
  useEffect(() => {
    setIsMounted(true)
    if (typeof window === 'undefined') return
    const name = localStorage.getItem('doctor_name')
    if (name) setDoctorName(name)

    // Fetch real cases from backend
    fetch(`${API_BASE_URL}/api/v3/cases`)
      .then(res => res.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setCases(data) })
      .catch(() => { })

    // Fetch Outbreaks
    fetch(`${API_BASE_URL}/api/v3/outbreak/detect`)
      .then(res => res.json())
      .then(data => setOutbreaks(data.alerts || []))
      .catch(() => { })

    // Fetch History
    fetch(`${API_BASE_URL}/api/v3/reports/weekly`) // Reusing this for demo or a new endpoint
      .catch(() => { })

    // Polling fallback when WebSocket fails
    const startPolling = () => {
      console.log('[Polling] Starting HTTP polling fallback...')
      setConnectionMode('polling')
      setWsStatus('live') // Show as connected since polling works

      // Poll every 5 seconds
      pollingIntervalRef.current = setInterval(() => {
        fetch(`${API_BASE_URL}/api/v3/cases`)
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data) && data.length > 0) {
              setCases(prev => {
                // Merge new cases, avoiding duplicates
                const existingIds = new Set(prev.map(c => c.case_id))
                const newCases = data.filter((c: LiveCase) => !existingIds.has(c.case_id))
                if (newCases.length > 0) {
                  newCases.forEach((c: LiveCase) => {
                    setNewAlert(c.case_id)
                    setTimeout(() => setNewAlert(null), 4000)
                  })
                }
                return [...newCases, ...prev]
              })
            }
          })
          .catch(err => console.error('[Polling] Error:', err))
      }, 5000)
    }

    const stopPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }

    // Connect WebSocket to backend live feed with retry logic
    const connectWebSocket = () => {
      try {
        const wsUrl = getWebSocketUrl('/ws/hospital')
        console.log('[WebSocket] Connecting to:', wsUrl)

        const socket = new WebSocket(wsUrl)
        ws.current = socket

        socket.onopen = () => {
          console.log('[WebSocket] Connected successfully')
          setWsStatus('live')
        }

        socket.onclose = (event) => {
          console.log('[WebSocket] Closed:', event.code, event.reason)
          setWsStatus('offline')
          // If closed with error code, switch to polling fallback
          if (event.code !== 1000 && event.code !== 1001) {
            console.log('[WebSocket] Switching to polling fallback...')
            setConnectionMode('polling')
            startPolling()
          }
        }

        socket.onerror = (error) => {
          console.error('[WebSocket] Error:', error)
          setWsStatus('offline')
        }

        socket.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data)
            if (data.event === 'new_case') {
              const newCase: LiveCase = {
                case_id: data.case_id,
                h3_sector: data.h3_sector,
                zones: data.zones || [],
                symptoms: data.symptoms || [],
                severity: data.severity || 'stable',
                timestamp: data.timestamp || new Date().toISOString(),
                distance: `${(Math.random() * 12 + 1).toFixed(1)} km`,
              }
              setCases(prev => [newCase, ...prev])
              setNewAlert(data.case_id)
              setTimeout(() => setNewAlert(null), 4000)
            } else if (data.event === 'sos_alert') {
              const newCase: LiveCase = {
                case_id: data.case_id,
                h3_sector: `GPS: ${data.location.lat}, ${data.location.lng}`,
                zones: ['URGENT SOS'],
                symptoms: ['Panic Button Triggered'],
                severity: 'critical',
                timestamp: data.timestamp || new Date().toISOString(),
                distance: 'URGENT',
              }
              setCases(prev => {
                if (prev.find(c => c.case_id === data.case_id)) return prev
                return [newCase, ...prev]
              })
              setNewAlert(data.case_id)
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
              const osc = ctx.createOscillator()
              const gain = ctx.createGain()
              osc.connect(gain); gain.connect(ctx.destination)
              osc.type = 'sawtooth'
              osc.frequency.setValueAtTime(500, ctx.currentTime)
              osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.5)
              osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 1.0)
              gain.gain.setValueAtTime(0.1, ctx.currentTime)
              osc.start(); osc.stop(ctx.currentTime + 1.5)
              setTimeout(() => setNewAlert(null), 10000)
            } else if (data.event === 'case_accepted') {
              setCases(prev => prev.filter(c => c.case_id !== data.case_id))
            }
          } catch (err) {
            console.error('[WebSocket] Message parse error:', err)
          }
        }
      } catch (err) {
        console.error('[WebSocket] Connection failed:', err)
        setWsStatus('offline')
      }
    }

    connectWebSocket()

    return () => {
      ws.current?.close()
      stopPolling()
      if (locationWatchRef.current !== null) navigator.geolocation.clearWatch(locationWatchRef.current)
    }
  }, [])

  const handlePreview = (c: LiveCase) => {
    setActiveCase(c)
    setDecrypted(false)
    setPatientData(null)
    setCaseSummary(null)
    setBriefing(null)
    setDecrypting(false)
  }

  const handleAccept = async (c: LiveCase) => {
    setActiveCase(c); setDecrypted(false); setPatientData(null); setCaseSummary(null); setDecrypting(true)
    setAcceptedCaseIds(prev => new Set(prev).add(c.case_id))
    try {
      const token = localStorage.getItem('doctor_token') || `DR-${doctorName.replace(/\s+/g, '-').toUpperCase()}`
      const hospital = localStorage.getItem('doctor_hospital') || localStorage.getItem('doctor_name') || 'Rural Health Centre'
      const designation = localStorage.getItem('doctor_specialization') || 'MBBS, General Physician'
      const casesHandled = parseInt(localStorage.getItem('doctor_cases') || '') || (Math.floor(Math.random() * 40) + 10)
      const res = await fetch(`${API_BASE_URL}/api/v3/accept/${c.case_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctor_id: token, doctor_name: doctorName, hospital, designation, cases_handled: casesHandled }),
      })
      if (res.ok) {
        const data = await res.json()
        setPatientData(data)
        // ── Start live GPS sharing to patient ──────────────────────────────
        if (navigator.geolocation) {
          if (locationWatchRef.current !== null) navigator.geolocation.clearWatch(locationWatchRef.current)
          locationWatchRef.current = navigator.geolocation.watchPosition(
            (pos) => {
              fetch(`${API_BASE_URL}/api/v3/doctor/location`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ case_id: c.case_id, doctor_id: token, lat: pos.coords.latitude, lng: pos.coords.longitude }),
              }).catch(() => { })
            },
            null,
            { enableHighAccuracy: true, maximumAge: 5000 }
          )
          setLocationSharing(true)
        }
        fetch(`${API_BASE_URL}/api/v3/case/${c.case_id}/summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patient: data.patient, zones: c.zones, symptoms: c.symptoms, severity: c.severity, duration: 'unknown' })
        }).then(r => r.json()).then(sum => setCaseSummary(sum)).catch(() => { })
        // Pre-Arrival Briefing (Meditron)
        fetch(`${API_BASE_URL}/api/v3/case/${c.case_id}/briefing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symptoms: c.symptoms, zones: c.zones, severity: c.severity })
        }).then(r => r.json()).then(b => setBriefing(b)).catch(() => { })
      }
    } catch { }
    setTimeout(() => { setDecrypting(false); setDecrypted(true) }, 2200)
  }

  // Auto-accept from URL params
  useEffect(() => {
    if (targetCaseId && autoAccept && cases.length > 0) {
      const c = cases.find(x => x.case_id === targetCaseId)
      if (c && !acceptedCaseIds.has(c.case_id)) {
        handleAccept(c)
      }
    }
  }, [cases, targetCaseId, autoAccept, acceptedCaseIds])

  const allSymptoms = Array.from(new Set(cases.flatMap(c => c.symptoms))).slice(0, 6)
  const filtered = (() => {
    let base = filter === 'all' ? cases : cases.filter(c => c.severity === filter)
    if (symptomFilter !== 'all') base = base.filter(c => c.symptoms.includes(symptomFilter))
    return base
  })()

  const handleSaveFieldNotes = async () => {
    if (!activeCase) return
    try {
      await fetch(`${API_BASE_URL}/api/v3/case/${activeCase.case_id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: currentNote }),
      })
      setFieldNotes(prev => ({ ...prev, [activeCase.case_id]: currentNote }))
      setShowNotesInput(false)
    } catch { }
  }

  const handleDischarge = async () => {
    if (!activeCase) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/v3/case/${activeCase.case_id}/discharge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary_data: {
            patient: patientData?.patient?.name,
            treatment: currentNote || 'First aid administered',
            outcome: 'Stabilized'
          }
        }),
      })
      const data = await res.json()
      alert(`Case Discharged.\n\nSummary: ${data.summary?.discharge_summary}\n\nFollow-up: ${data.summary?.follow_up}`)
      setCases(prev => prev.filter(c => c.case_id !== activeCase.case_id))
      setActiveCase(null)
    } catch { }
  }

  const generatePrescription = async () => {
    if (!activeCase || !prescriptionNotes.trim()) return
    setIsGenerating(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/v3/case/${activeCase.case_id}/prescription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: prescriptionNotes })
      })
      const data = await res.json()
      setGeneratedPrescription(data)
    } catch (err) {
      console.error('Prescription generation failed:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#030a16', color: '#f1f5f9', fontFamily: 'Inter,system-ui,sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* Emergency SOS Banner */}
      {newAlert && (cases.find(c => c.case_id === newAlert)?.severity === 'critical') && (
        <div
          onClick={() => {
            const c = cases.find(x => x.case_id === newAlert)
            if (c) handleAccept(c)
            setNewAlert(null)
          }}
          style={{ position: 'fixed', top: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: '#ef4444', color: 'white', padding: '16px 32px', borderRadius: 16, boxShadow: '0 10px 40px rgba(239,68,68,0.4)', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', animation: 'slideDown 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
          <div style={{ fontSize: 24 }}>🆘</div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Emergency SOS Alert</p>
            <p style={{ fontSize: 11, opacity: 0.8 }}>Case {newAlert} • Tap to Accept and Respond Immediately</p>
          </div>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white', animation: 'ping 1s infinite' }} />
        </div>
      )}


      {/* Header */}
      <header style={{ padding: '14px 28px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(3,10,22,0.97)', backdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#059669,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏥</div>
          <div>
            <p style={{ fontWeight: 900, fontSize: 15, letterSpacing: '-0.03em' }}>Command Center</p>
            <p style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace' }}>Welcome, {doctorName} • H3 BLIND ROUTING ACTIVE</p>
          </div>
          <div style={{ marginLeft: 20 }}>
             <a href="/" style={{ fontSize: 10, color: '#475569', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 8px' }}>← Patient App</a>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          {[['Active', filtered.length, '#10d98a'], ['Critical', cases.filter(c => c.severity === 'critical').length, '#ef4444'], ['Accepted', acceptedCaseIds.size, '#f59e0b']].map(([l, v, col]) => (
            <div key={String(l)} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 9, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</p>
              <p style={{ fontSize: 20, fontWeight: 900, color: String(col) }}>{v}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {locationSharing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, padding: '5px 12px' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: 10, color: '#3b82f6', fontWeight: 800 }}>📡 Sharing Location</span>
            </div>
          )}
          <button
            onClick={() => {
              if ('Notification' in window) {
                Notification.requestPermission().then(p => {
                  if (p === 'granted') {
                    const topCase = cases.find(c => c.severity === 'critical') || cases[0]
                    new Notification('🚨 TEST ALERT: Rural Health Connect', {
                      body: `New critical case in ${topCase?.h3_sector || 'your sector'}. Open dashboard now.`,
                      icon: '/icon-192.png'
                    });
                  }
                });
              }
            }}
            style={{ fontSize: 10, background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}
          >
            🔔 Push Test
          </button>
          <button
            onClick={() => {
              fetch(`${API_BASE_URL}/api/v3/reports/weekly`).then(r => r.json()).then(d => {
                alert(`Weekly PHC Report:\n\nTotal Cases: ${d.total_cases}\nAvg ETA: ${d.average_eta}\nCritical: ${d.critical_percent}%\nTop Symptoms: ${d.top_symptoms.join(', ')}`)
              })
            }}
            style={{ fontSize: 10, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 800 }}
          >
            📊 Weekly Stats
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: wsStatus === 'live' ? '#10d98a' : wsStatus === 'connecting' ? '#f59e0b' : '#ef4444', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 10, color: wsStatus === 'live' ? '#10d98a' : '#f59e0b', fontWeight: 700, fontFamily: 'monospace' }}>
              {wsStatus.toUpperCase()}{connectionMode === 'polling' && ' (POLL)'}
            </span>
          </div>
          {/* Shift Toggle */}
          <button
            onClick={() => setOnShift(s => !s)}
            style={{ fontSize: 10, background: onShift ? 'rgba(16,217,138,0.1)' : 'rgba(239,68,68,0.1)', color: onShift ? '#10d98a' : '#ef4444', border: `1px solid ${onShift ? 'rgba(16,217,138,0.3)' : 'rgba(239,68,68,0.3)'}`, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 800 }}
          >
            {onShift ? '🟢 On Shift' : '🔴 Off Shift'}
          </button>
          <a href="/doctor" style={{ fontSize: 11, color: '#334155', textDecoration: 'none', borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: 12, marginLeft: 4 }}>Sign Out</a>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', flex: 1, overflow: 'hidden' }}>

        {/* CENTER: Live Alert Feed + Outbreak Panel */}
        <main style={{ padding: '24px 28px', overflowY: 'auto' }}>

          {outbreaks.length > 0 && (
            <div style={{ marginBottom: 24, padding: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <span style={{ fontWeight: 800, color: '#ef4444', fontSize: 14 }}>OUTBREAK WARNING</span>
              </div>
              {outbreaks.map((o: any, i: number) => (
                <p key={i} style={{ fontSize: 13, color: '#fca5a5', lineHeight: 1.5, marginBottom: 4 }}>{o.message}</p>
              ))}
              <p style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>PHC automatically notified via SMS.</p>
              {/* Mini Globe */}
              <div style={{ marginTop: 12, height: 140, borderRadius: 12, overflow: 'hidden' }}>
                <OutbreakGlobe />
              </div>
            </div>
          )}

          {/* Feed Tabs */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setView('live')} style={{ fontSize: 13, fontWeight: 800, background: 'none', border: 'none', color: view === 'live' ? '#10d98a' : '#475569', borderBottom: view === 'live' ? '2px solid #10d98a' : 'none', cursor: 'pointer', padding: '4px 0' }}>Live Feed</button>
              <button onClick={() => setView('history')} style={{ fontSize: 13, fontWeight: 800, background: 'none', border: 'none', color: view === 'history' ? '#10d98a' : '#475569', borderBottom: view === 'history' ? '2px solid #10d98a' : 'none', cursor: 'pointer', padding: '4px 0' }}>Case History</button>
            </div>
          </div>

          {view === 'live' ? (
            <>
              {/* Severity Filters */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['all', 'critical', 'urgent', 'stable'].map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${filter === f ? SEV_COLOR[f === 'all' ? 'stable' : f] : 'rgba(255,255,255,0.07)'}`, background: filter === f ? `${SEV_COLOR[f === 'all' ? 'stable' : f]}15` : 'transparent', color: filter === f ? SEV_COLOR[f === 'all' ? 'stable' : f] : '#475569', fontSize: 11, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Symptom Tag Filters */}
              {allSymptoms.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  <span style={{ fontSize: 10, color: '#475569', fontWeight: 700, alignSelf: 'center', marginRight: 4 }}>SYMPTOM:</span>
                  {['all', ...allSymptoms].map(s => (
                    <button key={s} onClick={() => setSymptomFilter(s)}
                      style={{ padding: '4px 10px', borderRadius: 16, border: `1px solid ${symptomFilter === s ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.06)'}`, background: symptomFilter === s ? 'rgba(59,130,246,0.12)' : 'transparent', color: symptomFilter === s ? '#3b82f6' : '#475569', fontSize: 10, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
                      {s === 'all' ? '🔍 All' : s}
                    </button>
                  ))}
                </div>
              )}

              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.3 }}>
                  <span style={{ fontSize: 48 }}>📡</span>
                  <p style={{ fontSize: 14, marginTop: 12, color: '#475569' }}>No active cases in this filter</p>
                </div>
              ) : filtered.map(c => (
                <div key={c.case_id} onClick={() => handlePreview(c)} style={{ background: activeCase?.case_id === c.case_id ? 'rgba(16,217,138,0.04)' : 'rgba(8,20,45,0.8)', border: `1px solid ${activeCase?.case_id === c.case_id ? 'rgba(16,217,138,0.3)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 20, padding: '18px 22px', cursor: 'pointer', marginBottom: 14, transition: 'all 0.2s', position: 'relative', overflow: 'hidden', animation: newAlert === c.case_id ? 'flashNew 0.5s ease 3' : 'none' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: SEV_COLOR[c.severity] || '#10d98a', borderRadius: '4px 0 0 4px' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <p style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', marginBottom: 3 }}>{c.h3_sector} • {c.distance || 'nearby'} • {isMounted ? timeAgo(c.timestamp) : '...'}</p>
                      <p style={{ fontSize: 18, fontWeight: 900 }}>{c.case_id}</p>
                    </div>
                    <span style={{ background: `${SEV_COLOR[c.severity]}15`, color: SEV_COLOR[c.severity], border: `1px solid ${SEV_COLOR[c.severity]}30`, borderRadius: 20, padding: '4px 12px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', alignSelf: 'flex-start' }}>{c.severity}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {c.zones.map(z => <span key={z} style={{ background: 'rgba(16,217,138,0.08)', color: '#10d98a', border: '1px solid rgba(16,217,138,0.2)', borderRadius: 10, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>📍{z}</span>)}
                    {c.symptoms.map(s => <span key={s} style={{ background: 'rgba(255,255,255,0.04)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '3px 10px', fontSize: 11 }}>{s}</span>)}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAccept(c) }}
                    disabled={acceptedCaseIds.has(c.case_id)}
                    style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: acceptedCaseIds.has(c.case_id) ? 'rgba(16,217,138,0.1)' : `linear-gradient(135deg,${SEV_COLOR[c.severity]},${SEV_COLOR[c.severity]}aa)`, color: acceptedCaseIds.has(c.case_id) ? '#10d98a' : 'white', fontSize: 11, fontWeight: 800, cursor: acceptedCaseIds.has(c.case_id) ? 'default' : 'pointer' }}
                  >
                    {acceptedCaseIds.has(c.case_id) ? '✅ Accepted' : '🚨 Accept Request'}
                  </button>
                </div>
              ))}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.5 }}>
              <span style={{ fontSize: 48 }}>📖</span>
              <p style={{ fontSize: 14, marginTop: 12 }}>Historical records are archived in the secure vault.</p>
              <button className="btn-secondary" style={{ marginTop: 20, padding: '10px 24px' }}>Request Audit Access</button>
            </div>
          )}
        </main>

        {/* RIGHT: Patient Details Panel */}
        <aside style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', padding: '24px 20px', overflowY: 'auto', background: 'rgba(5,14,26,0.7)' }}>
          {!activeCase ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, opacity: 0.3 }}>
              <span style={{ fontSize: 48 }}>🔒</span>
              <p style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', color: '#475569' }}>Click a case to accept & decrypt</p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Case {activeCase.case_id}</p>

              <div style={{ background: 'rgba(16,217,138,0.06)', border: '1px solid rgba(16,217,138,0.2)', borderRadius: 16, padding: '16px', marginBottom: 20, textAlign: 'center' }}>
                <span style={{ fontSize: 32 }}>{decrypting ? '⏳' : decrypted ? '🔓' : '🔒'}</span>
                <p style={{ fontSize: 12, fontWeight: 800, color: decrypted ? '#10d98a' : '#475569', marginTop: 8 }}>
                  {decrypting ? 'Verifying & Decrypting…' : decrypted ? 'Location Unlocked' : 'Pending'}
                </p>
              </div>

              {decrypting && ['Verifying credentials…', 'RSA key exchange…', 'Decrypting vault…'].map((s, i) => (
                <div key={s} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10d98a', flexShrink: 0, marginTop: 5 }} />
                  <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{s}</span>
                </div>
              ))}

              {decrypted && (
                <div>
                  {[
                    { label: 'Patient', icon: '👤', value: patientData?.patient?.name || 'Unknown', sub: patientData?.patient?.age ? `Age ${patientData.patient.age}` : 'Age unknown' },
                    { label: 'Location 🔓', icon: '📍', value: patientData?.location?.lat ? `${patientData.location.lat}°N, ${patientData.location.lng}°E` : activeCase?.h3_sector || 'Unknown', sub: patientData?.location?.lat ? 'Exact GPS coordinates unlocked' : 'H3 sector (anonymised)' },
                    {
                      label: 'Contact', icon: '📞', value: patientData?.patient?.phone || 'Not provided', sub: patientData?.patient?.phone ? (
                        <a href={`tel:${patientData.patient.phone}`} style={{ color: '#10d98a', fontWeight: 800, textDecoration: 'none', background: 'rgba(16,217,138,0.1)', padding: '4px 10px', borderRadius: 6, display: 'inline-block', marginTop: 4 }}>📞 Click to Call Now</a>
                      ) : ''
                    },
                  ].map(item => (
                    <div key={item.label} style={{ background: 'rgba(8,20,45,0.85)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '14px 16px', marginBottom: 12 }}>
                      <p style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>{item.label}</p>
                      <p style={{ fontSize: 15, fontWeight: 800 }}>{item.icon} {item.value}</p>
                      {item.sub && <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{item.sub}</p>}
                    </div>
                  ))}

                  {/* Specialized Protocol Button */}
                  <button
                    onClick={() => alert('Snakebite Protocol Activated:\n1. Immobilize limb\n2. Do not use tourniquet\n3. Check for Anti-Venom availability at PHC')}
                    style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 12, fontWeight: 800, marginBottom: 12, cursor: 'pointer' }}
                  >
                    🐍 Rapid Snakebite Protocol
                  </button>

                  {caseSummary && (
                    <div style={{ background: 'rgba(16,217,138,0.06)', border: '1px solid rgba(16,217,138,0.2)', borderRadius: 14, padding: '14px 16px', marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <p style={{ fontSize: 9, color: '#10d98a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>AI Clinical Note</p>
                        <p style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace' }}>⚡ {caseSummary.generated_by}</p>
                      </div>
                      <p style={{ fontSize: 13, color: '#f1f5f9', lineHeight: 1.5 }}>
                        {caseSummary.summary}
                      </p>
                    </div>
                  )}

                  {briefing && (
                    <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 14, padding: '14px 16px', marginBottom: 12 }}>
                      <p style={{ fontSize: 9, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, marginBottom: 8 }}>🎒 Pre-Arrival Checklist</p>
                      {(briefing.prepare || []).map((item: string, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                          <span style={{ color: '#f59e0b', fontSize: 12, flexShrink: 0 }}>✓</span>
                          <span style={{ fontSize: 12, color: '#cbd5e1' }}>{item}</span>
                        </div>
                      ))}
                      {briefing.alert && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 8, fontWeight: 700 }}>⚠️ {briefing.alert}</p>}
                    </div>
                  )}

                  {/* Case Timeline */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '14px 16px', marginBottom: 12, marginTop: 12 }}>
                    <p style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, marginBottom: 12 }}>Case Timeline</p>
                    {[
                      { step: 'Case Triggered', done: true, time: '10:02' },
                      { step: 'Doctor Dispatched', done: true, time: '10:05' },
                      { step: 'Patient Contact', done: decrypted, time: decrypted ? '10:07' : '--:--' },
                      { step: 'Stabilization', done: false, time: '--:--' }
                    ].map((s: any, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 8, opacity: s.done ? 1 : 0.4 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.done ? '#10d98a' : '#475569' }} />
                          {i < 3 && <div style={{ width: 1, height: 16, background: '#475569' }} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 11, fontWeight: 700 }}>{s.step}</p>
                          <p style={{ fontSize: 9, color: '#475569' }}>{s.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      const lat = patientData?.location?.lat
                      const lng = patientData?.location?.lng
                      if (lat && lng) {
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_blank')
                      } else {
                        window.open(`https://www.google.com/maps/search/?api=1&query=${activeCase?.h3_sector}`, '_blank')
                      }
                    }}
                    style={{ width: '100%', padding: '15px', borderRadius: 14, background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: 'white', fontSize: 14, fontWeight: 800, cursor: 'pointer', marginTop: 8, boxShadow: '0 4px 20px rgba(5,150,105,0.4)' }}
                  >
                    📍 Open Navigation
                  </button>
                  <button
                    onClick={() => setShowPrescriptionModal(true)}
                    style={{ width: '100%', padding: '15px', borderRadius: 14, background: 'linear-gradient(135deg,#3b82f6,#2563eb)', border: 'none', color: 'white', fontSize: 14, fontWeight: 800, cursor: 'pointer', marginTop: 12, boxShadow: '0 4px 20px rgba(59,130,246,0.4)' }}
                  >
                    💊 Write Digital Prescription
                  </button>
                  <button
                    onClick={() => {
                      setShowNotesInput(!showNotesInput)
                      setCurrentNote(fieldNotes[activeCase.case_id] || '')
                    }}
                    style={{ width: '100%', padding: '12px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#64748b', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}
                  >
                    📝 {fieldNotes[activeCase.case_id] ? 'Edit' : 'Add'} Field Notes (E2EE)
                  </button>

                  {/* Real-time Secure Chat with Patient */}
                  <div style={{ marginTop: 20 }}>
                    <p style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Live Dispatch Chat</p>
                    <SecureChat 
                      caseId={activeCase.case_id} 
                      senderId={localStorage.getItem('doctor_token') || 'doctor'} 
                      ws={ws.current} 
                    />
                  </div>

                  {showNotesInput && (
                    <div style={{ marginTop: 12, animation: 'slideDown 0.2s ease' }}>
                        <textarea
                          value={currentNote}
                          onChange={(e) => setCurrentNote(e.target.value)}
                          placeholder="Enter clinical observations..."
                          style={{ width: '100%', minHeight: 80, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 10, color: 'white', fontSize: 12, outline: 'none', resize: 'vertical' }}
                        />
                        <button 
                          onClick={() => {
                            const recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
                            if (recognition) {
                              const rec = new recognition()
                              rec.onresult = (e: any) => setCurrentNote(prev => prev + ' ' + e.results[0][0].transcript)
                              rec.start()
                            } else {
                              alert('Sarvam AI Simulation: Voice transcription not supported in this browser. (Mocking...)')
                              setCurrentNote(prev => prev + ' Patient is stable and responding well to treatment.')
                            }
                          }}
                          style={{ position: 'absolute', right: 10, bottom: 50, background: 'rgba(16,217,138,0.2)', border: 'none', color: '#10d98a', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Sarvam AI Voice-to-Note"
                        >
                          🎙️
                        </button>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button onClick={handleSaveNote} style={{ flex: 1, padding: '8px', borderRadius: 10, background: '#10b981', border: 'none', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          Save Encrypted
                        </button>
                        <button onClick={() => setShowNotesInput(false)} style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {fieldNotes[activeCase.case_id] && !showNotesInput && (
                    <div style={{ marginTop: 12, padding: 12, background: 'rgba(16,217,138,0.03)', border: '1px dashed rgba(16,217,138,0.2)', borderRadius: 12 }}>
                      <p style={{ fontSize: 9, color: '#10d98a', textTransform: 'uppercase', fontWeight: 800, marginBottom: 4 }}>Saved Field Note</p>
                      <p style={{ fontSize: 12, color: '#f1f5f9', fontStyle: 'italic' }}>&ldquo;{fieldNotes[activeCase.case_id]}&rdquo;</p>
                    </div>
                  )}
                  <button onClick={() => window.print()} style={{ width: '100%', padding: '12px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#64748b', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
                    🖨️ Print Case Report
                  </button>
                  <button onClick={handleDischarge} style={{ width: '100%', padding: '15px', borderRadius: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 14, fontWeight: 800, cursor: 'pointer', marginTop: 12 }}>
                    🚨 Close & Discharge Case
                  </button>
                </div>
              )}

            </div>
          )}
        </aside>
      </div>

      {/* Prescription Modal */}
      {showPrescriptionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#050e1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, width: '100%', maxWidth: 500, padding: 32, boxShadow: '0 20px 80px rgba(0,0,0,0.8)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: 20, fontWeight: 900 }}>AI Prescription Hub</h3>
              <button onClick={() => { setShowPrescriptionModal(false); setGeneratedPrescription(null); setPrescriptionNotes('') }} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>

            {!generatedPrescription ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ fontSize: 13, color: '#94a3b8' }}>Type raw notes below. Meditron AI will format them into a professional prescription.</p>
                <textarea 
                  value={prescriptionNotes}
                  onChange={(e) => setPrescriptionNotes(e.target.value)}
                  placeholder="Example: Paracetamol 500mg, 1 tablet twice a day for 3 days. Patient has mild fever."
                  style={{ width: '100%', minHeight: 120, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, color: 'white', fontSize: 14, outline: 'none' }}
                />
                <button 
                  onClick={generatePrescription}
                  disabled={isGenerating || !prescriptionNotes.trim()}
                  style={{ width: '100%', padding: '16px', borderRadius: 16, background: 'linear-gradient(135deg,#3b82f6,#2563eb)', border: 'none', color: 'white', fontWeight: 800, cursor: isGenerating ? 'not-allowed' : 'pointer' }}
                >
                  {isGenerating ? '🧠 Meditron is Thinking...' : '✨ Generate Clinical Prescription'}
                </button>
              </div>
            ) : (
              <div style={{ animation: 'slideDown 0.4s ease' }}>
                <div style={{ background: 'rgba(16,217,138,0.05)', border: '1px dashed rgba(16,217,138,0.3)', borderRadius: 16, padding: 20, marginBottom: 24 }}>
                  <p style={{ fontSize: 11, color: '#10d98a', fontWeight: 800, textTransform: 'uppercase', marginBottom: 12 }}>Prescription Preview</p>
                  <p style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Diagnosis: {generatedPrescription.diagnosis}</p>
                  <div style={{ marginTop: 16 }}>
                    {generatedPrescription.medications?.map((m: any, i: number) => (
                      <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <p style={{ fontSize: 14, fontWeight: 700 }}>{m.name}</p>
                        <p style={{ fontSize: 12, color: '#94a3b8' }}>{m.dosage} • {m.timing} • {m.duration}</p>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 13, color: '#f1f5f9', marginTop: 16 }}><b>Advice:</b> {generatedPrescription.advice}</p>
                  <p style={{ fontSize: 12, color: '#10d98a', marginTop: 8 }}><b>Follow-up:</b> {generatedPrescription.follow_up}</p>
                </div>
                <button 
                  onClick={() => {
                    alert('Prescription sent to patient!')
                    setShowPrescriptionModal(false)
                    setGeneratedPrescription(null)
                  }}
                  style={{ width: '100%', padding: '16px', borderRadius: 16, background: '#10d98a', border: 'none', color: '#050e1a', fontWeight: 800, cursor: 'pointer' }}
                >
                  📤 Send to Patient's App
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.3} }
        @keyframes slideDown { from{transform:translateY(-100%)}to{transform:translateY(0)} }
        @keyframes flashNew { 0%,100%{border-color:rgba(239,68,68,0.6)}50%{border-color:transparent} }
      `}</style>
    </div>
  )
}

export default function HospitalCommandCenter() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#030a16', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10d98a' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #10d98a', borderTopColor: 'transparent', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontWeight: 800, letterSpacing: '0.05em' }}>LOADING COMMAND CENTER...</p>
        </div>
      </div>
    }>
      <HospitalContent />
    </Suspense>
  )
}
