import { useEffect } from 'react'
import { X } from 'lucide-react'
import { VOID, VOID_2, BONE, BONE_MID, BONE_LOW, SILVER, CARD, CARD_HI, HAIR, HAIR_HI, FONT_MONO, FONT_SANS, chromeText, safeImg } from '@/lib/cosmos'
import { useIsDesktop } from '@/lib/useIsDesktop'

/* Small cosmos UI primitives shared across the OS panels. Function-first. */

/* Modal — bottom sheet below 768px, centered dialog on the instrument shell
   (>=768px — half-screen windows get the work pattern, not the phone one).
   Keyboard: Enter saves (outside textareas), Esc closes. */
export function Modal({ title, onClose, onEnter, children, footer }) {
  const desktop = useIsDesktop()
  // window-level keys: Esc closes and Enter saves even if focus wandered off the sheet
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'Enter' && onEnter && e.target?.tagName !== 'TEXTAREA' && e.target?.tagName !== 'BUTTON') { e.preventDefault(); onEnter() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onEnter])
  return (
    <div onClick={onClose} className="overlay-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(7,8,14,.78)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: desktop ? 'center' : 'flex-end', justifyContent: 'center', padding: desktop ? '40px' : 0 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label={title} className={desktop ? 'dialog-in' : 'sheet-up'}
        style={{ width: '100%', maxWidth: '520px', background: VOID_2, border: `1px solid ${HAIR_HI}`,
          borderBottom: desktop ? `1px solid ${HAIR_HI}` : 'none',
          borderRadius: desktop ? '16px' : '20px 20px 0 0',
          padding: desktop ? '24px 24px 26px' : '22px 20px calc(24px + env(safe-area-inset-bottom,0px))',
          maxHeight: '88vh', overflowY: 'auto', boxShadow: desktop ? '0 24px 80px rgba(0,0,0,.5)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_MID, letterSpacing: '.2em', textTransform: 'uppercase' }}>◇ {title}</div>
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
    <select className="os-select" value={value} onChange={onChange} style={{ ...baseInput, cursor: 'pointer', fontSize: '12px', paddingRight: '30px' }}>
      {options.map(o => {
        const val = typeof o === 'string' ? o : o.value
        const lab = typeof o === 'string' ? o : o.label
        return <option key={val} value={val}>{lab}</option>
      })}
    </select>
  )
}

/* Kicker — the deck's eyebrow: "◇ [01] LABEL ——". Mono, wide-tracked, ash. */
export function Kicker({ code, label, style }) {
  return (
    <div style={{ fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.3em', textTransform: 'uppercase', color: BONE_LOW, display: 'flex', alignItems: 'center', gap: '13px', ...style }}>
      <span style={{ letterSpacing: 0 }}>◇</span>
      {code && <span style={{ color: BONE, border: `1px solid ${HAIR_HI}`, padding: '3px 9px', borderRadius: '3px', fontSize: '9px', letterSpacing: '.16em' }}>{code}</span>}
      <span>{label}</span>
      <span aria-hidden style={{ flex: '0 0 38px', height: '1px', background: HAIR_HI }} />
    </div>
  )
}

/* Chip — inline value editor: click cycles through options, no modal. */
export function Chip({ value, options, onPick, title, solid }) {
  const next = () => {
    const i = options.indexOf(value)
    onPick(options[(i + 1) % options.length])
  }
  return (
    <button onClick={next} title={title || 'Click to change'}
      style={{ background: solid ? 'rgba(242,238,230,.08)' : 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '4px', padding: '2px 8px', color: solid ? BONE : BONE_MID, fontFamily: FONT_MONO, fontSize: '8px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer' }}>
      {value}
    </button>
  )
}

export function Btn({ children, onClick, variant = 'ghost', disabled, style }) {
  const v = {
    solid: { background: BONE, color: VOID, border: `1px solid ${BONE}` },
    ghost: { background: 'transparent', color: BONE_MID, border: `1px solid ${HAIR_HI}` },
    danger: { background: 'transparent', color: BONE, border: `1px solid ${HAIR_HI}` },
  }[variant]
  return (
    <button onClick={onClick} disabled={disabled} style={{ flex: style?.flex, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', borderRadius: '100px', padding: '10px 16px', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase', transition: 'color .15s, background .15s, border-color .15s, opacity .15s, filter .15s, transform .16s var(--ease-exit)', ...v, ...style }}>
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
          : <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: `${size * 0.5}px`, color: BONE }}>{name[0].toUpperCase()}</span>}
      </span>
      <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
    </span>
  )
}
