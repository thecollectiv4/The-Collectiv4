import { useState, useRef, useEffect } from 'react'
import { Loader2, X, ImagePlus, Plus, ArrowLeft, ArrowRight, Camera } from 'lucide-react'
import { THEMES, nameSkin, DEFAULT_MARQUEE, normGallery, normLinks, worldSafeUrl, worldCompleteness, chromeDisplayText, craftKindOf, CRAFT_STEPS } from '@/lib/world'
import { craftLine, kindOfCrafts, saveProfileCrafts } from '@/lib/crafts'
import { saveTastes } from '@/lib/tastes'
import CraftPicker from '@/components/CraftPicker'
import TasteBrainstorm from '@/components/TasteBrainstorm'
import { useWide } from '@/lib/useIsDesktop'

/* =========================================================================
   WorldBuilder v4 — LA ENTRADA EXPRÉS (v18). El único dato de usuario real
   que no viene de los founders: un amigo de Pato intentó hacer su perfil y
   dijo que "tardaba demasiado / era difícil". Si la puerta cuesta, nada de
   lo de adentro importa.

   A NEW WORLD meets THREE BEATS, nothing else — the minimum to exist with
   dignity in Community (name already came from signup):
     01 · what do you make?    → craft (or "here for the people" / skip)
     02 · your face, your city → avatar + city (the card's identity)
     03 · your line            → tagline, then PUBLISH — you're in

   Every beat persists the moment it's answered; every beat is skippable.
   Target: cero → "estoy adentro y visible" in under 60 seconds.

   EVERYTHING ELSE IS CURATION, NOT THE DOOR. The v3 conversation (feel /
   show → composed plan, /api/curate polish) was charged at the entrance
   and is retired with v18 — its per-craft step ORDER survives below in
   CRAFT_STEPS. Taste, work, doors, marquee, skin now live as progressive
   curation: the museum invites ("your world · 60% — add X") and the deep
   builder resumes at the first unfinished step, exactly as before.

   The steps machinery below is the proven v2 kit: per-step persistence,
   the serial upload chain, drag/paste, guilt-free skips. v17's legacy-maker
   migration door (free-text discipline → real crafts) is intact — see
   firstUnfinished.
   ========================================================================= */

const VOID = 'var(--bg)'
const BONE = 'var(--cream)'
const BONE_MID = 'var(--cream-soft)'
const BONE_LOW = 'var(--cream-dim)'
const SILVER = 'var(--silver)'
const CARD = 'var(--card-solid)'
const HAIR = 'rgba(var(--ink-rgb),0.08)'
const HAIR_HI = 'rgba(var(--ink-rgb),0.15)'
const WARN = 'var(--warn)'


const inp = { width: '100%', background: CARD, border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '12px 14px', color: BONE, fontFamily: 'DM Sans', fontSize: '14px', outline: 'none' }
const monoLabel = { fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.22em', color: BONE_LOW, textTransform: 'uppercase', display: 'block', marginBottom: '7px' }

/* The reason this exists — shown on the first beat, verbatim guidance. */
const WHY = 'Your world is your card in Discover, your museum — and soon, where you get booked.'

/* LA ENTRADA EXPRÉS — three beats, the minimum to be visible with dignity.
   01 craft: from the CURATED taxonomy (0020), never free text — the
   structured craft is what turns the matching column on. v17's wall-falls
   doctrine holds: "I'm here for the people" and skip are first-class doors,
   never a dead end (el audit del 16 jul midió el costo del required: 11 de
   13 arquetipos rebotados en la primera pregunta de la casa).
   02 face: the avatar was NEVER asked for in the old builder — the single
   biggest dignity item on the card, only settable from the museum hero.
   City rides here: one question, the matching engine's third signal.
   03 line: one sentence in their voice, then publish. */
const EXPRESS = [
  { key: 'craft', kicker: 'question 01 · who you are', title: 'WHAT DO YOU MAKE?', why: `${WHY} Pick your craft — or walk in for the people. You can be many at once.` },
  { key: 'face', kicker: 'question 02 · the card', title: 'YOUR FACE, YOUR CITY', why: 'The two things a card needs to feel like a person. The photo says you exist; the city says where real life happens.' },
  { key: 'line', kicker: 'question 03 · in your voice', title: 'YOUR LINE', why: "One line under your name — what you're on right now. Then you're in." },
]

/* Base copy per step — one cosmos line that says WHY, never a demand. */
const STEP_COPY = {
  craft: { title: 'YOUR CRAFT', kicker: 'the door sign', why: `${WHY} Start with what you make.` },
  taste: { title: 'BRAINSTORM YOUR TASTE', kicker: 'the quiet layer', why: 'Music, film, what keeps you alive. Quiet by default — the universe uses it to find your people, only you decide what shows.' },
  city: { title: 'YOUR CITY', kicker: 'where real life happens', why: 'Where does real life happen for you? One answer and the universe knows who’s actually near — the room only works if it knows where you stand.' },
  line: { title: 'YOUR LINE', kicker: 'in your voice', why: 'One line under your name — what you\'re on right now. Rewrite the suggestion or clear it; it ships in YOUR words only.' },
  work: { title: 'THE WORK', kicker: 'what turns it on', why: 'This space is for your work — three pieces turn it on. Shots, canvases, fits, stills.' },
  doors: { title: 'THE DOORS', kicker: 'where it leads', why: 'Every link is a door out of your world — IG, portfolio, sound. One keeps it open.' },
  words: { title: 'YOUR WORDS', kicker: 'the piece', why: 'Give them one piece — a paragraph, a poem, a theory. It opens your world.' },
  marquee: { title: 'THE MARQUEE', kicker: 'the welcome', why: 'The line that loops above your world. Make it yours — or keep the house welcome.' },
  skin: { title: 'THE SKIN', kicker: 'your composition', why: 'Same universe, your composition — how your name is set. Watch it change above.' },
}

/* Craft overrides — the same step wears the door sign of the craft. */
const CRAFT_COPY = {
  sound: {
    doors: { title: 'YOUR SOUND', kicker: 'where it plays', why: 'Your sound is the door — SoundCloud, Spotify, a mix, a set. Paste the link that plays you.', doorPlaceholder: 'SoundCloud' },
    work: { title: 'THE VISUALS', kicker: 'the wall behind the booth', why: 'Flyers, booth shots, cover art — three pieces give your sound a face.' },
  },
  visual: {
    work: { kicker: 'your eye leads', why: 'Your eye is the front door — three pieces turn the museum on. Shots, canvases, fits, stills.' },
  },
  word: {
    work: { title: 'THE WALL', kicker: 'texture behind the words', why: 'Covers, pages, places you write — images give your words a room to hang in.' },
  },
}

/* A world that already carries identity data walked through the door on
   purpose — the express beats persisted what its owner chose to answer. */
const hasIdentity = (d) => !!((d?.tagline || '').trim() || (d?.city || '').trim() || (d?.avatar_url || '').trim())

// only ever render trusted image sources (http(s) or an uploaded data URI) —
// the same whitelist Community/ForYou/museum apply to avatars
const safeAvatar = (raw) => (/^https?:\/\//i.test((raw || '').trim()) || (raw || '').startsWith('data:image/')) ? raw : ''

/* Land on the first unfinished step of THIS order, not always at zero.
   The craft step counts as done only when REAL crafts are chosen — a legacy
   free-text discipline alone re-opens the step (the in-UI migration door).
   v17: a member holding tastes but no crafts AND no legacy discipline
   took the "here for the people" door DELIBERATELY — craft counts as
   answered for them, or the builder re-traps every non-maker at the wall
   it just tore down. A LEGACY free-text maker (discipline text, zero
   structured crafts) keeps meeting the craft step even with tastes:
   that's the migration door that turns the matching column on (review
   catch v17 — the first cut exempted them by accident).
   v18: the express non-maker (no craft, no tastes YET, but published
   identity — tagline/city/avatar) also answered deliberately: hasIdentity
   counts their craft as answered, or the deep builder re-traps them at
   the wall v17 tore down. The legacy migration door is untouched — a
   discipline text always re-opens the step.
   Taste counts as done only when ≥1 taste is held — a member with crafts
   but zero tastes re-enters at the brainstorm (the v6 door). */
function firstUnfinished(steps, d, crafts, tastes) {
  for (let i = 0; i < steps.length; i++) {
    const k = steps[i]
    if (k === 'craft' && !(crafts || []).length && ((d?.discipline || '').trim() || (!(tastes || []).length && !hasIdentity(d)))) return i
    if (k === 'taste' && !(tastes || []).length) return i
    if (k === 'city' && !(d?.city || '').trim()) return i
    if (k === 'line' && !(d?.tagline || '').trim()) return i
    if (k === 'words' && !(d?.bio || '').trim()) return i
    if (k === 'work' && normGallery(d?.gallery).length < 3) return i
    if (k === 'doors' && !normLinks(d?.world_links).length) return i
    if (k === 'marquee' && d?.marquee_text == null) return i
  }
  return steps.length - 1
}

export default function WorldBuilder({ data, crafts = [], onCraftsSaved, tastes = null, onTastesSaved, onDraft, onCommit, onUploadGallery, onCleanupImages, onUploadAvatar, onClose, onPublished }) {
  const wide = useWide()
  // A truly blank world meets the EXPRESS beats; a world with anything in
  // it — crafts, discipline, gallery, tastes, or identity (tagline/city/
  // avatar, v18) — belongs to a returning member and goes straight to its
  // first unfinished step. Without the identity check, the express-published
  // non-maker re-entered the express on every open (isNew lied about them).
  const isNew = !crafts.length && !(data?.discipline || '').trim() && normGallery(data?.gallery).length === 0 && !(tastes || []).length && !hasIdentity(data)
  const [stage, setStage] = useState(isNew ? 'express' : 'steps')  // express | steps
  const [expressIdx, setExpressIdx] = useState(0)
  // the chosen crafts — the picker's controlled state, seeded from what's
  // already saved (a returning member edits, never re-answers from zero)
  const [picked, setPicked] = useState(() => crafts.map((c) => ({ id: c.id, name: c.name, slug: c.slug, category: c.category })))
  const [primaryId, setPrimaryId] = useState(() => (crafts.find((c) => c.isPrimary) || crafts[0])?.id || null)
  // the brainstorm's controlled state — null until the hand touches it, the
  // SAVED tastes lead until then. WIPE GUARD: saveTastes replaces the WHOLE
  // set, so the step never renders (and Next never commits) while the parent
  // is still loading (tastes === null) — the craftsReady discipline.
  const [tasteDraft, setTasteDraft] = useState(null)
  const tasteValue = tasteDraft ?? (tastes || []).map((t) => ({ domain: t.domain, label: t.label, is_public: !!t.is_public }))
  // the express face beat — avatar upload state (persists the moment it
  // lands, same doctrine as the gallery chain)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const avatarRef = useRef(null)

  // what leads this world: the chosen crafts' own category decides (0020);
  // a craft-less legacy world falls back to the old free-text sniff
  const craftsNow = picked.map((c) => ({ ...c, isPrimary: c.id === primaryId }))
  const kind = kindOfCrafts(craftsNow) || craftKindOf(data?.discipline)
  const steps = CRAFT_STEPS[kind]
  const [step, setStep] = useState(() => (isNew ? 0 : firstUnfinished(CRAFT_STEPS[kindOfCrafts(crafts) || craftKindOf(data?.discipline)], data, crafts, tastes)))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [uploadingN, setUploadingN] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const galleryRef = useRef(null)
  // Three doors feed the wall (picker, drop, paste) and each commit replaces
  // the WHOLE gallery array — overlapping upload chains would base off stale
  // snapshots and silently erase each other's images (review catch). One
  // serial chain + one live view of the latest committed wall fixes both.
  const uploadChain = useRef(Promise.resolve())
  const galleryNow = useRef(null)             // null → derive from props

  // the craft chosen can shorten/reorder the path — never strand the index
  const safeStep = Math.min(step, steps.length - 1)
  const key = steps[safeStep]
  const copy = { ...STEP_COPY[key], ...(CRAFT_COPY[kind]?.[key] || {}) }
  // the meter answers the HAND, not the Next button (panel catch): a chosen
  // craft lights its 15 points the moment it's chosen — commit follows
  const { pct: savedPct } = worldCompleteness(data)
  const pct = Math.min(100, savedPct + (picked.length && !(data?.discipline || '').trim() ? 15 : 0))
  const gallery = normGallery(data?.gallery)
  const links = Array.isArray(data?.world_links) ? data.world_links : []

  /* ---- persist the chosen crafts: the set (0020, atomic) + the derived
     summary line into discipline, so every legacy surface keeps reading
     something true. Nothing is ever lost — saved the moment it's spoken. */
  const commitCrafts = async () => {
    const summary = craftLine(craftsNow)
    await saveProfileCrafts(picked.map((c) => c.id), primaryId)
    // the parent learns the DB's truth IMMEDIATELY — if the discipline
    // write below fails, the crafts are still saved and the UI must not
    // pretend otherwise (review catch)
    onCraftsSaved?.(craftsNow)
    await onCommit({ discipline: summary || null })
  }

  /* ---- LA ENTRADA EXPRÉS: three beats, each persisting as it's answered ---- */
  const expressNext = async () => {
    setErr('')
    const q = EXPRESS[expressIdx]
    if (q.key === 'craft') {
      // the craft persists the moment it's spoken — nothing is ever lost.
      // Zero crafts on Next is the same door as "here for the people".
      if (picked.length) {
        setBusy(true)
        try { await commitCrafts() } catch (e) {
          setErr(e?.message ? `Couldn't save — ${e.message}` : "Couldn't save — try again.")
          setBusy(false); return
        }
        setBusy(false)
      }
      setExpressIdx(1); return
    }
    if (q.key === 'face') {
      // avatar already persisted on upload; only the city commits here
      const city = (data?.city || '').trim()
      setBusy(true)
      try { await onCommit({ city: city || null }) } catch (e) {
        setErr(e?.message ? `Couldn't save — ${e.message}` : "Couldn't save — try again.")
        setBusy(false); return
      }
      setBusy(false)
      setExpressIdx(2); return
    }
    // line → PUBLISH. world_theme commits explicitly: the house default is
    // a real composition, and the express world ships composed, not naked.
    setBusy(true)
    try {
      await onCommit({ tagline: (data?.tagline || '').trim() || null, world_theme: data?.world_theme || 'chrome' })
    } catch (e) {
      setErr(e?.message ? `Couldn't save — ${e.message}` : "Couldn't save — try again.")
      setBusy(false); return
    }
    setBusy(false)
    onPublished()
  }
  // guilt-free — a skipped beat writes nothing and the door keeps moving.
  // Skipping the LAST beat still publishes (the world exists either way).
  const expressSkip = () => {
    setErr('')
    if (expressIdx < EXPRESS.length - 1) { setExpressIdx(expressIdx + 1); return }
    onPublished()
  }

  // the face beat's upload — persists immediately via the parent (the same
  // "saved the moment it's spoken" doctrine as crafts and the gallery)
  const uploadAvatar = async (e) => {
    const input = e.target
    const file = input.files?.[0]
    input.value = ''
    if (!file || !onUploadAvatar) return
    setErr(''); setAvatarBusy(true)
    try {
      const url = await onUploadAvatar(file)
      if (url) onDraft({ avatar_url: url })
    } catch (e2) {
      setErr(e2?.message ? `Photo upload failed — ${e2.message}` : 'Photo upload failed — try again.')
    } finally { setAvatarBusy(false) }
  }

  /* ---- per-step commit: persist, then advance (nothing is ever lost) ---- */
  const commitAndGo = async (patch, nextStep) => {
    setBusy(true); setErr('')
    try {
      await onCommit(patch)
      if (nextStep >= steps.length) { onPublished() } else { setStep(nextStep) }
    } catch (e) {
      setErr(e?.message ? `Couldn't save — ${e.message}` : "Couldn't save — try again.")
    } finally { setBusy(false) }
  }

  const next = async () => {
    if (key === 'craft') {
      // crafts save atomically first (0020), then the derived line + tagline
      setBusy(true); setErr('')
      try {
        await saveProfileCrafts(picked.map((c) => c.id), primaryId)
        onCraftsSaved?.(craftsNow)
      } catch (e) {
        setErr(e?.message ? `Couldn't save — ${e.message}` : "Couldn't save — try again.")
        setBusy(false); return
      }
      setBusy(false)
      return commitAndGo({ discipline: craftLine(craftsNow) || null, tagline: (data.tagline || '').trim() || null }, safeStep + 1)
    }
    if (key === 'taste') {
      // the whole set replaces atomically (0022) — never from an unloaded
      // state (the step body and nextDisabled both hold that door)
      if (tastes === null) return
      setBusy(true); setErr('')
      try {
        await saveTastes(tasteValue)
        onTastesSaved?.(tasteValue)
      } catch (e) {
        setErr(e?.message ? `Couldn't save — ${e.message}` : "Couldn't save — try again.")
        setBusy(false); return
      }
      setBusy(false)
      return setStep(safeStep + 1)
    }
    if (key === 'city') return commitAndGo({ city: (data.city || '').trim() || null }, safeStep + 1)
    if (key === 'line') return commitAndGo({ tagline: (data.tagline || '').trim() || null }, safeStep + 1)
    if (key === 'words') return commitAndGo({ bio: (data.bio || '').trim() || null }, safeStep + 1)
    if (key === 'work') return commitAndGo({ gallery: gallery.map(g => ({ path: g.path || null, url: g.url, caption: (g.caption || '').trim() })) }, safeStep + 1)
    if (key === 'doors') return commitAndGo({ world_links: links.map(l => ({ label: (l.label || '').trim(), url: (l.url || '').trim() })).filter(l => worldSafeUrl(l.url)) }, safeStep + 1)
    if (key === 'marquee') return commitAndGo({ marquee_text: (data.marquee_text ?? DEFAULT_MARQUEE).trim() }, safeStep + 1)
    if (key === 'skin') return commitAndGo({ world_theme: data.world_theme || 'chrome' }, safeStep + 1) // publish
  }

  // guilt-free skip — advance without writing a thing; the world stays honest
  const skip = () => { setErr(''); setStep(s => Math.min(s + 1, steps.length - 1)) }

  // ---- gallery: upload persists IMMEDIATELY (the wall builds live) ----
  const readGal = () => galleryNow.current ?? normGallery(data?.gallery)
  const uploadFiles = (fileList) => {
    const files = Array.from(fileList || []).filter(f => f && f.type?.startsWith('image/'))
    if (!files.length || !onUploadGallery) return
    setErr('')
    for (const f of files) {
      setUploadingN(n => n + 1)
      uploadChain.current = uploadChain.current.then(async () => {
        try {
          const { path, url } = await onUploadGallery(f)
          const prev = readGal()
          const nextGal = [...prev, { path, url, caption: '' }]
          galleryNow.current = nextGal
          onDraft({ gallery: nextGal })
          try { await onCommit({ gallery: nextGal }) } catch (e2) {
            // the commit never landed — the wall (draft included) stays honest
            galleryNow.current = prev
            onDraft({ gallery: prev })
            onCleanupImages?.([path])
            throw e2
          }
        } catch (e2) {
          setErr(e2?.message ? `Upload failed — ${e2.message}` : 'Upload failed — try again.')
        } finally { setUploadingN(n => n - 1) }
      })
    }
    return uploadChain.current
  }
  const addFiles = async (e) => {
    // snapshot + clear FIRST — a dirty input swallows the change event when
    // the same file is picked twice in a row (walkthrough catch)
    const input = e.target
    const files = Array.from(input.files || [])
    input.value = ''
    await uploadFiles(files)
  }
  const removePiece = (i) => {
    // removals ride the same serial chain — a remove racing an upload would
    // otherwise resurrect the removed piece on the next full-array commit
    uploadChain.current = uploadChain.current.then(async () => {
      const cur = readGal()
      const gone = cur[i]
      const nextGal = cur.filter((_, j) => j !== i)
      galleryNow.current = nextGal
      onDraft({ gallery: nextGal })
      try {
        await onCommit({ gallery: nextGal })
        if (gone?.path) onCleanupImages?.([gone.path])
      } catch (e2) {
        galleryNow.current = cur
        onDraft({ gallery: cur })
        setErr(e2?.message || "Couldn't remove — try again.")
      }
    })
    return uploadChain.current
  }

  // paste an image anywhere while on the work step — it lands on the wall
  useEffect(() => {
    if (stage !== 'steps' || key !== 'work') return
    const onPaste = (e) => {
      const files = [...(e.clipboardData?.files || [])].filter(f => f.type?.startsWith('image/'))
      if (files.length) { e.preventDefault(); uploadFiles(files) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [stage, key, data])

  // drag a file over the work step — the wall opens
  const dragProps = stage === 'steps' && key === 'work' ? {
    onDragOver: (e) => { e.preventDefault(); setDragOver(true) },
    onDragLeave: () => setDragOver(false),
    onDrop: (e) => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer?.files) },
  } : {}

  // ---- links (draft-level; persisted on Next) ----
  const setLink = (i, k, v) => {
    const rows = links.map((l, j) => j === i ? { ...l, [k]: v } : l)
    onDraft({ world_links: rows })
  }
  const addLink = () => onDraft({ world_links: [...links, { label: '', url: '' }] })
  const delLink = (i) => onDraft({ world_links: links.filter((_, j) => j !== i) })

  const nextDisabled = busy || uploadingN > 0 ||
    (key === 'craft' && !picked.length) ||
    (key === 'taste' && tastes === null) ||
    (key === 'doors' && links.length > 0 && !links.some(l => worldSafeUrl(l.url)))

  // phone: a bottom sheet under the live museum · wide: a studio panel docked
  // right, the world composing at full width beside it
  const shell = wide
    ? { position: 'fixed', top: '56px', right: 0, bottom: 0, width: '480px', zIndex: 10000, background: 'var(--bg)', borderLeft: `1px solid ${HAIR_HI}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '-40px 0 90px rgba(var(--shadow-rgb),.45)' }
    : { position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: '100%', maxWidth: '430px', zIndex: 10000, background: 'var(--bg)', borderTop: `1px solid ${HAIR_HI}`, borderRadius: '18px 18px 0 0', maxHeight: '58vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }

  /* ------------------------- header (all stages) ------------------------- */
  const headerLine = stage === 'steps'
    ? `◇ build your world · ${String(safeStep + 1).padStart(2, '0')}/${String(steps.length).padStart(2, '0')}`
    : `◇ enter the universe · ${String(expressIdx + 1).padStart(2, '0')}/${String(EXPRESS.length).padStart(2, '0')}`

  return (
    // z 10000: ABOVE Layout's bottom nav (9999) — the nav must never cover
    // the sheet's own footer (Back / Next / Publish)
    <div role="dialog" aria-label="Build your world" className={wide ? 'panel-in-right' : 'sheet-up-centered'} style={shell}>
      {/* the app-wide grain varnishes the sheet; the solid void behind it is
          the builder's silence — where you write, the galaxy shuts up (D2) */}

      {/* header: progress + meter + close */}
      <div style={{ padding: wide ? '20px 24px 0' : '14px 18px 0', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.26em', textTransform: 'uppercase' }}>{headerLine}</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: pct === 100 ? BONE : BONE_MID, letterSpacing: '.12em', textTransform: 'lowercase' }}>your world · {pct}%</span>
          <button onClick={onClose} disabled={busy || uploadingN > 0} aria-label="Close" style={{ background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: '4px', display: 'inline-flex', opacity: (busy || uploadingN > 0) ? .4 : 1 }}><X size={15} /></button>
        </div>
        {/* the meter — a hairline, not a game */}
        <div style={{ marginTop: '10px', height: '1px', background: HAIR, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', transform: `scaleX(${pct / 100})`, transformOrigin: 'left', background: SILVER, opacity: .7, transition: 'transform .5s var(--ease-house)' }} />
        </div>
      </div>

      {/* ======================= LA ENTRADA EXPRÉS ======================= */}
      {stage === 'express' && (() => {
        const q = EXPRESS[expressIdx]
        const canNext = !busy && !avatarBusy
        const last = expressIdx === EXPRESS.length - 1
        return (
          <>
            <div className="no-scrollbar" style={{ padding: wide ? '22px 24px 20px' : '16px 18px 18px', overflowY: 'auto', position: 'relative', flex: 1, minHeight: 0 }}>
              {/* the beat — keyed on the question so each one surfaces on its own */}
              <div key={expressIdx} className="beat-in">
                <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.24em', textTransform: 'uppercase' }}>{q.kicker}</div>
                <div style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '30px' : '24px', letterSpacing: '.03em', lineHeight: 1.02, marginTop: '6px', ...chromeDisplayText }}>{q.title}</div>
                <p style={{ fontFamily: 'DM Sans', fontSize: '13px', color: BONE_MID, lineHeight: 1.6, margin: '10px 0 16px' }}>{q.why}</p>

                {q.key === 'craft' && (
                  <>
                    <CraftPicker value={picked} primaryId={primaryId} autoFocus={wide}
                      onChange={(next, nextPrimary) => { setPicked(next); setPrimaryId(nextPrimary) }} />
                    {/* v17 — the first-class answer for the human who makes
                        nothing and shows up anyway. Only while no craft is
                        picked: the moment one is, they answered as a maker
                        and this door would be noise. In the express it
                        simply moves to the next beat — taste waits inside,
                        as the first invitation, never as a wall. */}
                    {!picked.length && (
                      <div style={{ marginTop: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 10px' }}>
                          <div style={{ flex: 1, height: '1px', background: HAIR }} />
                          <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.22em', textTransform: 'uppercase' }}>or</span>
                          <div style={{ flex: 1, height: '1px', background: HAIR }} />
                        </div>
                        <button onClick={() => { setErr(''); setExpressIdx(1) }} disabled={busy} className="pressable" data-testid="express-people-door"
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left', background: CARD, border: `1px solid ${HAIR_HI}`, borderRadius: '11px', padding: '12px 14px', cursor: 'pointer', transition: 'background .2s, border-color .2s' }}>
                          <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '11px', color: BONE_LOW }}>◇</span>
                          <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontFamily: 'DM Sans', fontSize: '13px', color: BONE }}>I&rsquo;m here for the people</span>
                            <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.08em' }}>no craft needed — you belong anyway</span>
                          </span>
                        </button>
                      </div>
                    )}
                  </>
                )}

                {q.key === 'face' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* the face — tap the circle, that's the whole gesture */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <button onClick={() => avatarRef.current?.click()} disabled={avatarBusy} aria-label="Add your photo" className="pressable"
                        style={{ position: 'relative', width: '72px', height: '72px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: CARD, border: `1px ${safeAvatar(data?.avatar_url) ? 'solid' : 'dashed'} ${safeAvatar(data?.avatar_url) ? SILVER : HAIR_HI}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                        {safeAvatar(data?.avatar_url)
                          ? <img src={data.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <Camera size={18} style={{ color: BONE_LOW }} />}
                        {avatarBusy && (
                          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(var(--void-rgb),.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Loader2 size={16} style={{ color: BONE_MID, animation: 'spin 1s linear infinite' }} />
                          </span>
                        )}
                      </button>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: 'DM Sans', fontSize: '13px', color: BONE }}>{safeAvatar(data?.avatar_url) ? 'That’s you.' : 'Add your photo'}</div>
                        <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.08em', marginTop: '3px' }}>
                          {safeAvatar(data?.avatar_url) ? 'tap it to change' : 'the card reads as a person the moment it has a face'}
                        </div>
                      </div>
                      <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadAvatar} />
                    </div>
                    <div>
                      <label style={monoLabel}>YOUR CITY</label>
                      <input style={inp} value={data?.city || ''} placeholder="Houston · Valencia · Katy…" maxLength={60}
                        onChange={e => onDraft({ city: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter' && canNext) expressNext() }} />
                      <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.06em', marginTop: '8px' }}>
                        the city you actually live in — it feeds who you meet.
                      </div>
                    </div>
                  </div>
                )}

                {q.key === 'line' && (
                  <div>
                    <label style={monoLabel}>YOUR LINE</label>
                    <input autoFocus={wide} style={inp} value={data?.tagline || ''} placeholder="One line, your voice — what you're on right now." maxLength={120}
                      onChange={e => onDraft({ tagline: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter' && canNext) expressNext() }} />
                  </div>
                )}
              </div>
              {err && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: WARN, marginTop: '12px' }}>⚠ {err}</div>}
            </div>
            <div style={{ position: 'relative', borderTop: `1px solid ${HAIR}`, padding: wide ? '14px 24px 18px' : '12px 18px calc(14px + env(safe-area-inset-bottom, 0px))' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                {expressIdx > 0 && (
                  <button onClick={() => setExpressIdx(i => i - 1)} disabled={busy} aria-label="Back" className="pressable"
                    style={{ background: 'rgba(var(--ink-rgb),.04)', border: `1px solid ${HAIR}`, borderRadius: '10px', padding: '12px 16px', color: BONE_MID, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                    <ArrowLeft size={12} /> Back
                  </button>
                )}
                <button onClick={expressNext} disabled={!canNext} className="pressable" data-testid="express-next"
                  style={{ flex: 1, background: BONE, border: 'none', borderRadius: '10px', padding: '13px', color: VOID, fontWeight: 600, fontSize: '13px', cursor: canNext ? 'pointer' : 'default', fontFamily: 'DM Sans', opacity: canNext ? 1 : .5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {busy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    : last ? 'ENTER THE UNIVERSE'
                    : <>Next <ArrowRight size={13} /></>}
                </button>
              </div>
              {/* the guilt-free door — every beat is skippable, and skipping
                  the last one still opens the universe (Ley 11: honest, never
                  a trap; the world exists either way) */}
              <button onClick={expressSkip} disabled={busy || avatarBusy} className="pressable"
                style={{ display: 'block', margin: '10px auto 0', background: 'transparent', border: 'none', color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', padding: '2px 8px' }}>
                skip this one →
              </button>
            </div>
          </>
        )
      })()}

      {/* ======================= THE STEPS (v2 machinery) ======================= */}
      {stage === 'steps' && (
        <>
          {/* step body */}
          <div className="no-scrollbar" {...dragProps} style={{ padding: wide ? '22px 24px 20px' : '16px 18px 18px', overflowY: 'auto', position: 'relative', flex: 1, minHeight: 0, ...(dragOver && { outline: `1px dashed ${SILVER}`, outlineOffset: '-8px', background: 'rgba(var(--silver-rgb),.04)' }) }}>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '32px' : '26px', letterSpacing: '.04em', lineHeight: 1, ...chromeDisplayText }}>{copy.title}</div>
            <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.24em', textTransform: 'uppercase', marginTop: '5px' }}>{copy.kicker}</div>
            <p style={{ fontFamily: 'DM Sans', fontSize: '13px', color: BONE_MID, lineHeight: 1.6, margin: '10px 0 16px' }}>{copy.why}</p>

            {key === 'craft' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                <div>
                  <label style={monoLabel}>WHAT YOU MAKE</label>
                  {/* the curated taxonomy, never free text — the migration door
                      for legacy worlds too: a text-only discipline seeds the
                      search so the person finds their REAL crafts fast */}
                  <CraftPicker value={picked} primaryId={primaryId} maxHeight="30vh"
                    seedQuery={picked.length ? '' : ((data.discipline || '').split(/[·,/&+]| and /i)[0] || '').trim().slice(0, 24)}
                    onChange={(next, nextPrimary) => { setPicked(next); setPrimaryId(nextPrimary) }} />
                </div>
                <div>
                  <label style={monoLabel}>YOUR LINE</label>
                  <input style={inp} value={data.tagline || ''} placeholder="One line, your voice — what you're on right now." maxLength={120} onChange={e => onDraft({ tagline: e.target.value })} />
                </div>
              </div>
            )}

            {key === 'taste' && (
              tastes === null ? (
                /* WIPE GUARD: the brainstorm never opens over an unloaded set —
                   a commit seeded from null would erase a member's tastes */
                <div style={{ display: 'flex', justifyContent: 'center', padding: '26px 0' }}>
                  <Loader2 size={15} style={{ color: BONE_LOW, animation: 'spin 1s linear infinite' }} />
                </div>
              ) : (
                <TasteBrainstorm value={tasteValue} onChange={setTasteDraft} maxHeight="22vh" />
              )
            )}

            {key === 'city' && (
              <div>
                <label style={monoLabel}>YOUR CITY</label>
                <input style={inp} value={data.city || ''} placeholder="Houston · Valencia · Katy…" maxLength={60}
                  onChange={e => onDraft({ city: e.target.value })} />
                <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.06em', marginTop: '8px' }}>
                  the city you actually live in — not the one you dream of. it feeds who you meet.
                </div>
              </div>
            )}

            {key === 'line' && (
              <div>
                <label style={monoLabel}>YOUR LINE</label>
                <input style={inp} value={data.tagline || ''} placeholder="One line, your voice — what you're on right now." maxLength={120} onChange={e => onDraft({ tagline: e.target.value })} />
              </div>
            )}

            {key === 'words' && (
              <div>
                <label style={monoLabel}>THE PIECE</label>
                <textarea style={{ ...inp, resize: 'vertical', minHeight: '140px', lineHeight: 1.7 }} rows={6} value={data.bio || ''} maxLength={2000}
                  placeholder={'A paragraph, a poem, a theory — in your voice.\nIt opens your world, right above.'}
                  onChange={e => onDraft({ bio: e.target.value })} />
              </div>
            )}

            {key === 'work' && (
              <div>
                <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: gallery.length >= 3 ? BONE : BONE_LOW, letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: '10px' }}>
                  {String(Math.min(3, gallery.length)).padStart(2, '0')}/03 on the wall{gallery.length > 3 ? ` · +${gallery.length - 3}` : ''}
                </div>
                {gallery.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {gallery.map((g, i) => (
                      <div key={`${g.url}:${i}`} style={{ position: 'relative' }}>
                        <img src={g.url} alt="" style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover', border: `1px solid ${HAIR_HI}`, display: 'block' }} />
                        <button onClick={() => removePiece(i)} aria-label="Remove" style={{ position: 'absolute', top: '-6px', right: '-6px', width: '18px', height: '18px', borderRadius: '50%', background: VOID, border: `1px solid ${HAIR_HI}`, color: WARN, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><X size={10} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => galleryRef.current?.click()} disabled={uploadingN > 0}
                  style={{ width: '100%', background: dragOver ? 'rgba(var(--silver-rgb),.07)' : 'transparent', border: `1px dashed ${dragOver ? SILVER : HAIR_HI}`, borderRadius: '12px', padding: '16px 13px', color: BONE_MID, fontSize: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'DM Sans', opacity: uploadingN > 0 ? .6 : 1, transition: 'background .2s, border-color .2s, opacity .2s' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    {uploadingN > 0 ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <ImagePlus size={14} />}
                    {uploadingN > 0 ? `Uploading ${uploadingN}…` : 'Add your work'}
                  </span>
                  <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.1em' }}>tap · drag it in · or just paste</span>
                </button>
                <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple style={{ display: 'none' }} onChange={addFiles} />
              </div>
            )}

            {key === 'doors' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {links.map((l, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px' }}>
                    <input style={{ ...inp, flex: '0 0 32%' }} value={l.label || ''} placeholder={i === 0 ? (copy.doorPlaceholder || 'IG') : 'IG'} maxLength={24} onChange={e => setLink(i, 'label', e.target.value)} />
                    <input style={{ ...inp, flex: 1 }} value={l.url || ''} placeholder="https://…" onChange={e => setLink(i, 'url', e.target.value)} />
                    <button onClick={() => delLink(i)} aria-label="Remove link" style={{ background: 'transparent', border: `1px solid ${HAIR}`, borderRadius: '8px', width: '38px', flexShrink: 0, color: WARN, cursor: 'pointer' }}><X size={13} /></button>
                  </div>
                ))}
                {links.some(l => l.url && !worldSafeUrl(l.url)) && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: WARN }}>Links must start with http:// or https://</div>}
                <button onClick={addLink} style={{ background: 'transparent', border: `1px dashed ${HAIR_HI}`, borderRadius: '12px', padding: '11px', color: BONE_MID, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'DM Sans' }}>
                  <Plus size={13} /> Add a door
                </button>
              </div>
            )}

            {key === 'marquee' && (
              <div>
                <label style={monoLabel}>THE LINE THAT LOOPS</label>
                <input style={inp} value={data.marquee_text ?? DEFAULT_MARQUEE} maxLength={80} placeholder={DEFAULT_MARQUEE} onChange={e => onDraft({ marquee_text: e.target.value })} />
                <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.06em', marginTop: '8px' }}>
                  look up — it&rsquo;s already running.
                </div>
              </div>
            )}

            {key === 'skin' && (
              <div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {THEMES.map(t => {
                    const active = (data.world_theme || 'chrome') === t.key
                    return (
                      <button key={t.key} onClick={() => onDraft({ world_theme: t.key })} className="pressable"
                        style={{ flex: 1, background: active ? 'rgba(var(--silver-rgb),.08)' : CARD, border: `1px solid ${active ? SILVER : HAIR_HI}`, borderRadius: '12px', padding: '14px 6px 10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', transition: 'background .2s, border-color .2s' }}>
                        <span style={{ fontFamily: 'Bebas Neue', fontSize: '24px', lineHeight: 1, ...nameSkin(t.key) }}>Aa</span>
                        <span style={{ fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.2em', textTransform: 'uppercase', color: active ? BONE : BONE_LOW }}>{t.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {err && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: WARN, marginTop: '12px' }}>⚠ {err}</div>}
          </div>

          {/* footer: back / skip / next-publish */}
          <div style={{ position: 'relative', borderTop: `1px solid ${HAIR}`, padding: wide ? '14px 24px 18px' : '12px 18px calc(14px + env(safe-area-inset-bottom, 0px))' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              {safeStep > 0 && (
                <button onClick={() => setStep(s => s - 1)} disabled={busy} aria-label="Back" className="pressable"
                  style={{ background: 'rgba(var(--ink-rgb),.04)', border: `1px solid ${HAIR}`, borderRadius: '10px', padding: '12px 16px', color: BONE_MID, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                  <ArrowLeft size={12} /> Back
                </button>
              )}
              <button onClick={next} disabled={nextDisabled} className="pressable"
                style={{ flex: 1, background: BONE, border: 'none', borderRadius: '10px', padding: '13px', color: VOID, fontWeight: 600, fontSize: '13px', cursor: nextDisabled ? 'default' : 'pointer', fontFamily: 'DM Sans', opacity: nextDisabled ? .5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {busy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  : key === 'skin' ? 'PUBLISH YOUR WORLD'
                  : <>Next <ArrowRight size={13} /></>}
              </button>
            </div>
            {/* the guilt-free door — every step is optional except the publish */}
            {key !== 'skin' && (
              <button onClick={skip} disabled={busy || uploadingN > 0} className="pressable"
                style={{ display: 'block', margin: '10px auto 0', background: 'transparent', border: 'none', color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', padding: '2px 8px' }}>
                skip this step →
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
