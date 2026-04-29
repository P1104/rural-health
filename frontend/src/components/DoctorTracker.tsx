'use client'
import React from 'react'

export interface DoctorProfile {
  name: string
  designation: string
  hospital: string
  cases_handled: number
  eta_minutes: number
  photo_url?: string
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

      {/* ── Doctor Profile Card ── */}
      {doctorProfile && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(16,217,138,0.05))',
          border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: 20, padding: '20px 22px', marginBottom: 16,
          display: 'flex', gap: 18, alignItems: 'center',
          animation: 'slideDown 0.4s ease',
        }}>
          {/* Avatar */}
          <div style={{
            width: 62, height: 62, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#3b82f6,#10b981)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, boxShadow: '0 0 20px rgba(59,130,246,0.4)',
          }}>👨‍⚕️</div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, color: '#3b82f6', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
              ✅ Doctor Assigned &amp; En Route
            </p>
            <p style={{ fontSize: 17, fontWeight: 900, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Dr. {doctorProfile.name}
            </p>
            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{doctorProfile.designation}</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>🏥 {doctorProfile.hospital}</span>
              <span style={{ fontSize: 11, color: '#10d98a', fontWeight: 700 }}>📋 {doctorProfile.cases_handled} cases</span>
            </div>
          </div>

          {/* ETA */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <p style={{ fontSize: 30, fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>{doctorProfile.eta_minutes}</p>
            <p style={{ fontSize: 9, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>MIN ETA</p>
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
          {/* Grid */}
          {[20, 40, 60, 80].map(v => (
            <React.Fragment key={v}>
              <line x1={v} y1={0} x2={v} y2={100} stroke="rgba(16,217,138,0.05)" strokeWidth="0.3" />
              <line x1={0} y1={v} x2={100} y2={v} stroke="rgba(16,217,138,0.05)" strokeWidth="0.3" />
            </React.Fragment>
          ))}

          {/* Route line doctor→patient */}
          {doctorPos && (
            <line
              x1={doctorPos.x} y1={doctorPos.y} x2={50} y2={50}
              stroke="#3b82f6" strokeWidth="0.6" strokeDasharray="2 1.5" opacity="0.6"
            />
          )}

          {/* Patient (green) */}
          <circle cx={50} cy={50} r={2.5} fill="#10d98a" />
          <circle cx={50} cy={50} r={5} fill="none" stroke="#10d98a" strokeWidth="0.4" opacity="0.5">
            <animate attributeName="r" values="3;8;3" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
          </circle>

          {/* Doctor (blue) */}
          {doctorPos && (
            <>
              <circle cx={doctorPos.x} cy={doctorPos.y} r={2.5} fill="#3b82f6" />
              <circle cx={doctorPos.x} cy={doctorPos.y} r={5} fill="none" stroke="#3b82f6" strokeWidth="0.4" opacity="0.4">
                <animate attributeName="r" values="2.5;6;2.5" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0;0.4" dur="1.8s" repeatCount="indefinite" />
              </circle>
            </>
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
