import { useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { CONTENT_FORMATS, CONTENT_STATUSES, BONE, BONE_MID, BONE_LOW, SILVER, STAR, CARD, HAIR, HAIR_HI, FONT_MONO, FONT_SANS } from '@/lib/cosmos'
import { Modal, Field, Input, Textarea, Select, Btn, OwnerChip } from './ui'

export default function ContentEngine({ content, owners, onCreate, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(null)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '14px' }}>
        <Btn variant="solid" onClick={() => setEditing({ mode: 'new', item: { format: 'iPhone raw', status: 'idea' } })}><Plus size={12} /> Content</Btn>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {content.map(c => (
          <div key={c.id} style={{ border: `1px solid ${HAIR}`, background: CARD, borderRadius: '13px', padding: '14px 15px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: FONT_SANS, fontSize: '15px', color: BONE, lineHeight: 1.3 }}>{c.title}</div>
                {c.concept && <div style={{ fontFamily: FONT_SANS, fontSize: '12.5px', color: BONE_MID, lineHeight: 1.45, marginTop: '5px' }}>{c.concept}</div>}
              </div>
              <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                <button onClick={() => setEditing({ mode: 'edit', item: c })} aria-label="Edit" style={iconBtn}><Pencil size={12} /></button>
                <button onClick={() => { if (confirm(`Delete "${c.title}"?`)) onDelete(c) }} aria-label="Delete" style={iconBtn}><Trash2 size={12} /></button>
              </div>
            </div>
            {c.caption && <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: BONE_LOW, lineHeight: 1.5, marginTop: '10px', paddingLeft: '10px', borderLeft: `1px solid ${HAIR_HI}` }}>{c.caption}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '11px' }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: BONE_MID, letterSpacing: '.1em', textTransform: 'uppercase', border: `1px solid ${HAIR}`, borderRadius: '4px', padding: '2px 7px' }}>{c.format || '—'}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: c.status === 'posted' ? STAR : BONE_LOW, letterSpacing: '.1em', textTransform: 'uppercase' }}>● {c.status}</span>
              {c.planned_date && <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: STAR, letterSpacing: '.06em' }}>◇ {new Date(c.planned_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
              <div style={{ flex: 1 }} />
              <OwnerChip owner={owners[c.owner_profile_id]} />
            </div>
          </div>
        ))}
        {content.length === 0 && <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.1em', textAlign: 'center', padding: '40px 0' }}>NO CONTENT YET</div>}
      </div>

      {editing && (
        <ContentEditor entry={editing} onClose={() => setEditing(null)}
          onSave={(fields) => { editing.mode === 'new' ? onCreate(fields) : onUpdate(editing.item.id, fields); setEditing(null) }} />
      )}
    </div>
  )
}

const iconBtn = { background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: '5px', display: 'inline-flex' }

function ContentEditor({ entry, onClose, onSave }) {
  const c = entry.item || {}
  const [title, setTitle] = useState(c.title || '')
  const [format, setFormat] = useState(c.format || 'iPhone raw')
  const [concept, setConcept] = useState(c.concept || '')
  const [caption, setCaption] = useState(c.caption || '')
  const [status, setStatus] = useState(c.status || 'idea')
  const [planned, setPlanned] = useState(c.planned_date || '')
  const valid = title.trim().length > 0

  return (
    <Modal title={entry.mode === 'new' ? 'New content' : 'Edit content'} onClose={onClose}
      footer={<>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
        <Btn variant="solid" disabled={!valid} onClick={() => onSave({ title: title.trim(), format, concept: concept.trim() || null, caption: caption.trim() || null, status, planned_date: planned || null })} style={{ flex: 1 }}>Save</Btn>
      </>}>
      <Field label="Title"><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Working title…" autoFocus /></Field>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}><Field label="Format"><Select value={format} onChange={e => setFormat(e.target.value)} options={CONTENT_FORMATS} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Status"><Select value={status} onChange={e => setStatus(e.target.value)} options={CONTENT_STATUSES} /></Field></div>
      </div>
      <Field label="Concept"><Textarea value={concept} onChange={e => setConcept(e.target.value)} placeholder="The idea in one or two lines…" /></Field>
      <Field label="Caption"><Textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Draft caption…" /></Field>
      <Field label="Planned date"><Input type="date" value={planned} onChange={e => setPlanned(e.target.value)} /></Field>
    </Modal>
  )
}
