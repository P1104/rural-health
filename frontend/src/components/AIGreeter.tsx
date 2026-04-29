'use client'

import React, { useEffect, useState, useRef } from 'react'
import { API_BASE_URL } from '@/config'

interface Greeting {
  lang: string
  script: string
  english: string
  ttsText: string
  sarvamSpeaker: string
}

const GREETINGS: Record<string, Greeting> = {
  kn: {
    lang: 'ಕನ್ನಡ',
    script: 'ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ಆರೋಗ್ಯ ಸಹಾಯಕ. ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?',
    english: 'Hi! I am your health assistant. How can I help you?',
    ttsText: 'ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ಆರೋಗ್ಯ ಸಹಾಯಕ. ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?',
    sarvamSpeaker: 'vidya',
  },
  hi: {
    lang: 'हिंदी',
    script: 'नमस्ते! मैं आपका स्वास्थ्य सहायक हूँ। मैं आपकी क्या मदद कर सकता हूँ?',
    english: 'Hi! I am your health assistant. How can I help you?',
    ttsText: 'नमस्ते! मैं आपका स्वास्थ्य सहायक हूँ। मैं आपकी क्या मदद कर सकता हूँ?',
    sarvamSpeaker: 'manisha',
  },
  ta: {
    lang: 'தமிழ்',
    script: 'வணக்கம்! நான் உங்கள் உடல்நல உதவியாளர். நான் உங்களுக்கு எப்படி உதவ முடியும்?',
    english: 'Hi! I am your health assistant. How can I help you?',
    ttsText: 'வணக்கம்! நான் உங்கள் உடல்நல உதவியாளர். நான் உங்களுக்கு எப்படி உதவ முடியும்?',
    sarvamSpeaker: 'anushka',
  },
  te: {
    lang: 'తెలుగు',
    script: 'నమస్కారం! నేను మీ ఆరోగ్య సహాయకుడిని. నేను మీకు ఎలా సహాయం చేయగలను?',
    english: 'Hi! I am your health assistant. How can I help you?',
    ttsText: 'నమస్కారం! నేను మీ ఆరోగ్య సహాయకుడిని. నేను మీకు ఎలా సహాయం చేయగలను?',
    sarvamSpeaker: 'abhilash',
  },
  bn: {
    lang: 'বাংলা',
    script: 'নমস্কার! আমি আপনার স্বাস্থ্য সহকারী। আমি আপনাকে কীভাবে সাহায্য করতে পারি?',
    english: 'Hi! I am your health assistant. How can I help you?',
    ttsText: 'নমস্কার! আমি আপনার স্বাস্থ্য সহকারী। আমি আপনাকে কীভাবে সাহায্য করতে পারি?',
    sarvamSpeaker: 'arya',
  },
  en: {
    lang: 'English',
    script: 'Hi! I am your health assistant. How can I help you?',
    english: 'Hi! I am your health assistant. How can I help you?',
    ttsText: 'Hi! I am your health assistant. How can I help you today?',
    sarvamSpeaker: 'hitesh',
  },
}

interface AIGreeterProps {
  lang: string
  onDismiss: () => void
  onVoiceReply?: (transcript: string) => void  // Called when user speaks back
}

const LANG_CODES: Record<string, string> = {
  kn: 'kn-IN', hi: 'hi-IN', ta: 'ta-IN',
  te: 'te-IN', bn: 'bn-IN', mr: 'mr-IN', en: 'en-IN'
}

const REPLY_HINT: Record<string, string> = {
  kn: 'ನಿಮ್ಮ ಸಮಸ್ಯೆ ಹೇಳಿ…',
  hi: 'अपनी समस्या बताएं…',
  ta: 'உங்கள் பிரச்சனை சொல்லுங்கள்…',
  te: 'మీ సమస్య చెప్పండి…',
  bn: 'আপনার সমস্যা বলুন…',
  en: 'Describe your problem…',
}

export default function AIGreeter({ lang, onDismiss, onVoiceReply }: AIGreeterProps) {
  const [visible, setVisible] = useState(true)
  const [minimized, setMinimized] = useState(false)
  const [displayedText, setDisplayedText] = useState('')
  const [charIdx, setCharIdx] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  const [listeningReply, setListeningReply] = useState(false)
  const [replyTranscript, setReplyTranscript] = useState('')
  const [audioReady, setAudioReady] = useState(false)
  const replyRecRef = useRef<any>(null)

  const greeting = GREETINGS[lang] || GREETINGS['en']
  const hasSpoken = useRef(false)
  const lastLang = useRef(lang)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Reset when language changes
  useEffect(() => {
    if (lastLang.current !== lang) {
      setDisplayedText('')
      setCharIdx(0)
      hasSpoken.current = false
      setSpeaking(false)
      setAudioReady(false)
      audioRef.current?.pause()
      lastLang.current = lang
    }
  }, [lang])

  // Typewriter + trigger voice fetch at first character
  useEffect(() => {
    const fullText = greeting.script

    if (charIdx === 0 && !hasSpoken.current && fullText.length > 0) {
      hasSpoken.current = true
      fetchSarvamAudio()
    }

    if (charIdx < fullText.length) {
      const t = setTimeout(() => {
        setDisplayedText(prev => prev + fullText[charIdx])
        setCharIdx(c => c + 1)
      }, 40)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charIdx, greeting.script, lang])

  // Fetch Sarvam audio and try to autoplay; if blocked, show "Tap to hear"
  const fetchSarvamAudio = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v3/sarvam/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: greeting.ttsText,
          lang,
          speaker: greeting.sarvamSpeaker,
        }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (!data.audio_base64 || data.fallback) return

      const byteStr = atob(data.audio_base64)
      const buf = new Uint8Array(byteStr.length)
      for (let i = 0; i < byteStr.length; i++) buf[i] = byteStr.charCodeAt(i)
      const blob = new Blob([buf], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url) }
      audio.onerror = () => { setSpeaking(false); setAudioReady(false) }

      try {
        // Try autoplay first
        await audio.play()
        setSpeaking(true)
        setAudioReady(false)
      } catch {
        // Autoplay blocked by browser — surface a "Tap to hear" button
        setAudioReady(true)
        setSpeaking(false)
      }
    } catch (err) {
      console.error('Sarvam TTS error:', err)
    }
  }

  // User taps the bot icon or "Tap to hear" button — this IS a user gesture, play works
  const playOnTap = () => {
    if (!audioRef.current) return
    setSpeaking(true)
    setAudioReady(false)
    audioRef.current.play().catch(() => setSpeaking(false))
  }

  // Voice Reply — user speaks back to the bot after greeting
  const startReplyMic = () => {
    if (listeningReply) {
      replyRecRef.current?.abort()
      setListeningReply(false)
      setReplyTranscript('')
      return
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Speech recognition not supported. Use Chrome.'); return }
    const r = new SR()
    replyRecRef.current = r
    r.lang = LANG_CODES[lang] || 'en-IN'
    r.continuous = false
    r.interimResults = true
    r.onstart = () => setListeningReply(true)
    r.onresult = (e: any) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      setReplyTranscript(text)
      if (e.results[e.results.length - 1].isFinal) {
        onVoiceReply?.(text)
      }
    }
    r.onend = () => { setListeningReply(false) }
    r.onerror = () => { setListeningReply(false) }
    r.start()
  }

  if (!visible) return null

  if (minimized) {
    return (
      <button
        id="health-bot-minimized"
        onClick={() => setMinimized(false)}
        style={{
          position: 'fixed', bottom: 24, left: 24, zIndex: 100,
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg,#10b981,#059669)',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, boxShadow: '0 8px 24px rgba(16,217,138,0.4)',
          animation: 'botBounce 2s infinite',
        }}
      >
        🤖
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: 24,
      width: 'calc(100% - 48px)', maxWidth: 360,
      zIndex: 100,
      background: 'rgba(8,20,45,0.98)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(16,217,138,0.3)',
      borderRadius: 24,
      padding: '16px 20px',
      boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
      animation: 'slideUp 0.5s cubic-bezier(0.2,0,0,1)',
    }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>

        {/* Bot Icon — tappable to play audio if autoplay was blocked */}
        <div
          role="button"
          aria-label="Play greeting"
          onClick={audioReady ? playOnTap : undefined}
          style={{ position: 'relative', flexShrink: 0, cursor: audioReady ? 'pointer' : 'default' }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: speaking
              ? 'linear-gradient(135deg,#7c3aed,#a78bfa)'
              : audioReady
                ? 'linear-gradient(135deg,#f59e0b,#d97706)'
                : 'linear-gradient(135deg,#059669,#10b981)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            boxShadow: speaking
              ? '0 0 20px rgba(124,58,237,0.4)'
              : audioReady
                ? '0 0 20px rgba(245,158,11,0.5)'
                : '0 0 15px rgba(16,217,138,0.3)',
            transition: 'all 0.3s ease',
          }}>
            {speaking ? '🔊' : audioReady ? '▶️' : '🤖'}
          </div>
          {speaking && (
            <div style={{
              position: 'absolute', inset: -3, borderRadius: '50%',
              border: '2px solid rgba(124,58,237,0.5)',
              animation: 'ring 1.2s ease-out infinite',
            }} />
          )}
          {audioReady && (
            <div style={{
              position: 'absolute', inset: -3, borderRadius: '50%',
              border: '2px solid rgba(245,158,11,0.6)',
              animation: 'ring 1.2s ease-out infinite',
            }} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#10d98a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Health Bot
            </span>
            <span style={{
              fontSize: 9,
              background: 'rgba(16,217,138,0.1)', color: '#10d98a',
              border: '1px solid rgba(16,217,138,0.25)', borderRadius: 6, padding: '0 5px',
            }}>
              {greeting.lang}
            </span>
          </div>

          <p style={{ fontSize: 14, color: '#f1f5f9', lineHeight: 1.5, fontWeight: 500, margin: 0 }}>
            {displayedText}
            <span style={{ animation: 'blink 0.8s step-end infinite', color: '#10d98a' }}>|</span>
          </p>

          {/* Tap to hear button — shown only when autoplay is blocked */}
          {audioReady && (
            <button
              id="tap-to-hear-btn"
              onClick={playOnTap}
              style={{
                marginTop: 10,
                background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                border: 'none', borderRadius: 12, padding: '6px 14px',
                color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              ▶ Tap to hear
            </button>
          )}

          {/* ── VOICE REPLY MIC ── */}
          {onVoiceReply && (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={startReplyMic}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: listeningReply ? 'rgba(239,68,68,0.15)' : 'rgba(16,217,138,0.1)',
                  border: `1px solid ${listeningReply ? 'rgba(239,68,68,0.4)' : 'rgba(16,217,138,0.3)'}`,
                  borderRadius: 12, padding: '8px 14px', cursor: 'pointer',
                  color: listeningReply ? '#ef4444' : '#10d98a', fontSize: 12, fontWeight: 700,
                  animation: listeningReply ? 'micRing 0.8s ease-in-out infinite alternate' : 'none',
                }}
              >
                <span style={{ fontSize: 16 }}>{listeningReply ? '⏹' : '🎙️'}</span>
                {listeningReply
                  ? (lang === 'kn' ? 'ನಿಲ್ಲಿಸಿ…' : lang === 'hi' ? 'रोकें…' : 'Listening…')
                  : (lang === 'kn' ? 'ಉತ್ತರಿಸಿ' : lang === 'hi' ? 'जवाब दें' : 'Reply by Voice')}
              </button>
              {replyTranscript && (
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6, fontStyle: 'italic' }}>
                  "{replyTranscript}"
                </p>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: audioReady ? 6 : 12 }}>
            <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{greeting.english}</p>
            <button
              onClick={() => setMinimized(true)}
              style={{
                background: 'rgba(255,255,255,0.05)', border: 'none',
                color: '#94a3b8', fontSize: 10, padding: '4px 8px', borderRadius: 8, cursor: 'pointer',
              }}
            >
              Minimize
            </button>
          </div>
        </div>

        <button
          onClick={() => { setVisible(false); audioRef.current?.pause(); onDismiss() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 18, padding: 0 }}
        >
          ×
        </button>
      </div>

      <style>{`
        @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes ring { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes botBounce { 0%,20%,50%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-10px); } 60% { transform: translateY(-5px); } }
        @keyframes micRing { from { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } to { box-shadow: 0 0 0 10px rgba(239,68,68,0); } }
      `}</style>
    </div>
  )
}
