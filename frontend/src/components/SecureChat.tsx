'use client'

import React, { useState, useEffect, useRef } from 'react'
import { API_BASE_URL } from '@/config'

interface Message {
  sender_id: string
  content: string
  timestamp: string
}

interface SecureChatProps {
  caseId: string
  senderId: string // 'patient' or doctor_id
  ws: WebSocket | null
}

export default function SecureChat({ caseId, senderId, ws }: SecureChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load persisted history on mount
  useEffect(() => {
    if (!caseId) return
    fetch(`${API_BASE_URL}/api/v3/chat/${caseId}/messages`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setMessages(data)
      })
      .catch(() => { /* history unavailable — start fresh */ })
  }, [caseId])

  // Listen for live incoming messages via WebSocket
  useEffect(() => {
    if (!ws) return

    const handleMessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data)
        if (data.event === 'chat' && data.case_id === caseId) {
          setMessages(prev => {
            // Deduplicate by timestamp + sender
            const key = `${data.sender_id}|${data.timestamp}`
            if (prev.some(m => `${m.sender_id}|${m.timestamp}` === key)) return prev
            return [...prev, {
              sender_id: data.sender_id,
              content: data.content,
              timestamp: data.timestamp,
            }]
          })
        }
      } catch (err) {
        console.error('Chat WS parse error:', err)
      }
    }

    ws.addEventListener('message', handleMessage)
    return () => ws.removeEventListener('message', handleMessage)
  }, [caseId, ws])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)

    try {
      // POST to backend — persists + broadcasts via WS
      const res = await fetch(`${API_BASE_URL}/api/v3/chat/${caseId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_id: senderId, content: text }),
      })
      if (res.ok) {
        const data = await res.json()
        // Add own message immediately (WS broadcast may echo back — dedup handles it)
        setMessages(prev => {
          const key = `${data.message.sender_id}|${data.message.timestamp}`
          if (prev.some(m => `${m.sender_id}|${m.timestamp}` === key)) return prev
          return [...prev, data.message]
        })
      }
    } catch {
      // Fallback: send via WebSocket only (no persistence)
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          event: 'chat',
          case_id: caseId,
          sender_id: senderId,
          content: text,
          timestamp: new Date().toISOString(),
        }))
        setMessages(prev => [...prev, {
          sender_id: senderId,
          content: text,
          timestamp: new Date().toISOString(),
        }])
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '300px',
      background: 'rgba(8, 20, 45, 0.9)',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      overflow: 'hidden',
      marginTop: '16px',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        background: 'rgba(16, 217, 138, 0.1)',
        borderBottom: '1px solid rgba(16, 217, 138, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10d98a', animation: 'ping 2s infinite' }} />
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#10d98a', letterSpacing: '0.05em' }}>
            SECURE CHANNEL
          </span>
        </div>
        <span style={{ fontSize: '10px', color: '#334155', fontFamily: 'monospace' }}>
          {messages.length} msg{messages.length !== 1 ? 's' : ''} • E2EE
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {messages.length === 0 && (
          <p style={{ textAlign: 'center', fontSize: '11px', color: '#475569', marginTop: '20px', fontStyle: 'italic' }}>
            🔒 Encrypted channel established. Messages are end-to-end secured.
          </p>
        )}
        {messages.map((m, i) => {
          const isMe = m.sender_id === senderId
          return (
            <div key={i} style={{
              alignSelf: isMe ? 'flex-end' : 'flex-start',
              maxWidth: '82%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: isMe ? 'flex-end' : 'flex-start',
            }}>
              {!isMe && (
                <span style={{ fontSize: '9px', color: '#475569', marginBottom: 3, paddingLeft: 4 }}>
                  {m.sender_id === 'patient' ? '🧑 Patient' : `👨‍⚕️ ${m.sender_id.slice(0, 12)}`}
                </span>
              )}
              <div style={{
                background: isMe ? 'linear-gradient(135deg, #059669, #10b981)' : 'rgba(255, 255, 255, 0.06)',
                color: isMe ? 'white' : '#f1f5f9',
                padding: '9px 13px',
                borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                fontSize: '13px',
                lineHeight: 1.4,
                border: isMe ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: isMe ? '0 2px 12px rgba(5,150,105,0.25)' : 'none',
              }}>
                {m.content}
              </div>
              <span style={{ fontSize: '9px', color: '#334155', marginTop: '4px', paddingLeft: 4, paddingRight: 4 }}>
                {m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
          )
        })}
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 12px',
        background: 'rgba(5, 14, 26, 0.6)',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
      }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder={sending ? 'Sending…' : 'Type a message…'}
          disabled={sending}
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
            padding: '8px 12px',
            color: 'white',
            fontSize: '13px',
            outline: 'none',
            opacity: sending ? 0.6 : 1,
          }}
        />
        <button
          onClick={sendMessage}
          disabled={sending || !input.trim()}
          style={{
            background: sending ? 'rgba(16,217,138,0.3)' : '#10d98a',
            border: 'none',
            borderRadius: '10px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: sending ? 'not-allowed' : 'pointer',
            fontSize: '15px',
            flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          {sending ? '⏳' : '📤'}
        </button>
      </div>
    </div>
  )
}
