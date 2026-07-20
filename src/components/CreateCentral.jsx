import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
// v12: Sparkles → LayoutGrid (curate = arranging a gallery, not "magic"),
// Mark 'star' → Users (a plan is people). ArrowLeft is still used by the
// composers' Back; Sparkles is gone from this file entirely.
import { X, ImagePlus, Loader2, ArrowLeft, Tag, Handshake, CalendarPlus, LayoutGrid, Users, Camera } from 'lucide-react'
import { useWide } from '@/lib/useIsDesktop'
import Mark from '@/components/Mark'
import { createWorldPost } from '@/lib/worldPosts'
import { createListing, KINDS, priceLabel } from '@/lib/listings'
import { socialReady, circleReady } from '@/lib/social'

/* =========================================================================
   CREATE CENTRAL — the + at the center of the app (Ley 13; the Base44
   steal). v8 (adición A): the six flat intentions become THREE DOORS —
   Pato's drop: "post your world y curate your world podrían estar más
   juntos. Make a plan o just an event, más juntos. Offer a service y
   sell, más juntos."

     ○ SHARE   — post to your world · curate your world
     ◇ GATHER  — make a plan · host an event (verified)
     △ OFFER   — offer a service · sell a piece

   The structural reason is not cleanliness: six flat buttons cannot
   become twelve. Three doors hold four each without the member feeling
   anything. Each door wears its house mark (Ley 14); honest absence
   holds per door AND per intention (Leyes 9/11) — a door with nothing
   live behind it simply isn't there.
   ========================================================================= */

const VOID = '#0A0A0D'
const VOID_2 = '#07080E'
const BONE = '#F2EEE6'
const BONE_MID = '#9B9891'
const BONE_LOW = '#5B5952'
const FAINT = '#4C4C57'                              // deck --faint (group sub-labels)
const SILVER = '#C7C9D1'
const CARD = '#0E0E13'
const HAIR = 'rgba(242,238,230,0.08)'
const HAIR_HI = 'rgba(242,238,230,0.15)'
const WARN = '#E5A0A0'
const CHROME = 'linear-gradient(100deg,#F6F6FA 0%,#A6ABBA 26%,#FCFCFE 50%,#8E94A6 73%,#EFEFF4 100%)' // deck formula — jewelry, one moment per screen (v8 D3)
const chromeText = { background: CHROME, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }

const MAX_POST_IMAGES = 4
const MAX_LISTING_IMAGES = 4

export default function CreateCentral({ user, isMemberVerified, onClose, devForceReady = false }) {
  const navigate = useNavigate()
  const wide = useWide()
  // menu (the doors) | share | gather | offer (a door open) | post | posted | sell | listed
  const [stage, setStage] = useState('menu')
  const [sellKind, setSellKind] = useState('piece')
  // the marketplace doors render only when the layer is LIVE in the DB —
  // pre-migration they're honestly absent, never a full composer that
  // hits a wall at publish (panel + review catch, Leyes 9/11)
  const [marketReady, setMarketReady] = useState(false)
  // devForceReady: the /__create harness has no real session, so the probes
  // below answer false and the menu renders a shape no real member sees.
  // import.meta.env.DEV is statically false in prod — this branch does not ship.
  const forced = import.meta.env.DEV && devForceReady
  useEffect(() => {
    if (forced) { setMarketReady(true); return undefined }
    let on = true; socialReady().then((r) => { if (on) setMarketReady(r) }); return () => { on = false }
  }, [forced])
  // same doctrine for the plan door: it renders only once 0023 is live
  const [planReady, setPlanReady] = useState(false)
  useEffect(() => {
    if (forced) { setPlanReady(true); return undefined }
    let on = true; circleReady().then((r) => { if (on) setPlanReady(r) }); return () => { on = false }
  }, [forced])
  // while a write is in flight, neither Esc nor the backdrop may abandon it
  const busyRef = useRef(false)
  const dialogRef = useRef(null)

  // Esc closes; lock body scroll while open; focus moves INTO the dialog
  // and back to the opener on close (a11y catch). Mount-once with onClose
  // in a ref — an unstable inline onClose from Layout re-ran this effect
  // mid-session and stole focus from a member mid-caption (review catch).
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const opener = document.activeElement
    dialogRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape' && !busyRef.current) onCloseRef.current() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      if (opener && typeof opener.focus === 'function') opener.focus()
    }
  }, [])

  const go = (path) => { onClose(); navigate(path) }

  const shell = wide
    ? { position: 'relative', width: 'min(560px, 92vw)', maxHeight: '86vh', background: VOID_2, border: `1px solid ${HAIR_HI}`, borderRadius: '18px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 90px rgba(0,0,0,.6)' }
    : { position: 'relative', width: '100%', maxWidth: '430px', maxHeight: '86dvh', background: VOID_2, borderTop: `1px solid ${HAIR_HI}`, borderRadius: '20px 20px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }

  return createPortal(
    <div onClick={() => { if (!busyRef.current) onClose() }} className="overlay-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 10005, background: 'rgba(7,8,14,.8)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: wide ? 'center' : 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Create" className={wide ? 'dialog-in' : 'sheet-up'} style={{ ...shell, outline: 'none' }}>

        {stage === 'menu' && (
          <CreateMenu wide={wide}
            verified={isMemberVerified} marketReady={marketReady} planReady={planReady} onClose={onClose}
            onPost={() => setStage('post')}
            onPlan={() => go('/messages?seg=plans&new=1')}
            onSell={(kind) => { setSellKind(kind); setStage('sell') }}
            onHost={() => go('/os?tab=events&new=1')}
            onCurate={() => go('/profile')} />
        )}
        {stage === 'post' && (
          // v12: back goes to 'menu' — the intermediate 'share'/'offer' stages
          // no longer exist now that the menu is one screen. Left pointing at
          // a dead stage, Back would have rendered nothing.
          <PostComposer wide={wide} user={user} onBack={() => setStage('menu')} onClose={onClose}
            onBusy={(b) => { busyRef.current = b }}
            onPosted={() => { busyRef.current = false; setStage('posted') }} />
        )}
        {stage === 'posted' && (
          <Done
            kicker="posted" title={<>IT LIVES IN<br />YOUR WORLD</>}
            line="A dated piece in your museum — the world can see it now."
            cta="SEE IT IN YOUR WORLD" onCta={() => go('/profile')} onClose={onClose} />
        )}
        {stage === 'sell' && (
          <ListingComposer wide={wide} user={user} kind={sellKind} onBack={() => setStage('menu')} onClose={onClose}
            onBusy={(b) => { busyRef.current = b }}
            onListed={() => { busyRef.current = false; setStage('listed') }} />
        )}
        {stage === 'listed' && (
          <Done
            kicker="on offer" title={<>IT'S ON<br />THE WALL</>}
            line={sellKind === 'service'
              ? 'Your service hangs in your world with its price — people reach you by DM.'
              : 'Your piece hangs in your world with its price — people reach you by DM.'}
            cta="SEE YOUR OFFER" onCta={() => go('/profile')} onClose={onClose} />
        )}
      </div>
    </div>,
    document.body
  )
}

/* ---------- the closing moment, shared ---------- */
function Done({ kicker, title, line, cta, onCta, onClose }) {
  return (
    <div style={{ position: 'relative', padding: '44px 28px 40px', textAlign: 'center' }}>
      <div className="rise" style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>◇ {kicker}</div>
      <div className="rise rise-1" style={{ fontFamily: 'Bebas Neue', fontSize: '40px', lineHeight: .95, marginTop: '14px', ...chromeText }}>{title}</div>
      <p className="rise rise-2" style={{ fontFamily: 'DM Sans', fontSize: '13px', color: BONE_MID, lineHeight: 1.6, marginTop: '12px' }}>{line}</p>
      {/* the rise animates the WRAPPER: a filled animation outranks .pressable's
          :active transform, so a .rise on the button would kill its press. */}
      <div className="rise rise-3" style={{ marginTop: '24px', display: 'flex' }}>
        <button className="pressable" onClick={onCta}
          style={{ width: '100%', background: BONE, border: 'none', borderRadius: '10px', padding: '14px', color: VOID, fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans' }}>
          {cta}
        </button>
      </div>
      <button className="rise rise-4" onClick={onClose} style={{ marginTop: '12px', background: 'transparent', border: 'none', color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
        done
      </button>
    </div>
  )
}

/* ---------- THE CREATE MENU (v12 rewrite of the v8 doors) ----------

   WHAT CHANGED AND WHY. v8 put three DOORS on this screen (SHARE / GATHER /
   OFFER) and hid the six real actions behind them. Observed in production:
   a first-timer opens CREATE and cannot tell what any door does without
   reading, then has to guess which one holds the thing they came for. At
   the single most important moment in the product — creating — the member
   hesitates. Hesitation kills the action.

   Three specific defects, all visible in the shipped screen:
   1. TWO TAPS TO THE MOST COMMON ACTION. "I want to post something" — the
      overwhelmingly common intent — was menu → door → action.
   2. THE SUB-ACTIONS READ AS A CAPTION, NOT AS BUTTONS. They were rendered
      as INTENTS[key].map(t => t.toLowerCase()).join(' · ') — one lowercase
      DM Mono string. It looked like a description of the door, because
      typographically that is exactly what it was.
   3. THE DOOR MARKS SAID NOTHING. ○ ◇ △ for SHARE / GATHER / OFFER, while
      the actions BEHIND them already used legible pictograms (Camera, Tag,
      Handshake). The house had already conceded legibility one layer down.

   THE FIX IS ONE SCREEN. Every action is visible and pressable immediately,
   GROUPED under its intention rather than hidden behind it. This keeps the
   v8 insight that made doors worth building — grouping is what lets this
   scale past six items — and drops the cost, which was concealment.

   The group marks (○ ◇ △) survive as SECTION MARKERS, which is the job the
   design system actually locks them to. Function is carried by the action
   icons. Same hand, correct division of labour.

   Cards, not list rows: each action is a bordered object with its own fill.
   The v8 rows were borderless with a hairline divider — typographically a
   LIST. A border is what makes a thing read as pressable, and the reference
   posters in the brand deck already speak in outlined capsules.
   ------------------------------------------------------------------- */
function CreateMenu({ wide, verified, marketReady, planReady, onPost, onPlan, onSell, onHost, onCurate, onClose }) {
  /* Each action exists only when its layer is LIVE (Leyes 9/11).
     ICON CHANGES (function over decoration, Ley 5 / Ley 14):
       CURATE  Sparkles → LayoutGrid. "Sparkles" reads as AI/magic in every
               other product on the member's phone; this action arranges a
               gallery, so it should look like arranging a gallery.
       PLAN    Mark 'star' → Users. A plan is PEOPLE. The star said nothing,
               and it also collided with the star used as a section marker.
       Camera / CalendarPlus / Handshake / Tag were already legible — kept.
     COPY: one line each, cut to the shortest true sentence. The v8 rows
     carried a title, an uppercase kicker AND a full sentence — three text
     elements competing inside one button. */
  const GROUPS = [
    {
      key: 'share', mark: 'ring', tint: '242,238,230',
      title: 'SHARE', line: 'your world speaks',
      items: [
        { icon: Camera,     title: 'POST TO YOUR WORLD', line: 'Images and a line — dated in your museum.', onGo: onPost, hero: true },
        { icon: LayoutGrid, title: 'CURATE YOUR WORLD',  line: 'Shape the gallery, sound and marquee.', onGo: onCurate },
      ],
    },
    {
      key: 'gather', mark: 'diamond', tint: '232,233,237',
      title: 'GATHER', line: 'real life, planned',
      items: [
        ...(planReady ? [{ icon: Users, title: 'MAKE A PLAN', line: 'A kickback, a roadtrip, real life.', onGo: onPlan }] : []),
        ...(verified ? [{ icon: CalendarPlus, title: 'HOST AN EVENT', line: 'Publish it, sell it, scan the door.', onGo: onHost }] : []),
      ],
    },
    {
      key: 'offer', mark: 'triangle', tint: '199,201,209',
      title: 'OFFER', line: 'your craft, priced',
      items: marketReady ? [
        { icon: Handshake, title: 'OFFER A SERVICE', line: 'Shoots, sets, design — with your rate.', onGo: () => onSell('service') },
        { icon: Tag,       title: 'SELL A PIECE',    line: 'Clothing, prints, archive — name it, price it.', onGo: () => onSell('piece') },
      ] : [],
    },
  ].filter((g) => g.items.length > 0)   // a group with nothing live isn't there

  return (
    <div style={{ position: 'relative', padding: wide ? '24px 26px 24px' : '18px 18px calc(18px + env(safe-area-inset-bottom, 0px))', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>◇ create</div>
        <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: '4px', display: 'inline-flex' }}><X size={16} /></button>
      </div>

      <div style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '34px' : '30px', lineHeight: .95, marginTop: '8px', ...chromeText }}>
        PUT SOMETHING<br />INTO THE WORLD
      </div>

      {GROUPS.map((g) => (
        /* testid stays on the group so the v8 walkthrough's visibility
           assertions keep meaning something after the flow changed */
        <div key={g.key} data-testid={`create-door-${g.key}`} style={{ marginTop: '20px' }}>
          {/* the section marker doing its actual job */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '9px' }}>
            <Mark type={g.mark} size={11} color={`rgb(${g.tint})`} />
            <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_MID, letterSpacing: '.24em', textTransform: 'uppercase' }}>{g.title}</span>
            <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: FAINT, letterSpacing: '.14em', textTransform: 'uppercase' }}>· {g.line}</span>
            <span style={{ flex: 1, height: '1px', background: HAIR }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {g.items.map((it) => <ActionCard key={it.title} it={it} tint={g.tint} wide={wide} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

/* one action — a bordered, obviously pressable object.
   `hero` marks the fastest path (POST): brighter border and a lit icon, so
   "I just want to post something" is the thing the eye lands on first. */
function ActionCard({ it, tint, wide }) {
  const Icon = it.icon
  return (
    <button className="row-lead pressable" data-testid={`create-action-${it.title.toLowerCase().replace(/[^a-z]+/g, '-')}`} onClick={it.onGo}
      style={{
        display: 'flex', alignItems: 'center', gap: '13px', width: '100%', textAlign: 'left',
        background: it.hero ? `rgba(${tint},.055)` : 'rgba(242,238,230,.022)',
        border: `1px solid ${it.hero ? `rgba(${tint},.30)` : HAIR}`,
        borderRadius: '10px', padding: wide ? '14px 14px' : '13px 13px', cursor: 'pointer',
      }}>
      <span aria-hidden style={{
        width: '38px', height: '38px', flexShrink: 0, borderRadius: '9px',
        border: `1px solid rgba(${tint},${it.hero ? .34 : .2})`,
        background: `rgba(${tint},${it.hero ? .1 : .05})`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={17} strokeWidth={1.7} style={{ color: `rgb(${tint})` }} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: 'Bebas Neue', fontSize: '20px', color: BONE, letterSpacing: '.035em', lineHeight: 1 }}>{it.title}</span>
        <span style={{ display: 'block', fontFamily: 'DM Sans', fontSize: '11.5px', color: BONE_MID, lineHeight: 1.4, marginTop: '3px' }}>{it.line}</span>
      </span>
      <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '12px', color: it.hero ? BONE : SILVER, flexShrink: 0 }}>→</span>
    </button>
  )
}

/* ---------- the post composer: images + a line, one honest write ---------- */
function PostComposer({ wide, user, onBack, onClose, onBusy, onPosted }) {
  const [files, setFiles] = useState([])           // [{ file, preview }]
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  // previews are object URLs — a ref mirror releases the CURRENT set on
  // unmount (an [] effect closure would capture the initial empty array
  // and revoke nothing)
  const filesRef = useRef(files)
  filesRef.current = files
  useEffect(() => () => { filesRef.current.forEach((f) => URL.revokeObjectURL(f.preview)) }, [])

  const addFiles = (list) => {
    const imgs = Array.from(list || []).filter((f) => f && f.type?.startsWith('image/'))
    if (!imgs.length) return
    setErr('')
    // create object URLs only for the slots that remain — URLs made past the
    // cap and discarded by a slice would leak unrevoked (review catch)
    setFiles((cur) => {
      const room = Math.max(0, MAX_POST_IMAGES - cur.length)
      return [...cur, ...imgs.slice(0, room).map((file) => ({ file, preview: URL.createObjectURL(file) }))]
    })
  }
  const removeAt = (i) => setFiles((cur) => { URL.revokeObjectURL(cur[i]?.preview); return cur.filter((_, j) => j !== i) })

  // paste an image straight into the composer
  useEffect(() => {
    const onPaste = (e) => {
      const imgs = [...(e.clipboardData?.files || [])].filter((f) => f.type?.startsWith('image/'))
      if (imgs.length) { e.preventDefault(); addFiles(imgs) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  const canPost = !busy && (files.length > 0 || caption.trim().length > 0)

  const publish = async () => {
    if (!canPost || !user) return
    setBusy(true); setErr(''); onBusy?.(true)
    try {
      await createWorldPost(user.id, { files: files.map((f) => f.file), caption })
      // any mounted museum refreshes its timeline without a hard reload
      window.dispatchEvent(new Event('c4:posted'))
      onPosted()
    } catch (e) {
      setErr(e?.message || "couldn't post — try again")
    } finally { setBusy(false); onBusy?.(false) }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer?.files) }}
      style={{ position: 'relative', padding: wide ? '26px 28px 24px' : '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))', overflowY: 'auto', ...(dragOver && { outline: `1px dashed ${SILVER}`, outlineOffset: '-10px' }) }}>
      <ComposerTop onBack={onBack} onClose={onClose} busy={busy} />
      <div style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '32px' : '27px', lineHeight: .95, marginTop: '10px', color: BONE }}>POST TO YOUR WORLD</div>
      <p style={{ fontFamily: 'DM Sans', fontSize: '12.5px', color: BONE_MID, lineHeight: 1.55, margin: '8px 0 16px' }}>
        A moment, dated and hung in your museum. Up to {MAX_POST_IMAGES} images, one line — or just the line.
      </p>

      <Thumbs files={files} busy={busy} onRemove={removeAt} />

      {files.length < MAX_POST_IMAGES && (
        <AddImages busy={busy} dragOver={dragOver} onPick={() => fileRef.current?.click()} />
      )}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple style={{ display: 'none' }}
        onChange={(e) => { const list = Array.from(e.target.files || []); e.target.value = ''; addFiles(list) }} />

      <div style={{ marginTop: '14px' }}>
        <label style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.22em', color: BONE_LOW, textTransform: 'uppercase', display: 'block', marginBottom: '7px' }}>THE LINE</label>
        <textarea value={caption} maxLength={600} rows={3} disabled={busy}
          placeholder="What is this moment? Your voice, one breath."
          onChange={(e) => setCaption(e.target.value)}
          style={{ width: '100%', background: CARD, border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '12px 14px', color: BONE, fontFamily: 'DM Sans', fontSize: '14px', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
      </div>

      {err && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: WARN, marginTop: '10px' }}>⚠ {err}</div>}

      <button className="pressable" onClick={publish} disabled={!canPost}
        style={{ marginTop: '16px', width: '100%', background: BONE, border: 'none', borderRadius: '10px', padding: '14px', color: VOID, fontWeight: 600, fontSize: '13px', cursor: canPost ? 'pointer' : 'default', fontFamily: 'DM Sans', opacity: canPost ? 1 : .5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        {busy ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> POSTING…</> : 'POST IT'}
      </button>
    </div>
  )
}

/* ---------- the listing composer: a piece/service with a REAL price ----------
   The first marketplace layer (Estrella Polar): exist and show honestly.
   No payment path yet → the wall says DM to buy, never a dead checkout
   (Ley 11). Price is required — the price IS the point. */
function ListingComposer({ wide, user, kind, onBack, onClose, onBusy, onListed }) {
  const [files, setFiles] = useState([])
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef(null)

  const filesRef = useRef(files)
  filesRef.current = files
  useEffect(() => () => { filesRef.current.forEach((f) => URL.revokeObjectURL(f.preview)) }, [])

  const addFiles = (list) => {
    const imgs = Array.from(list || []).filter((f) => f && f.type?.startsWith('image/'))
    if (!imgs.length) return
    setErr('')
    // same slot-cap discipline as the post composer (review catch)
    setFiles((cur) => {
      const room = Math.max(0, MAX_LISTING_IMAGES - cur.length)
      return [...cur, ...imgs.slice(0, room).map((file) => ({ file, preview: URL.createObjectURL(file) }))]
    })
  }
  const removeAt = (i) => setFiles((cur) => { URL.revokeObjectURL(cur[i]?.preview); return cur.filter((_, j) => j !== i) })

  const priceNum = Number(price)
  const priceOk = Number.isFinite(priceNum) && priceNum >= 1 && priceNum <= 50000
  const canList = !busy && title.trim().length > 0 && priceOk && (kind === 'service' || files.length > 0)

  const service = kind === 'service'
  const heading = service ? 'OFFER A SERVICE' : 'SELL A PIECE'
  const sub = service
    ? 'Your craft with a rate — shoots, sets, design, whatever you do. Booking happens by DM for now; native booking is a coming layer.'
    : 'A piece with a price — clothing, prints, archive. Buying happens by DM for now; native checkout is a coming layer.'

  const publish = async () => {
    if (!canList || !user) return
    setBusy(true); setErr(''); onBusy?.(true)
    try {
      await createListing(user.id, {
        kind,
        title,
        description: desc,
        priceCents: Math.round(priceNum * 100),
        files: files.map((f) => f.file),
      })
      window.dispatchEvent(new Event('c4:listed'))
      onListed()
    } catch (e) {
      setErr(e?.message || "couldn't publish — try again")
    } finally { setBusy(false); onBusy?.(false) }
  }

  return (
    <div style={{ position: 'relative', padding: wide ? '26px 28px 24px' : '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))', overflowY: 'auto' }}>
      <ComposerTop onBack={onBack} onClose={onClose} busy={busy} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
        <span aria-hidden style={{ width: '34px', height: '34px', flexShrink: 0, borderRadius: '10px', border: '1px solid rgba(199,201,209,.28)', background: 'rgba(199,201,209,.07)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {service ? <Handshake size={15} strokeWidth={1.6} style={{ color: SILVER }} /> : <Tag size={15} strokeWidth={1.6} style={{ color: SILVER }} />}
        </span>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '32px' : '26px', lineHeight: .95, color: BONE }}>{heading}</div>
      </div>
      <p style={{ fontFamily: 'DM Sans', fontSize: '12.5px', color: BONE_MID, lineHeight: 1.55, margin: '8px 0 16px' }}>{sub}</p>

      <Thumbs files={files} busy={busy} onRemove={removeAt} />
      {files.length < MAX_LISTING_IMAGES && (
        <AddImages busy={busy} onPick={() => fileRef.current?.click()}
          hint={service ? 'optional — show the work' : 'show the piece — at least one'} />
      )}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple style={{ display: 'none' }}
        onChange={(e) => { const list = Array.from(e.target.files || []); e.target.value = ''; addFiles(list) }} />

      <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label htmlFor="listing-title" style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.22em', color: BONE_LOW, textTransform: 'uppercase', display: 'block', marginBottom: '7px' }}>{service ? 'THE SERVICE' : 'THE PIECE'}</label>
          <input id="listing-title" value={title} maxLength={120} disabled={busy}
            placeholder={service ? 'Event photography · full set' : 'C4 archive tee · 001'}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: '100%', background: CARD, border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '12px 14px', color: BONE, fontFamily: 'DM Sans', fontSize: '14px', outline: 'none' }} />
        </div>
        <div>
          <label htmlFor="listing-price" style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.22em', color: BONE_LOW, textTransform: 'uppercase', display: 'block', marginBottom: '7px' }}>THE PRICE (USD)</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontFamily: 'Bebas Neue', fontSize: '16px', color: SILVER }}>$</span>
            <input id="listing-price" value={price} inputMode="decimal" disabled={busy}
              placeholder={service ? '150' : '45'}
              aria-invalid={!!price && !priceOk}
              aria-describedby={price && !priceOk ? 'listing-price-err' : undefined}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
              style={{ width: '100%', background: CARD, border: `1px solid ${price && !priceOk ? 'rgba(229,160,160,.4)' : HAIR_HI}`, borderRadius: '10px', padding: '12px 14px 12px 30px', color: BONE, fontFamily: 'DM Sans', fontSize: '14px', outline: 'none' }} />
          </div>
          {price && !priceOk && <div id="listing-price-err" role="alert" style={{ fontFamily: 'DM Mono', fontSize: '8.5px', color: WARN, marginTop: '6px' }}>a real price: $1 – $50,000</div>}
        </div>
        <div>
          <label htmlFor="listing-desc" style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.22em', color: BONE_LOW, textTransform: 'uppercase', display: 'block', marginBottom: '7px' }}>THE DETAILS <span style={{ opacity: .6 }}>· optional</span></label>
          <textarea id="listing-desc" value={desc} maxLength={1000} rows={2} disabled={busy}
            placeholder={service ? 'What it includes, turnaround, where you work.' : 'Size, condition, the story behind it.'}
            onChange={(e) => setDesc(e.target.value)}
            style={{ width: '100%', background: CARD, border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '12px 14px', color: BONE, fontFamily: 'DM Sans', fontSize: '14px', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
        </div>
      </div>

      {err && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: WARN, marginTop: '10px' }}>⚠ {err}</div>}

      <button className="pressable" onClick={publish} disabled={!canList}
        style={{ marginTop: '16px', width: '100%', background: BONE, border: 'none', borderRadius: '10px', padding: '14px', color: VOID, fontWeight: 600, fontSize: '13px', cursor: canList ? 'pointer' : 'default', fontFamily: 'DM Sans', opacity: canList ? 1 : .5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        {busy
          ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> PUTTING IT UP…</>
          : `PUT IT ON THE WALL${priceOk ? ` · ${priceLabel(Math.round(priceNum * 100))}` : ''}`}
      </button>
      <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.1em', textAlign: 'center', marginTop: '10px', textTransform: 'uppercase' }}>
        {KINDS[kind].cta} · native checkout comes next
      </div>
    </div>
  )
}

/* ---------- shared composer pieces ---------- */
function ComposerTop({ onBack, onClose, busy }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <button onClick={onBack} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'transparent', border: 'none', color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.18em', textTransform: 'uppercase', cursor: 'pointer', padding: 0 }}>
        <ArrowLeft size={12} /> create
      </button>
      <button onClick={onClose} disabled={busy} aria-label="Close" style={{ background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: '4px', display: 'inline-flex', opacity: busy ? .4 : 1 }}><X size={16} /></button>
    </div>
  )
}

function Thumbs({ files, busy, onRemove }) {
  if (!files.length) return null
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
      {files.map((f, i) => (
        <div key={f.preview} style={{ position: 'relative' }}>
          <img src={f.preview} alt="" style={{ width: '72px', height: '72px', borderRadius: '10px', objectFit: 'cover', border: `1px solid ${HAIR_HI}`, display: 'block' }} />
          <button onClick={() => onRemove(i)} disabled={busy} aria-label="Remove image" style={{ position: 'absolute', top: '-6px', right: '-6px', width: '19px', height: '19px', borderRadius: '50%', background: VOID, border: `1px solid ${HAIR_HI}`, color: WARN, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><X size={10} /></button>
        </div>
      ))}
    </div>
  )
}

function AddImages({ busy, dragOver, onPick, hint }) {
  return (
    <button className="pressable" onClick={onPick} disabled={busy}
      style={{ width: '100%', background: dragOver ? 'rgba(199,201,209,.07)' : 'transparent', border: `1px dashed ${dragOver ? SILVER : HAIR_HI}`, borderRadius: '12px', padding: '16px 13px', color: BONE_MID, fontSize: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', fontFamily: 'DM Sans', opacity: busy ? .6 : 1 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><ImagePlus size={14} /> Add images</span>
      <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.1em' }}>{hint || 'tap · drag it in · or just paste'}</span>
    </button>
  )
}
