import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { Send, Lock } from 'lucide-react'

const SEED_MESSAGES = [
  { id: 1, sender: 'Pato', text: 'May 30. The room is going to be different this time.', time: '4:20 PM' },
  { id: 2, sender: 'Marcus', text: 'Edition 1 was insane. Can\'t wait', time: '4:32 PM' },
  { id: 3, sender: 'Jasmine', text: 'Live painting again? I have new pieces ready', time: '4:45 PM' },
  { id: 4, sender: 'Diego', text: 'Working on something new for the visual experience 👀', time: '5:01 PM' },
  { id: 5, sender: 'Devon', text: 'House music all night. That vinyl set last time was everything', time: '5:15 PM' },
  { id: 6, sender: 'Sofía', text: 'Fashion pop-up round 2! Who wants a table?', time: '5:28 PM' },
]

export default function EventChat() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState(SEED_MESSAGES)
  const [newMsg, setNewMsg] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = () => {
    if (!newMsg.trim()) return
    setMessages(prev => [...prev, {
      id: Date.now(), sender: 'You', text: newMsg.trim(), isMe: true,
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    }])
    setNewMsg('')
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px', textAlign: 'center' }}>
        <Lock size={24} strokeWidth={1.2} style={{ color: '#333', marginBottom: '20px' }} />
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '28px', color: '#FFF', letterSpacing: '0.02em', marginBottom: '8px' }}>
          JOIN THE CONVERSATION
        </div>
        <div style={{ fontSize: '13px', color: '#555', marginBottom: '28px', lineHeight: 1.6 }}>
          Create an account to chat with other attendees.
        </div>
        <button onClick={() => navigate('/auth')} style={{
          background: '#FFF', border: 'none', borderRadius: '10px', padding: '14px 36px',
          color: '#000', fontFamily: 'DM Sans', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
        }}>
          Join
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '16px 28px', borderBottom: '1px solid #1A1A1A',
        background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '18px', color: '#FFF', letterSpacing: '0.02em' }}>
          RAN BY ARTISTS
        </div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: '#444', marginTop: '2px', letterSpacing: '0.1em' }}>
          {messages.length} MESSAGES · {new Set(messages.map(m => m.sender)).size} MEMBERS
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, padding: '20px 28px 130px', overflowY: 'auto' }}>
        {/* Welcome */}
        <div style={{
          textAlign: 'center', padding: '16px', marginBottom: '20px',
          fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#333',
          border: '1px solid #1A1A1A', borderRadius: '10px', letterSpacing: '0.04em',
        }}>
          Event group chat · Connect before May 30
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{
              display: 'flex', gap: '10px',
              flexDirection: msg.isMe ? 'row-reverse' : 'row',
            }}>
              {!msg.isMe && (
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: '#111', border: '1px solid #1A1A1A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Bebas Neue', fontSize: '12px', color: '#555',
                  flexShrink: 0, marginTop: '2px',
                }}>
                  {msg.sender[0]}
                </div>
              )}

              <div style={{
                maxWidth: '78%',
                background: msg.isMe ? '#FFF' : '#111',
                borderRadius: msg.isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                padding: '10px 14px',
              }}>
                {!msg.isMe && (
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#888', marginBottom: '3px' }}>
                    {msg.sender}
                  </div>
                )}
                <div style={{ fontSize: '13px', color: msg.isMe ? '#000' : '#DDD', lineHeight: 1.5 }}>
                  {msg.text}
                </div>
                <div style={{
                  fontFamily: 'DM Mono, monospace', fontSize: '9px',
                  color: msg.isMe ? '#999' : '#444',
                  marginTop: '4px', textAlign: msg.isMe ? 'right' : 'left',
                }}>
                  {msg.time}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{
        position: 'fixed', bottom: '56px', left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '430px',
        background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)',
        borderTop: '1px solid #1A1A1A',
        padding: '10px 20px',
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text" placeholder="Say something..."
            value={newMsg} onChange={e => setNewMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            style={{
              flex: 1, background: '#111', border: '1px solid #1A1A1A',
              borderRadius: '100px', padding: '12px 18px',
              color: '#FFF', fontFamily: 'DM Sans', fontSize: '13px', outline: 'none',
            }}
          />
          <button onClick={sendMessage} disabled={!newMsg.trim()} style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: newMsg.trim() ? '#FFF' : '#1A1A1A',
            border: 'none', cursor: newMsg.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s',
          }}>
            <Send size={14} style={{ color: newMsg.trim() ? '#000' : '#444' }} />
          </button>
        </div>
      </div>
    </div>
  )
}
