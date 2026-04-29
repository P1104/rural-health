'use client'

import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '@/config'

interface Doctor {
  name: string
  email: string
  hospital: string
  specialization: string
  license_number: string
  phone: string
  verified: boolean
  joined: string
}

export default function AdminDashboard() {
  const [adminKey, setAdminKey] = useState('')
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [pendingDocs, setPendingDocs] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const fetchPending = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/v3/auth/admin/pending?admin_key=${adminKey}`)
      if (!res.ok) throw new Error('Invalid Admin Key or Server Error')
      const data = await res.json()
      setPendingDocs(data)
      setIsAuthorized(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const verifyDoctor = async (email: string) => {
    setMessage('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/v3/auth/admin/verify/${email}?admin_key=${adminKey}`, {
        method: 'POST'
      })
      if (!res.ok) throw new Error('Verification failed')
      setMessage(`Successfully verified ${email}`)
      fetchPending() // Refresh list
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (!isAuthorized) {
    return (
      <div style={{ minHeight: '100vh', background: '#030a16', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: 40, borderRadius: 24, width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Admin Portal</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 32 }}>Enter authority key to manage medical licenses</p>
          
          <input 
            type="password" 
            placeholder="Authority Admin Key" 
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            style={{ width: '100%', padding: '14px 18px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'white', marginBottom: 16, outline: 'none' }}
          />
          
          <button 
            onClick={fetchPending}
            disabled={loading}
            style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: 'white', fontWeight: 800, borderRadius: 12, cursor: 'pointer' }}
          >
            {loading ? 'Authenticating...' : 'Access Dashboard'}
          </button>
          
          {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 16 }}>{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#030a16', color: 'white', fontFamily: 'Inter, sans-serif', padding: 40 }}>
      <header style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900 }}>Doctor Verification</h1>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>Review and approve medical licenses for Rural Health Connect</p>
        </div>
        <button 
          onClick={() => setIsAuthorized(false)}
          style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}
        >
          Logout
        </button>
      </header>

      <main style={{ maxWidth: 1000, margin: '0 auto' }}>
        {message && (
          <div style={{ background: 'rgba(16,217,138,0.1)', border: '1px solid #10d98a', color: '#10d98a', padding: '12px 20px', borderRadius: 12, marginBottom: 24, fontSize: 14 }}>
            {message}
          </div>
        )}

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '16px 24px' }}>Doctor Details</th>
                <th style={{ padding: '16px 24px' }}>Medical License</th>
                <th style={{ padding: '16px 24px' }}>Facility</th>
                <th style={{ padding: '16px 24px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingDocs.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 60, textAlign: 'center', color: '#475569' }}>
                    <span style={{ fontSize: 40, display: 'block', marginBottom: 16 }}>✅</span>
                    All pending registrations have been processed.
                  </td>
                </tr>
              ) : pendingDocs.map(doc => (
                <tr key={doc.email} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '20px 24px' }}>
                    <p style={{ fontWeight: 800, fontSize: 15 }}>{doc.name}</p>
                    <p style={{ fontSize: 12, color: '#64748b' }}>{doc.email}</p>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <p style={{ fontFamily: 'monospace', color: '#10d98a', fontSize: 13, fontWeight: 700 }}>{doc.license_number}</p>
                    <p style={{ fontSize: 11, color: '#475569' }}>{doc.specialization}</p>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <p style={{ fontSize: 14 }}>{doc.hospital}</p>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <button 
                      onClick={() => verifyDoctor(doc.email)}
                      style={{ padding: '8px 16px', background: '#10b981', border: 'none', color: 'white', fontWeight: 700, borderRadius: 8, cursor: 'pointer', fontSize: 12 }}
                    >
                      Approve License
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
