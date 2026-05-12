'use client'
// Rural Health Connect - Patient Interface

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import BodyMap from '@/components/BodyMap'
import SymptomCard from '@/components/SymptomCard'
import TriageAssistant from '@/components/TriageAssistant'
import VoiceAssistant from '@/components/VoiceAssistant'
import AIGreeter from '@/components/AIGreeter'
import Human3D from '@/components/Human3D'
import DoctorTracker, { DoctorProfile } from '@/components/DoctorTracker'
import PatientRegistration from '@/components/PatientRegistration'
import { ZONE_SYMPTOMS, LANGUAGES, DURATIONS, SEVERITIES, FIRST_AID } from '@/data/symptomMapping'
import { TRANSLATIONS } from '@/data/translations'
import { API_BASE_URL, WS_BASE_URL } from '@/config'
import SecureChat from '@/components/SecureChat'

type Step = 'lang' | 'register' | 'body' | 'symptoms' | 'severity' | 'review' | 'waiting'

export default function App() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('lang')
  const [lang, setLang] = useState('kn')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [iconMode, setIconMode] = useState(false)

  // BCP-47 codes for Web Speech API TTS — used throughout for consistent regional voices
  const BCP47: Record<string, string> = {
    kn: 'kn-IN', hi: 'hi-IN', ta: 'ta-IN',
    te: 'te-IN', bn: 'bn-IN', mr: 'mr-IN', en: 'en-IN'
  }
  const [patient, setPatient] = useState<{ name: string; age: string; phone: string } | null>(null)
  const [selectedZones, setSelectedZones] = useState<string[]>([])
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([])
  const [duration, setDuration] = useState('')
  const [severity, setSeverity] = useState('')
  const [triageResult, setTriageResult] = useState<any>(null)
  const [sosPulse, setSosPulse] = useState(false)
  const [patientPhoto, setPatientPhoto] = useState<string | null>(null)
  const [loadingAdvice, setLoadingAdvice] = useState(false)
  const [vitals, setVitals] = useState<{ pulse: number; resp: number } | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [greeterVisible, setGreeterVisible] = useState(true)
  const [sosActive, setSosActive] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [caseId, setCaseId] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [doctorAccepted, setDoctorAccepted] = useState(false)
  const [countdown, setCountdown] = useState(600) // 10 minutes in seconds
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number }>({ lat: 12.9716, lng: 77.5946 })
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null)
  const [doctorLocation, setDoctorLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [toasts, setToasts] = useState<{ id: string; msg: string; color: string }[]>([])
  const [symptomSearch, setSymptomSearch] = useState('')
  const [painLevel, setPainLevel] = useState(5)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [tipIndex, setTipIndex] = useState(0)
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [receivedPrescription, setReceivedPrescription] = useState<any>(null)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    setMounted(true)
    setCaseId(`SEC-${Math.random().toString(36).slice(2, 7).toUpperCase()}`)

    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          console.log("Location updated:", pos.coords.latitude, pos.coords.longitude);
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.warn("Geolocation failed:", err.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [])

  // PWA install prompt listener
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler as any)
    return () => window.removeEventListener('beforeinstallprompt', handler as any)
  }, [])

  // Rotate health tips every 6s on waiting screen
  const HEALTH_TIPS = [
    '💧 Drink small sips of water to stay hydrated.',
    '🧘 Breathe slowly and stay calm — help is on the way.',
    '📵 Keep your phone charged and nearby.',
    '🩹 If bleeding, press firmly with a clean cloth.',
    '🚫 Do not eat or drink if you may need surgery.',
    '❄️ If burned, cool with clean water for 10 minutes.',
    '🐍 If bitten, keep the limb still and below heart level.',
  ]
  useEffect(() => {
    if (step !== 'waiting') return
    const t = setInterval(() => setTipIndex(i => (i + 1) % HEALTH_TIPS.length), 6000)
    return () => clearInterval(t)
  }, [step])

  const triggerSOS = () => {
    if (navigator.vibrate) navigator.vibrate([100, 50, 100])
    setSosPulse(true)
    setTimeout(() => setSosPulse(false), 2000)
    
    setSosActive(true)
    setStep('waiting')
    if (typeof window !== 'undefined') {
      const u = new SpeechSynthesisUtterance('SOS activated. Broadcasting your location to all nearby hospitals immediately. Help is coming.')
      u.rate = 0.9; window.speechSynthesis.speak(u)

      // Start Siren Audio
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(440, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.5)
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 1.0)

      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      osc.start()

      // Notify Backend / Hospitals
      fetch(`${API_BASE_URL}/api/v3/sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          case_id: caseId, 
          location: userLocation,
          severity: 'critical',
          patient: patient ? { ...patient, photo: patientPhoto } : { name: 'Anonymous', age: '0', phone: '0000000000', photo: patientPhoto }
        }),
      }).catch(() => { })

      // Stop after 10s to not be annoying in demo
      setTimeout(() => osc.stop(), 10000)
    }
  }

  const analyzeImage = async () => {
    if (!patientPhoto) {
      alert("Please upload a photo first in the Info step!");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v3/analysis/vision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: patientPhoto, symptoms: selectedSymptoms }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiAnalysis(data);
      }
    } catch (e) { }
    setAnalyzing(false);
  }

  // Build zone-specific symptom list (deduplicated)
  const availableSymptoms = React.useMemo(() => {
    const all = [
      ...selectedZones.flatMap(z => ZONE_SYMPTOMS[z] || []),
      ...ZONE_SYMPTOMS['General'],
    ]
    const seen = new Set<string>()
    return all.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true })
  }, [selectedZones])

  const fetchAdvice = useCallback(async () => {
    if (selectedSymptoms.length === 0) { setTriageResult(null); return }
    setLoadingAdvice(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/v3/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms: selectedSymptoms, zones: selectedZones, severity, lang }),
      })
      if (res.ok) {
        const data = await res.json()
        setTriageResult(data)
      } else {
        // Rule-based fallback
        const key = selectedSymptoms[0]
        setTriageResult({ advice: FIRST_AID[key] || FIRST_AID.default, urgency_score: 50 })
      }
    } catch {
      const key = selectedSymptoms[0]
      setTriageResult({ advice: FIRST_AID[key] || FIRST_AID.default, urgency_score: 50 })
    } finally {
      setLoadingAdvice(false)
    }
  }, [selectedSymptoms, selectedZones, severity, lang])

  useEffect(() => { fetchAdvice() }, [fetchAdvice])

  // Elapsed timer on waiting screen
  useEffect(() => {
    if (step !== 'waiting') return
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [step])

  // WebSocket: listen for doctor acceptance and chat
  useEffect(() => {
    if (step !== 'waiting') return
    let ws: WebSocket | null = null
    try {
      ws = new WebSocket(`${WS_BASE_URL}/ws/hospital`)
      setSocket(ws)
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.event === 'case_accepted') {
            setDoctorAccepted(true)
            setCountdown(600)
            if (data.doctor_profile) setDoctorProfile(data.doctor_profile)
            // Toast notification
            const id = Date.now().toString()
            setToasts(p => [...p, { id, msg: `🚑 Dr. ${data.doctor_profile?.name || 'Doctor'} is on the way!`, color: '#10d98a' }])
            setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000)
          } else if (data.event === 'doctor_location_update') {
            setDoctorLocation({ lat: data.lat, lng: data.lng })
          } else if (data.event === 'prescription_ready') {
            setReceivedPrescription(data.prescription)
            const id = Date.now().toString()
            setToasts(p => [...p, { id, msg: "📋 Your prescription is ready!", color: '#3b82f6' }])
            setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 8000)
          }
        } catch { }
      }
    } catch { }
    return () => {
        ws?.close()
        setSocket(null)
    }
  }, [step])

  // Countdown timer after doctor accepts
  useEffect(() => {
    if (!doctorAccepted) return
    if (countdown <= 0) return
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [doctorAccepted, countdown])

  const [offlineToast, setOfflineToast] = useState(false)

  // Listen for Service Worker messages
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handler = (event: MessageEvent) => {
        if (event.data.type === 'QUEUE_CASE') {
          setOfflineToast(true)
          setTimeout(() => setOfflineToast(false), 5000)
        }
      }
      navigator.serviceWorker.addEventListener('message', handler)
      return () => navigator.serviceWorker.removeEventListener('message', handler)
    }
  }, [])

  const scanVitals = () => {
    setIsScanning(true)
    setTimeout(() => {
      setVitals({ pulse: 72 + Math.floor(Math.random() * 20), resp: 16 + Math.floor(Math.random() * 4) })
      setIsScanning(false)
    }, 3000)
  }

  const toggleZone = (z: string) =>
    setSelectedZones(p => p.includes(z) ? p.filter(x => x !== z) : [...p, z])

  const toggleSymptom = (id: string) =>
    setSelectedSymptoms(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const onSpeechAnalyzed = (d: { symptoms: string[]; zones: string[]; advice: string }) => {
    setSelectedZones(d.zones)
    setSelectedSymptoms(d.symptoms)
    setTriageResult({ advice: d.advice, urgency_score: 50 })
    setStep('symptoms')
  }

  /**
   * Called when the user replies to the AI Greeter by voice.
   * Parses the reply for name/age/phone and any symptoms mentioned,
   * then navigates to 'register' so the form is pre-filled.
   */
  const handleGreeterVoiceReply = useCallback((transcript: string) => {
    // Extract 10-digit phone
    const phoneMatch = transcript.match(/\b(\d{10})\b/)
    // Extract age
    const ageMatch = transcript.match(/(\d{1,3})\s*(?:year|years|sal|ವರ್ಷ|वर्ष|ఏళ్ళు|வயது|বছর)/i)
      || transcript.match(/(?:age|aged|ವಯಸ್ಸು|उम्र)\s*(\d{1,3})/i)
    // Symptom keywords (English + common transliterations)
    const symptomKeywords: Record<string, string> = {
      fever: 'fever', temperature: 'fever', jwar: 'fever',
      headache: 'headache', head: 'headache',
      breathless: 'breathless', breath: 'breathless', asthma: 'breathless',
      stomach: 'cramps', abdomen: 'cramps', vomit: 'vomit', nausea: 'vomit',
      wound: 'wound', cut: 'wound', bleeding: 'wound',
      snake: 'snakebite', bite: 'snakebite',
      chest: 'tightness', pain: 'tightness', dizzy: 'dizziness',
    }
    const lower = transcript.toLowerCase()
    const foundSymptoms = [...new Set(
      Object.entries(symptomKeywords)
        .filter(([kw]) => lower.includes(kw))
        .map(([, sym]) => sym)
    )]
    if (foundSymptoms.length) setSelectedSymptoms(foundSymptoms)

    // Pre-fill name (simple heuristic — words that aren't numbers, phone or age digits)
    const cleanText = transcript
      .replace(phoneMatch?.[1] || '', '')
      .replace(ageMatch?.[1] || '', '')
      .replace(/\b(?:my name is|i am|i'm|mera naam|nanna hesaru|naam|name|age|phone|number|mobile|year|years|sal|sick|problem|fever|pain|bite|wound|breathless|vomit|dizzy|chest|stomach|head)\b/gi, '')
      .replace(/\d+/g, '')
      .replace(/\s+/g, ' ').trim()

    if (cleanText.length > 1) setPatient(p => p ? { ...p, name: cleanText } : { name: cleanText, age: ageMatch?.[1] || '', phone: phoneMatch?.[1] || '' })
    if (ageMatch?.[1]) setPatient(p => p ? { ...p, age: ageMatch[1] } : { name: '', age: ageMatch[1], phone: '' })
    if (phoneMatch?.[1]) setPatient(p => p ? { ...p, phone: phoneMatch[1] } : { name: '', age: '', phone: phoneMatch[1] })

    // Dismiss greeter and navigate to register
    setGreeterVisible(false)
    setStep('register')
  }, [setSelectedSymptoms, setPatient, setGreeterVisible, setStep])

  const STEP_ORDER: Step[] = ['lang', 'register', 'body', 'symptoms', 'severity', 'review', 'waiting']
  const stepIdx = STEP_ORDER.indexOf(step)

  // Submit to backend
  const submitCase = async (finalStep: boolean = false) => {
    if (!finalStep) return
    try {
      const isOffline = !navigator.onLine

      const res = await fetch(`${API_BASE_URL}/api/v3/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration: patient ? { ...patient, photo: patientPhoto } : { name: 'Anonymous', age: '0', phone: '0000000000', photo: patientPhoto },
          location: userLocation,
          zones: selectedZones,
          symptoms: selectedSymptoms,
          severity,
          duration,
          public_key: '',
        }),
      })
      const data = await res.json()
      console.log('Case submitted:', data)

      // If patient gave a phone, send a Family Alert to themselves (demo)
      if (patient?.phone && !isOffline) {
        fetch(`${API_BASE_URL}/api/v3/family/alert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            case_id: data.case_id || 'SEC-OFFLINE',
            patient_name: patient.name,
            family_contacts: [patient.phone],
            sos: false
          }),
        }).catch(e => console.log('Family alert skipped (offline/demo)'))
      }
    } catch (e) {
      console.warn('Backend not available or Offline — queued in Service Worker')
    }
  }

  const t = TRANSLATIONS[lang] || TRANSLATIONS['en']

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, background: theme === 'dark' ? '#030a16' : '#f8fafc', color: theme === 'dark' ? '#f1f5f9' : '#0f172a', transition: 'background 0.3s' }}>

      {/* SOS Fullscreen Pulse Overlay */}
      {sosPulse && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(239,68,68,0.4)', animation: 'sosPulseAnim 0.5s ease-out infinite', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 200, height: 200, borderRadius: '50%', border: '8px solid white', animation: 'sosRingAnim 0.5s ease-out infinite' }} />
        </div>
      )}

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          {toasts.map(toast => (
            <div key={toast.id} style={{
              background: toast.color, color: '#fff', padding: '12px 22px',
              borderRadius: 14, fontSize: 13, fontWeight: 700,
              boxShadow: `0 6px 24px rgba(0,0,0,0.4)`,
              animation: 'slideDown 0.3s ease',
              whiteSpace: 'nowrap',
            }}>
              {toast.msg}
            </div>
          ))}
        </div>
      )}

      {/* AI Greeter Overlay */}
      {greeterVisible && step !== 'waiting' && (
        <AIGreeter
          lang={lang}
          onDismiss={() => setGreeterVisible(false)}
          onVoiceReply={handleGreeterVoiceReply}
        />
      )}

      {/* Connectivity Status Banner */}
      {mounted && !navigator.onLine && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'linear-gradient(90deg,#d97706,#f59e0b)', padding: '6px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white', animation: 'ping 1s infinite' }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: 'white', letterSpacing: '0.04em' }}>📡 OFFLINE MODE — Cases queued locally, will sync when connection returns</span>
        </div>
      )}

      {/* Navbar */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 24px',
        background: 'rgba(5,14,26,0.9)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {offlineToast && (
          <div style={{ position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)', background: '#f59e0b', color: 'white', padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', animation: 'slideDown 0.3s ease' }}>
            📡 {t.offlineMode}. {t.caseQueued}.
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#059669,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>❤️</div>
          <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: '-0.04em' }} className="gradient-text">HealthConnect</span>
        </div>

        {/* Step Progress Bar */}
        {step !== 'lang' && step !== 'waiting' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {(['register','body','symptoms','severity','review'] as Step[]).map((s, i) => {
              const steps: Step[] = ['register','body','symptoms','severity','review']
              const labels = ['Info','Body','Symptoms','Severity','Review']
              const cur = steps.indexOf(step)
              const done = i < cur; const active = i === cur
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: done ? '#10d98a' : active ? 'rgba(16,217,138,0.2)' : 'rgba(255,255,255,0.04)', border: `2px solid ${done || active ? '#10d98a' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: done ? '#050e1a' : '#10d98a', fontWeight: 900 }}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span style={{ fontSize: 7, color: active ? '#10d98a' : '#334155', fontWeight: active ? 800 : 500, letterSpacing: '0.04em' }}>{labels[i]}</span>
                  </div>
                  {i < 4 && <div style={{ width: 14, height: 1, background: done ? '#10d98a' : 'rgba(255,255,255,0.06)', marginBottom: 12 }} />}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* PWA Install Button */}
          {installPrompt && (
            <button
              onClick={async () => {
                installPrompt.prompt()
                const { outcome } = await installPrompt.userChoice
                if (outcome === 'accepted') setInstallPrompt(null)
              }}
              style={{ fontSize: 10, background: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', padding: '5px 12px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              📲 Install App
            </button>
          )}
          {mounted && !navigator.onLine && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, background: '#f59e0b', color: '#fff', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>{t.offlineMode}</span>
              <button
                onClick={() => {
                  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ type: 'SYNC_QUEUE' });
                    alert('Syncing queued cases...');
                  }
                }}
                style={{ fontSize: 10, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 12, cursor: 'pointer' }}
              >
                🔄 {t.syncQueue}
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/doctor" style={{ fontSize: 11, color: '#475569', fontWeight: 700, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '6px 12px', background: 'rgba(255,255,255,0.03)' }}>👨‍⚕️ Doctor</a>
            <a href="/hospital" style={{ fontSize: 11, color: '#475569', fontWeight: 700, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '6px 12px', background: 'rgba(255,255,255,0.03)' }}>🏥 Hospital</a>
            <a href="/admin" style={{ fontSize: 11, color: '#475569', fontWeight: 700, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '6px 12px', background: 'rgba(255,255,255,0.03)' }}>⚙️ Admin</a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: userLocation.lat === 12.9716 ? '#f59e0b' : '#10d98a', animation: 'ping 2s ease-out infinite' }} />
            <span style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.06em' }}>
              {userLocation.lat === 12.9716 ? 'GPS PENDING' : 'GPS LIVE'}
            </span>
          </div>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10d98a', animation: 'ping 2s ease-out infinite' }} />
            <span style={{ fontSize: 11, color: '#475569', fontWeight: 600, letterSpacing: '0.06em' }}>{t.encrypted}</span>
          </div>
          <button
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>
        </div>
      </nav>

      {/* MAIN content */}
      <main style={{ flex: 1, paddingTop: 80, paddingBottom: 100, maxWidth: 680, margin: '0 auto', width: '100%', padding: '80px 20px 100px' }}>

        {/* ── STEP: Language ── */}
        {step === 'lang' && (
          <div className="animate-up" style={{ textAlign: 'center', paddingTop: 40 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🏥</div>
            <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.04em', marginBottom: 8 }}>
              <span className="gradient-text">{t.getHelpNow}</span>
            </h1>
            <p style={{ color: '#64748b', fontSize: 16, marginBottom: 48 }}>
              {t.tellUsWrong}
            </p>

            <p style={{ fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
              {t.chooseLang}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 360, margin: '0 auto 40px' }}>
              {LANGUAGES.map(l => (
                <button
                  key={l.code}
                  className={`lang-btn ${lang === l.code ? 'active' : ''}`}
                  onClick={() => setLang(l.code)}
                  style={{ padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: 'none', background: 'none' }}
                >
                  <span style={{ fontSize: 24 }}>{l.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: lang === l.code ? '#10d98a' : '#94a3b8' }}>{l.label}</span>
                </button>
              ))}
            </div>

            <button 
              onClick={() => { setIconMode(!iconMode); alert(iconMode ? 'Text restored' : 'Icons-only mode enabled for simplified use') }}
              style={{ padding: '8px 20px', borderRadius: 12, background: iconMode ? 'rgba(16,217,138,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${iconMode ? '#10d98a' : 'rgba(255,255,255,0.1)'}`, color: iconMode ? '#10d98a' : '#64748b', fontSize: 11, fontWeight: 800, cursor: 'pointer', marginBottom: 24, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {iconMode ? '✅ Icons Mode Active' : '🖼️ Simplified (Icons Only)'}
            </button>

            <button className="btn-primary" onClick={() => setStep('register')} style={{ width: '100%', maxWidth: 320, padding: '18px 32px', borderRadius: 16, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '0 auto' }}>
              <span>🚀</span> {t.startSecure}
            </button>
            <p style={{ marginTop: 16, fontSize: 12, color: '#334155' }}>
              🔒 {t.privacyNote}
            </p>

            {/* Community Pulse Banner */}
            <div style={{ marginTop: 60, padding: '20px', background: 'rgba(59,130,246,0.03)', border: '1px solid rgba(59,130,246,0.1)', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 15, textAlign: 'left' }}>
              <div style={{ fontSize: 32 }}>📊</div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#3b82f6', marginBottom: 2 }}>COMMUNITY PULSE</p>
                <p style={{ fontSize: 12, color: '#64748b' }}>12 active doctors in your sector. Average help arrival time: 14 mins.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: Patient Registration ── */}
        {step === 'register' && (
          <PatientRegistration
            lang={lang}
            onComplete={(data) => {
              setPatient(data)
              setStep('body')
            }}
            onUploadPhoto={setPatientPhoto}
          />
        )}

        {/* ── STEP: Body Map ── */}
        {step === 'body' && (
          <div className="animate-up">
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
                {t.whereItHurts}
              </h2>
              <p style={{ color: '#64748b', fontSize: 15 }}>
                {t.tapBodyPart}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
              {/* Voice OR Tap options */}
              <div className="glass" style={{ width: '100%', borderRadius: 20, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
                <VoiceAssistant onSpeechAnalyzed={onSpeechAnalyzed} lang={lang} />
                <div style={{ width: 1, height: 60, background: 'rgba(255,255,255,0.07)' }} />
                <p style={{ fontSize: 13, color: '#475569', flex: 1 }}>
                  <strong style={{ color: '#94a3b8', display: 'block', marginBottom: 4 }}>{t.orSpeak}</strong>
                  {t.aiUnderstands}
                </p>
              </div>

              {/* 3D Model + 2D Map side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, width: '100%' }}>
                <Human3D selectedZones={selectedZones} onToggleZone={toggleZone} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                  <p style={{ fontSize: 12, color: '#475569', textAlign: 'center' }}>Or tap the 2D map</p>
                  <BodyMap selectedZones={selectedZones} onToggleZone={toggleZone} />
                </div>
              </div>
            </div>

            <button
              className="btn-primary"
              disabled={selectedZones.length === 0}
              onClick={() => setStep('symptoms')}
              style={{ width: '100%', padding: '18px', borderRadius: 16, fontSize: 16, marginTop: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {t.seeSymptoms} {selectedZones.join(', ') || '…'} →
            </button>
          </div>
        )}

        {/* ── STEP: Symptoms ── */}
        {step === 'symptoms' && (
          <div className="animate-up">
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                {selectedZones.map(z => (
                  <span key={z} style={{ background: 'rgba(16,217,138,0.12)', color: '#10d98a', border: '1px solid rgba(16,217,138,0.3)', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
                    {z}
                  </span>
                ))}
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
                {t.whatSymptoms}
              </h2>
              <p style={{ color: '#64748b', fontSize: 14 }}>{t.selectAll}</p>
            </div>

            {/* Symptom Search Bar */}
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <input
                type="text"
                value={symptomSearch}
                onChange={e => setSymptomSearch(e.target.value)}
                placeholder="🔍 Search symptoms…"
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 14,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#f1f5f9', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              {availableSymptoms
                .filter(s => s.label.toLowerCase().includes(symptomSearch.toLowerCase()))
                .map((s, i) => (
                <SymptomCard
                  key={s.id}
                  symptom={s}
                  isSelected={selectedSymptoms.includes(s.id)}
                  onToggle={() => toggleSymptom(s.id)}
                  delay={i * 0.06}
                />
              ))}
            </div>

            {/* AI Visual Analysis Feature */}
            <div style={{ marginBottom: 24, padding: '20px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#3b82f6' }}>📸 AI Visual Triage</h3>
                  <p style={{ fontSize: 11, color: '#64748b' }}>Analyze your symptoms using Gemini Vision</p>
                </div>
                <button 
                  onClick={analyzeImage}
                  disabled={analyzing || !patientPhoto}
                  style={{ padding: '10px 20px', borderRadius: 12, background: analyzing ? '#1e293b' : '#3b82f6', color: 'white', border: 'none', fontWeight: 800, fontSize: 12, cursor: 'pointer', opacity: !patientPhoto ? 0.5 : 1 }}
                >
                  {analyzing ? '⌛ Analyzing...' : '✨ Run AI Scan'}
                </button>
              </div>

              {aiAnalysis ? (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 16, animation: 'fadeIn 0.5s ease' }}>
                   <p style={{ fontSize: 13, fontWeight: 800, color: '#10d98a', marginBottom: 6 }}>{aiAnalysis.title}</p>
                   <p style={{ fontSize: 12, color: '#f1f5f9', lineHeight: 1.5, marginBottom: 8 }}>{aiAnalysis.observation}</p>
                   <div style={{ padding: '8px 12px', background: 'rgba(245,158,11,0.1)', borderLeft: '3px solid #f59e0b', fontSize: 11, color: '#f59e0b' }}>
                     <strong>TIP:</strong> {aiAnalysis.suggestion}
                   </div>
                </div>
              ) : !patientPhoto && (
                <p style={{ fontSize: 11, color: '#475569', fontStyle: 'italic', textAlign: 'center' }}>Go back to "Info" step to upload a photo for AI analysis.</p>
              )}
            </div>

            {loadingAdvice && (
              <div style={{ marginBottom: 24, padding: 20, background: 'rgba(16,217,138,0.03)', border: '1px solid rgba(16,217,138,0.1)', borderRadius: 16 }}>
                {[80, 60, 40].map((w, i) => (
                  <div key={i} style={{ height: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 10, width: `${w}%`, animation: 'pulse 1.5s ease-in-out infinite' }} />
                ))}
              </div>
            )}
            {triageResult && !loadingAdvice && (
              <div style={{ marginBottom: 24 }}>
                <TriageAssistant result={triageResult} loading={false} lang={lang} />
                <button
                  onClick={async () => {
                    const text = triageResult.advice || ''
                    // 1. Try Sarvam TTS (regional voice, primary)
                    try {
                      const res = await fetch(`${API_BASE_URL}/api/v3/sarvam/tts`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text, lang }),
                      })
                      if (res.ok) {
                        const data = await res.json()
                        if (data.audio_base64 && !data.fallback) {
                          const bytes = atob(data.audio_base64)
                          const buf = new Uint8Array(bytes.length)
                          for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i)
                          const blob = new Blob([buf], { type: 'audio/wav' })
                          const audio = new Audio(URL.createObjectURL(blob))
                          audio.play()
                          return
                        }
                      }
                    } catch { }
                    // 2. Fallback: Web Speech API with correct BCP-47 language code
                    const u = new SpeechSynthesisUtterance(text)
                    u.lang = BCP47[lang] || 'en-IN'
                    u.rate = 0.85
                    window.speechSynthesis.cancel()
                    window.speechSynthesis.speak(u)
                  }}
                  style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16,217,138,0.08)', border: '1px solid rgba(16,217,138,0.2)', color: '#10d98a', padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  🔊 {lang === 'kn' ? 'ಸಲಹೆ ಓದಿ' : lang === 'hi' ? 'सलाह पढ़ें' : lang === 'ta' ? 'அறிவுரை கேளுங்கள்' : 'Read Advice Aloud'}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setStep('body')} style={{ flex: '0 0 80px', padding: '16px', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                ← {t.back}
              </button>
              <button
                className="btn-primary"
                disabled={selectedSymptoms.length === 0}
                onClick={() => setStep('severity')}
                style={{ flex: 1, padding: '16px', borderRadius: 14, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {t.nextHowBad} →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: Severity + Duration ── */}
        {step === 'severity' && (
          <div className="animate-up">
            <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8, textAlign: 'center' }}>
              {t.howFeeling}
            </h2>
            <p style={{ color: '#64748b', fontSize: 14, textAlign: 'center', marginBottom: 28 }}>
              {t.tapFace}
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 36 }}>
              {SEVERITIES.map(s => (
                <div
                  key={s.id}
                  className={`sev-card ${s.className} ${severity === s.id ? 'active' : ''}`}
                  onClick={() => setSeverity(s.id)}
                  style={{ borderRadius: 20, padding: '24px 20px', textAlign: 'center', minWidth: 100, cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 48, marginBottom: 10 }}>{s.emoji}</div>
                  <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: severity === s.id ? (s.id === 'stable' ? '#10d98a' : s.id === 'moderate' ? '#f59e0b' : '#ef4444') : '#94a3b8' }}>{s.label}</p>
                  <p style={{ fontSize: 11, color: '#475569' }}>{s.sublabel}</p>
                </div>
              ))}
            </div>

            {/* Pain Level Slider */}
            <div style={{ marginBottom: 28, padding: '18px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>🩹 Pain Level</h3>
                <span style={{ fontSize: 22, fontWeight: 900, color: painLevel >= 7 ? '#ef4444' : painLevel >= 4 ? '#f59e0b' : '#10d98a' }}>{painLevel}<span style={{ fontSize: 13, color: '#475569' }}>/10</span></span>
              </div>
              <input type="range" min={0} max={10} value={painLevel} onChange={e => setPainLevel(Number(e.target.value))}
                style={{ width: '100%', accentColor: painLevel >= 7 ? '#ef4444' : painLevel >= 4 ? '#f59e0b' : '#10d98a', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginTop: 4 }}>
                <span>😌 No pain</span><span>😰 Moderate</span><span>😱 Unbearable</span>
              </div>
            </div>

            {/* Vitals Scanner */}
            <div style={{ marginBottom: 36, padding: '20px', background: 'rgba(16,217,138,0.03)', border: '1px dashed rgba(16,217,138,0.3)', borderRadius: 20, textAlign: 'center' }}>
              {isScanning ? (
                <div>
                  <div style={{ width: 60, height: 60, borderRadius: '50%', border: '3px solid #10d98a', borderTopColor: 'transparent', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
                  <p style={{ fontSize: 13, color: '#10d98a', fontWeight: 700 }}>Scanning Vitals via Camera rPPG...</p>
                </div>
              ) : vitals ? (
                <div style={{ display: 'flex', gap: 20, justifyContent: 'center', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 9, color: '#475569', fontWeight: 800 }}>PULSE</p>
                    <p style={{ fontSize: 24, fontWeight: 900, color: '#10d98a' }}>{vitals.pulse} <span style={{ fontSize: 12 }}>BPM</span></p>
                  </div>
                  <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.1)' }} />
                  <div>
                    <p style={{ fontSize: 9, color: '#475569', fontWeight: 800 }}>RESPIRATION</p>
                    <p style={{ fontSize: 24, fontWeight: 900, color: '#10d98a' }}>{vitals.resp} <span style={{ fontSize: 12 }}>/min</span></p>
                  </div>
                  <button onClick={scanVitals} style={{ marginLeft: 10, background: 'none', border: 'none', color: '#64748b', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>Re-scan</button>
                </div>
              ) : (
                <button onClick={scanVitals} style={{ background: 'rgba(16,217,138,0.1)', border: '1px solid rgba(16,217,138,0.3)', color: '#10d98a', padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, margin: '0 auto' }}>
                  <span>📸</span> Estimate Vitals via Camera
                </button>
              )}
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>{t.howLong}</h3>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 36 }}>
              {DURATIONS.map(d => (
                <div
                  key={d.id}
                  className={`dur-card ${duration === d.id ? 'active' : ''}`}
                  onClick={() => setDuration(d.id)}
                  style={{ borderRadius: 16, padding: '18px 16px', textAlign: 'center', flex: 1, maxWidth: 130, cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{d.icon}</div>
                  <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, color: duration === d.id ? '#10d98a' : '#94a3b8' }}>{d.label}</p>
                  <p style={{ fontSize: 11, color: '#475569' }}>{d.sublabel}</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setStep('symptoms')} style={{ flex: '0 0 80px', padding: '16px', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                ← {t.back}
              </button>
              <button
                className="btn-primary"
                disabled={!severity || !duration}
                onClick={() => setStep('review')}
                style={{ flex: 1, padding: '16px', borderRadius: 14, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {t.reviewSend} →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: Review ── */}
        {step === 'review' && (
          <div className="animate-up">
            <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 6 }}>
              {t.readyToSend}
            </h2>
            <p style={{ color: '#64748b', textAlign: 'center', marginBottom: 28, fontSize: 14 }}>
              {t.broadcastDoctors}
            </p>

            <div className="glass" style={{ borderRadius: 20, padding: 24, marginBottom: 20 }}>
              <p style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 16 }}>{t.medicalSummary}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                {selectedZones.map(z => (
                  <span key={z} style={{ background: 'rgba(16,217,138,0.1)', color: '#10d98a', border: '1px solid rgba(16,217,138,0.25)', borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 600 }}>📍 {z}</span>
                ))}
              </div>

              {vitals && (
                <div style={{ padding: '12px 16px', background: 'rgba(16,217,138,0.05)', borderRadius: 12, marginBottom: 20, display: 'flex', gap: 20 }}>
                  <div>
                    <p style={{ fontSize: 9, color: '#475569', fontWeight: 800 }}>HEART RATE</p>
                    <p style={{ fontSize: 16, fontWeight: 800 }}>{vitals.pulse} BPM</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 9, color: '#475569', fontWeight: 800 }}>RESPIRATION</p>
                    <p style={{ fontSize: 16, fontWeight: 800 }}>{vitals.resp}/min</p>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {selectedSymptoms.map(s => {
                  const sym = availableSymptoms.find(x => x.id === s)
                  return sym ? (
                    <span key={s} style={{ background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '4px 12px', fontSize: 13 }}>
                      {sym.icon} {sym.label}
                    </span>
                  ) : null
                })}
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>⏱ {DURATIONS.find(d => d.id === duration)?.label}</span>
                <span style={{ fontSize: 13, color: '#64748b' }}>
                  {SEVERITIES.find(s => s.id === severity)?.emoji} {SEVERITIES.find(s => s.id === severity)?.label}
                </span>
              </div>
            </div>

            {/* Privacy guarantee panel */}
            <div style={{ background: 'rgba(16,217,138,0.04)', border: '1px solid rgba(16,217,138,0.15)', borderRadius: 16, padding: '16px 20px', marginBottom: 24 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#10d98a', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>🔐 {t.privacyGuarantee}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  t.privacy1,
                  t.privacy2,
                  t.privacy3,
                ].map((text, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: '#10d98a', fontSize: 14 }}>✓</span>
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              className="btn-primary"
              onClick={() => { submitCase(true); setStep('waiting') }}
              style={{ width: '100%', padding: '20px', borderRadius: 16, fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
            >
              🚀 {t.sendHelpNow}
            </button>
          </div>
        )}

        {/* ── STEP: Waiting / Radar ── */}
        {step === 'waiting' && (
          <div className="animate-up" style={{ textAlign: 'center', paddingTop: 20 }}>

            {/* Doctor On The Way — Profile + Live Tracker + Countdown */}
            {doctorAccepted && (
              <div style={{ marginBottom: 28, animation: 'slideDown 0.4s ease' }}>
                <DoctorTracker
                  patientLat={userLocation.lat}
                  patientLng={userLocation.lng}
                  doctorLat={doctorLocation?.lat ?? null}
                  doctorLng={doctorLocation?.lng ?? null}
                  doctorProfile={doctorProfile}
                />
                
                {/* Real-time Secure Chat */}
                <SecureChat 
                  caseId={caseId} 
                  senderId="patient" 
                  ws={socket} 
                />

                {/* Countdown timer */}
                <div style={{ marginTop: 16, background: 'rgba(0,0,0,0.3)', borderRadius: 16, padding: '14px 20px', textAlign: 'center' }}>
                  <p style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Estimated Arrival</p>
                  <p style={{ fontSize: 38, fontWeight: 900, color: countdown <= 60 ? '#ef4444' : '#10d98a', fontFamily: 'monospace' }}>
                    {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}
                  </p>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${((600 - countdown) / 600) * 100}%`, background: countdown <= 60 ? 'linear-gradient(90deg,#ef4444,#f87171)' : 'linear-gradient(90deg,#10d98a,#34d399)', transition: 'width 1s linear', borderRadius: 2 }} />
                  </div>
                </div>

                {/* Received Prescription Display */}
                {receivedPrescription && (
                  <div style={{ marginTop: 16, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 20, padding: 20, textAlign: 'left', animation: 'slideDown 0.4s ease' }}>
                    <p style={{ fontSize: 10, color: '#3b82f6', fontWeight: 800, textTransform: 'uppercase', marginBottom: 12 }}>📋 DIGITAL PRESCRIPTION</p>
                    <p style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{receivedPrescription.diagnosis}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {receivedPrescription.medications?.map((m: any, i: number) => (
                        <div key={i} style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
                          <p style={{ fontSize: 13, fontWeight: 700 }}>{m.name}</p>
                          <p style={{ fontSize: 11, color: '#94a3b8' }}>{m.dosage} • {m.timing} • {m.duration}</p>
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}><b>Advice:</b> {receivedPrescription.advice}</p>
                    <button 
                      onClick={() => window.print()}
                      style={{ width: '100%', marginTop: 16, padding: '12px', borderRadius: 12, background: '#3b82f6', border: 'none', color: 'white', fontWeight: 800, cursor: 'pointer' }}
                    >
                      🖨️ Download/Print Prescription
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Radar animation */}
            {!doctorAccepted && (
              <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto 32px' }}>
                <svg viewBox="0 0 200 200" width="200" height="200">
                  {[80, 60, 40, 20].map(r => (
                    <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="rgba(16,217,138,0.2)" strokeWidth="1" />
                  ))}
                  <g className="radar-sweep">
                    <path d="M100,100 L100,20" stroke="#10d98a" strokeWidth="2" opacity="0.8" />
                    <path d="M100,100 L180,100" stroke="#10d98a" strokeWidth="1" opacity="0.3" strokeDasharray="4 3" />
                    <path d="M100,100 L100,180" stroke="#10d98a" strokeWidth="1" opacity="0.3" strokeDasharray="4 3" />
                    <path d="M100,100 L20,100" stroke="#10d98a" strokeWidth="1" opacity="0.3" strokeDasharray="4 3" />
                  </g>
                  <circle cx="100" cy="100" r="5" fill="#10d98a" />
                  <circle cx="140" cy="68" r="4" fill="#10d98a" opacity="0.9">
                    <animate attributeName="opacity" values="0.9;0.2;0.9" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="72" cy="130" r="3" fill="#f59e0b" opacity="0.7">
                    <animate attributeName="opacity" values="0.7;0.1;0.7" dur="2.5s" repeatCount="indefinite" />
                  </circle>
                </svg>
              </div>
            )}

            <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.04em', marginBottom: 10 }}>
              {doctorAccepted ? 'Help is confirmed!' : t.helpOnWay}
            </h2>
            {!doctorAccepted && (
              <div style={{ marginBottom: 32 }}>
                <p style={{ color: '#10d98a', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10d98a', animation: 'ping 1s infinite' }} />
                  Broadcasting SOS to nearby doctors...
                </p>
                <p style={{ color: '#64748b', fontSize: 15 }}>
                  {t.broadcastTo} {mounted ? (Math.floor(Math.random() * 5) + 3) : '…'} {t.hospitalsNearby}
                </p>
              </div>
            )}

            <div className="glass" style={{ borderRadius: 20, padding: 24, marginBottom: 20, textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.caseId}</span>
                <span style={{ fontFamily: 'monospace', color: '#10d98a', fontWeight: 700 }}>{caseId}</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min((elapsed / 600) * 100, 100)}%`, background: 'linear-gradient(90deg,#10d98a,#34d399)', transition: 'width 1s linear', borderRadius: 2 }} />
              </div>
              <p style={{ fontSize: 12, color: '#10d98a', fontWeight: 600 }}>
                {t.scanningHospitals} {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} elapsed
              </p>
            </div>

            <div style={{ background: 'rgba(16,217,138,0.05)', border: '1px solid rgba(16,217,138,0.15)', borderRadius: 16, padding: '16px 20px', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#10d98a' }}>💡 Health Tip</p>
                <div style={{ display: 'flex', gap: 4 }}>
                  {HEALTH_TIPS.map((_, i) => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i === tipIndex ? '#10d98a' : 'rgba(16,217,138,0.2)' }} />)}
                </div>
              </div>
              <p style={{ color: '#10d98a', fontSize: 13, fontWeight: 700, fontStyle: 'italic', lineHeight: 1.6, animation: 'slideDown 0.4s ease' }}>
                {HEALTH_TIPS[tipIndex]}
              </p>
              {triageResult?.advice && (
                <>
                  <div style={{ height: 1, background: 'rgba(16,217,138,0.1)', margin: '12px 0' }} />
                  <p style={{ fontSize: 11, color: '#475569', fontWeight: 700, marginBottom: 4 }}>🎙️ {t.whileYouWait}</p>
                  <p style={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic', lineHeight: 1.5 }}>{triageResult.advice}</p>
                </>
              )}
            </div>
          </div>
        )}

      </main>

      {/* Security Status Footer */}
      <footer style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(5,14,26,0.95)', backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(16,217,138,0.12)',
        padding: '8px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', gap: 16, fontSize: 10, color: '#334155', fontWeight: 600, letterSpacing: '0.04em', fontFamily: 'monospace' }}>
          <span>AES-256</span>
          <span>H3-L7</span>
          <span>RSA-4096</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10d98a', animation: 'ping 2s ease-out infinite' }} />
          <span style={{ fontSize: 10, color: '#10d98a', fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'monospace' }}>{t.secure}</span>
        </div>
      </footer>

      {/* 🆘 SOS Panic Button — always visible except on waiting screen */}
      {step !== 'waiting' && (
        <button
          onClick={triggerSOS}
          style={{
            position: 'fixed', bottom: 72, right: 20, zIndex: 60,
            width: 64, height: 64, borderRadius: '50%',
            background: sosActive ? '#991b1b' : 'linear-gradient(135deg,#ef4444,#dc2626)',
            border: '3px solid rgba(239,68,68,0.4)',
            color: 'white', fontSize: 11, fontWeight: 900,
            cursor: 'pointer', letterSpacing: '0.05em',
            boxShadow: '0 0 30px rgba(239,68,68,0.5)',
            animation: 'sosPulse 2s ease-in-out infinite',
          }}
        >
          🆘<br />{t.emergency}
        </button>
      )}

      {/* Language switcher floating (show after lang step) */}
      {step !== 'lang' && step !== 'waiting' && (
        <div style={{
          position: 'fixed', top: 70, right: 16, zIndex: 40,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); setGreeterVisible(true) }}
              style={{
                width: 36, height: 36, borderRadius: 8, border: 'none',
                background: lang === l.code ? 'rgba(16,217,138,0.2)' : 'rgba(8,20,45,0.9)',
                cursor: 'pointer', fontSize: 16,
                boxShadow: lang === l.code ? '0 0 8px rgba(16,217,138,0.3)' : 'none',
                transition: 'all 0.2s',
              }}
              title={l.label}
            >
              {l.emoji}
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes ping { 0% { transform: scale(1); opacity: 0.9; } 100% { transform: scale(2.2); opacity: 0; } }
        @keyframes sosPulse { 0%, 100% { box-shadow: 0 0 20px rgba(239,68,68,0.5); } 50% { box-shadow: 0 0 40px rgba(239,68,68,0.8), 0 0 80px rgba(239,68,68,0.3); } }
        @keyframes sosPulseAnim { 0% { background: rgba(239,68,68,0.2) } 50% { background: rgba(239,68,68,0.6) } 100% { background: rgba(239,68,68,0.2) } }
        @keyframes sosRingAnim { 0% { transform: scale(0.5); opacity: 1; } 100% { transform: scale(2); opacity: 0; } }
      `}</style>
    </div>
  )
}
