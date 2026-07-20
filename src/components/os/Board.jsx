import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Pencil, Trash2, Plus, Check, RotateCcw } from 'lucide-react'
import { BOARD_COLUMNS, VOID, BONE, BONE_MID, BONE_LOW, FAINT, SILVER, STAR, HAIR, HAIR_HI, PANEL, CARD_HI, FONT_MONO, FONT_SANS, safeImg } from '@/lib/cosmos'
import { useIsDesktop, useBoardGrid } from '@/lib/useIsDesktop'
import { Modal, Field, Input, Select, Btn } from './ui'

/* Board — the deck's catalog language on a WORKING surface (v8 adición B).
   Pato's drop: "el board está super messy… ¿está apto para operar, para
   mandarle a Brandon?" Two answers in one pass:

   LEGIBLE — lanes never squash below ~300px: the grid measures itself and
   drops columns instead of strangling text one word per line. >=768px a
   horizontal snap row when only one lane fits; <768px the phone swipe lanes.

   OPERABLE — the first real work gestures, without inventing a Jira:
     · SHIP (✓) on every card — one tap moves it to Done. Reopen from Done.
     · ASSIGN — the owner chip on every card opens the team; a person's
       name lands on the card (owner select in the editor too).
   The OS is where the team WORKS, not where it looks at work. */

const EMPTY_LINE = {
  ideas: 'no ideas parked yet',
  this_week: 'nothing pulled in yet',
  in_motion: 'nothing moving yet',
  done: 'nothing shipped yet',
}
const LANE_MIN = 300   // px — below this, text breaks one word per line (the bug)

/* entrance — the staged reveal is a first-visit welcome (OS.jsx owns the
   per-session bookkeeping). Off = lanes and rows are simply THERE, and a card
   that moves settles instead of entering. */
export default function Board({ tasks, profileId, owners, entrance, onCreate, onUpdate, onMoveTo, onDelete }) {
  const desktop = useIsDesktop()   // >=768 — instrument shell
  const grid = useBoardGrid()      // >=1100 — lanes may fit side by side
  const [mineOnly, setMineOnly] = useState(false)
  const [editing, setEditing] = useState(null)     // { mode, task }
  const [quickCol, setQuickCol] = useState(null)   // column key with quick-add open
  const [dragOver, setDragOver] = useState(null)   // column key under the dragged card
  const [assignFor, setAssignFor] = useState(null) // task id with the assign menu open
  const dragId = useRef(null)

  // the grid measures itself: columns = how many REAL lanes fit (Ley 4 —
  // el espacio se compone; never four strangled strips)
  const laneWrap = useRef(null)
  const [cols, setCols] = useState(4)
  useEffect(() => {
    if (!grid || !laneWrap.current) return undefined
    const el = laneWrap.current
    const measure = () => setCols(Math.min(BOARD_COLUMNS.length, Math.max(1, Math.floor(el.clientWidth / LANE_MIN))))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [grid])

  // the team the board can hand work to — real members with a face
  const members = Object.values(owners || {})
    .filter(p => p && (p.full_name || p.username))
    .sort((a, b) => (a.full_name || a.username || '').localeCompare(b.full_name || b.username || ''))

  // N opens quick-add in Ideas — unless the member is already typing somewhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key !== 'n' && e.key !== 'N') || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editing) return
      e.preventDefault()
      setQuickCol('ideas')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  const visible = mineOnly ? tasks.filter(t => t.owner_profile_id === profileId) : tasks
  const byCol = (key) => visible.filter(t => t.board_column === key)

  const dropOn = (colKey) => {
    if (!dragId.current) { setDragOver(null); return }
    const t = tasks.find(x => x.id === dragId.current)
    dragId.current = null
    setDragOver(null)
    if (t && t.board_column !== colKey) onMoveTo(t, colKey)
  }

  return (
    <div>
      {/* controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button onClick={() => setMineOnly(v => !v)} style={{ background: mineOnly ? 'rgba(var(--silver-rgb),.12)' : 'transparent', border: `1px solid ${mineOnly ? SILVER : HAIR_HI}`, color: mineOnly ? BONE : BONE_MID, borderRadius: '100px', padding: '6px 13px', fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer' }}>
          {mineOnly ? '● Mine only' : '○ Mine only'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {desktop && <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: FAINT, letterSpacing: '.14em', textTransform: 'uppercase' }}>N — quick add</span>}
          <Btn variant="solid" onClick={() => setQuickCol('ideas')}><Plus size={12} /> Task</Btn>
        </div>
      </div>

      {/* lanes — measured grid / snap row / phone swipe (see header comment) */}
      <div ref={laneWrap} className={desktop && (!grid || cols === 1) ? 'os-board-snap' : undefined}
        style={grid && cols > 1
          ? { display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: '18px', alignItems: 'start' }
          : desktop
            ? { display: 'flex', gap: '14px', overflowX: 'auto', alignItems: 'flex-start', paddingBottom: '10px' }
            : { display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', WebkitOverflowScrolling: 'touch' }}>
        {BOARD_COLUMNS.map((col, ci) => {
          const items = byCol(col.key)
          return (
            <section key={col.key} data-testid={`board-lane-${col.key}`} className={`${entrance ? 'os-reveal' : ''}${dragOver === col.key ? ' os-lane-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); if (dragOver !== col.key) setDragOver(col.key) }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null) }}
              onDrop={(e) => { e.preventDefault(); dropOn(col.key) }}
              style={{ ...(grid && cols > 1 ? { minWidth: 0 } : desktop ? { flex: `0 0 ${LANE_MIN}px`, minWidth: `${LANE_MIN - 20}px` } : { flex: '0 0 84%', maxWidth: '320px', minWidth: '240px' }), animationDelay: entrance ? `${ci * 70}ms` : undefined, background: PANEL, border: `1px solid ${HAIR}`, borderRadius: '12px', padding: '14px 14px 8px', transition: 'background .18s, border-color .18s' }}>
              {/* lane kicker — deck eyebrow with catalog number */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '11px', borderBottom: `1px solid ${HAIR_HI}` }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE, border: `1px solid ${HAIR_HI}`, padding: '2px 7px', borderRadius: '3px', letterSpacing: '.16em' }}>{String(ci + 1).padStart(2, '0')}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.26em', textTransform: 'uppercase' }}>{col.label}</span>
                <span aria-hidden style={{ flex: 1, height: '1px', background: `linear-gradient(90deg,${HAIR_HI},transparent)` }} />
                <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: FAINT }}>{String(items.length).padStart(2, '0')}</span>
                <button onClick={() => setQuickCol(col.key)} aria-label={`Add to ${col.label}`} style={{ background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: '2px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Plus size={13} /><span style={{ fontFamily: FONT_MONO, fontSize: '8px', letterSpacing: '.1em', textTransform: 'uppercase' }}>Add</span></button>
              </div>

              {/* quick add — inline, Enter saves, Esc closes */}
              {quickCol === col.key && (
                <QuickAdd onCancel={() => setQuickCol(null)}
                  onSave={(title) => { onCreate({ title, type: null, due_date: null, board_column: col.key }); setQuickCol(null) }} />
              )}

              {/* rows */}
              <div>
                {items.map((t, i) => (
                  <TaskRow key={t.id} task={t} owner={owners[t.owner_profile_id]} colKey={col.key} last={i === items.length - 1}
                    entrance={entrance}
                    delay={entrance ? ci * 70 + i * 35 : undefined}
                    members={members}
                    assignOpen={assignFor === t.id}
                    onAssignToggle={() => setAssignFor(cur => cur === t.id ? null : t.id)}
                    onAssign={(pid) => { setAssignFor(null); if (pid !== t.owner_profile_id) onUpdate(t.id, { owner_profile_id: pid }) }}
                    onDragStart={() => { dragId.current = t.id }}
                    onDragEnd={() => { dragId.current = null; setDragOver(null) }}
                    onEdit={() => setEditing({ mode: 'edit', task: t })}
                    onShip={() => onMoveTo(t, 'done')}
                    onReopen={() => onMoveTo(t, 'this_week')}
                    onArrow={(dir) => {
                      const ni = Math.max(0, Math.min(BOARD_COLUMNS.length - 1, ci + dir))
                      if (ni !== ci) onMoveTo(t, BOARD_COLUMNS[ni].key)
                    }}
                    onDelete={onDelete} />
                ))}
                {items.length === 0 && quickCol !== col.key && (
                  <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: FAINT, letterSpacing: '.1em', padding: '18px 2px', textTransform: 'lowercase' }}>{EMPTY_LINE[col.key]}</div>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {editing && (
        <TaskEditor entry={editing} members={members} onClose={() => setEditing(null)}
          onSave={(fields) => { onUpdate(editing.task.id, fields); setEditing(null) }} />
      )}
    </div>
  )
}

function QuickAdd({ onSave, onCancel }) {
  const [v, setV] = useState('')
  return (
    <div style={{ padding: '10px 0 4px' }}>
      <input autoFocus value={v} placeholder="Title, then Enter…"
        onChange={e => setV(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && v.trim()) { onSave(v.trim()) }
          else if (e.key === 'Escape') onCancel()
        }}
        onBlur={() => { if (!v.trim()) onCancel() }}
        style={{ width: '100%', background: CARD_HI, border: `1px solid ${HAIR_HI}`, borderRadius: '8px', padding: '8px 10px', color: BONE, fontFamily: FONT_SANS, fontSize: '13px', outline: 'none' }} />
    </div>
  )
}

/* one face, tiny — the assign control and the menu rows share it */
function Face({ p, size = 18 }) {
  const name = p?.full_name || p?.username || '?'
  const avatar = safeImg(p?.avatar_url)
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, background: VOID, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {avatar
        ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: `${Math.round(size * 0.55)}px`, color: BONE, lineHeight: 1 }}>{name[0].toUpperCase()}</span>}
    </span>
  )
}

/* entrance — first visit: the row enters on the lane's stagger (`delay`).
   Otherwise it SETTLES: the keyframe fires when the node mounts, which is
   exactly the move/create case — the card the member just acted on is there
   instantly, with a scale + border pulse instead of a fade from nowhere. */
function TaskRow({ task, owner, colKey, last, entrance, delay, members, assignOpen, onAssignToggle, onAssign, onDragStart, onDragEnd, onEdit, onShip, onReopen, onArrow, onDelete }) {
  const [dragging, setDragging] = useState(false)
  const chipRef = useRef(null)
  const idx = BOARD_COLUMNS.findIndex(c => c.key === colKey)
  const due = task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
  const done = colKey === 'done'
  const meta = [due && `◇ ${due}`, task.type].filter(Boolean).join(' · ')
  // first name on the chip — the due date and tag are operative information
  // and must never lose to a long full name (panel catch, Ley 5)
  const ownerFull = owner?.full_name || owner?.username || ''
  const ownerName = ownerFull.split(' ')[0]
  return (
    <div className={`os-card ${entrance ? 'os-reveal-fast' : 'os-settle'}${dragging ? ' os-dragging' : ''}`} tabIndex={0}
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); setDragging(true) }}
      onDragEnd={() => { setDragging(false); onDragEnd() }}
      style={{ position: 'relative', padding: '11px 4px 10px', borderBottom: last ? 'none' : `1px solid ${HAIR}`, animationDelay: entrance ? `${delay}ms` : undefined, cursor: 'grab', borderRadius: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        {/* SHIP / REOPEN — the one-tap gesture that makes the board a tool:
            a card closes (or comes back) without opening anything */}
        <button data-testid={done ? 'board-reopen' : 'board-ship'}
          onClick={done ? onReopen : onShip}
          aria-label={done ? 'Reopen' : 'Ship it'} title={done ? 'Reopen' : 'Ship it'}
          style={{ marginTop: '1px', width: '18px', height: '18px', flexShrink: 0, borderRadius: '50%', border: `1px solid ${done ? SILVER : HAIR_HI}`, background: done ? 'rgba(var(--silver-rgb),.14)' : 'transparent', color: done ? STAR : BONE_LOW, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'border-color .15s, background .15s, color .15s' }}
          onMouseOver={(e) => { if (!done) { e.currentTarget.style.borderColor = SILVER; e.currentTarget.style.color = STAR } }}
          onMouseOut={(e) => { if (!done) { e.currentTarget.style.borderColor = HAIR_HI; e.currentTarget.style.color = BONE_LOW } }}>
          {done ? <RotateCcw size={9} /> : <Check size={11} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '13.5px', color: done ? BONE_MID : BONE, lineHeight: 1.4, ...(done ? { textDecoration: 'line-through', textDecorationColor: 'rgba(var(--silver-rgb),.4)' } : {}) }}>{task.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px', minWidth: 0 }}>
            {/* ASSIGN — the owner chip is a control, not a caption */}
            <button ref={chipRef} data-testid="board-assign" onClick={onAssignToggle} title={ownerFull ? `Assign · ${ownerFull}` : 'Assign'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', minWidth: 0 }}>
              <Face p={owner} size={16} />
              <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: ownerName ? BONE_MID : FAINT, letterSpacing: '.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                {ownerName || 'assign'}
              </span>
            </button>
            {meta && <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.07em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{done ? `✕ shipped · ${meta}` : meta}</span>}
            {done && !meta && <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.07em', textTransform: 'uppercase' }}>✕ shipped</span>}
          </div>
        </div>
        <div className="os-actions" style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0, marginTop: '-1px' }}>
          <IconBtn disabled={idx <= 0} onClick={() => onArrow(-1)} label="Move left"><ChevronLeft size={13} /></IconBtn>
          <IconBtn disabled={idx >= BOARD_COLUMNS.length - 1} onClick={() => onArrow(1)} label="Move right"><ChevronRight size={13} /></IconBtn>
          <IconBtn onClick={onEdit} label="Edit" text="Edit"><Pencil size={11} /></IconBtn>
          <IconBtn onClick={() => { if (confirm(`Delete "${task.title}"?`)) onDelete(task) }} label="Delete" text="Del"><Trash2 size={11} /></IconBtn>
        </div>
      </div>

      {/* the team, one tap away — PORTALED to body: cards and lanes carry
          forwards-filled reveal transforms (containing blocks for fixed) and
          overflow scrollers that would trap or clip an inline menu (review
          catches ×3). The portal escapes all of it. */}
      {assignOpen && chipRef.current && createPortal(
        <AssignMenu anchor={chipRef.current} members={members} currentId={task.owner_profile_id}
          onPick={onAssign} onClose={onAssignToggle} />,
        document.body
      )}
    </div>
  )
}

/* the assign menu — fixed to the viewport, anchored to the chip's rect,
   flipping upward when the chip sits in the lower third */
function AssignMenu({ anchor, members, currentId, onPick, onClose }) {
  const rect = anchor.getBoundingClientRect()
  const MENU_W = 230
  const MENU_H = Math.min(260, 44 * Math.max(1, members.length + 1) + 12)
  const openUp = rect.bottom + MENU_H + 8 > window.innerHeight
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - MENU_W - 8))
  const pos = openUp
    ? { left, bottom: window.innerHeight - rect.top + 6 }
    : { left, top: rect.bottom + 6 }
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10001 }} />
      <div data-testid="board-owner-menu" role="menu" className="menu-in" style={{ position: 'fixed', ...pos, zIndex: 10002, width: `${MENU_W}px`, maxHeight: '260px', overflowY: 'auto', background: 'var(--menu-bg)', border: `1px solid ${HAIR_HI}`, borderRadius: '12px', padding: '6px', boxShadow: '0 18px 50px rgba(var(--shadow-rgb),.6)', transformOrigin: openUp ? 'left bottom' : 'left top' }}>
        {members.map(m => {
          const name = m.full_name || m.username
          const mine = m.id === currentId
          return (
            <button key={m.id} role="menuitem" onClick={() => onPick(m.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '9px', width: '100%', textAlign: 'left', background: mine ? 'rgba(var(--silver-rgb),.1)' : 'transparent', border: 'none', borderRadius: '8px', padding: '7px 9px', cursor: 'pointer' }}
              onMouseOver={(e) => { if (!mine) e.currentTarget.style.background = 'rgba(var(--ink-rgb),.05)' }}
              onMouseOut={(e) => { if (!mine) e.currentTarget.style.background = 'transparent' }}>
              <Face p={m} size={20} />
              <span style={{ flex: 1, minWidth: 0, fontFamily: FONT_SANS, fontSize: '12.5px', color: BONE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
              {mine && <Check size={12} style={{ color: STAR, flexShrink: 0 }} />}
            </button>
          )
        })}
        {currentId && (
          <button role="menuitem" onClick={() => onPick(null)}
            style={{ display: 'flex', alignItems: 'center', gap: '9px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderTop: `1px solid ${HAIR}`, borderRadius: '0 0 8px 8px', padding: '8px 9px', cursor: 'pointer', color: BONE_LOW, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.12em', textTransform: 'uppercase' }}>
            unassign
          </button>
        )}
        {members.length === 0 && (
          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: FAINT, padding: '10px', letterSpacing: '.08em' }}>no members loaded</div>
        )}
      </div>
    </>
  )
}

/* `text` renders the action's word next to its icon — actions read, not
   just glyph (legibility > minimalism). Directional chevrons stay wordless. */
function IconBtn({ children, onClick, disabled, label, text }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label} style={{ background: 'transparent', border: 'none', color: disabled ? 'rgba(131,131,143,.3)' : BONE_LOW, cursor: disabled ? 'default' : 'pointer', padding: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '5px' }}>
      {children}
      {text && <span style={{ fontFamily: FONT_MONO, fontSize: '8px', letterSpacing: '.1em', textTransform: 'uppercase' }}>{text}</span>}
    </button>
  )
}

function TaskEditor({ entry, members, onClose, onSave }) {
  const t = entry.task || {}
  const [title, setTitle] = useState(t.title || '')
  const [type, setType] = useState(t.type || '')
  const [due, setDue] = useState(t.due_date || '')
  const [col, setCol] = useState(t.board_column || 'ideas')
  const [ownerId, setOwnerId] = useState(t.owner_profile_id || '')
  const valid = title.trim().length > 0
  const save = () => { if (valid) onSave({ title: title.trim(), type: type.trim() || null, due_date: due || null, board_column: col, owner_profile_id: ownerId || null }) }

  return (
    <Modal title="Edit task" onClose={onClose} onEnter={save}
      footer={<>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
        <Btn variant="solid" disabled={!valid} onClick={save} style={{ flex: 1 }}>Save</Btn>
      </>}>
      <Field label="Title"><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to happen…" autoFocus /></Field>
      <Field label="Type"><Input value={type} onChange={e => setType(e.target.value)} placeholder="venue · content · marketing · ops" /></Field>
      <Field label="Owner">
        {/* an owner outside the member list (retired/demo) still shows as a
            real option — what you see is what saves (review catch) */}
        <Select value={ownerId} onChange={e => setOwnerId(e.target.value)}
          options={[
            { value: '', label: 'Unassigned' },
            ...(ownerId && !members.some(m => m.id === ownerId) ? [{ value: ownerId, label: 'former member' }] : []),
            ...members.map(m => ({ value: m.id, label: m.full_name || m.username })),
          ]} />
      </Field>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}><Field label="Due date"><Input type="date" value={due} onChange={e => setDue(e.target.value)} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Column"><Select value={col} onChange={e => setCol(e.target.value)} options={BOARD_COLUMNS.map(c => ({ value: c.key, label: c.label }))} /></Field></div>
      </div>
    </Modal>
  )
}
