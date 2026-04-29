'use client'

import React, { useState, useRef, useEffect } from 'react'
import { TRANSLATIONS } from '@/data/translations'

interface PatientRegistrationProps {
  onComplete: (data: { name: string; age: string; phone: string }) => void
  onUploadPhoto: (base64: string) => void
  lang: string
}

// BCP-47 codes for Web Speech API
const LANG_CODES: Record<string, string> = {
  kn: 'kn-IN', hi: 'hi-IN', ta: 'ta-IN',
  te: 'te-IN', bn: 'bn-IN', mr: 'mr-IN', en: 'en-IN'
}

// Instructions shown while mic is open (in regional language)
const MIC_HINTS: Record<string, string> = {
  kn: 'ನಿಮ್ಮ ಹೆಸರು, ವಯಸ್ಸು ಮತ್ತು ಫೋನ್ ನಂಬರ್ ಹೇಳಿ…',
  hi: 'अपना नाम, उम्र और फ़ोन नंबर बोलें…',
  ta: 'உங்கள் பெயர், வயது மற்றும் தொலைபேசி எண் சொல்லுங்கள்…',
  te: 'మీ పేరు, వయస్సు మరియు ఫోన్ నంబర్ చెప్పండి…',
  bn: 'আপনার নাম, বয়স এবং ফোন নম্বর বলুন…',
  mr: 'तुमचं नाव, वय आणि फोन नंबर सांगा…',
  en: 'Say your name, age and phone number…',
}

export default function PatientRegistration({ onComplete, onUploadPhoto, lang }: PatientRegistrationProps) {
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [phone, setPhone] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  // STT state
  const [listening, setListening] = useState<string | null>(null)  // 'name'|'age'|'phone'|'all'
  const [interim, setInterim] = useState('')   // live transcript shown while user speaks
  const [sttError, setSttError] = useState('')
  const [convMode, setConvMode] = useState(false)  // show conversational mode banner

  const recognitionRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const t = TRANSLATIONS[lang] || TRANSLATIONS['en']
  const bcp47 = LANG_CODES[lang] || 'en-IN'
  const micHint = MIC_HINTS[lang] || MIC_HINTS['en']

  // Cleanup on unmount
  useEffect(() => () => { recognitionRef.current?.abort() }, [])

  /** Parse a free-form sentence into name/age/phone */
  const parseSentence = (text: string) => {
    // Extract 10-digit phone
    const phoneMatch = text.match(/\b(\d{10})\b/)
    const foundPhone = phoneMatch?.[1] || ''

    // Extract age: patterns like "45 years", "age 45", standalone 2-digit number
    const ageMatch = text.match(/(?:age|aged|वर्ष|ವರ್ಷ|years?|sal|ఏళ్ళు|வயது|বছর)\s*(\d{1,3})/i)
      || text.match(/(\d{1,3})\s*(?:year|years|वर्ष|ವರ್ಷ|sal|ఏళ్ళు|வயது|বছর)/i)
      || text.match(/\b(\d{2,3})\b/)
    const foundAge = ageMatch?.[1] || ''

    // Remove phone & age numbers from text to get name
    let nameText = text
      .replace(foundPhone, '')
      .replace(new RegExp(foundAge, 'g'), '')
      .replace(/\b(my name is|i am|i'm|mera naam|nanna hesaru|en peyar|naa peru|naam|name|age|phone|number|mobile)\b/gi, '')
      .replace(/[0-9]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    return { name: nameText, age: foundAge, phone: foundPhone }
  }

  const stopListening = () => {
    recognitionRef.current?.abort()
    recognitionRef.current = null
    setListening(null)
    setInterim('')
  }

  /** Start STT for a specific field OR for "all" (conversational mode) */
  const startVoice = (field: 'name' | 'age' | 'phone' | 'all') => {
    setSttError('')
    if (typeof window === 'undefined') return

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setSttError('Speech recognition not supported in this browser. Please use Chrome.')
      return
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort()
    }

    const r = new SR()
    recognitionRef.current = r
    r.lang = bcp47
    r.continuous = field === 'all'   // continuous for conversational mode
    r.interimResults = true          // show live transcript

    r.onstart = () => {
      setListening(field)
      setInterim('')
      if (field === 'all') setConvMode(true)
    }

    r.onresult = (e: any) => {
      let finalText = ''
      let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += t + ' '
        else interimText += t
      }
      setInterim(interimText || finalText)

      if (finalText.trim()) {
        if (field === 'all') {
          const parsed = parseSentence(finalText)
          if (parsed.name)  setName(n => n || parsed.name)
          if (parsed.age)   setAge(a => a || parsed.age)
          if (parsed.phone) setPhone(p => p || parsed.phone)
        } else {
          const val = finalText.trim()
          if (field === 'name')  setName(val)
          else if (field === 'age')   setAge(val.replace(/\D/g, '').slice(0, 3))
          else if (field === 'phone') setPhone(val.replace(/\D/g, '').slice(0, 10))
        }
      }
    }

    r.onerror = (e: any) => {
      if (e.error !== 'aborted') setSttError(`Mic error: ${e.error}. Make sure mic permission is allowed.`)
      stopListening()
    }

    r.onend = () => {
      setListening(null)
      setInterim('')
      if (field === 'all') setConvMode(false)
    }

    try { r.start() } catch { setSttError('Could not start microphone.') }
  }

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      const b64 = reader.result as string
      setPhotoPreview(b64)
      onUploadPhoto(b64)
    }
    reader.readAsDataURL(file)
  }

  const isValid = name.trim().length > 1 && age.length > 0 && phone.length === 10

  const INPUT: React.CSSProperties = {
    flex: 1, padding: '14px 16px', borderRadius: 12,
    background: 'rgba(8,20,45,0.85)', border: '1px solid rgba(255,255,255,0.08)',
    color: '#f1f5f9', fontSize: 16, fontFamily: 'Inter,sans-serif',
    outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
  }

  const fields = [
    { field: 'name'  as const, label: t.regName,  value: name,  set: setName,  type: 'text',   icon: '👤', hint: 'e.g. Sunita Rao'    },
    { field: 'age'   as const, label: t.regAge,   value: age,   set: setAge,   type: 'number', icon: '🎂', hint: 'e.g. 45'             },
    { field: 'phone' as const, label: t.regPhone, value: phone, set: setPhone, type: 'tel',    icon: '📞', hint: '10-digit number'     },
  ]

  return (
    <div className="animate-up" style={{ maxWidth: 480, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
        <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
          {t.regTitle}
        </h2>
        <p style={{ color: '#64748b', fontSize: 14 }}>{t.regSub}</p>
      </div>

      {/* ── ONE-SHOT CONVERSATIONAL MIC ── */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => listening === 'all' ? stopListening() : startVoice('all')}
          style={{
            width: '100%', padding: '18px', borderRadius: 18, fontWeight: 800, fontSize: 15,
            background: listening === 'all'
              ? 'linear-gradient(135deg,#dc2626,#ef4444)'
              : 'linear-gradient(135deg,#059669,#10b981)',
            border: 'none', color: 'white', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            boxShadow: listening === 'all'
              ? '0 0 30px rgba(239,68,68,0.5)'
              : '0 4px 24px rgba(16,217,138,0.35)',
            animation: listening === 'all' ? 'micPulse 0.8s ease-in-out infinite alternate' : 'none',
            transition: 'all 0.3s',
          }}
        >
          <span style={{ fontSize: 24 }}>{listening === 'all' ? '⏹' : '🎙️'}</span>
          {listening === 'all'
            ? (lang === 'kn' ? 'ನಿಲ್ಲಿಸಿ' : lang === 'hi' ? 'रोकें' : 'Tap to Stop')
            : (lang === 'kn' ? 'ಮಾತನಾಡಿ' : lang === 'hi' ? 'बोलें' : 'Speak Everything at Once')}
        </button>

        {/* Live interim transcript display */}
        {(listening === 'all' || convMode) && (
          <div style={{
            marginTop: 10, padding: '14px 16px', background: 'rgba(16,217,138,0.06)',
            border: '1px solid rgba(16,217,138,0.2)', borderRadius: 14,
          }}>
            <p style={{ fontSize: 10, color: '#10d98a', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              🎙️ Listening… ({bcp47})
            </p>
            <p style={{ fontSize: 14, color: '#f1f5f9', minHeight: 20, fontStyle: interim ? 'normal' : 'italic' }}>
              {interim || micHint}
            </p>
          </div>
        )}

        <p style={{ fontSize: 11, color: '#475569', textAlign: 'center', marginTop: 8 }}>
          {lang === 'kn'
            ? '— ಅಥವಾ ಕೆಳಗಿನ ಪ್ರತಿ ಕ್ಷೇತ್ರದ ಮೈಕ್ ಅನ್ನು ಬಳಸಿ —'
            : '— or use the mic on each field below —'}
        </p>
      </div>

      {/* ── INDIVIDUAL FIELD INPUTS WITH MICS ── */}
      {fields.map(f => {
        const isActive = listening === f.field
        return (
          <div key={f.field} style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>
              {f.icon} {f.label}
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type={f.type}
                value={f.value}
                onChange={e => f.set(e.target.value)}
                placeholder={f.hint}
                style={INPUT}
                onFocus={e => { e.target.style.borderColor = '#10d98a' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)' }}
              />
              <button
                onClick={() => isActive ? stopListening() : startVoice(f.field)}
                title={isActive ? 'Stop' : `Speak your ${f.field}`}
                style={{
                  width: 50, borderRadius: 12, flexShrink: 0, fontSize: 20, cursor: 'pointer',
                  border: isActive ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(16,217,138,0.25)',
                  background: isActive ? 'rgba(239,68,68,0.2)' : 'rgba(16,217,138,0.12)',
                  animation: isActive ? 'micPulse 0.6s ease-in-out infinite alternate' : 'none',
                }}
              >
                {isActive ? '⏹' : '🎙️'}
              </button>
            </div>
            {/* Show interim text for individual field too */}
            {isActive && interim && (
              <p style={{ fontSize: 12, color: '#10d98a', marginTop: 4, fontStyle: 'italic' }}>
                🎙️ {interim}
              </p>
            )}
          </div>
        )
      })}

      {/* STT error banner */}
      {sttError && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: '#ef4444' }}>⚠️ {sttError}</p>
        </div>
      )}

      {/* ── PHOTO UPLOAD ── */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 12 }}>
          📸 {lang === 'kn' ? 'ರೋಗಿಯ ಫೋಟೋ (ಗಾಯ/ಸ್ಥಿತಿ)' : lang === 'hi' ? 'मरीज़ की फ़ोटो (घाव/स्थिति)' : 'Patient Photo (Wound/Condition)'}
        </label>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{ width: 80, height: 80, borderRadius: 16, background: 'rgba(8,20,45,0.85)', border: '2px dashed rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}
          >
            {photoPreview
              ? <img src={photoPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="preview" />
              : <span style={{ fontSize: 24 }}>➕</span>}
            <input type="file" ref={fileInputRef} onChange={handlePhoto} accept="image/*" capture="environment" style={{ display: 'none' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, color: photoPreview ? '#10d98a' : '#64748b', fontWeight: 600 }}>
              {photoPreview ? '✅ Photo captured' : 'Tap to take a photo of the affected area'}
            </p>
            <p style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
              {lang === 'kn' ? 'ಇದು ವೈದ್ಯರಿಗೆ ತ್ವರಿತ ಗ್ರಹಣಕ್ಕೆ ಸಹಾಯ ಮಾಡುತ್ತದೆ.' : 'This helps doctors triage faster.'}
            </p>
          </div>
        </div>
      </div>

      {/* Privacy note */}
      <div style={{ marginTop: 8, padding: '12px 16px', background: 'rgba(16,217,138,0.04)', border: '1px solid rgba(16,217,138,0.12)', borderRadius: 12, marginBottom: 24 }}>
        <p style={{ fontSize: 12, color: '#475569' }}>🔒 {t.privacyNote}</p>
      </div>

      <button
        disabled={!isValid}
        onClick={() => onComplete({ name, age, phone })}
        className="btn-primary"
        style={{ width: '100%', padding: '18px', borderRadius: 16, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        {t.regContinue}
      </button>

      <style>{`
        @keyframes micPulse {
          from { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          to   { box-shadow: 0 0 0 16px rgba(239,68,68,0); }
        }
      `}</style>
    </div>
  )
}
