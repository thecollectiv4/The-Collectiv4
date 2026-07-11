import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Trash2, Plus } from 'lucide-react'
import { BOARD_COLUMNS, BONE, BONE_MID, BONE_LOW, FAINT, SILVER, STAR, HAIR, HAIR_HI, PANEL, CARD_HI, FONT_MONO, FONT_SANS } from '@/lib/cosmos'
import { useIsDesktop, useBoardGrid } from '@/lib/useIsDesktop'
import { Modal, Field, Input, Select, Btn } from './ui'

/* Board — the deck's catalog language on a working surface. Four numbered
   lanes ("◇ 01 IDEAS ——"); §E instrument rows; drag a card between lanes
   (arrows remain as the fallback), quick-add inline (the N key opens it),
   everything optimistic. Three width modes: >=1100px the four lanes fit as a
   grid; 768–1100px they become a horizontal snap-scroll row (full-width
   columns, never squashed); <768px keeps the phone swipe lanes. */

const EMPTY_LINE = {
  ideas: 'no ideas parked yet',
  this_week: 'nothing pulled in yet',
  in_motion: 'nothing moving yet',
  done: 'nothing shipped yet',
}

export default function Board({ tasks, profileId, owners, onCreate, onUpdate, onMoveTo, onDelete }) {
  const desktop = useIsDesktop()   // >=768 — instrument shell
  const grid = useBoardGrid()      // >=1100 — four lanes fit side by side
  const [mineOnly, setMineOnly] = useState(false)
  const [editing, setEditing] = useState(null)     // { mode, task }
  const [quickCol, setQuickCol] = useState(null)   // column key with quick-add open
  const [dragOver, setDragOver] = useState(null)   // column key under the dragged card
  const dragId = useRef(null)

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
        <button onClick={() => setMineOnly(v => !v)} style={{ background: mineOnly ? 'rgba(199,201,209,.12)' : 'transparent', border: `1px solid ${mineOnly ? SILVER : HAIR_HI}`, color: mineOnly ? BONE : BONE_MID, borderRadius: '100px', padding: '6px 13px', fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer' }}>
          {mineOnly ? '● Mine only' : '○ Mine only'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {desktop && <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: FAINT, letterSpacing: '.14em', textTransform: 'uppercase' }}>N — quick add</span>}
          <Btn variant="solid" onClick={() => setQuickCol('ideas')}><Plus size={12} /> Task</Btn>
        </div>
      </div>

      {/* lanes — grid / snap row / phone swipe (see header comment) */}
      <div className={desktop && !grid ? 'os-board-snap' : undefined}
        style={grid
          ? { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '18px', alignItems: 'start' }
          : desktop
            ? { display: 'flex', gap: '14px', overflowX: 'auto', alignItems: 'flex-start', paddingBottom: '10px' }
            : { display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', WebkitOverflowScrolling: 'touch' }}>
        {BOARD_COLUMNS.map((col, ci) => {
          const items = byCol(col.key)
          return (
            <section key={col.key} className={`os-reveal${dragOver === col.key ? ' os-lane-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); if (dragOver !== col.key) setDragOver(col.key) }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null) }}
              onDrop={(e) => { e.preventDefault(); dropOn(col.key) }}
              style={{ ...(grid ? { minWidth: 0 } : desktop ? { flex: '0 0 300px', minWidth: '280px' } : { flex: '0 0 84%', maxWidth: '320px', minWidth: '240px' }), animationDelay: `${ci * 70}ms`, background: PANEL, border: `1px solid ${HAIR}`, borderRadius: '12px', padding: '14px 14px 8px', transition: 'background .18s, border-color .18s' }}>
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
                    delay={ci * 70 + i * 35}
                    onDragStart={() => { dragId.current = t.id }}
                    onDragEnd={() => { dragId.current = null; setDragOver(null) }}
                    onEdit={() => setEditing({ mode: 'edit', task: t })}
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
        <TaskEditor entry={editing} onClose={() => setEditing(null)}
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

function TaskRow({ task, owner, colKey, last, delay, onDragStart, onDragEnd, onEdit, onArrow, onDelete }) {
  const [dragging, setDragging] = useState(false)
  const idx = BOARD_COLUMNS.findIndex(c => c.key === colKey)
  const due = task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
  const done = colKey === 'done'
  const meta = [due && `◇ ${due}`, task.type, owner?.full_name || owner?.username || 'unassigned'].filter(Boolean).join(' · ')
  return (
    <div className={`os-card os-reveal-fast${dragging ? ' os-dragging' : ''}`} tabIndex={0}
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); setDragging(true) }}
      onDragEnd={() => { setDragging(false); onDragEnd() }}
      style={{ padding: '10px 4px 9px', borderBottom: last ? 'none' : `1px solid ${HAIR}`, animationDelay: `${delay}ms`, cursor: 'grab', borderRadius: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '13px', color: done ? BONE_MID : BONE, lineHeight: 1.35 }}>{task.title}</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.07em', textTransform: 'uppercase', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {done ? `✕ shipped · ${meta}` : meta}
          </div>
        </div>
        <div className="os-actions" style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0, marginTop: '-1px' }}>
          <IconBtn disabled={idx <= 0} onClick={() => onArrow(-1)} label="Move left"><ChevronLeft size={13} /></IconBtn>
          <IconBtn disabled={idx >= BOARD_COLUMNS.length - 1} onClick={() => onArrow(1)} label="Move right"><ChevronRight size={13} /></IconBtn>
          <IconBtn onClick={onEdit} label="Edit" text="Edit"><Pencil size={11} /></IconBtn>
          <IconBtn onClick={() => { if (confirm(`Delete "${task.title}"?`)) onDelete(task) }} label="Delete" text="Del"><Trash2 size={11} /></IconBtn>
        </div>
      </div>
    </div>
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

function TaskEditor({ entry, onClose, onSave }) {
  const t = entry.task || {}
  const [title, setTitle] = useState(t.title || '')
  const [type, setType] = useState(t.type || '')
  const [due, setDue] = useState(t.due_date || '')
  const [col, setCol] = useState(t.board_column || 'ideas')
  const valid = title.trim().length > 0
  const save = () => { if (valid) onSave({ title: title.trim(), type: type.trim() || null, due_date: due || null, board_column: col }) }

  return (
    <Modal title="Edit task" onClose={onClose} onEnter={save}
      footer={<>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
        <Btn variant="solid" disabled={!valid} onClick={save} style={{ flex: 1 }}>Save</Btn>
      </>}>
      <Field label="Title"><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to happen…" autoFocus /></Field>
      <Field label="Type"><Input value={type} onChange={e => setType(e.target.value)} placeholder="venue · content · marketing · ops" /></Field>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}><Field label="Due date"><Input type="date" value={due} onChange={e => setDue(e.target.value)} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Column"><Select value={col} onChange={e => setCol(e.target.value)} options={BOARD_COLUMNS.map(c => ({ value: c.key, label: c.label }))} /></Field></div>
      </div>
    </Modal>
  )
}
