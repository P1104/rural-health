'use client'

import React, { useState, useRef } from 'react'
import { API_BASE_URL } from '@/config'

interface VoiceAssistantProps {
  lang?: string
  onSpeechAnalyzed: (data: { symptoms: string[]; zones: string[]; advice: string; transcript?: string }) => void
}

const BARS = [3, 6, 9, 7, 4, 8, 5, 3, 7, 5, 4, 6]

export default function VoiceAssistant({ lang = 'kn', onSpeechAnalyzed }: VoiceAssistantProps) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'analyzing'>('idle')
  const [transcript, setTranscript] = useState<string>('')
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const startRecording = async () => {
    setTranscript('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunks.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data) }
      mr.onstop = sendToSarvam
      mediaRecorder.current = mr
      mr.start()
      setStatus('recording')
    } catch {
      fallbackBrowserSTT()
    }
  }

  const stopRecording = () => {
    mediaRecorder.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    setStatus('analyzing')
  }

  const sendToSarvam = async () => {
    try {
      const blob = new Blob(chunks.current, { type: 'audio/webm' })
      const fd = new FormData()
      fd.append('audio', blob, 'recording.webm')
      fd.append('lang', lang)

      const res = await fetch(`${API_BASE_URL}/api/v3/sarvam/stt`, {
        method: 'POST',
        body: fd,
      })

      if (res.ok) {
        const data = await res.json()
        const text = data.transcript || ''
        setTranscript(text)
        extractSymptoms(text)
      } else {
        // Sarvam key not set — fallback to rule-based
        extractSymptoms('')
      }
    } catch {
      extractSymptoms('')
    }
  }

  const fallbackBrowserSTT = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { extractSymptoms(''); return }
    const r = new SR()
    const langMap: Record<string, string> = {
      kn: 'kn-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', bn: 'bn-IN', mr: 'mr-IN', en: 'en-IN'
    }
    r.lang = langMap[lang] || 'en-IN'
    r.onstart = () => setStatus('recording')
    r.onresult = (e: any) => {
      const t = e.results[0][0].transcript
      setTranscript(t)
      setStatus('analyzing')
      extractSymptoms(t)
    }
    r.onerror = () => { setStatus('idle'); extractSymptoms('') }
    r.start()
  }

  // Simple keyword extraction from transcript
  const extractSymptoms = (text: string) => {
    const lower = text.toLowerCase()
    const MAP: Record<string, string> = {
      'head': 'Head', 'headache': 'Head', 'fever': 'Head', 'dizzy': 'Head', 'vision': 'Head',
      'chest': 'Chest', 'breath': 'Chest', 'heart': 'Chest', 'cough': 'Chest',
      'stomach': 'Stomach', 'nausea': 'Stomach', 'vomit': 'Stomach', 'cramp': 'Stomach',
      'arm': 'Right Arm', 'hand': 'Right Arm',
      'leg': 'Right Leg', 'knee': 'Right Leg', 'walk': 'Right Leg',
    }
    const SYMP_MAP: Record<string, string[]> = {
      'headache': ['headache'], 'fever': ['fever'], 'dizzy': ['dizziness'],
      'breath': ['breathless'], 'chest': ['tightness'], 'vomit': ['vomit'],
      'cramp': ['cramps'], 'walk': ['noWalk'], 'nausea': ['nausea'],
    }
    const zones = new Set<string>()
    const symptoms: string[] = []
    Object.entries(MAP).forEach(([kw, zone]) => { if (lower.includes(kw)) zones.add(zone) })
    Object.entries(SYMP_MAP).forEach(([kw, syms]) => { if (lower.includes(kw)) symptoms.push(...syms) })

    setTimeout(() => {
      setStatus('idle')
      onSpeechAnalyzed({
        symptoms: symptoms.length > 0 ? symptoms : ['fever'],
        zones: zones.size > 0 ? Array.from(zones) : ['Head'],
        advice: 'AI is analyzing your symptoms. Please also tap the body map to confirm.',
        transcript: text,
      })
    }, 500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* Mic button */}
      <button
        onClick={status === 'recording' ? stopRecording : startRecording}
        disabled={status === 'analyzing'}
        style={{
          width: 68, height: 68, borderRadius: '50%', border: 'none',
          background: status === 'recording'
            ? 'linear-gradient(135deg,#ef4444,#dc2626)'
            : 'linear-gradient(135deg,#059669,#10b981)',
          cursor: status === 'analyzing' ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, flexShrink: 0,
          boxShadow: status === 'recording'
            ? '0 0 25px rgba(239,68,68,0.5), 0 0 50px rgba(239,68,68,0.2)'
            : '0 0 20px rgba(16,217,138,0.35)',
          transition: 'all 0.3s ease',
          opacity: status === 'analyzing' ? 0.5 : 1,
          animation: status === 'recording' ? 'recPulse 1s ease-in-out infinite' : 'none',
        }}
      >
        {status === 'analyzing'
          ? <div style={{ width: 22, height: 22, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          : status === 'recording' ? '⏹' : '🎙️'}
      </button>

      {/* Waveform */}
      {status === 'recording' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 28 }}>
          {BARS.map((h, i) => (
            <div key={i} style={{ width: 3, borderRadius: 2, background: '#10d98a', height: `${h * 2.5}px`, animation: `wave 0.6s ease-in-out ${i * 0.05}s infinite alternate` }} />
          ))}
        </div>
      )}

      <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>
        {status === 'idle' ? `${lang === 'kn' ? 'ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ' : lang === 'hi' ? 'हिंदी में बोलें' : lang === 'ta' ? 'தமிழில் பேசுங்கள்' : 'Speak in your language'}` : status === 'recording' ? 'Listening…' : 'Sarvam AI Processing…'}
      </div>

      {transcript && (
        <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', textAlign: 'center', maxWidth: 160, lineHeight: 1.4, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 10px' }}>
          &ldquo;{transcript.slice(0, 60)}{transcript.length > 60 ? '…' : ''}&rdquo;
        </div>
      )}

      <div style={{ fontSize: 9, color: '#1e3a5f', textAlign: 'center' }}>
        ⚡ Powered by Sarvam AI
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes wave { from { transform: scaleY(0.4); } to { transform: scaleY(1.2); } }
        @keyframes recPulse { 0%,100% { box-shadow: 0 0 20px rgba(239,68,68,0.5); } 50% { box-shadow: 0 0 40px rgba(239,68,68,0.8); } }
      `}</style>
    </div>
  )
}
