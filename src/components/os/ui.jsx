import { X } from 'lucide-react'
import { VOID, BONE, BONE_MID, BONE_LOW, SILVER, CARD, CARD_HI, HAIR, HAIR_HI, FONT_MONO, FONT_SANS, chromeText, safeImg } from '@/lib/cosmos'

/* Small cosmos UI primitives shared across the OS panels. Function-first. */

export function Modal({ title, onClose, children, footer }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(5,5,8,.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '520px', background: 'linear-gradient(180deg,#111119 0%,#0C0C12 100%)', border: `1px solid ${HAIR_HI}`, borderBottom: 'none', borderRadius: '20px 20px 0 0', padding: '22px 20px calc(24px + env(safe-area-inset-bottom,0px))', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_MID, letterSpacing: '.2em', textTransform: 'uppercase' }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: '2px' }}><X size={17} /></button>
        </div>
        {children}
        {footer && <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: '14px' }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: '7px' }}>{label}</div>
      {children}
    </label>
  )
}

const baseInput = { width: '100%', background: VOID, border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '11px 13px', color: BONE, fontFamily: FONT_SANS, fontSize: '14px', outline: 'none' }
export const Input = (p) => <input {...p} style={{ ...baseInput, ...(p.style || {}) }} />
export const Textarea = (p) => <textarea {...p} style={{ ...baseInput, resize: 'vertical', minHeight: '70px', lineHeight: 1.5, ...(p.style || {}) }} />
export function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={onChange} style={{ ...baseInput, appearance: 'none', cursor: 'pointer' }}>
      {options.map(o => {
        const val = typeof o === 'string' ? o : o.value
        const lab = typeof o === 'string' ? o : o.label
        return <option key={val} value={val} style={{ background: '#111', color: BONE }}>{lab}</option>
      })}
    </select>
  )
}

export function Btn({ children, onClick, variant = 'ghost', disabled, style }) {
  const v = {
    solid: { background: SILVER, color: VOID, border: `1px solid ${SILVER}` },
    ghost: { background: 'transparent', color: BONE_MID, border: `1px solid ${HAIR_HI}` },
    danger: { background: 'transparent', color: '#E5A0A0', border: '1px solid rgba(229,160,160,.3)' },
  }[variant]
  return (
    <button onClick={onClick} disabled={disabled} style={{ flex: style?.flex, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', borderRadius: '100px', padding: '10px 16px', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase', transition: 'all .15s', ...v, ...style }}>
      {children}
    </button>
  )
}

/* owner avatar + name chip (real profile — no pickers) */
export function OwnerChip({ owner, size = 20 }) {
  const name = owner?.full_name || owner?.username || 'Unassigned'
  const avatar = safeImg(owner?.avatar_url)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
      <span style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, background: VOID, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: `${size * 0.5}px`, ...chromeText }}>{name[0].toUpperCase()}</span>}
      </span>
      <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
    </span>
  )
}
