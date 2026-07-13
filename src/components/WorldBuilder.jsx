import { useState, useRef, useEffect } from 'react'
import { Loader2, X, ImagePlus, Plus, ArrowLeft, ArrowRight } from 'lucide-react'
import { THEMES, nameSkin, DEFAULT_MARQUEE, normGallery, normLinks, worldSafeUrl, worldCompleteness, chromeDisplayText, craftKindOf, CRAFT_STEPS, composeWorldPlan } from '@/lib/world'
import { useWide } from '@/lib/useIsDesktop'

/* =========================================================================
   WorldBuilder v3 — the builder KNOWS you before it asks you for anything
   (Ley 15). A new world opens with a short conversation — three questions,
   max — and the system COMPOSES the plan: step order, emphasis, a suggested
   skin and welcome line. Then the guided steps run with everything already
   arranged. Curated, never surveyed.

   THE CONVERSATION (new worlds only; returning members go straight to the
   first unfinished step):
     01 · what do you make?                     → discipline (persisted)
     02 · what should entering your world feel like? → skin + marquee seeds
     03 · what do you have ready to show today? → step order + emphasis

   The composition is a client-side decision tree (composeWorldPlan) that
   ALWAYS works; /api/curate polishes the suggestions when the key is live
   and degrades silently when it isn't. Suggestions are DRAFTS the member
   edits or clears — nothing is saved as theirs without passing through
   their own hands (data real o vacío honesto, Ley 11).

   Everything below the conversation is the proven v2 machinery: per-step
   persistence, the serial upload chain, drag/paste, guilt-free skips.
   ========================================================================= */

const VOID = '#0A0A0D'
const BONE = '#F2EEE6'
const BONE_MID = '#9B9891'
const BONE_LOW = '#5B5952'
const SILVER = '#C7C9D1'
const CARD = '#0E0E13'
const HAIR = 'rgba(242,238,230,0.08)'
const HAIR_HI = 'rgba(242,238,230,0.15)'
const WARN = '#E5A0A0'

const NOISE = "<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>"
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(NOISE)}")`

const inp = { width: '100%', background: CARD, border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '12px 14px', color: BONE, fontFamily: 'DM Sans', fontSize: '14px', outline: 'none' }
const monoLabel = { fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.22em', color: BONE_LOW, textTransform: 'uppercase', display: 'block', marginBottom: '7px' }

/* The reason this exists — shown on the first beat, verbatim guidance. */
const WHY = 'Your world is your card in Discover, your museum — and soon, where you get booked.'

/* The conversation — three questions, each with a reason to exist. */
const MEET = [
  { key: 'craft', kicker: 'question 01 · who you are', title: 'WHAT DO YOU MAKE?', why: `${WHY} Start with the craft — everything composes around it.`, placeholder: 'DJ · Painter · Photographer · Writer…', required: true },
  { key: 'feel', kicker: 'question 02 · the door', title: 'WHEN SOMEONE STEPS IN — WHAT SHOULD THEY FEEL?', why: 'One phrase. It seeds your welcome line and how your name is set.', placeholder: 'like walking into a warm room · raw energy · timeless…', required: false },
  { key: 'show', kicker: 'question 03 · today', title: 'WHAT DO YOU HAVE READY TO SHOW TODAY?', why: 'Only what exists — the world starts honest. What you have leads; the rest waits for you.', required: false },
]
const SHOW_OPTIONS = [
  { key: 'images', label: 'images of my work' },
  { key: 'links', label: 'links where my stuff lives' },
  { key: 'words', label: "words I've written" },
]

/* Base copy per step — one cosmos line that says WHY, never a demand. */
const STEP_COPY = {
  craft: { title: 'YOUR CRAFT', kicker: 'the door sign', why: `${WHY} Start with what you make.` },
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

/* Land on the first unfinished step of THIS order, not always at zero. */
function firstUnfinished(steps, d) {
  for (let i = 0; i < steps.length; i++) {
    const k = steps[i]
    if (k === 'craft' && !(d?.discipline || '').trim()) return i
    if (k === 'line' && !(d?.tagline || '').trim()) return i
    if (k === 'words' && !(d?.bio || '').trim()) return i
    if (k === 'work' && normGallery(d?.gallery).length < 3) return i
    if (k === 'doors' && !normLinks(d?.world_links).length) return i
    if (k === 'marquee' && d?.marquee_text == null) return i
  }
  return steps.length - 1
}

export default function WorldBuilder({ data, onDraft, onCommit, onUploadGallery, onCleanupImages, onCurate, onClose, onPublished }) {
  const wide = useWide()
  // A world with no craft yet meets the conversation; a returning member's
  // world goes straight to its first unfinished step.
  const isNew = !(data?.discipline || '').trim() && normGallery(data?.gallery).length === 0
  const [stage, setStage] = useState(isNew ? 'meet' : 'steps')  // meet | compose | plan | steps
  const [meetIdx, setMeetIdx] = useState(0)
  const [answers, setAnswers] = useState({ craft: '', feel: '', show: [] })
  const [plan, setPlan] = useState(null)          // { kind, steps, skin, marquee, line }
  const [planSteps, setPlanSteps] = useState(null)

  const kind = plan?.kind ?? craftKindOf(data?.discipline)
  const steps = planSteps || CRAFT_STEPS[craftKindOf(data?.discipline)]
  const [step, setStep] = useState(() => (isNew ? 0 : firstUnfinished(CRAFT_STEPS[craftKindOf(data?.discipline)], data)))
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
  const { pct } = worldCompleteness(data)
  const gallery = normGallery(data?.gallery)
  const links = Array.isArray(data?.world_links) ? data.world_links : []

  /* ---- the conversation → the composed plan ---- */
  const meetNext = async () => {
    setErr('')
    const q = MEET[meetIdx]
    if (q.key === 'craft') {
      // the craft persists the moment it's spoken — nothing is ever lost
      const craft = answers.craft.trim()
      if (!craft) return
      setBusy(true)
      try { await onCommit({ discipline: craft }) } catch (e) {
        setErr(e?.message ? `Couldn't save — ${e.message}` : "Couldn't save — try again.")
        setBusy(false); return
      }
      setBusy(false)
    }
    if (meetIdx < MEET.length - 1) { setMeetIdx(meetIdx + 1); return }
    compose()
  }
  const meetSkip = () => {
    if (meetIdx < MEET.length - 1) { setMeetIdx(meetIdx + 1); return }
    compose()
  }

  const compose = async () => {
    setStage('compose')
    // the decision tree ALWAYS composes; /api/curate refines when it's live.
    const local = composeWorldPlan({ craft: answers.craft || data?.discipline, feel: answers.feel, show: answers.show })
    const beat = new Promise((r) => setTimeout(r, 900))   // the moment reads as composed, not instant
    let refined = null
    if (onCurate) {
      refined = await Promise.race([
        onCurate({ craft: answers.craft || data?.discipline || '', feel: answers.feel, show: answers.show }).catch(() => null),
        new Promise((r) => setTimeout(() => r(null), 3500)),   // never hold the door for the polish
      ])
    }
    await beat
    const merged = {
      ...local,
      skin: refined?.skin && THEMES.some((t) => t.key === refined.skin) ? refined.skin : local.skin,
      marquee: (refined?.marquee || '').trim() || local.marquee,
      line: (refined?.line || '').trim() || null,
    }
    // suggestions land as DRAFTS in the live preview — the member walks each
    // step and keeps, rewrites, or clears them before anything commits
    const draft = { world_theme: merged.skin }
    if (merged.marquee && data?.marquee_text == null) draft.marquee_text = merged.marquee
    if (merged.line && !(data?.tagline || '').trim()) draft.tagline = merged.line
    onDraft(draft)
    setPlan(merged)
    setPlanSteps(merged.steps)
    setStep(0)
    setStage('plan')
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

  const next = () => {
    if (key === 'craft') return commitAndGo({ discipline: (data.discipline || '').trim() || null, tagline: (data.tagline || '').trim() || null }, safeStep + 1)
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
    (key === 'craft' && !(data.discipline || '').trim()) ||
    (key === 'doors' && links.length > 0 && !links.some(l => worldSafeUrl(l.url)))

  // phone: a bottom sheet under the live museum · wide: a studio panel docked
  // right, the world composing at full width beside it
  const shell = wide
    ? { position: 'fixed', top: '56px', right: 0, bottom: 0, width: '480px', zIndex: 10000, background: 'rgba(10,10,13,.97)', borderLeft: `1px solid ${HAIR_HI}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '-40px 0 90px rgba(0,0,0,.45)' }
    : { position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: '100%', maxWidth: '430px', zIndex: 10000, background: 'rgba(10,10,13,.97)', borderTop: `1px solid ${HAIR_HI}`, borderRadius: '18px 18px 0 0', maxHeight: '58vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }

  /* ------------------------- header (all stages) ------------------------- */
  const headerLine = stage === 'steps'
    ? `◇ build your world · ${String(safeStep + 1).padStart(2, '0')}/${String(steps.length).padStart(2, '0')}`
    : stage === 'meet'
      ? `◇ getting to know you · ${String(meetIdx + 1).padStart(2, '0')}/${String(MEET.length).padStart(2, '0')}`
      : '◇ composing your world'

  return (
    // z 10000: ABOVE Layout's bottom nav (9999) — the nav must never cover
    // the sheet's own footer (Back / Next / Publish)
    <div role="dialog" aria-label="Build your world" style={shell}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: GRAIN, backgroundSize: '150px 150px', opacity: 0.05, mixBlendMode: 'overlay', pointerEvents: 'none' }} />

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
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: SILVER, opacity: .7, transition: 'width .5s ease' }} />
        </div>
      </div>

      {/* ======================= THE CONVERSATION ======================= */}
      {stage === 'meet' && (() => {
        const q = MEET[meetIdx]
        const canNext = !busy && (!q.required || (q.key === 'craft' ? answers.craft.trim() : true))
        return (
          <>
            <div className="no-scrollbar" style={{ padding: wide ? '22px 24px 10px' : '16px 18px 8px', overflowY: 'auto', position: 'relative', flex: 1, minHeight: 0 }}>
              {/* the transcript — what they already told us, quiet, above */}
              {meetIdx > 0 && (
                <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {answers.craft.trim() && <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.08em' }}>— you make · <span style={{ color: BONE_MID }}>{answers.craft.trim()}</span></div>}
                  {meetIdx > 1 && answers.feel.trim() && <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.08em' }}>— it should feel · <span style={{ color: BONE_MID }}>{answers.feel.trim()}</span></div>}
                </div>
              )}
              <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.24em', textTransform: 'uppercase' }}>{q.kicker}</div>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '30px' : '24px', letterSpacing: '.03em', lineHeight: 1.02, marginTop: '6px', ...chromeDisplayText }}>{q.title}</div>
              <p style={{ fontFamily: 'DM Sans', fontSize: '13px', color: BONE_MID, lineHeight: 1.6, margin: '10px 0 16px' }}>{q.why}</p>

              {q.key !== 'show' ? (
                <input autoFocus={wide} style={inp} value={answers[q.key]} placeholder={q.placeholder} maxLength={q.key === 'craft' ? 60 : 120}
                  onChange={(e) => setAnswers(a => ({ ...a, [q.key]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && canNext) meetNext() }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {SHOW_OPTIONS.map((o) => {
                    const on = answers.show.includes(o.key)
                    return (
                      <button key={o.key} onClick={() => setAnswers(a => ({ ...a, show: on ? a.show.filter(k => k !== o.key) : [...a.show, o.key] }))}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left', background: on ? 'rgba(199,201,209,.08)' : CARD, border: `1px solid ${on ? SILVER : HAIR_HI}`, borderRadius: '11px', padding: '12px 14px', cursor: 'pointer', transition: 'all .2s' }}>
                        <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '11px', color: on ? BONE : BONE_LOW }}>{on ? '◆' : '◇'}</span>
                        <span style={{ fontFamily: 'DM Sans', fontSize: '13px', color: on ? BONE : BONE_MID }}>{o.label}</span>
                      </button>
                    )
                  })}
                  <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.08em', marginTop: '2px' }}>pick what's real today — or nothing, and the world waits with you.</div>
                </div>
              )}
              {err && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: WARN, marginTop: '12px' }}>⚠ {err}</div>}
            </div>
            <div style={{ position: 'relative', borderTop: `1px solid ${HAIR}`, padding: wide ? '14px 24px 18px' : '12px 18px calc(14px + env(safe-area-inset-bottom, 0px))' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                {meetIdx > 0 && (
                  <button onClick={() => setMeetIdx(i => i - 1)} disabled={busy} aria-label="Back"
                    style={{ background: 'rgba(242,238,230,.04)', border: `1px solid ${HAIR}`, borderRadius: '10px', padding: '12px 16px', color: BONE_MID, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                    <ArrowLeft size={12} /> Back
                  </button>
                )}
                <button onClick={meetNext} disabled={!canNext}
                  style={{ flex: 1, background: BONE, border: 'none', borderRadius: '10px', padding: '13px', color: VOID, fontWeight: 600, fontSize: '13px', cursor: canNext ? 'pointer' : 'default', fontFamily: 'DM Sans', opacity: canNext ? 1 : .5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {busy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    : meetIdx === MEET.length - 1 ? 'COMPOSE MY WORLD'
                    : <>Next <ArrowRight size={13} /></>}
                </button>
              </div>
              {!q.required && (
                <button onClick={meetSkip} disabled={busy}
                  style={{ display: 'block', margin: '10px auto 0', background: 'transparent', border: 'none', color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', padding: '2px 8px' }}>
                  skip this one →
                </button>
              )}
            </div>
          </>
        )
      })()}

      {/* ======================= THE COMPOSITION BEAT ======================= */}
      {stage === 'compose' && (
        <div style={{ padding: wide ? '40px 24px' : '32px 18px', position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', minHeight: '200px' }}>
          <Loader2 size={18} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
          <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_MID, letterSpacing: '.24em', textTransform: 'uppercase' }}>composing your world…</div>
        </div>
      )}

      {/* ======================= THE PLAN, PRESENTED ======================= */}
      {stage === 'plan' && plan && (
        <>
          <div className="no-scrollbar" style={{ padding: wide ? '22px 24px 10px' : '16px 18px 8px', overflowY: 'auto', position: 'relative', flex: 1, minHeight: 0 }}>
            <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.24em', textTransform: 'uppercase' }}>composed for you</div>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '32px' : '26px', letterSpacing: '.03em', lineHeight: 1, marginTop: '6px', ...chromeDisplayText }}>
              {plan.kind === 'sound' ? 'A SOUND WORLD' : plan.kind === 'word' ? 'A WRITTEN WORLD' : plan.kind === 'visual' ? 'A VISUAL WORLD' : 'YOUR WORLD'}
            </div>
            <p style={{ fontFamily: 'DM Sans', fontSize: '13px', color: BONE_MID, lineHeight: 1.6, margin: '10px 0 14px' }}>
              {plan.kind === 'sound' ? 'Your sound leads — the links that play you come first, visuals behind them.'
                : plan.kind === 'word' ? 'Your words lead — one piece opens the world, the wall hangs behind it.'
                : plan.kind === 'visual' ? 'Your eye leads — the wall of work opens the world.'
                : 'Your work opens the world — everything else composes around it.'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <PlanRow label="the order" value={plan.steps.map((s) => (STEP_COPY[s]?.title || s).toLowerCase()).join(' → ')} />
              <PlanRow label="suggested skin" value={plan.skin} />
              {plan.marquee && <PlanRow label="suggested welcome" value={`“${plan.marquee}”`} />}
              {plan.line && <PlanRow label="suggested line" value={`“${plan.line}”`} />}
            </div>
            <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.06em', lineHeight: 1.6, marginTop: '14px' }}>
              suggestions, not decisions — every one passes through your hands before it ships. look up: the skin is already on your name.
            </div>
          </div>
          <div style={{ position: 'relative', borderTop: `1px solid ${HAIR}`, padding: wide ? '14px 24px 18px' : '12px 18px calc(14px + env(safe-area-inset-bottom, 0px))' }}>
            <button onClick={() => setStage('steps')}
              style={{ width: '100%', background: BONE, border: 'none', borderRadius: '10px', padding: '13px', color: VOID, fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans' }}>
              START BUILDING →
            </button>
          </div>
        </>
      )}

      {/* ======================= THE STEPS (v2 machinery) ======================= */}
      {stage === 'steps' && (
        <>
          {/* step body */}
          <div className="no-scrollbar" {...dragProps} style={{ padding: wide ? '22px 24px 10px' : '16px 18px 8px', overflowY: 'auto', position: 'relative', flex: 1, minHeight: 0, ...(dragOver && { outline: `1px dashed ${SILVER}`, outlineOffset: '-8px', background: 'rgba(199,201,209,.04)' }) }}>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '32px' : '26px', letterSpacing: '.04em', lineHeight: 1, ...chromeDisplayText }}>{copy.title}</div>
            <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.24em', textTransform: 'uppercase', marginTop: '5px' }}>{copy.kicker}</div>
            <p style={{ fontFamily: 'DM Sans', fontSize: '13px', color: BONE_MID, lineHeight: 1.6, margin: '10px 0 16px' }}>{copy.why}</p>

            {key === 'craft' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                <div>
                  <label style={monoLabel}>WHAT YOU MAKE</label>
                  <input style={inp} value={data.discipline || ''} placeholder="DJ · Painter · Photographer…" maxLength={60} onChange={e => onDraft({ discipline: e.target.value })} />
                </div>
                <div>
                  <label style={monoLabel}>YOUR LINE</label>
                  <input style={inp} value={data.tagline || ''} placeholder="One line, your voice — what you're on right now." maxLength={120} onChange={e => onDraft({ tagline: e.target.value })} />
                </div>
                {kind !== 'generic' && (
                  <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.08em', lineHeight: 1.6 }}>
                    {kind === 'sound' ? '♪ a sound world — your links will lead' : kind === 'word' ? '◆ a written world — your piece comes next' : '● a visual world — your wall leads'}
                  </div>
                )}
              </div>
            )}

            {key === 'line' && (
              <div>
                <label style={monoLabel}>YOUR LINE</label>
                <input style={inp} value={data.tagline || ''} placeholder="One line, your voice — what you're on right now." maxLength={120} onChange={e => onDraft({ tagline: e.target.value })} />
                {plan?.line && (data.tagline || '') === plan.line && (
                  <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.06em', marginTop: '8px' }}>
                    suggested from what you told us — rewrite it, or clear it and speak.
                  </div>
                )}
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
                  style={{ width: '100%', background: dragOver ? 'rgba(199,201,209,.07)' : 'transparent', border: `1px dashed ${dragOver ? SILVER : HAIR_HI}`, borderRadius: '12px', padding: '16px 13px', color: BONE_MID, fontSize: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'DM Sans', opacity: uploadingN > 0 ? .6 : 1, transition: 'all .2s' }}>
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
                  {plan?.marquee && (data.marquee_text ?? '') === plan.marquee
                    ? 'seeded from what you want them to feel — look up, it\'s already running. make it yours.'
                    : 'look up — it\'s already running.'}
                </div>
              </div>
            )}

            {key === 'skin' && (
              <div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {THEMES.map(t => {
                    const active = (data.world_theme || 'chrome') === t.key
                    return (
                      <button key={t.key} onClick={() => onDraft({ world_theme: t.key })}
                        style={{ flex: 1, background: active ? 'rgba(199,201,209,.08)' : CARD, border: `1px solid ${active ? SILVER : HAIR_HI}`, borderRadius: '12px', padding: '14px 6px 10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', transition: 'all .2s' }}>
                        <span style={{ fontFamily: 'Bebas Neue', fontSize: '24px', lineHeight: 1, ...nameSkin(t.key) }}>Aa</span>
                        <span style={{ fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.2em', textTransform: 'uppercase', color: active ? BONE : BONE_LOW }}>{t.label}</span>
                      </button>
                    )
                  })}
                </div>
                {plan?.skin && (data.world_theme || 'chrome') === plan.skin && (
                  <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.06em', marginTop: '10px' }}>
                    matched to the feel you described — switch it if it reads wrong.
                  </div>
                )}
              </div>
            )}

            {err && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: WARN, marginTop: '12px' }}>⚠ {err}</div>}
          </div>

          {/* footer: back / skip / next-publish */}
          <div style={{ position: 'relative', borderTop: `1px solid ${HAIR}`, padding: wide ? '14px 24px 18px' : '12px 18px calc(14px + env(safe-area-inset-bottom, 0px))' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              {safeStep > 0 && (
                <button onClick={() => setStep(s => s - 1)} disabled={busy} aria-label="Back"
                  style={{ background: 'rgba(242,238,230,.04)', border: `1px solid ${HAIR}`, borderRadius: '10px', padding: '12px 16px', color: BONE_MID, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                  <ArrowLeft size={12} /> Back
                </button>
              )}
              <button onClick={next} disabled={nextDisabled}
                style={{ flex: 1, background: BONE, border: 'none', borderRadius: '10px', padding: '13px', color: VOID, fontWeight: 600, fontSize: '13px', cursor: nextDisabled ? 'default' : 'pointer', fontFamily: 'DM Sans', opacity: nextDisabled ? .5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {busy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  : key === 'skin' ? 'PUBLISH YOUR WORLD'
                  : <>Next <ArrowRight size={13} /></>}
              </button>
            </div>
            {/* the guilt-free door — every step is optional except the publish */}
            {key !== 'skin' && (
              <button onClick={skip} disabled={busy || uploadingN > 0}
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

function PlanRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', borderBottom: `1px solid ${HAIR}`, paddingBottom: '7px' }}>
      <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.18em', textTransform: 'uppercase', flexShrink: 0, width: '110px' }}>{label}</span>
      <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: BONE_MID, letterSpacing: '.03em', lineHeight: 1.5 }}>{value}</span>
    </div>
  )
}
