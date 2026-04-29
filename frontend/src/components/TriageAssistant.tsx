'use client'

import React, { useState } from 'react'
import { API_BASE_URL } from '@/config'

interface TriageResult {
  advice: string
  urgency_score?: number
  possible_conditions?: string[]
  do_nots?: string[]
  call_now?: boolean
}

interface TriageAssistantProps {
  result: TriageResult | null
  loading: boolean
  lang?: string
}

export default function TriageAssistant({ result, loading, lang = 'kn' }: TriageAssistantProps) {
  const [speaking, setSpeaking] = useState(false)
  const [ttsLoading, setTtsLoading] = useState(false)

  const speak = async () => {
    if (!result?.advice) return
    setTtsLoading(true)

    try {
      // Try Sarvam TTS first
      const res = await fetch(`${API_BASE_URL}/api/v3/sarvam/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: result.advice, lang, speaker: 'meera' }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.audio_base64 && !data.fallback) {
          // Play Sarvam audio
          const audioBytes = atob(data.audio_base64)
          const audioArray = new Uint8Array(audioBytes.length)
          for (let i = 0; i < audioBytes.length; i++) audioArray[i] = audioBytes.charCodeAt(i)
          const blob = new Blob([audioArray], { type: 'audio/wav' })
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          setSpeaking(true)
          setTtsLoading(false)
          audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url) }
          await audio.play()
          return
        }
      }
    } catch {}

    // Fallback to browser TTS
    setTtsLoading(false)
    if (typeof window === 'undefined') return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(result.advice)
    u.rate = 0.88
    u.pitch = 1
    u.onstart = () => setSpeaking(true)
    u.onend = () => setSpeaking(false)
    window.speechSynthesis.speak(u)
  }

  const urgency = result?.urgency_score || 0
  const urgencyColor = urgency >= 80 ? '#ef4444' : urgency >= 50 ? '#f59e0b' : '#10d98a'

  if (!result && !loading) return null

  return (
    <div style={{ background: 'rgba(8,20,45,0.9)', border: '1px solid rgba(16,217,138,0.2)', borderLeft: '4px solid #10d98a', borderRadius: 20, padding: '20px 22px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(16,217,138,0.12)', border: '2px solid rgba(16,217,138,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, animation: speaking ? 'docPulse 0.5s ease-in-out infinite alternate' : 'none' }}>
          👨‍⚕️
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: '#10d98a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
            MedBot AI Triage Advisor
          </p>
          <p style={{ fontSize: 9, color: '#334155', fontFamily: 'monospace' }}>⚡ Meditron (Local) + Sarvam AI</p>
        </div>
        {result && (
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 9, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Urgency</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: urgencyColor }}>{urgency}<span style={{ fontSize: 10 }}>/100</span></p>
          </div>
        )}
      </div>

      {/* Loading dots */}
      {loading && (
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '8px 0' }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#10d98a', animation: `bounce 0.8s ease-in-out ${i*0.2}s infinite alternate` }} />
          ))}
          <span style={{ fontSize: 11, color: '#475569', marginLeft: 6 }}>Gemini is analyzing symptoms…</span>
        </div>
      )}

      {/* Advice */}
      {result && !loading && (
        <>
          {/* Emergency banner */}
          {result.call_now && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span>🚨</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#ef4444' }}>EMERGENCY — Call for help immediately!</span>
            </div>
          )}

          <p style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.65, marginBottom: 14, fontStyle: 'italic' }}>"{result.advice}"</p>

          {/* Possible conditions */}
          {result.possible_conditions && result.possible_conditions.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>May be related to</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {result.possible_conditions.map(c => (
                  <span key={c} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '3px 10px', fontSize: 11, color: '#94a3b8' }}>{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Do NOTs */}
          {result.do_nots && result.do_nots.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>⚠️ Do NOT</p>
              {result.do_nots.map(d => (
                <div key={d} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: '#ef4444', fontSize: 12 }}>✗</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{d}</span>
                </div>
              ))}
            </div>
          )}

          {/* TTS button */}
          <button onClick={speak} disabled={speaking || ttsLoading} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(16,217,138,0.08)', border: '1px solid rgba(16,217,138,0.2)', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', color: speaking ? '#10d98a' : '#475569', fontSize: 12, fontWeight: 700, transition: 'all 0.2s' }}>
            <span style={{ fontSize: 16 }}>{ttsLoading ? '⏳' : speaking ? '🔊' : '🔈'}</span>
            {ttsLoading ? 'Loading Sarvam TTS…' : speaking ? `Speaking in ${lang === 'kn' ? 'ಕನ್ನಡ' : lang === 'hi' ? 'हिंदी' : 'your language'}…` : 'Read aloud (Sarvam AI)'}
          </button>
        </>
      )}

      <style>{`
        @keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-6px); } }
        @keyframes docPulse { from { box-shadow: 0 0 0 0 rgba(16,217,138,0.4); } to { box-shadow: 0 0 0 10px rgba(16,217,138,0); } }
      `}</style>
    </div>
  )
}
