import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Plus, ScanLine, Trash2, Pencil, ArrowLeft } from 'lucide-react'
import { supabase } from '@/api/supabase'
import { useIsDesktop } from '@/lib/useIsDesktop'
import { VOID, BONE, BONE_MID, BONE_LOW, FAINT, SILVER, WARN, PANEL, HAIR, HAIR_HI, FONT_DISPLAY, FONT_MONO, FONT_SANS } from '@/lib/cosmos'
import { Field, Input, Textarea, Select, Btn } from '@/components/os/ui'

/* =========================================================================
   EVENTS — create, edit, publish and sell an event without touching SQL.
   Desktop-first (this work is done sitting down); the phone gets a single
   column. Every write goes through the admin_* RPCs (SECURITY DEFINER,
   caller_is_network() — the server validates and refuses, the client only
   renders the server's answer). Prices are INTEGER CENTS in the data; the
   form takes dollars and shows the cents conversion live so neither
   direction can silently lie.

   ACTION INTEGRITY: "saved" renders only after the RPC returns ok AND the
   list reloads from the DB. Errors render verbatim. Deleting an event with
   any ticket rows is refused server-side; the button hides on the same
   signal (ticket_rows — ALL rows, not just confirmed ones).
   ========================================================================= */

const TIER_STATUSES = [
  { value: 'coming_soon', label: 'coming soon' },
  { value: 'available',   label: 'available — ON SALE' },
  { value: 'sold_out',    label: 'sold out' },
]
const EVENT_STATUS_LABEL = { draft: 'DRAFT', published: 'LIVE', past: 'PAST' }

const slugify = (s) => (s || '').toLowerCase().trim()
  .replace(/&/g, ' and ').replace(/[^a-z0-9\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

const centsToDollarInput = (c) => (Number.isFinite(c) ? (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2)) : '')
const dollarInputToCents = (v) => {
  const s = String(v).trim()
  if (!s || !/^\$?\d+(\.\d{1,2})?$/.test(s)) return null
  return Math.round(Number(s.replace('$', '')) * 100)
}
const fmtMoney = (c) => `$${c % 100 === 0 ? c / 100 : (c / 100).toFixed(2)}`

// datetime-local speaks LOCAL time ("YYYY-MM-DDTHH:mm"); the DB stores timestamptz.
const isoToLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const localInputToISO = (v) => {
  if (!v) return ''
  const d = new Date(v)
  return isNaN(d) ? '' : d.toISOString()
}

const emptyForm = () => ({
  id: null, title: '', slug: '', slugTouched: false, edition: '', tagline: '', description: '',
  dateLocal: '', doors: '', venue: '', city: 'Houston', cover_url: '', status: 'draft', tiers: [],
})

const eventToForm = (e) => ({
  id: e.id, title: e.title || '', slug: e.slug || '', slugTouched: true,
  edition: e.edition || '', tagline: e.tagline || '', description: e.description || '',
  dateLocal: isoToLocalInput(e.event_date), doors: e.doors || '', venue: e.venue || '',
  city: e.city || '', cover_url: e.cover_url || '', status: e.status || 'draft',
  // legacy 'soon' normalizes to coming_soon in the editor; doorLabel rides along untouched.
  tiers: (Array.isArray(e.tiers) ? e.tiers : []).map(t => ({
    id: t.id || '', name: t.name || '', dollars: centsToDollarInput(t.price),
    status: t.status === 'soon' ? 'coming_soon' : (t.status || 'coming_soon'),
    note: t.note || '', doorLabel: t.doorLabel,
  })),
})

// One payload builder for BOTH the editor save and the list quick-actions —
// a status flip must never silently rewrite tiers differently than the editor.
const formToPayload = (form) => {
  const usedIds = []
  const tiers = form.tiers.map(t => {
    let id = slugify(t.id || t.name)
    let base = id, n = 2
    while (id && usedIds.includes(id)) id = `${base}-${n++}`
    if (id) usedIds.push(id)
    const out = { id, name: t.name.trim(), price: dollarInputToCents(t.dollars), status: t.status }
    if (t.note && t.note.trim()) out.note = t.note.trim()
    if (t.doorLabel != null) out.doorLabel = t.doorLabel
    return out
  })
  return {
    id: form.id, title: form.title.trim(), slug: slugify(form.slug),
    edition: form.edition.trim(), tagline: form.tagline.trim(), description: form.description.trim(),
    event_date: localInputToISO(form.dateLocal), doors: form.doors.trim(), venue: form.venue.trim(),
    city: form.city.trim(), cover_url: form.cover_url.trim(), status: form.status, tiers,
  }
}

export default function EventsAdmin() {
  const navigate = useNavigate()
  const desktop = useIsDesktop()
  const [events, setEvents] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  const [view, setView] = useState('list')          // list | edit
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [notice, setNotice] = useState('')          // rendered only after a confirmed server ok
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [busyRow, setBusyRow] = useState('')

  const load = useCallback(async () => {
    setLoadErr('')
    const { data, error } = await supabase.rpc('admin_list_events')
    if (error || !data?.ok) { setLoadErr(error?.message || data?.error || 'could not load events'); return false }
    setEvents(data.events || [])
    setLoaded(true)
    return true
  }, [])
  useEffect(() => { load() }, [load])

  const say = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 6000) }

  /* ---------- form helpers ---------- */
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setTitle = (v) => setForm(f => ({ ...f, title: v, slug: f.slugTouched ? f.slug : slugify(v) }))
  const setTier = (i, k, v) => setForm(f => ({ ...f, tiers: f.tiers.map((t, j) => j === i ? { ...t, [k]: v } : t) }))
  const addTier = () => setForm(f => ({ ...f, tiers: [...f.tiers, { id: '', name: '', dollars: '', status: 'coming_soon', note: '' }] }))
  const delTier = (i) => setForm(f => ({ ...f, tiers: f.tiers.filter((_, j) => j !== i) }))

  const openNew = () => { setForm(emptyForm()); setFormErr(''); setView('edit') }
  const openEdit = (e) => { setForm(eventToForm(e)); setFormErr(''); setView('edit') }

  const save = async () => {
    setFormErr('')
    for (const t of form.tiers) {
      if (!t.name.trim()) { setFormErr('every tier needs a name'); return }
      const cents = dollarInputToCents(t.dollars)
      if (cents == null) { setFormErr(`tier “${t.name.trim() || '?'}” needs a price in whole dollars (e.g. 15)`); return }
      // Whole dollars only, for now: the public landing rounds the shown price
      // to whole dollars, so a $15.50 tier would DISPLAY $16 while Stripe
      // charges $15.50 — a lie at the button. Until the landing renders exact
      // cents, cent-precision prices are refused here.
      if (cents % 100 !== 0) {
        setFormErr(`tier “${t.name.trim()}” is ${fmtMoney(cents)} — whole dollars only for now (the public page rounds displayed prices)`)
        return
      }
    }
    setSaving(true)
    const { data, error } = await supabase.rpc('admin_save_event', { p: formToPayload(form) })
    setSaving(false)
    if (error || !data?.ok) { setFormErr(error?.message || data?.error || 'save failed'); return }
    await load()                       // render the DB's truth, not the form's optimism
    setView('list')
    say(`saved “${data.event?.title}” — ${EVENT_STATUS_LABEL[data.event?.status] || data.event?.status}`)
  }

  const quickStatus = async (e, status) => {
    if (status === 'published' && !window.confirm(`Publish “${e.title}”? It goes live on the public landing — and if it's the newest published event, it becomes THE event.`)) return
    setBusyRow(e.id)
    const { data, error } = await supabase.rpc('admin_save_event', { p: { ...formToPayload(eventToForm(e)), status } })
    setBusyRow('')
    if (error || !data?.ok) { say(`couldn't change status — ${error?.message || data?.error}`); return }
    await load()
    say(`“${e.title}” → ${EVENT_STATUS_LABEL[status]}`)
  }

  const doDelete = async (e) => {
    setConfirmDelete(null)
    setBusyRow(e.id)
    const { data, error } = await supabase.rpc('admin_delete_event', { p_id: e.id })
    setBusyRow('')
    if (error || !data?.ok) {
      say(data?.error === 'has_tickets'
        ? `can't delete “${e.title}” — ${data.tickets} ticket${data.tickets === 1 ? '' : 's'} exist for it`
        : `couldn't delete — ${error?.message || data?.error}`)
      return
    }
    await load()
    say(`deleted “${e.title}”`)
  }

  /* ------------------------------- states ------------------------------- */
  if (loadErr) return (
    <div style={{ padding: '30px 0', textAlign: 'center' }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: BONE_MID, letterSpacing: '.14em', textTransform: 'uppercase' }}>couldn't load events</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, marginTop: '8px' }}>{loadErr}</div>
      <Btn onClick={load} style={{ marginTop: '14px' }}>↻ Retry</Btn>
    </div>
  )
  if (!loaded) return <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}><Loader2 size={18} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} /></div>

  /* ================================ EDIT ================================ */
  if (view === 'edit') {
    const isNew = !form.id
    const cols = desktop ? '1fr 1fr' : '1fr'
    return (
      <div style={{ maxWidth: '860px' }}>
        <button onClick={() => setView('list')} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'transparent', border: 'none', color: BONE_LOW, fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', padding: 0, marginBottom: '16px' }}>
          <ArrowLeft size={13} /> All events
        </button>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: desktop ? '30px' : '24px', color: BONE, lineHeight: .95, marginBottom: '18px' }}>
          {isNew ? 'NEW EVENT' : `EDIT — ${(form.title || 'EVENT').toUpperCase()}`}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: cols, columnGap: '18px' }}>
          <Field label="Title *"><Input value={form.title} onChange={e => setTitle(e.target.value)} placeholder="COFFEE & HOUSE" /></Field>
          <Field label="Slug * (URL id — lowercase-kebab)">
            <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value, slugTouched: true }))} placeholder="coffee-and-house" style={{ fontFamily: FONT_MONO, fontSize: '13px' }} />
          </Field>
          <Field label="Edition"><Input value={form.edition} onChange={e => set('edition', e.target.value)} placeholder="EDITION 003" /></Field>
          <Field label="Date & time *"><Input type="datetime-local" value={form.dateLocal} onChange={e => set('dateLocal', e.target.value)} /></Field>
          <Field label="Venue"><Input value={form.venue} onChange={e => set('venue', e.target.value)} placeholder="Venue name" /></Field>
          <Field label="Doors (display text)"><Input value={form.doors} onChange={e => set('doors', e.target.value)} placeholder="4PM — 9PM" /></Field>
          <Field label="City"><Input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Houston" /></Field>
          <Field label="Cover image URL"><Input value={form.cover_url} onChange={e => set('cover_url', e.target.value)} placeholder="https://…" /></Field>
        </div>
        <Field label="Tagline"><Input value={form.tagline} onChange={e => set('tagline', e.target.value)} placeholder="One line under the title" /></Field>
        <Field label="Description"><Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} /></Field>

        <Field label="Status">
          <Select value={form.status} onChange={e => set('status', e.target.value)} options={[
            { value: 'draft', label: 'draft — only the team sees it' },
            { value: 'published', label: 'published — LIVE on the landing' },
            { value: 'past', label: 'past — archived' },
          ]} />
        </Field>

        {/* tiers */}
        <div style={{ margin: '6px 0 14px', borderTop: `1px solid ${HAIR}`, paddingTop: '16px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: '12px' }}>◇ Ticket tiers — dollars in the form, integer cents in the data</div>
          {form.tiers.length === 0 && (
            <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: FAINT, letterSpacing: '.06em', marginBottom: '12px' }}>no tiers yet — nothing can be sold without one.</div>
          )}
          {form.tiers.map((t, i) => {
            const cents = dollarInputToCents(t.dollars)
            return (
              <div key={i} style={{ border: `1px solid ${HAIR_HI}`, background: PANEL, borderRadius: '12px', padding: '14px', marginBottom: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: desktop ? '1.4fr .8fr 1.2fr auto' : '1fr', gap: '10px', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: BONE_LOW, letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: '5px' }}>Name</div>
                    <Input value={t.name} onChange={e => setTier(i, 'name', e.target.value)} placeholder="EARLY BIRD" />
                  </div>
                  <div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: BONE_LOW, letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: '5px' }}>Price ($)</div>
                    <Input value={t.dollars} onChange={e => setTier(i, 'dollars', e.target.value)} placeholder="15" inputMode="decimal" />
                    <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: cents == null ? WARN : FAINT, marginTop: '5px', letterSpacing: '.04em' }}>
                      {cents == null ? 'not a price yet' : `= ${cents} cents`}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: BONE_LOW, letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: '5px' }}>Status</div>
                    <Select value={t.status} onChange={e => setTier(i, 'status', e.target.value)} options={TIER_STATUSES} />
                  </div>
                  <button onClick={() => delTier(i)} aria-label="Remove tier" title="Remove tier"
                    style={{ background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '8px', color: BONE_LOW, cursor: 'pointer', padding: '9px', marginTop: desktop ? '18px' : 0, justifySelf: desktop ? 'end' : 'start' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
                <div style={{ marginTop: '10px' }}>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: BONE_LOW, letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: '5px' }}>Note (shown under the tier)</div>
                  <Input value={t.note} onChange={e => setTier(i, 'note', e.target.value)} placeholder="Limited first wave" />
                </div>
              </div>
            )
          })}
          <Btn onClick={addTier}><Plus size={12} /> Add tier</Btn>
        </div>

        <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: FAINT, letterSpacing: '.04em', lineHeight: 1.6, marginBottom: '16px' }}>
          Lineup & experiences keep their current values — they're outside this editor for now.
          {form.status !== 'published' && ' · Not live until status is published.'}
        </div>

        {formErr && <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: WARN, letterSpacing: '.04em', marginBottom: '12px' }}>△ {formErr}</div>}

        <div style={{ display: 'flex', gap: '10px' }}>
          <Btn variant="solid" onClick={save} disabled={saving} style={{ flex: desktop ? 'none' : 1 }}>
            {saving ? 'Saving…' : (isNew ? 'Create event' : 'Save changes')}
          </Btn>
          <Btn onClick={() => setView('list')} disabled={saving}>Cancel</Btn>
        </div>
      </div>
    )
  }

  /* ================================ LIST ================================ */
  return (
    <div style={{ maxWidth: '860px' }}>
      {notice && <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_MID, letterSpacing: '.14em', textTransform: 'uppercase', padding: '0 0 14px' }}>△ {notice}</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.2em', textTransform: 'uppercase' }}>
          {events.length} event{events.length === 1 ? '' : 's'} · every write validated server-side
        </div>
        <Btn variant="solid" onClick={openNew}><Plus size={12} /> New event</Btn>
      </div>

      {events.length === 0 && (
        <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: FAINT, letterSpacing: '.06em', padding: '20px 0' }}>no events yet — create the first one.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {events.map((e, i) => {
          const tiers = Array.isArray(e.tiers) ? e.tiers : []
          const onSale = tiers.filter(t => t.status === 'available')
          const busy = busyRow === e.id
          return (
            <div key={e.id} style={{ padding: '14px 2px', borderBottom: i === events.length - 1 ? 'none' : `1px solid ${HAIR}` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: FONT_SANS, fontSize: '14px', fontWeight: 600, color: BONE }}>{e.title}</span>
                {e.edition && <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.1em' }}>{e.edition}</span>}
                <StatusChip status={e.status} />
                {e.is_test && <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: FAINT, letterSpacing: '.14em', border: `1px solid ${HAIR}`, borderRadius: '4px', padding: '2px 7px' }}>TEST</span>}
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.04em', marginTop: '6px', lineHeight: 1.6 }}>
                {e.event_date ? new Date(e.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'no date'}
                {e.venue ? ` · ${e.venue}` : ''} · {e.sold} sold
                {tiers.length
                  ? ` · ${tiers.length} tier${tiers.length === 1 ? '' : 's'}${onSale.length ? ` — on sale: ${onSale.map(t => `${t.name} ${fmtMoney(t.price)}`).join(', ')}` : ' — none on sale'}`
                  : ' · no tiers'}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                <RowBtn onClick={() => openEdit(e)} disabled={busy}><Pencil size={11} /> Edit</RowBtn>
                {e.status !== 'published' && <RowBtn onClick={() => quickStatus(e, 'published')} disabled={busy || !e.event_date} title={!e.event_date ? 'needs a date first' : ''}>Publish</RowBtn>}
                {e.status === 'published' && <RowBtn onClick={() => quickStatus(e, 'draft')} disabled={busy}>Unpublish</RowBtn>}
                {e.status === 'published' && <RowBtn onClick={() => navigate(`/door?event=${e.id}`)}><ScanLine size={11} /> Door</RowBtn>}
                {/* Delete keys on ticket_rows (ALL rows) — the server refuses on any
                    ticket row, so the button must hide on the same truth, not on
                    confirmed-only `sold`. */}
                {(e.ticket_rows ?? e.sold) === 0 && <RowBtn onClick={() => setConfirmDelete(e)} disabled={busy} warn><Trash2 size={11} /> Delete</RowBtn>}
                {busy && <Loader2 size={13} style={{ color: SILVER, animation: 'spin 1s linear infinite', alignSelf: 'center' }} />}
              </div>
              {confirmDelete?.id === e.id && (
                <div style={{ marginTop: '10px', border: '1px solid rgba(229,160,160,.3)', background: 'rgba(229,160,160,.05)', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: WARN, letterSpacing: '.04em' }}>Delete “{e.title}” forever? No tickets exist for it.</span>
                  <RowBtn onClick={() => doDelete(e)} warn>Yes, delete</RowBtn>
                  <RowBtn onClick={() => setConfirmDelete(null)}>Keep it</RowBtn>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatusChip({ status }) {
  const map = {
    draft:     { color: BONE_LOW, border: HAIR_HI, bg: 'transparent' },
    published: { color: VOID,     border: BONE,    bg: BONE },
    past:      { color: FAINT,    border: HAIR,    bg: 'transparent' },
  }
  const s = map[status] || map.draft
  return (
    <span style={{ fontFamily: FONT_MONO, fontSize: '8px', letterSpacing: '.14em', color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: '4px', padding: '2px 8px', textTransform: 'uppercase' }}>
      {EVENT_STATUS_LABEL[status] || status}
    </span>
  )
}

function RowBtn({ children, onClick, disabled, warn, title }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', border: `1px solid ${warn ? 'rgba(229,160,160,.35)' : HAIR_HI}`, borderRadius: '100px', padding: '6px 13px', color: warn ? WARN : BONE_MID, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1 }}>
      {children}
    </button>
  )
}
