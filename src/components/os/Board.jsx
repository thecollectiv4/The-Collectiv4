import { useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Trash2, Plus } from 'lucide-react'
import { BOARD_COLUMNS, BONE, BONE_MID, BONE_LOW, SILVER, STAR, CARD, HAIR, HAIR_HI, FONT_MONO, FONT_SANS } from '@/lib/cosmos'
import { useIsDesktop } from '@/lib/useIsDesktop'
import { Modal, Field, Input, Select, Btn, OwnerChip } from './ui'

/* Board — §E density: work-instrument rows, not brochure cards. Desktop shows
   all four lanes in one grid (no horizontal scroll, no truncation); mobile
   keeps swipeable lanes. Hover reveals actions; empty lanes state it honestly. */

const EMPTY_LINE = {
  ideas: 'no ideas parked yet',
  this_week: 'nothing pulled in yet',
  in_motion: 'nothing moving yet',
  done: 'nothing shipped yet',
}

export default function Board({ tasks, profileId, owners, onCreate, onUpdate, onMove, onDelete }) {
  const desktop = useIsDesktop()
  const [mineOnly, setMineOnly] = useState(false)
  const [editing, setEditing] = useState(null)  // { mode, task }

  const visible = mineOnly ? tasks.filter(t => t.owner_profile_id === profileId) : tasks
  const byCol = (key) => visible.filter(t => t.board_column === key)

  return (
    <div>
      {/* controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: desktop ? '16px' : '14px' }}>
        <button onClick={() => setMineOnly(v => !v)} style={{ background: mineOnly ? 'rgba(199,201,209,.12)' : 'transparent', border: `1px solid ${mineOnly ? SILVER : HAIR_HI}`, color: mineOnly ? BONE : BONE_MID, borderRadius: '100px', padding: '6px 13px', fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer' }}>
          {mineOnly ? '● Mine only' : '○ Mine only'}
        </button>
        <Btn variant="solid" onClick={() => setEditing({ mode: 'new', task: { board_column: 'ideas' } })}><Plus size={12} /> Task</Btn>
      </div>

      {/* lanes — desktop: one grid, all four visible; mobile: swipeable */}
      <div style={desktop
        ? { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px', alignItems: 'start' }
        : { display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', WebkitOverflowScrolling: 'touch' }}>
        {BOARD_COLUMNS.map((col, ci) => {
          const items = byCol(col.key)
          return (
            <div key={col.key} className="os-reveal" style={{ ...(desktop ? { minWidth: 0 } : { flex: '0 0 84%', maxWidth: '320px', minWidth: '240px' }), animationDelay: `${ci * 45}ms` }}>
              {/* lane header — mono kicker over a hairline */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', paddingBottom: '9px', borderBottom: `1px solid ${HAIR_HI}`, marginBottom: '4px' }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_MID, letterSpacing: '.2em', textTransform: 'uppercase' }}>{col.label}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW }}>{String(items.length).padStart(2, '0')}</span>
                <div style={{ flex: 1 }} />
                <button onClick={() => setEditing({ mode: 'new', task: { board_column: col.key } })} aria-label={`Add to ${col.label}`} style={{ background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: '2px', display: 'inline-flex' }}><Plus size={13} /></button>
              </div>
              {/* rows, separated by hairlines */}
              <div>
                {items.map((t, i) => (
                  <TaskRow key={t.id} task={t} owner={owners[t.owner_profile_id]} colKey={col.key} last={i === items.length - 1}
                    delay={ci * 45 + i * 30}
                    onEdit={() => setEditing({ mode: 'edit', task: t })}
                    onMove={onMove} onDelete={onDelete} />
                ))}
                {items.length === 0 && (
                  <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: 'rgba(91,89,82,.75)', letterSpacing: '.1em', padding: '18px 2px', textTransform: 'lowercase' }}>{EMPTY_LINE[col.key]}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {editing && (
        <TaskEditor entry={editing} onClose={() => setEditing(null)}
          onSave={(fields) => { editing.mode === 'new' ? onCreate(fields) : onUpdate(editing.task.id, fields); setEditing(null) }} />
      )}
    </div>
  )
}

function TaskRow({ task, owner, colKey, last, delay, onEdit, onMove, onDelete }) {
  const idx = BOARD_COLUMNS.findIndex(c => c.key === colKey)
  const due = task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
  const done = colKey === 'done'
  const meta = [owner?.full_name || owner?.username || 'unassigned', task.type, due && `◇ ${due}`].filter(Boolean).join(' · ')
  return (
    <div className="os-card os-reveal" tabIndex={0} style={{ padding: '10px 2px 9px', borderBottom: last ? 'none' : `1px solid ${HAIR}`, animationDelay: `${delay}ms` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '13px', color: done ? BONE_MID : BONE, lineHeight: 1.35 }}>{task.title}</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: '8.5px', color: BONE_LOW, letterSpacing: '.07em', textTransform: 'uppercase', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {done ? `✕ shipped · ${meta}` : meta}
          </div>
        </div>
        {/* actions — revealed on hover / focus, always on touch */}
        <div className="os-actions" style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0, marginTop: '-1px' }}>
          <IconBtn disabled={idx <= 0} onClick={() => onMove(task, -1)} label="Move left"><ChevronLeft size={13} /></IconBtn>
          <IconBtn disabled={idx >= BOARD_COLUMNS.length - 1} onClick={() => onMove(task, 1)} label="Move right"><ChevronRight size={13} /></IconBtn>
          <IconBtn onClick={onEdit} label="Edit"><Pencil size={11} /></IconBtn>
          <IconBtn onClick={() => { if (confirm(`Delete "${task.title}"?`)) onDelete(task) }} label="Delete"><Trash2 size={11} /></IconBtn>
        </div>
      </div>
    </div>
  )
}

function IconBtn({ children, onClick, disabled, label }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label} style={{ background: 'transparent', border: 'none', color: disabled ? 'rgba(91,89,82,.35)' : BONE_LOW, cursor: disabled ? 'default' : 'pointer', padding: '4px', display: 'inline-flex', borderRadius: '5px' }}>
      {children}
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
    <Modal title={entry.mode === 'new' ? 'New task' : 'Edit task'} onClose={onClose} onEnter={save}
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
