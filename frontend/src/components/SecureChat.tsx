'use client'

import React, { useState, useEffect, useRef } from 'react'

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
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ws) return

    const handleMessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data)
        if (data.event === 'chat' && data.case_id === caseId) {
          setMessages(prev => [...prev, {
            sender_id: data.sender_id,
            content: data.content,
            timestamp: data.timestamp
          }])
        }
      } catch (err) {
        console.error('Chat WS error:', err)
      }
    }

    ws.addEventListener('message', handleMessage)
    
    // Fetch history
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v3/case/${caseId}/chat`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setMessages(data)
      })
      .catch(err => console.error('Failed to fetch chat history:', err))

    return () => ws.removeEventListener('message', handleMessage)
  }, [caseId, ws])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = () => {
    if (!input.trim() || !ws || ws.readyState !== WebSocket.OPEN) return

    const payload = {
      event: 'chat',
      case_id: caseId,
      sender_id: senderId,
      content: input.trim()
    }

    ws.send(JSON.stringify(payload))
    setInput('')
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
      marginTop: '16px'
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        background: 'rgba(16, 217, 138, 0.1)',
        borderBottom: '1px solid rgba(16, 217, 138, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10d98a' }} />
        <span style={{ fontSize: '12px', fontWeight: 800, color: '#10d98a', letterSpacing: '0.05em' }}>SECURE CHANNEL</span>
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
          gap: '12px'
        }}
      >
        {messages.length === 0 && (
          <p style={{ textAlign: 'center', fontSize: '11px', color: '#475569', marginTop: '20px' }}>
            Connection established. You can now chat with your doctor.
          </p>
        )}
        {messages.map((m, i) => {
          const isMe = m.sender_id === senderId
          return (
            <div key={i} style={{
              alignSelf: isMe ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: isMe ? 'flex-end' : 'flex-start'
            }}>
              <div style={{
                background: isMe ? 'linear-gradient(135deg, #059669, #10b981)' : 'rgba(255, 255, 255, 0.05)',
                color: isMe ? 'white' : '#f1f5f9',
                padding: '8px 12px',
                borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                fontSize: '13px',
                lineHeight: 1.4,
                border: isMe ? 'none' : '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                {m.content}
              </div>
              <span style={{ fontSize: '9px', color: '#475569', marginTop: '4px' }}>
                {m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
          )
        })}
      </div>

      {/* Input */}
      <div style={{
        padding: '12px',
        background: 'rgba(5, 14, 26, 0.5)',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        gap: '8px'
      }}>
        <input 
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
            padding: '8px 12px',
            color: 'white',
            fontSize: '13px',
            outline: 'none'
          }}
        />
        <button 
          onClick={sendMessage}
          style={{
            background: '#10d98a',
            border: 'none',
            borderRadius: '10px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          📤
        </button>
      </div>
    </div>
  )
}
