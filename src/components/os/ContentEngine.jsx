import { useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { CONTENT_FORMATS, CONTENT_STATUSES, BONE, BONE_MID, BONE_LOW, STAR, PANEL, HAIR, HAIR_HI, FONT_MONO, FONT_SANS } from '@/lib/cosmos'
import { useIsDesktop } from '@/lib/useIsDesktop'
import { Modal, Field, Input, Textarea, Select, Btn, OwnerChip, Chip } from './ui'

/* Content Engine — §E density. Desktop lays cards in a 2-up grid so the width
   works; status is stated in mono (posted = solid bone, everything else = ash). */

/* entrance — the staged reveal is a first-visit welcome (OS.jsx owns the
   per-session bookkeeping); a re-entry finds the pipeline already there. */
export default function ContentEngine({ content, owners, entrance, onCreate, onUpdate, onDelete }) {
  const desktop = useIsDesktop()
  const [editing, setEditing] = useState(null)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '14px' }}>
        <Btn variant="solid" onClick={() => setEditing({ mode: 'new', item: { format: 'iPhone raw', status: 'idea' } })}><Plus size={12} /> Content</Btn>
      </div>

      <div style={desktop
        ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '14px', alignItems: 'start' }
        : { display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {content.map((c, i) => (
          <div key={c.id} className={`os-card${entrance ? ' os-reveal' : ''}`} tabIndex={0} style={{ border: `1px solid ${HAIR}`, background: PANEL, borderRadius: '12px', padding: '13px 14px', animationDelay: entrance ? `${i * 45}ms` : undefined, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: FONT_SANS, fontSize: '14px', color: BONE, lineHeight: 1.3 }}>{c.title}</div>
                {c.concept && <div style={{ fontFamily: FONT_SANS, fontSize: '12px', color: BONE_MID, lineHeight: 1.45, marginTop: '4px' }}>{c.concept}</div>}
              </div>
              <div className="os-actions" style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                <button onClick={() => setEditing({ mode: 'edit', item: c })} aria-label="Edit" style={iconBtn}><Pencil size={11} /><span style={btnWord}>Edit</span></button>
                <button onClick={() => { if (confirm(`Delete "${c.title}"?`)) onDelete(c) }} aria-label="Delete" style={iconBtn}><Trash2 size={11} /><span style={btnWord}>Del</span></button>
              </div>
            </div>
            {c.caption && <div style={{ fontFamily: FONT_MONO, fontSize: '10.5px', color: BONE_LOW, lineHeight: 1.5, marginTop: '9px', paddingLeft: '10px', borderLeft: `1px solid ${HAIR_HI}`, overflowWrap: 'anywhere' }}>{c.caption}</div>}
            {c.brief && <Brief brief={c.brief} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '10px', paddingTop: '9px', borderTop: `1px solid ${HAIR}` }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: BONE_MID, letterSpacing: '.1em', textTransform: 'uppercase' }}>{c.format || 'format?'}</span>
              {/* status is an inline chip — click cycles, no modal */}
              <Chip value={c.status} options={CONTENT_STATUSES} solid={c.status === 'posted'} title="Click to advance status"
                onPick={(s) => onUpdate(c.id, { status: s })} />
              {c.planned_date && <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: STAR, letterSpacing: '.06em' }}>◇ {new Date(c.planned_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
              <div style={{ flex: 1 }} />
              <OwnerChip owner={owners[c.owner_profile_id]} size={17} />
            </div>
          </div>
        ))}
        {content.length === 0 && (
          <div style={{ gridColumn: '1 / -1', fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.1em', textAlign: 'center', padding: '48px 0' }}>
            no content in the pipeline — capture the first concept
          </div>
        )}
      </div>

      {editing && (
        <ContentEditor entry={editing} onClose={() => setEditing(null)}
          onSave={(fields) => { editing.mode === 'new' ? onCreate(fields) : onUpdate(editing.item.id, fields); setEditing(null) }} />
      )}
    </div>
  )
}

const iconBtn = { background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }
// the action's word next to its icon — actions read, not just glyph
const btnWord = { fontFamily: FONT_MONO, fontSize: '8px', letterSpacing: '.1em', textTransform: 'uppercase' }

/* Brief — long structured creative brief (nullable os_content.brief). Collapsed
   by default so the card grid keeps §E density; expands inline, mono, hairline. */
function Brief({ brief }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginTop: '9px' }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '4px', padding: '3px 9px', color: BONE_MID, fontFamily: FONT_MONO, fontSize: '8px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer' }}>
        {open ? '◇ hide brief' : '◇ view brief'}
      </button>
      {open && (
        <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, lineHeight: 1.6, marginTop: '8px', paddingLeft: '10px', borderLeft: `1px solid ${HAIR_HI}`, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: '260px', overflowY: 'auto' }}>
          {brief}
        </div>
      )}
    </div>
  )
}

function ContentEditor({ entry, onClose, onSave }) {
  const c = entry.item || {}
  const [title, setTitle] = useState(c.title || '')
  const [format, setFormat] = useState(c.format || 'iPhone raw')
  const [concept, setConcept] = useState(c.concept || '')
  const [caption, setCaption] = useState(c.caption || '')
  const [status, setStatus] = useState(c.status || 'idea')
  const [planned, setPlanned] = useState(c.planned_date || '')
  const [brief, setBrief] = useState(c.brief || '')
  const valid = title.trim().length > 0
  const save = () => { if (valid) onSave({ title: title.trim(), format, concept: concept.trim() || null, caption: caption.trim() || null, brief: brief.trim() || null, status, planned_date: planned || null }) }

  return (
    <Modal title={entry.mode === 'new' ? 'New content' : 'Edit content'} onClose={onClose} onEnter={save}
      footer={<>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
        <Btn variant="solid" disabled={!valid} onClick={save} style={{ flex: 1 }}>Save</Btn>
      </>}>
      <Field label="Title"><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Working title…" autoFocus /></Field>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}><Field label="Format"><Select value={format} onChange={e => setFormat(e.target.value)} options={CONTENT_FORMATS} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Status"><Select value={status} onChange={e => setStatus(e.target.value)} options={CONTENT_STATUSES} /></Field></div>
      </div>
      <Field label="Concept"><Textarea value={concept} onChange={e => setConcept(e.target.value)} placeholder="The idea in one or two lines…" /></Field>
      <Field label="Caption"><Textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Draft caption…" /></Field>
      <Field label="Brief · optional"><Textarea value={brief} onChange={e => setBrief(e.target.value)} placeholder="The full creative brief — shots, references, structure…" style={{ minHeight: '110px' }} /></Field>
      <Field label="Planned date"><Input type="date" value={planned} onChange={e => setPlanned(e.target.value)} /></Field>
    </Modal>
  )
}
