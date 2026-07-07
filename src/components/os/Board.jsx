import { useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Trash2, Plus } from 'lucide-react'
import { BOARD_COLUMNS, COLUMN_LABEL, BONE, BONE_MID, BONE_LOW, SILVER, STAR, CARD, HAIR, HAIR_HI, FONT_MONO, FONT_SANS, FONT_DISPLAY, chromeText } from '@/lib/cosmos'
import { Modal, Field, Input, Select, Btn, OwnerChip } from './ui'

export default function Board({ tasks, profileId, owners, onCreate, onUpdate, onMove, onDelete }) {
  const [mineOnly, setMineOnly] = useState(false)
  const [editing, setEditing] = useState(null)  // { mode, task }

  const visible = mineOnly ? tasks.filter(t => t.owner_profile_id === profileId) : tasks
  const byCol = (key) => visible.filter(t => t.board_column === key)

  return (
    <div>
      {/* controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <button onClick={() => setMineOnly(v => !v)} style={{ background: mineOnly ? 'rgba(199,201,209,.12)' : 'transparent', border: `1px solid ${mineOnly ? SILVER : HAIR_HI}`, color: mineOnly ? BONE : BONE_MID, borderRadius: '100px', padding: '7px 14px', fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer' }}>
          {mineOnly ? '● Mine only' : '○ Mine only'}
        </button>
        <Btn variant="solid" onClick={() => setEditing({ mode: 'new', task: { board_column: 'ideas' } })}><Plus size={12} /> Task</Btn>
      </div>

      {/* columns — horizontal scroll on mobile, each a lane */}
      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', WebkitOverflowScrolling: 'touch' }}>
        {BOARD_COLUMNS.map(col => {
          const items = byCol(col.key)
          return (
            <div key={col.key} style={{ flex: '0 0 84%', maxWidth: '320px', minWidth: '240px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_MID, letterSpacing: '.18em', textTransform: 'uppercase' }}>{col.label}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW }}>{String(items.length).padStart(2, '0')}</span>
                <div style={{ flex: 1, height: '1px', background: HAIR }} />
                <button onClick={() => setEditing({ mode: 'new', task: { board_column: col.key } })} aria-label="Add" style={{ background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: 0, display: 'inline-flex' }}><Plus size={14} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {items.map(t => (
                  <TaskCard key={t.id} task={t} owner={owners[t.owner_profile_id]} colKey={col.key}
                    onEdit={() => setEditing({ mode: 'edit', task: t })}
                    onMove={onMove} onDelete={onDelete} />
                ))}
                {items.length === 0 && <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: 'rgba(91,89,82,.6)', letterSpacing: '.08em', padding: '14px 0', textAlign: 'center' }}>—</div>}
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

function TaskCard({ task, owner, colKey, onEdit, onMove, onDelete }) {
  const idx = BOARD_COLUMNS.findIndex(c => c.key === colKey)
  const due = task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
  return (
    <div style={{ border: `1px solid ${HAIR}`, background: CARD, borderRadius: '12px', padding: '11px 12px' }}>
      <div style={{ fontFamily: FONT_SANS, fontSize: '13.5px', color: BONE, lineHeight: 1.35, marginBottom: '9px' }}>{task.title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '9px' }}>
        {task.type && <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: BONE_MID, letterSpacing: '.1em', textTransform: 'uppercase', border: `1px solid ${HAIR}`, borderRadius: '4px', padding: '2px 6px' }}>{task.type}</span>}
        {due && <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: STAR, letterSpacing: '.06em' }}>◇ {due}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <OwnerChip owner={owner} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
          <IconBtn disabled={idx <= 0} onClick={() => onMove(task, -1)} label="Move left"><ChevronLeft size={14} /></IconBtn>
          <IconBtn disabled={idx >= BOARD_COLUMNS.length - 1} onClick={() => onMove(task, 1)} label="Move right"><ChevronRight size={14} /></IconBtn>
          <IconBtn onClick={onEdit} label="Edit"><Pencil size={12} /></IconBtn>
          <IconBtn onClick={() => { if (confirm(`Delete "${task.title}"?`)) onDelete(task) }} label="Delete"><Trash2 size={12} /></IconBtn>
        </div>
      </div>
    </div>
  )
}

function IconBtn({ children, onClick, disabled, label }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} style={{ background: 'transparent', border: 'none', color: disabled ? 'rgba(91,89,82,.4)' : BONE_LOW, cursor: disabled ? 'default' : 'pointer', padding: '5px', display: 'inline-flex', borderRadius: '6px' }}>
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

  return (
    <Modal title={entry.mode === 'new' ? 'New task' : 'Edit task'} onClose={onClose}
      footer={<>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
        <Btn variant="solid" disabled={!valid} onClick={() => onSave({ title: title.trim(), type: type.trim() || null, due_date: due || null, board_column: col })} style={{ flex: 1 }}>Save</Btn>
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
