'use client'
import React from 'react'

export interface DoctorProfile {
  name: string
  designation: string
  hospital: string
  cases_handled: number
  eta_minutes: number
  photo_url?: string
  verified?: boolean
  trust_score?: number
}

interface Props {
  patientLat: number
  patientLng: number
  doctorLat: number | null
  doctorLng: number | null
  doctorProfile: DoctorProfile | null
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2)
}

export default function DoctorTracker({ patientLat, patientLng, doctorLat, doctorLng, doctorProfile }: Props) {
  // Map doctor position relative to patient (patient = center 50%,50%)
  const getDoctorPos = () => {
    if (doctorLat === null || doctorLng === null) return null
    const scale = 900 // degrees → %
    const dx = (doctorLng - patientLng) * scale
    const dy = -(doctorLat - patientLat) * scale
    return {
      x: Math.max(6, Math.min(94, 50 + dx)),
      y: Math.max(6, Math.min(94, 50 + dy)),
    }
  }

  const doctorPos = getDoctorPos()
  const distance = doctorLat !== null && doctorLng !== null
    ? haversineKm(patientLat, patientLng, doctorLat, doctorLng)
    : null

  return (
    <div style={{ width: '100%' }}>

      {/* ── Doctor Info Bottom Sheet (Uber-style) ── */}
      {doctorProfile && (
        <div style={{
          background: 'rgba(5, 14, 26, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '24px 24px 20px 20px',
          padding: '24px',
          marginBottom: 16,
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          animation: 'slideUp 0.5s ease-out',
        }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20 }}>
            {/* Avatar with Ring */}
            <div style={{ position: 'relative' }}>
              <div style={{
                width: 70, height: 70, borderRadius: '50%',
                background: `url(${doctorProfile.photo_url || 'https://img.freepik.com/free-vector/doctor-character-background_1270-84.jpg'}) center/cover`,
                border: '3px solid #3b82f6',
                boxShadow: '0 0 20px rgba(59,130,246,0.3)',
              }} />
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 24, height: 24, borderRadius: '50%',
                background: '#10b981', border: '3px solid #050e1a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: 'white'
              }}>✓</div>
            </div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: 'white', margin: 0 }}>Dr. {doctorProfile.name}</h3>
                <span style={{ 
                  background: 'rgba(16,185,129,0.1)', color: '#10b981', 
                  fontSize: 10, fontWeight: 900, padding: '3px 8px', borderRadius: 20,
                  border: '1px solid rgba(16,185,129,0.3)', letterSpacing: '0.05em'
                }}>VERIFIED</span>
              </div>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 8px 0' }}>{doctorProfile.designation}</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 13 }}>⭐</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>4.9</span>
                </div>
                <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)', alignSelf: 'center' }} />
                <span style={{ fontSize: 12, color: '#64748b' }}>{doctorProfile.cases_handled}+ Cases</span>
              </div>
            </div>

            {/* ETA Bubble */}
            <div style={{ 
              background: 'linear-gradient(135deg, #f59e0b, #d97706)', 
              borderRadius: 18, padding: '12px 16px', textAlign: 'center',
              boxShadow: '0 4px 15px rgba(245,158,11,0.3)'
            }}>
              <span style={{ display: 'block', fontSize: 24, fontWeight: 900, color: 'white', lineHeight: 1 }}>{doctorProfile.eta_minutes}</span>
              <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.8)' }}>MIN</span>
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 -24px 20px -24px' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🏥</div>
              <span style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 600 }}>{doctorProfile.hospital}</span>
            </div>
            <button style={{ 
              background: '#3b82f6', color: 'white', border: 'none', 
              padding: '10px 20px', borderRadius: 12, fontWeight: 800, fontSize: 13,
              cursor: 'pointer', boxShadow: '0 4px 15px rgba(59,130,246,0.4)'
            }}>
              📞 Call Doctor
            </button>
          </div>
        </div>
      )}

      {/* ── Live Tracking Map (pure SVG) ── */}
      <div style={{
        width: '100%', height: 200, position: 'relative',
        background: 'rgba(5,12,24,0.9)',
        border: '1px solid rgba(16,217,138,0.15)',
        borderRadius: 20, overflow: 'hidden',
      }}>
        {/* LIVE badge */}
        <div style={{ position: 'absolute', top: 12, left: 14, zIndex: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10d98a', animation: 'ping 1.5s infinite' }} />
          <span style={{ fontSize: 9, color: '#10d98a', fontWeight: 800, letterSpacing: '0.08em' }}>LIVE TRACKING</span>
        </div>

        {distance && (
          <div style={{ position: 'absolute', top: 12, right: 14, zIndex: 3 }}>
            <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 800 }}>📍 {distance} km away</span>
          </div>
        )}

        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5"/>
            </pattern>
            <radialGradient id="patientGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </radialGradient>
          </defs>
          
          {/* Map Background Pattern */}
          <rect width="100" height="100" fill="url(#grid)" />
          
          {/* Major "Roads" simulation */}
          <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
          <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />

          {/* Route line doctor→patient (Premium Glow) */}
          {doctorPos && (
            <path
              d={`M ${doctorPos.x} ${doctorPos.y} L 50 50`}
              stroke="#3b82f6" strokeWidth="0.8" strokeDasharray="3 2" opacity="0.8"
              fill="none"
            >
              <animate attributeName="stroke-dashoffset" from="10" to="0" dur="1s" repeatCount="indefinite" />
            </path>
          )}

          {/* Patient (green) */}
          <circle cx={50} cy={50} r={6} fill="url(#patientGlow)" />
          <circle cx={50} cy={50} r={2} fill="#10b981" />
          <circle cx={50} cy={50} r={5} fill="none" stroke="#10d98a" strokeWidth="0.4" opacity="0.5">
            <animate attributeName="r" values="2;8;2" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
          </circle>

          {/* Doctor (blue - Uber-like Car Icon simulation) */}
          {doctorPos && (
            <g transform={`translate(${doctorPos.x - 2.5}, ${doctorPos.y - 2.5})`}>
              <circle cx={2.5} cy={2.5} r={2.5} fill="#3b82f6" />
              <circle cx={2.5} cy={2.5} r={5} fill="none" stroke="#3b82f6" strokeWidth="0.4" opacity="0.4">
                <animate attributeName="r" values="2.5;7;2.5" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0;0.5" dur="1.5s" repeatCount="indefinite" />
              </circle>
            </g>
          )}
        </svg>

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 12, left: 0, right: 0,
          display: 'flex', justifyContent: 'space-around', padding: '0 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10d98a' }} />
            <span style={{ fontSize: 10, color: '#10d98a', fontWeight: 700 }}>You</span>
          </div>
          {doctorPos ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
              <span style={{ fontSize: 10, color: '#3b82f6', fontWeight: 700 }}>
                Dr. {doctorProfile?.name || 'Doctor'}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: 10, color: '#475569' }}>⏳ Waiting for doctor GPS…</span>
          )}
        </div>
      </div>
    </div>
  )
}
