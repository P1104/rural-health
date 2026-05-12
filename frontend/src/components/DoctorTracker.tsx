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

      {/* ── Live Tracking Map (3D Tactical Proximity HUD) ── */}
      <div style={{
        width: '100%', height: 280, position: 'relative',
        background: '#020617',
        border: '1px solid rgba(59,130,246,0.3)',
        borderRadius: 28, overflow: 'hidden',
        perspective: '1200px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6), inset 0 0 40px rgba(59,130,246,0.1)'
      }}>
        {/* Scanning Sweep Effect */}
        {/* Top Overlay UI */}
        <div style={{ position: 'absolute', top: 16, left: 20, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10d98a', boxShadow: '0 0 15px #10d98a', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 11, color: '#10d98a', fontWeight: 900, letterSpacing: '0.15em' }}>MISSION ACTIVE</span>
          </div>
          <div style={{ display: 'flex', gap: 12, opacity: 0.6 }}>
            <p style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, margin: 0 }}>ID: {Math.random().toString(36).substring(7).toUpperCase()}</p>
            <p style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, margin: 0 }}>ENCRYPTED CHANNEL</p>
          </div>
        </div>

        {distance && (
          <div style={{ position: 'absolute', top: 16, right: 20, zIndex: 10, textAlign: 'right' }}>
            <span style={{ fontSize: 24, color: '#f59e0b', fontWeight: 900, textShadow: '0 0 20px rgba(245,158,11,0.5)', fontFamily: 'monospace' }}>
              {distance}<span style={{ fontSize: 12, marginLeft: 2 }}>KM</span>
            </span>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ 
                  width: 8, height: 3, 
                  background: parseFloat(distance) < (6 - i) ? '#f59e0b' : 'rgba(255,255,255,0.1)',
                  borderRadius: 2 
                }} />
              ))}
            </div>
          </div>
        )}

        {/* 3D Space */}
        <div style={{
          position: 'absolute', inset: 0,
          transform: 'rotateX(40deg) translateY(-30px)',
          transformStyle: 'preserve-3d',
        }}>
          {/* Grid with Depth */}
          <div style={{
            position: 'absolute', inset: -200,
            backgroundImage: `
              radial-gradient(circle at center, transparent 0%, #020617 70%),
              linear-gradient(to right, rgba(59,130,246,0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(59,130,246,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '100% 100%, 50px 50px',
          }} />

          {/* Connection Path (Energy Stream) */}
          {doctorPos && (
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
              <path
                d={`M ${doctorPos.x}% ${doctorPos.y}% L 50% 50%`}
                fill="none"
                stroke="rgba(59,130,246,0.2)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <circle r="3" fill="#3b82f6">
                <animateMotion 
                  path={`M ${doctorPos.x}% ${doctorPos.y}% L 50% 50%`} 
                  dur="1.5s" 
                  repeatCount="indefinite" 
                />
              </circle>
            </svg>
          )}

          {/* Patient Marker */}
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%, -50%) translateZ(10px)',
            width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#10d98a', boxShadow: '0 0 30px #10d98a', zIndex: 2 }} />
            <div style={{ position: 'absolute', width: '100%', height: '100%', border: '2px solid #10d98a', borderRadius: '50%', animation: 'ripple 3s infinite' }} />
            <div style={{ position: 'absolute', width: '200%', height: '200%', border: '1px solid rgba(16,217,138,0.2)', borderRadius: '50%', animation: 'ripple 3s infinite 1s' }} />
          </div>

          {/* Doctor Marker (3D Pin) */}
          {doctorPos && (
            <div style={{
              position: 'absolute', left: `${doctorPos.x}%`, top: `${doctorPos.y}%`,
              transform: 'translate(-50%, -50%) translateZ(30px)',
              transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex', flexDirection: 'column', alignItems: 'center'
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50% 50% 50% 0',
                background: '#3b82f6', border: '2px solid white',
                transform: 'rotate(-45deg)',
                boxShadow: '0 0 20px rgba(59,130,246,0.8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <div style={{ width: 8, height: 8, background: 'white', borderRadius: '50%', transform: 'rotate(45deg)' }} />
              </div>
              <div style={{ width: 4, height: 20, background: 'linear-gradient(to bottom, #3b82f6, transparent)', marginTop: -5 }} />
            </div>
          )}
        </div>

        {/* Legend Panel */}
        <div style={{
          position: 'absolute', bottom: 20, left: 20, right: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)',
          padding: '12px 20px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10d98a' }} />
            <span style={{ fontSize: 12, color: 'white', fontWeight: 800 }}>YOUR LOCATION</span>
          </div>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }} />
            <span style={{ fontSize: 12, color: 'white', fontWeight: 800 }}>
              DR. {doctorProfile?.name.toUpperCase() || 'SEARCHING...'}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ripple { from { transform: scale(0.5); opacity: 1; } to { transform: scale(3); opacity: 0; } }
        @keyframes sweep { 0%, 100% { transform: translateY(-100%); } 50% { transform: translateY(100%); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.7; } }
      `}</style>
    </div>
  )
}
