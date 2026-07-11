import { useState, useRef } from 'react'
import { Loader2, X, ImagePlus, Plus, ArrowLeft, ArrowRight } from 'lucide-react'
import { THEMES, nameSkin, DEFAULT_MARQUEE, marqueeOf, normGallery, normLinks, worldSafeUrl, worldCompleteness, chromeDisplayText } from '@/lib/world'

/* =========================================================================
   WorldBuilder — "Edit your world" becomes BUILD YOUR WORLD.
   A guided, five-step sheet that sits at the bottom of the screen while
   the museum itself renders LIVE above it — you watch your world form,
   never fill a blind form.

   Steps: craft + your line → the work (3 pieces) → the doors (links) →
   the marquee → the skin → PUBLISH. Every step persists on Next (nothing
   is lost if you walk away). The why, in the owner's face the whole time:
   your world is your card in Discover, your museum — and soon, where you
   get booked.
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

const STEPS = ['craft', 'work', 'doors', 'marquee', 'skin']

/* The reason this exists — shown on step one, verbatim guidance. */
const WHY = 'Your world is your card in Discover, your museum — and soon, where you get booked.'

const STEP_COPY = {
  craft: { title: 'YOUR CRAFT', kicker: 'the door sign', why: `${WHY} Start with what you make.` },
  work: { title: 'THE WORK', kicker: 'what turns it on', why: 'This space is for your work — three pieces turn it on. Shots, canvases, fits, stills.' },
  doors: { title: 'THE DOORS', kicker: 'where it leads', why: 'Every link is a door out of your world — IG, portfolio, sound. One keeps it open.' },
  marquee: { title: 'THE MARQUEE', kicker: 'the welcome', why: 'The line that loops above your world. Make it yours — or keep the house welcome.' },
  skin: { title: 'THE SKIN', kicker: 'your composition', why: 'Same universe, your composition — how your name is set. Watch it change above.' },
}

export default function WorldBuilder({ data, onDraft, onCommit, onUploadGallery, onCleanupImages, onClose, onPublished }) {
  const [step, setStep] = useState(() => {
    // land on the first unfinished step, not always at zero
    if (!(data?.discipline || '').trim()) return 0
    if (normGallery(data?.gallery).length < 3) return 1
    if (!normLinks(data?.world_links).length) return 2
    if (data?.marquee_text == null) return 3
    return 4
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [uploadingN, setUploadingN] = useState(0)
  const galleryRef = useRef(null)

  const key = STEPS[step]
  const copy = STEP_COPY[key]
  const { pct } = worldCompleteness(data)
  const gallery = normGallery(data?.gallery)
  const links = Array.isArray(data?.world_links) ? data.world_links : []

  // ---- per-step commit: persist, then advance (nothing is ever lost) ----
  const commitAndGo = async (patch, nextStep) => {
    setBusy(true); setErr('')
    try {
      await onCommit(patch)
      if (nextStep >= STEPS.length) { onPublished() } else { setStep(nextStep) }
    } catch (e) {
      setErr(e?.message ? `Couldn't save — ${e.message}` : "Couldn't save — try again.")
    } finally { setBusy(false) }
  }

  const next = () => {
    if (key === 'craft') return commitAndGo({ discipline: (data.discipline || '').trim() || null, tagline: (data.tagline || '').trim() || null }, step + 1)
    if (key === 'work') return commitAndGo({ gallery: gallery.map(g => ({ path: g.path || null, url: g.url, caption: (g.caption || '').trim() })) }, step + 1)
    if (key === 'doors') return commitAndGo({ world_links: links.map(l => ({ label: (l.label || '').trim(), url: (l.url || '').trim() })).filter(l => worldSafeUrl(l.url)) }, step + 1)
    if (key === 'marquee') return commitAndGo({ marquee_text: (data.marquee_text ?? DEFAULT_MARQUEE).trim() }, step + 1)
    if (key === 'skin') return commitAndGo({ world_theme: data.world_theme || 'chrome' }, step + 1) // publish
  }

  // ---- gallery: upload persists IMMEDIATELY (the wall builds live) ----
  const addFiles = async (e) => {
    const input = e.target
    const files = Array.from(input.files || [])
    input.value = ''
    if (!files.length || !onUploadGallery) return
    setErr('')
    for (const f of files) {
      setUploadingN(n => n + 1)
      try {
        const { path, url } = await onUploadGallery(f)
        const nextGal = [...normGallery(data.gallery), { path, url, caption: '' }]
        onDraft({ gallery: nextGal })
        try { await onCommit({ gallery: nextGal }) } catch (e2) { onCleanupImages?.([path]); throw e2 }
        data = { ...data, gallery: nextGal } // keep the loop's view current for multi-file selects
      } catch (e2) {
        setErr(e2?.message ? `Upload failed — ${e2.message}` : 'Upload failed — try again.')
      } finally { setUploadingN(n => n - 1) }
    }
  }
  const removePiece = async (i) => {
    const cur = normGallery(data.gallery)
    const gone = cur[i]
    const nextGal = cur.filter((_, j) => j !== i)
    onDraft({ gallery: nextGal })
    try {
      await onCommit({ gallery: nextGal })
      if (gone?.path) onCleanupImages?.([gone.path])
    } catch (e2) { setErr(e2?.message || "Couldn't remove — try again.") }
  }

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

  return (
    <div role="dialog" aria-label="Build your world" style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: '100%', maxWidth: '430px', zIndex: 9000, background: 'rgba(10,10,13,.96)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderTop: `1px solid ${HAIR_HI}`, borderRadius: '18px 18px 0 0', maxHeight: '58vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: GRAIN, backgroundSize: '150px 150px', opacity: 0.05, mixBlendMode: 'overlay', pointerEvents: 'none' }} />

      {/* header: progress + meter + close */}
      <div style={{ padding: '14px 18px 0', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.26em', textTransform: 'uppercase' }}>◇ build your world · {String(step + 1).padStart(2, '0')}/{String(STEPS.length).padStart(2, '0')}</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: pct === 100 ? BONE : BONE_MID, letterSpacing: '.1em' }}>{pct}%</span>
          <button onClick={onClose} disabled={busy || uploadingN > 0} aria-label="Close" style={{ background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: '4px', display: 'inline-flex', opacity: (busy || uploadingN > 0) ? .4 : 1 }}><X size={15} /></button>
        </div>
        {/* the meter — a hairline, not a game */}
        <div style={{ marginTop: '10px', height: '1px', background: HAIR, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: SILVER, opacity: .7, transition: 'width .5s ease' }} />
        </div>
      </div>

      {/* step body */}
      <div className="no-scrollbar" style={{ padding: '16px 18px 8px', overflowY: 'auto', position: 'relative', flex: 1, minHeight: 0 }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '26px', letterSpacing: '.04em', lineHeight: 1, ...chromeDisplayText }}>{copy.title}</div>
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
              style={{ width: '100%', background: 'transparent', border: `1px dashed ${HAIR_HI}`, borderRadius: '12px', padding: '13px', color: BONE_MID, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'DM Sans', opacity: uploadingN > 0 ? .6 : 1 }}>
              {uploadingN > 0 ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <ImagePlus size={14} />}
              {uploadingN > 0 ? `Uploading ${uploadingN}…` : 'Add your work'}
            </button>
            <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple style={{ display: 'none' }} onChange={addFiles} />
          </div>
        )}

        {key === 'doors' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {links.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px' }}>
                <input style={{ ...inp, flex: '0 0 32%' }} value={l.label || ''} placeholder="IG" maxLength={24} onChange={e => setLink(i, 'label', e.target.value)} />
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
            <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.06em', marginTop: '8px' }}>look up — it's already running.</div>
          </div>
        )}

        {key === 'skin' && (
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
        )}

        {err && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: WARN, marginTop: '12px' }}>⚠ {err}</div>}
      </div>

      {/* footer: back / next-publish */}
      <div style={{ display: 'flex', gap: '10px', padding: '12px 18px calc(14px + env(safe-area-inset-bottom, 0px))', borderTop: `1px solid ${HAIR}`, position: 'relative' }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} disabled={busy} aria-label="Back"
            style={{ background: 'rgba(242,238,230,.04)', border: `1px solid ${HAIR}`, borderRadius: '10px', padding: '12px 16px', color: BONE_MID, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
            <ArrowLeft size={12} /> Back
          </button>
        )}
        <button onClick={next} disabled={nextDisabled}
          style={{ flex: 1, background: BONE, border: 'none', borderRadius: '10px', padding: '13px', color: VOID, fontWeight: 600, fontSize: '13px', cursor: nextDisabled ? 'default' : 'pointer', fontFamily: 'DM Sans', opacity: nextDisabled ? .5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {busy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            : key === 'skin' ? 'PUBLISH YOUR WORLD'
            : key === 'work' && gallery.length === 0 ? 'Skip for now'
            : <>Next <ArrowRight size={13} /></>}
        </button>
      </div>
    </div>
  )
}
