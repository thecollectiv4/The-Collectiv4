import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { Send, Lock } from 'lucide-react'

const EVENT_CHAT_ID = 'rba-may-2026'

// Seed messages for demo
const SEED_MESSAGES = [
  { id: 1, sender: 'Pato', text: 'May 30. The room is going to be different this time.', time: '4:20 PM', color: '#C05A2A' },
  { id: 2, sender: 'Marcus', text: 'Edition 1 was insane. Can\'t wait for this one', time: '4:32 PM', color: '#4A7A2A' },
  { id: 3, sender: 'Jasmine', text: 'Are we doing live painting again? I want to show some new pieces', time: '4:45 PM', color: '#7A4A2A' },
  { id: 4, sender: 'Diego', text: 'Si! Live painting confirmed. Also working on something new for the experience 👀', time: '5:01 PM', color: '#2A5A7A' },
  { id: 5, sender: 'Devon', text: 'The vinyl set last time was everything. House music all night please', time: '5:15 PM', color: '#6A2A7A' },
  { id: 6, sender: 'Sofía', text: 'Fashion pop-up round 2!! Who wants a table?', time: '5:28 PM', color: '#7A2A5A' },
]

export default function EventChat() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState(SEED_MESSAGES)
  const [newMsg, setNewMsg] = useState('')
  const [userProfile, setUserProfile] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('display_name').eq('id', user.id).single()
        .then(({ data }) => setUserProfile(data))
        .catch(() => setUserProfile({ display_name: 'You' }))
    }
  }, [user])

  const sendMessage = () => {
    if (!newMsg.trim()) return
    const msg = {
      id: Date.now(),
      sender: userProfile?.display_name || 'You',
      text: newMsg.trim(),
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      color: '#C05A2A',
      isMe: true,
    }
    setMessages(prev => [...prev, msg])
    setNewMsg('')

    // TODO: Save to Supabase for real-time sync
    // supabase.from('messages').insert({ ... })
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
        <Lock size={32} style={{ color: '#5A5248', marginBottom: '16px' }} />
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '24px', color: '#F4F0E8', letterSpacing: '0.04em', marginBottom: '8px' }}>
          Get your ticket to join the chat
        </div>
        <div style={{ fontSize: '13px', color: '#5A5248', marginBottom: '24px' }}>
          Connect with other attendees before the event.
        </div>
        <button onClick={() => navigate('/auth')} style={{
          background: '#C05A2A', border: 'none', borderRadius: '12px', padding: '14px 32px',
          color: '#F4F0E8', fontFamily: 'Bebas Neue', fontSize: '16px', letterSpacing: '0.06em', cursor: 'pointer'
        }}>
          JOIN THE COLLECTIVE
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0D0B', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid #1A1814',
        background: 'rgba(14,13,11,0.95)', backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.2em', color: '#5A5248', textTransform: 'uppercase', fontWeight: 600 }}>
          Event Group Chat
        </div>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '20px', color: '#F4F0E8', letterSpacing: '0.04em', marginTop: '2px' }}>
          RAN BY ARTISTS <span style={{ color: '#C05A2A' }}>· MAY 30</span>
        </div>
        <div style={{ fontSize: '11px', color: '#5A5248', marginTop: '2px' }}>
          {messages.length} messages · {new Set(messages.map(m => m.sender)).size} members
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, padding: '16px 24px 140px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Welcome message */}
          <div style={{
            textAlign: 'center', padding: '16px', marginBottom: '8px',
            fontSize: '11px', color: '#5A5248',
            border: '1px dashed #2A2825', borderRadius: '12px',
          }}>
            Welcome to the RBA May 30 group chat. Connect with other attendees, share ideas, and build the energy before the event. 🖤
          </div>

          {messages.map((msg) => (
            <div key={msg.id} style={{
              display: 'flex', gap: '10px',
              flexDirection: msg.isMe ? 'row-reverse' : 'row',
            }}>
              {/* Avatar */}
              {!msg.isMe && (
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2A2420, #1A1210)',
                  border: '1px solid #2A2825',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Bebas Neue', fontSize: '13px', color: msg.color || '#C05A2A',
                  flexShrink: 0,
                }}>
                  {msg.sender[0]}
                </div>
              )}

              <div style={{
                maxWidth: '75%',
                background: msg.isMe ? 'rgba(192,90,42,0.15)' : '#1A1814',
                border: `1px solid ${msg.isMe ? 'rgba(192,90,42,0.2)' : '#2A2825'}`,
                borderRadius: msg.isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '10px 14px',
              }}>
                {!msg.isMe && (
                  <div style={{ fontSize: '11px', fontWeight: 600, color: msg.color || '#C05A2A', marginBottom: '4px' }}>
                    {msg.sender}
                  </div>
                )}
                <div style={{ fontSize: '13px', color: '#F4F0E8', lineHeight: 1.5 }}>
                  {msg.text}
                </div>
                <div style={{ fontSize: '9px', color: '#5A5248', marginTop: '4px', textAlign: msg.isMe ? 'right' : 'left' }}>
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
        position: 'fixed', bottom: '64px', left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '430px',
        background: 'rgba(14,13,11,0.95)', backdropFilter: 'blur(12px)',
        borderTop: '1px solid #1A1814',
        padding: '12px 16px',
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Say something..."
            value={newMsg}
            onChange={e => setNewMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            style={{
              flex: 1, background: '#1A1814', border: '1px solid #2A2825',
              borderRadius: '24px', padding: '12px 18px',
              color: '#F4F0E8', fontFamily: 'DM Sans', fontSize: '13px',
              outline: 'none',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!newMsg.trim()}
            style={{
              width: '42px', height: '42px', borderRadius: '50%',
              background: newMsg.trim() ? '#C05A2A' : '#2A2825',
              border: 'none', cursor: newMsg.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s',
            }}
          >
            <Send size={16} style={{ color: '#F4F0E8' }} />
          </button>
        </div>
      </div>
    </div>
  )
}
