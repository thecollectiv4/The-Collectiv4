import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Edit3, Camera, MapPin, BadgeCheck, Plus, X, Music2, Film, Sparkles, Loader2, Play, ImageOff, ArrowUpRight } from 'lucide-react'

// stable id for editable rows (secure-context safe, with a plain fallback)
const uid = () => (globalThis.crypto?.randomUUID?.() || `r${Date.now()}${Math.random().toString(36).slice(2)}`)

/* =========================================================================
   ProfileMuseum — a personal WORLD in The Collectiv4's universe.
   One component, two routes:
     • /profile      → owner view  (isOwner, with edit + cover/avatar upload)
     • /user/:id     → public view (read-only)

   Brand system (same as the deck): near-black cosmic VOID, warm ivory/BONE
   type, liquid-CHROME on key display words only. Star-chart geometric marks,
   film grain, hairline rules, catalog mono. Structure is a magazine spread —
   hero, three taste "movements" each with its own visual language, work,
   closing mark. Cold-premium, warmth only in the type.
   ========================================================================= */

/* ---------- brand palette (void · bone · chrome) ---------- */
const VOID = '#0A0A0D'
const BONE = '#F2EEE6'
const BONE_MID = '#9B9891'
const BONE_LOW = '#5B5952'
const SILVER = '#C7C9D1'                                  // solid chrome for lines / marks
const STAR = '#E8E9ED'
const CARD = '#0E0E13'
const CARD_HI = '#14141A'
const HAIR = 'rgba(242,238,230,0.08)'
const HAIR_HI = 'rgba(242,238,230,0.15)'
const PAGE_BG = 'linear-gradient(180deg,#0B0B10 0%,#08080D 55%,#07080E 100%)'
// liquid-chrome / brushed-metal gradient — clipped to text on display words only
const CHROME = 'linear-gradient(176deg,#EEF0F4 0%,#BFC2CB 20%,#83868F 40%,#F7F9FD 52%,#7E818A 63%,#CED1DA 82%,#9497A0 100%)'
const chromeText = { background: CHROME, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }

// --- only ever trust http(s) urls (no javascript:, data:, etc.) ---
function safeUrl(raw) { const u = (raw || '').trim(); return /^https?:\/\//i.test(u) ? u : '' }
function hostOf(raw) { try { return new URL(safeUrl(raw)).hostname.replace(/^www\./, '') } catch { return '' } }
// allow a trailing query/hash (CDN transforms, Supabase signed URLs: photo.jpg?token=…)
function isImage(raw) { return /\.(png|jpe?g|gif|webp|avif|svg)(?:$|[?#])/i.test(safeUrl(raw)) }
// an image src is safe if it's a whitelisted http(s) url OR an uploaded data:image
function safeImg(raw) { return (safeUrl(raw) || (raw || '').startsWith('data:image/')) ? raw : '' }

// --- known providers only (whitelist) → no arbitrary iframe injection ---
// Returns a rich descriptor used to render players / thumbnails / images / links.
function parseMedia(raw) {
  const u = safeUrl(raw); if (!u) return null
  let m
  if ((m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)))
    return { kind: 'video', embed: `https://www.youtube.com/embed/${m[1]}?autoplay=1&rel=0`, thumb: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`, href: u }
  if ((m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)))
    return { kind: 'video', embed: `https://player.vimeo.com/video/${m[1]}?autoplay=1`, thumb: null, href: u }
  if ((m = u.match(/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/)))
    return { kind: 'audio', embed: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, height: m[1] === 'track' ? 152 : 352, href: u }
  if (/soundcloud\.com\//.test(u))
    return { kind: 'audio', embed: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u)}&color=%23C7C9D1&visual=true`, height: 280, href: u }
  if (isImage(u)) return { kind: 'image', src: u, href: u }
  return { kind: 'link', href: u, host: hostOf(u) }
}
function detectType(raw) { const p = parseMedia(raw); return !p ? 'link' : p.kind === 'image' ? 'image' : p.kind === 'link' ? 'link' : 'embed' }
const isPlayer = (p) => !!p && (p.kind === 'audio' || p.kind === 'video')

// --- deterministic seed → star field (a person's own constellation) ---
function hash(seed = '') { let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0; return h }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }

// --- textarea <-> array helpers (one item per line, commas also split) ---
const toList = (s) => (s || '').split(/[\n,]/).map(x => x.trim()).filter(Boolean)
const fromList = (a) => (Array.isArray(a) ? a.join('\n') : '')

// --- normalize the jsonb columns (nullable in the DB) ---
function normTaste(t) {
  const o = t && typeof t === 'object' && !Array.isArray(t) ? t : {}
  return {
    music: Array.isArray(o.music) ? o.music : [],
    films: Array.isArray(o.films) ? o.films : [],
    influences: Array.isArray(o.influences) ? o.influences : [],
  }
}
const normMedia = (m) => (Array.isArray(m) ? m.filter(x => x && safeUrl(x.url)) : [])

// --- film grain: a real texture layer, cheap + no asset ---
const NOISE = "<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>"
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(NOISE)}")`

// --- scroll-reveal preset (framer-motion) ---
const reveal = {
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.7, ease: [0.22, 0.61, 0.36, 1] },
}

const inp = { width: '100%', background: CARD, border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '13px 15px', color: BONE, fontFamily: 'DM Sans', fontSize: '14px', outline: 'none', transition: 'border-color .2s' }
const monoLabel = { fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.22em', color: BONE_LOW, textTransform: 'uppercase', display: 'block', marginBottom: '7px' }
const onF = (e) => e.currentTarget.style.borderColor = 'rgba(242,238,230,.34)'
const onB = (e) => e.currentTarget.style.borderColor = HAIR_HI

// star-chart marks, one per movement
const MARKS = { sound: 'ring', screen: 'triangle', influences: 'diamond', work: 'cross' }

// `event` is the normalized live-event object from useLiveEvent (name/edition/date/
// city); the wrapper passes it so the "going" badge shows the real upcoming event.
// `ticket` is the boolean "is this person going".
export default function ProfileMuseum({ profile, isOwner = false, onSave, onUploadAvatar, onUploadCover, ticket, event, topBar, ownerExtras }) {
  const [data, setData] = useState(profile)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const fileRef = useRef(null)
  const coverRef = useRef(null)

  // edit-form state
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [discipline, setDiscipline] = useState('')
  const [city, setCity] = useState('')
  const [tagline, setTagline] = useState('')
  const [bio, setBio] = useState('')
  const [music, setMusic] = useState('')
  const [films, setFilms] = useState('')
  const [influences, setInfluences] = useState('')
  const [rows, setRows] = useState([])

  // Entering edit takes a snapshot of `data` (see startEdit). Don't let a parent
  // re-fetch clobber an open form mid-edit; re-sync only while not editing.
  useEffect(() => { if (!editing) setData(profile) }, [profile])

  const startEdit = () => {
    const t = normTaste(data?.taste)
    setName(data?.full_name || '')
    setUsername(data?.username || '')
    setDiscipline(data?.discipline || '')
    setCity(data?.city || '')
    setTagline(data?.tagline || '')
    setBio(data?.bio || '')
    setMusic(fromList(t.music))
    setFilms(fromList(t.films))
    setInfluences(fromList(t.influences))
    setRows(normMedia(data?.media).map(m => ({ id: uid(), title: m.title || '', url: m.url || '' })))
    setEditing(true)
  }

  const addRow = () => setRows(r => [...r, { id: uid(), title: '', url: '' }])
  const setRow = (i, k, v) => setRows(r => r.map((row, j) => j === i ? { ...row, [k]: v } : row))
  const delRow = (i) => setRows(r => r.filter((_, j) => j !== i))

  const save = async () => {
    if (saving) return
    setSaving(true)
    setSaveErr(null)
    const patch = {
      full_name: name.trim() || null,
      username: username.trim().replace(/^@/, '') || null,
      discipline: discipline.trim() || null,
      city: city.trim() || null,
      tagline: tagline.trim() || null,
      bio: bio.trim() || null,
      taste: { music: toList(music), films: toList(films), influences: toList(influences) },
      media: rows.map(r => ({ url: (r.url || '').trim(), title: (r.title || '').trim() }))
        .filter(r => safeUrl(r.url))
        .map(r => ({ type: detectType(r.url), url: r.url, title: r.title })),
    }
    try {
      if (onSave) await onSave(patch)
      setData(d => ({ ...d, ...patch }))
      setEditing(false)
    } catch (err) {
      console.error('Save failed:', err)
      setSaveErr("Couldn't save — check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  const uploadPhoto = async (e) => {
    const input = e.target
    const file = input.files?.[0]
    if (!file || !onUploadAvatar) return
    setUploading(true)
    try {
      const url = await onUploadAvatar(file)
      if (url) setData(d => ({ ...d, avatar_url: url }))
    } catch (err) {
      console.error('Avatar upload failed:', err)
    } finally {
      setUploading(false)
      input.value = ''
    }
  }

  const uploadCover = async (e) => {
    const input = e.target
    const file = input.files?.[0]
    if (!file || !onUploadCover) return
    setCoverUploading(true)
    try {
      const url = await onUploadCover(file)
      if (url) setData(d => ({ ...d, cover_url: url }))
    } catch (err) {
      console.error('Cover upload failed:', err)
    } finally {
      setCoverUploading(false)
      input.value = ''
    }
  }

  const removeCover = async () => {
    if (!onUploadCover) return
    try { await onUploadCover(null); setData(d => ({ ...d, cover_url: null })) }
    catch (err) { console.error('Cover remove failed:', err) }
  }

  if (!data) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: VOID }}>
      <Loader2 size={20} style={{ color: BONE_LOW, animation: 'spin 1s linear infinite' }} />
    </div>
  )

  const seed = data.id || data.username || data.full_name || 'c4'
  const taste = normTaste(data.taste)
  const media = normMedia(data.media)
  const displayName = data.full_name || 'Unnamed'
  const initial = displayName[0].toUpperCase()
  const avatar = safeImg(data.avatar_url)
  const cover = safeImg(data.cover_url)

  // which movements to show — owner sees invitations for the empty ones
  const show = {
    sound: taste.music.length > 0 || isOwner,
    screen: taste.films.length > 0 || isOwner,
    influences: taste.influences.length > 0 || isOwner,
    work: media.length > 0 || isOwner,
  }
  // editorial catalog numbering, only across the movements actually rendered
  let counter = 0
  const num = {}
  ;['sound', 'screen', 'influences', 'work'].forEach(k => { if (show[k]) num[k] = String(++counter).padStart(2, '0') })
  const worldIsEmpty = !data.bio && !taste.music.length && !taste.films.length && !taste.influences.length && !media.length

  return (
    <div style={{ position: 'relative', background: PAGE_BG, minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ============ HERO — cover as a magazine cover, in the void ============ */}
      <div style={{ position: 'relative', height: 'clamp(340px, 58vh, 460px)', overflow: 'hidden', background: VOID }}>
        {cover
          ? <motion.img src={cover} alt="" initial={{ scale: 1.12 }} animate={{ scale: 1 }} transition={{ duration: 2, ease: 'easeOut' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (
            /* no cover → a cosmic dark field: void + constellation + monogram */
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 88% at 50% 4%, rgba(199,201,209,.08) 0%, transparent 55%), ${VOID}` }}>
              <StarField seed={seed} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'Bebas Neue', fontSize: '340px', lineHeight: 1, transform: 'translateY(-6%)', userSelect: 'none', opacity: 0.07, ...chromeText }}>{initial}</span>
              </div>
            </div>
          )}

        {/* film grain over the cover */}
        <div style={{ position: 'absolute', inset: 0, background: GRAIN, backgroundSize: '150px 150px', opacity: 0.06, mixBlendMode: 'overlay', pointerEvents: 'none' }} />
        {/* scrim so name + kicker sit legibly, fading into the page void */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(7,8,14,.08) 0%, rgba(7,8,14,0) 30%, rgba(7,8,14,.55) 70%, #0B0B10 100%)' }} />

        {/* top bar (back / sign-out) floats over the cover */}
        {topBar && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 5 }}>{topBar}</div>}

        {/* owner cover controls */}
        {isOwner && (
          <div style={{ position: 'absolute', top: '16px', right: '18px', display: 'flex', gap: '8px', zIndex: 5 }}>
            {cover && <button onClick={removeCover} style={pill}>Remove</button>}
            <button onClick={() => coverRef.current?.click()} style={{ ...pill, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {coverUploading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={11} />} {cover ? 'Change' : 'Cover'}
            </button>
            <input ref={coverRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadCover} />
          </div>
        )}

        {/* name set large + chrome, over the cover's lower edge */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: '20px', padding: '0 24px', zIndex: 3 }}>
          {data.discipline && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
              style={{ fontFamily: 'DM Mono', fontSize: '10px', color: SILVER, letterSpacing: '.28em', textTransform: 'uppercase', marginBottom: '11px', textShadow: '0 1px 12px rgba(0,0,0,.6)' }}>
              {data.discipline}
            </motion.div>
          )}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.85, delay: 0.16, ease: [0.22, 0.61, 0.36, 1] }}
            style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(48px, 15vw, 66px)', letterSpacing: '.01em', lineHeight: 0.86, margin: 0, filter: 'drop-shadow(0 2px 20px rgba(0,0,0,.55))', ...chromeText }}>{displayName}</h1>
            {data.verified && <span title="In The Collectiv4 network" aria-label="Verified — in The Collectiv4 network" style={{ display: 'inline-flex', alignItems: 'center', color: STAR, marginBottom: '8px', filter: 'drop-shadow(0 0 9px rgba(232,233,237,.5))' }}><BadgeCheck size={24} /></span>}
          </motion.div>
        </div>
      </div>

      {/* ============ BYLINE — avatar signature + catalog meta ============ */}
      <div style={{ position: 'relative', padding: '18px 24px 0', zIndex: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ position: 'relative', width: '58px', height: '58px', flexShrink: 0, cursor: isOwner ? 'pointer' : 'default' }} onClick={() => isOwner && fileRef.current?.click()}>
            {avatar
              ? <img src={avatar} alt="" style={{ width: '58px', height: '58px', borderRadius: '50%', objectFit: 'cover', outline: `1px solid ${SILVER}`, outlineOffset: '2px', boxShadow: `0 6px 22px rgba(0,0,0,.5)` }} />
              : <div style={{ width: '58px', height: '58px', borderRadius: '50%', background: CARD_HI, outline: `1px solid ${SILVER}`, outlineOffset: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bebas Neue', fontSize: '26px', ...chromeText }}>{initial}</div>}
            {isOwner && (
              <>
                <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '24px', height: '24px', borderRadius: '50%', background: CARD, border: `1px solid ${HAIR_HI}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={11} style={{ color: BONE_MID }} />
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadPhoto} />
                {uploading && <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(7,8,14,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={16} style={{ color: BONE_MID, animation: 'spin 1s linear infinite' }} /></div>}
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', rowGap: '4px' }}>
            {data.username && <span style={{ fontFamily: 'DM Mono', fontSize: '12px', color: BONE_MID, letterSpacing: '.04em' }}>@{data.username}</span>}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={11} style={{ color: BONE_LOW }} />
              <span style={{ fontFamily: 'DM Mono', fontSize: '11px', color: BONE_LOW, letterSpacing: '.04em' }}>{data.city || 'Houston'}</span>
            </span>
            {ticket && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontFamily: 'DM Mono', fontSize: '10px', color: BONE, border: `1px solid ${HAIR_HI}`, background: 'rgba(242,238,230,.03)', borderRadius: '100px', padding: '3px 11px', letterSpacing: '.1em' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: STAR, boxShadow: `0 0 8px rgba(232,233,237,.7)` }} />
                GOING{event?.editionNumber ? ` · ${event.editionNumber}` : ''}
              </span>
            )}
          </div>
        </div>

        {/* tagline — the "right now" line, promoted to a featured statement */}
        {data.tagline ? (
          <p style={{ fontFamily: 'DM Sans', fontStyle: 'italic', fontSize: '19px', color: BONE, lineHeight: 1.4, margin: '20px 0 0', maxWidth: '440px', letterSpacing: '.005em' }}>
            <span style={{ color: SILVER, fontStyle: 'normal', marginRight: '2px' }}>“</span>{data.tagline}<span style={{ color: SILVER, fontStyle: 'normal', marginLeft: '2px' }}>”</span>
          </p>
        ) : (isOwner && !editing && (
          <p style={{ fontFamily: 'DM Sans', fontStyle: 'italic', fontSize: '15px', color: BONE_LOW, margin: '18px 0 0' }}>Add a line — what you're on, right now.</p>
        ))}

        {isOwner && !editing && (
          <button onClick={startEdit} style={{ marginTop: '20px', background: 'rgba(242,238,230,.05)', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '9px 20px', color: BONE, fontSize: '11.5px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px', fontFamily: 'DM Sans', letterSpacing: '.03em', transition: 'all .2s' }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(242,238,230,.11)'; e.currentTarget.style.borderColor = 'rgba(242,238,230,.34)' }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(242,238,230,.05)'; e.currentTarget.style.borderColor = HAIR_HI }}>
            <Edit3 size={12} /> {worldIsEmpty ? 'Build your world' : 'Edit your world'}
          </button>
        )}
      </div>

      {/* ============ EDIT MODE ============ */}
      {editing ? (
        <div style={{ position: 'relative', padding: '30px 24px 130px', display: 'flex', flexDirection: 'column', gap: '30px', animation: 'fadeUp .3s ease', zIndex: 3 }}>
          <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: BONE_MID, letterSpacing: '.04em', lineHeight: 1.6, borderLeft: `1px solid ${SILVER}`, paddingLeft: '14px' }}>
            You're not filling out a form — you're building a world. Paste links and they come alive; write names and they become the walls of your museum.
          </div>

          <Section title="IDENTITY">
            <Field label="NAME"><input style={inp} value={name} placeholder="Your name" onChange={e => setName(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="HANDLE"><input style={inp} value={username} placeholder="@yourhandle" onChange={e => setUsername(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="DISCIPLINE"><input style={inp} value={discipline} placeholder="DJ · Painter · Photographer…" onChange={e => setDiscipline(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="CITY"><input style={inp} value={city} placeholder="Houston" onChange={e => setCity(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="RIGHT NOW" hint="One line, your voice. What you're on right now."><input style={inp} value={tagline} placeholder="Chasing the sound that doesn't exist yet." onChange={e => setTagline(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="THE OPENING" hint="A short statement — who you are, in your own words. This opens your world."><textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={bio} placeholder="Where you're from, what you make, what you're chasing." onChange={e => setBio(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
          </Section>

          <Section title="THE MUSEUM" hint="One per line. A name — or paste a link (Spotify, YouTube, SoundCloud) and it plays right here.">
            <Field label="SOUND"><textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={music} placeholder={'https://open.spotify.com/track/…\nFred again..\nFela Kuti'} onChange={e => setMusic(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="SCREEN"><textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={films} placeholder={'In the Mood for Love\nParis, Texas'} onChange={e => setFilms(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="INFLUENCES"><textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={influences} placeholder={'Virgil Abloh\nBauhaus\nHouston'} onChange={e => setInfluences(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
          </Section>

          <Section title="WORK" hint="Drop a link — sets, films, photos, drops. The good ones embed themselves.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {rows.map((row, i) => (
                <div key={row.id} style={{ border: `1px solid ${HAIR_HI}`, borderRadius: '12px', padding: '12px', background: CARD }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <input style={{ ...inp, padding: '10px 13px' }} value={row.title} placeholder="Title (optional)" onChange={e => setRow(i, 'title', e.target.value)} onFocus={onF} onBlur={onB} />
                    <button onClick={() => delRow(i)} aria-label="Remove" style={{ background: 'rgba(229,160,160,.08)', border: '1px solid rgba(229,160,160,.2)', borderRadius: '8px', width: '38px', height: '38px', flexShrink: 0, color: '#E5A0A0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                  </div>
                  <input style={{ ...inp, padding: '10px 13px' }} value={row.url} placeholder="https://…" onChange={e => setRow(i, 'url', e.target.value)} onFocus={onF} onBlur={onB} />
                  {row.url && !safeUrl(row.url) && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: '#E5A0A0', marginTop: '6px' }}>Must start with http:// or https://</div>}
                </div>
              ))}
              <button onClick={addRow} style={{ background: 'transparent', border: `1px dashed ${HAIR_HI}`, borderRadius: '12px', padding: '12px', color: BONE_MID, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'DM Sans' }}>
                <Plus size={14} /> Add a piece
              </button>
            </div>
          </Section>

          {saveErr && <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: '#E5A0A0', textAlign: 'center', marginTop: '-12px' }}>{saveErr}</div>}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => { setEditing(false); setSaveErr(null) }} style={{ flex: '0 0 auto', background: 'rgba(242,238,230,.04)', border: `1px solid ${HAIR}`, borderRadius: '10px', padding: '14px 22px', color: BONE_MID, fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans' }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ flex: 1, background: BONE, border: 'none', borderRadius: '10px', padding: '14px', color: VOID, fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans', opacity: saving ? .6 : 1, transition: 'all .2s' }}>{saving ? 'Saving…' : 'Save your world'}</button>
          </div>
        </div>
      ) : (
        /* ============ VIEW MODE — the world ============ */
        <div style={{ position: 'relative', padding: '4px 24px 120px', zIndex: 3 }}>

          {/* OPENING STATEMENT */}
          {data.bio && (
            <motion.p {...reveal} style={{ fontSize: '16.5px', color: BONE, lineHeight: 1.8, maxWidth: '540px', margin: '38px 0 0', paddingLeft: '16px', borderLeft: `1px solid ${SILVER}`, fontFamily: 'DM Sans', fontWeight: 300 }}>
              {data.bio}
            </motion.p>
          )}

          {/* MOVEMENT — SOUND */}
          {show.sound && (
            <motion.div {...reveal} style={{ marginTop: data.bio ? '58px' : '44px' }}>
              <Marker mark={MARKS.sound} n={num.sound} label="SOUND" kicker="on rotation" />
              {taste.music.length > 0
                ? <SoundMovement items={taste.music} />
                : <Invite icon={Music2}>The sound that runs through you. Paste a Spotify, YouTube or SoundCloud link and it plays right here — or just name the artists on rotation.</Invite>}
            </motion.div>
          )}

          {/* MOVEMENT — SCREEN */}
          {show.screen && (
            <motion.div {...reveal} style={{ marginTop: '58px' }}>
              <Marker mark={MARKS.screen} n={num.screen} label="SCREEN" kicker="what i watch" />
              {taste.films.length > 0
                ? <PosterRail items={taste.films} />
                : <Invite icon={Film}>The films that shaped your eye. Titles become posters; a trailer link becomes a still you can open.</Invite>}
            </motion.div>
          )}

          {/* MOVEMENT — INFLUENCES */}
          {show.influences && (
            <motion.div {...reveal} style={{ marginTop: '58px' }}>
              <Marker mark={MARKS.influences} n={num.influences} label="INFLUENCES" kicker="what shaped me" />
              {taste.influences.length > 0
                ? <WordWall items={taste.influences} />
                : <Invite icon={Sparkles}>The names, places and ideas behind your work. Written large — a wall of what made you.</Invite>}
            </motion.div>
          )}

          {/* MOVEMENT — WORK */}
          {show.work && (
            <motion.div {...reveal} style={{ marginTop: '58px' }}>
              <Marker mark={MARKS.work} n={num.work} label="WORK" kicker="what i make" />
              {media.length > 0 ? (
                <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {media.map((m, i) => <MediaCard key={`${m.url}:${i}`} item={m} full featured={i === 0} />)}
                </div>
              ) : <Invite icon={ArrowUpRight}>Show what you make. Drop links to your sets, films, photos, drops — they embed and play, right here.</Invite>}
            </motion.div>
          )}

          {/* closing mark */}
          {!worldIsEmpty && (
            <div style={{ marginTop: '64px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ height: '1px', flex: 1, background: `linear-gradient(90deg,transparent,${HAIR_HI})` }} />
              <Mark type="diamond" size={9} color={SILVER} style={{ opacity: .8, flexShrink: 0 }} />
              <span style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.24em', color: BONE_LOW, textTransform: 'uppercase' }}>a world by {data.username ? `@${data.username}` : displayName}</span>
              <span style={{ fontFamily: 'Bebas Neue', fontSize: '16px', ...chromeText }}>4</span>
              <div style={{ height: '1px', flex: 1, background: `linear-gradient(270deg,transparent,${HAIR_HI})` }} />
            </div>
          )}

          {/* owner-only extras (full ticket card, events attended) rendered by the wrapper */}
          {ownerExtras}
        </div>
      )}

      {/* ============ page-wide film grain (over everything, non-blocking) ============ */}
      <div style={{ position: 'absolute', inset: 0, background: GRAIN, backgroundSize: '150px 150px', opacity: 0.04, mixBlendMode: 'overlay', pointerEvents: 'none', zIndex: 40 }} />
    </div>
  )
}

/* ---------- shared bits ---------- */
const pill = { background: 'rgba(7,8,14,.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '6px 12px', color: BONE, fontSize: '10px', fontFamily: 'DM Sans', cursor: 'pointer' }

/* Star-chart geometric mark (filled dot · ring · cross · triangle · diamond). */
function Mark({ type = 'ring', size = 14, color = SILVER, style }) {
  const s = size, c = s / 2, r = s * 0.36, sw = Math.max(1, s * 0.085)
  const common = { fill: 'none', stroke: color, strokeWidth: sw, strokeLinejoin: 'round', strokeLinecap: 'round' }
  let shape
  if (type === 'dot') shape = <circle cx={c} cy={c} r={r * 0.62} fill={color} />
  else if (type === 'ring') shape = <circle cx={c} cy={c} r={r} {...common} />
  else if (type === 'cross') shape = <g {...common}><line x1={c} y1={s * 0.12} x2={c} y2={s * 0.88} /><line x1={s * 0.12} y1={c} x2={s * 0.88} y2={c} /></g>
  else if (type === 'triangle') shape = <path d={`M${c} ${s * 0.15} L${s * 0.86} ${s * 0.83} L${s * 0.14} ${s * 0.83} Z`} {...common} />
  else shape = <path d={`M${c} ${s * 0.1} L${s * 0.9} ${c} L${c} ${s * 0.9} L${s * 0.1} ${c} Z`} {...common} />
  return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={style} aria-hidden="true">{shape}</svg>
}

/* A deterministic constellation for the no-cover state — the person's own star chart. */
function StarField({ seed }) {
  const rnd = mulberry32(hash(seed) + 9)
  const stars = Array.from({ length: 48 }, () => ({ x: +(rnd() * 100).toFixed(2), y: +(rnd() * 100).toFixed(2), r: +(0.5 + rnd() * 1.4).toFixed(2), o: +(0.12 + rnd() * 0.6).toFixed(2) }))
  const links = Array.from({ length: 6 }, () => [stars[Math.floor(rnd() * stars.length)], stars[Math.floor(rnd() * stars.length)]]).filter(([a, b]) => a && b && a !== b)
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
      {links.map((l, i) => <line key={i} x1={l[0].x} y1={l[0].y} x2={l[1].x} y2={l[1].y} stroke={SILVER} strokeWidth="0.1" opacity="0.16" />)}
      {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r / 2} fill={STAR} opacity={s.o} />)}
    </svg>
  )
}

/* Editorial catalog marker — [mark] 02  SOUND ———— KICKER. */
function Marker({ mark, n, label, kicker }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
      <Mark type={mark} size={14} color={SILVER} style={{ flexShrink: 0, opacity: .9 }} />
      <span style={{ fontFamily: 'DM Mono', fontSize: '11px', color: BONE_MID, letterSpacing: '.1em', flexShrink: 0 }}>{n}</span>
      <span style={{ fontFamily: 'Bebas Neue', fontSize: '31px', letterSpacing: '.05em', lineHeight: 1, flexShrink: 0, ...chromeText }}>{label}</span>
      <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${HAIR_HI}, transparent)` }} />
      {kicker && <span style={{ fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.26em', color: BONE_LOW, textTransform: 'uppercase', flexShrink: 0 }}>{kicker}</span>}
    </div>
  )
}

/* An empty movement, styled into the world — an invitation, never a barren shell. */
function Invite({ children, icon: Icon }) {
  return (
    <div style={{ marginTop: '4px', padding: '24px 22px', borderRadius: '16px', border: `1px solid ${HAIR_HI}`, background: 'linear-gradient(150deg, rgba(199,201,209,.05), rgba(199,201,209,.01))', display: 'flex', gap: '16px', alignItems: 'flex-start', maxWidth: '480px' }}>
      <div style={{ width: '38px', height: '38px', flexShrink: 0, borderRadius: '10px', border: `1px solid ${HAIR_HI}`, background: 'rgba(199,201,209,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={17} style={{ color: SILVER }} strokeWidth={1.5} />
      </div>
      <p style={{ fontSize: '13.5px', color: BONE_MID, lineHeight: 1.65, margin: 0, fontFamily: 'DM Sans' }}>{children}</p>
    </div>
  )
}

/* Little catalog tag inside a movement. */
function Tag({ label, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '14px' }}>
      <span style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.24em', color: BONE_MID, textTransform: 'uppercase' }}>{label}</span>
      {count != null && <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW }}>{String(count).padStart(2, '0')}</span>}
      <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg,${HAIR_HI},transparent)` }} />
    </div>
  )
}

/* ---------- SOUND: a featured player + an editorial tracklist ---------- */
function SoundMovement({ items }) {
  const parsed = items.map((it, i) => ({ it, i, p: parseMedia(it) }))
  const players = parsed.filter(x => isPlayer(x.p))
  const featured = players[0] || null
  const morePlayers = players.slice(1)
  const tracks = parsed.filter(x => !isPlayer(x.p)) // names + plain links

  return (
    <div style={{ marginTop: '4px' }}>
      {featured && (
        <div style={{ marginBottom: tracks.length || morePlayers.length ? '26px' : 0 }}>
          <Tag label="On repeat" />
          <MediaCard item={{ url: featured.it }} full featured />
        </div>
      )}

      {tracks.length > 0 && (
        <div>
          {featured && <Tag label="In rotation" count={tracks.length} />}
          <div>
            {tracks.map((t, i) => <Track key={`${t.it}:${t.i}`} index={i + 1} value={t.it} />)}
          </div>
        </div>
      )}

      {morePlayers.length > 0 && (
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {morePlayers.map((m) => <MediaCard key={`${m.it}:${m.i}`} item={{ url: m.it }} full />)}
        </div>
      )}
    </div>
  )
}

/* A tracklist row — reads like the back of a record sleeve. */
function Track({ index, value }) {
  const p = parseMedia(value)
  const link = p && p.kind === 'link' ? p : null
  const text = link ? (link.host || value) : value
  const inner = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '15px 6px', borderBottom: `1px solid ${HAIR}`, color: BONE, transition: 'all .25s ease' }}
      onMouseOver={e => { e.currentTarget.style.paddingLeft = '14px'; e.currentTarget.style.borderColor = HAIR_HI }}
      onMouseOut={e => { e.currentTarget.style.paddingLeft = '6px'; e.currentTarget.style.borderColor = HAIR }}>
      <span style={{ fontFamily: 'DM Mono', fontSize: '11px', color: SILVER, opacity: .7, minWidth: '20px' }}>{String(index).padStart(2, '0')}</span>
      <span style={{ flex: 1, fontFamily: 'Bebas Neue', fontSize: '23px', letterSpacing: '.03em', color: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
      {link && <ArrowUpRight size={15} style={{ color: SILVER, flexShrink: 0 }} />}
    </div>
  )
  return link
    ? <a href={link.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>{inner}</a>
    : inner
}

/* ---------- SCREEN: a horizontal poster rail ---------- */
function PosterRail({ items }) {
  return (
    <div className="no-scrollbar" style={{ marginTop: '4px', display: 'flex', gap: '14px', overflowX: 'auto', scrollSnapType: 'x proximity', paddingBottom: '6px', WebkitOverflowScrolling: 'touch' }}>
      {items.map((it, i) => <PosterCard key={`${it}:${i}`} value={it} index={i + 1} />)}
    </div>
  )
}
function PosterCard({ value, index }) {
  const [imgOk, setImgOk] = useState(true)
  const p = parseMedia(value)
  const img = p && p.kind === 'image' ? p.src : (p && p.kind === 'video' ? p.thumb : null)
  const href = p && (p.kind === 'link' || p.kind === 'image' || p.kind === 'video') ? p.href : null
  // a plain name renders as-is; any URL falls back to its host, never the raw string
  const label = !p ? value : (p.kind === 'link' ? (p.host || value) : (hostOf(value) || value))

  const body = (img && imgOk) ? (
    <>
      <img src={img} alt={label} loading="lazy" onError={() => setImgOk(false)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(7,8,14,.05) 40%, rgba(7,8,14,.88) 100%)' }} />
      {p.kind === 'video' && (
        <div style={{ position: 'absolute', top: '10px', right: '10px', width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(7,8,14,.55)', border: `1px solid ${SILVER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Play size={13} style={{ color: BONE, marginLeft: '2px' }} fill={BONE} />
        </div>
      )}
      <div style={{ position: 'absolute', left: '12px', right: '12px', bottom: '12px', fontFamily: 'Bebas Neue', fontSize: '18px', color: BONE, letterSpacing: '.03em', lineHeight: 1.02, textShadow: '0 1px 10px rgba(0,0,0,.7)' }}>{label}</div>
    </>
  ) : (
    // typographic poster — no image, still a curated object in the void
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(199,201,209,.11) 0%, rgba(199,201,209,.02) 45%, #08080D 100%)' }} />
      <div style={{ position: 'absolute', top: '10px', left: '12px', fontFamily: 'DM Mono', fontSize: '9px', color: SILVER, letterSpacing: '.16em' }}>{String(index).padStart(2, '0')}</div>
      <div style={{ position: 'absolute', top: '10px', right: '11px' }}><Mark type="diamond" size={9} color={SILVER} style={{ opacity: .5 }} /></div>
      <div style={{ position: 'absolute', bottom: '-10px', right: '-4px', fontFamily: 'Bebas Neue', fontSize: '120px', lineHeight: 1, opacity: .1, pointerEvents: 'none', ...chromeText }}>{(label || '?')[0].toUpperCase()}</div>
      <div style={{ position: 'absolute', left: '12px', right: '12px', bottom: '14px', fontFamily: 'Bebas Neue', fontSize: '22px', color: BONE, letterSpacing: '.03em', lineHeight: 1.0 }}>{label}</div>
    </>
  )

  const card = (
    <div style={{ position: 'relative', flex: '0 0 auto', width: '148px', height: '212px', borderRadius: '14px', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, background: CARD, scrollSnapAlign: 'start', transition: 'transform .25s ease, border-color .25s ease', cursor: href ? 'pointer' : 'default' }}
      onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(242,238,230,.34)' }}
      onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = HAIR_HI }}>
      {body}
    </div>
  )
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{card}</a>
    : card
}

/* ---------- INFLUENCES: a typographic word-wall (bone · chrome · outline) ---------- */
function WordWall({ items }) {
  const sizes = [34, 46, 26, 40, 30, 52, 28, 38]
  return (
    <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '10px 20px' }}>
      {items.map((it, i) => {
        const p = parseMedia(it)
        const href = p && p.kind === 'link' ? p.href : null
        const text = p && p.kind === 'link' ? (p.host || it) : it
        const size = sizes[i % sizes.length]
        const mode = i % 3 // 0 bone · 1 outline · 2 chrome
        const base = { fontFamily: 'Bebas Neue', fontSize: `${size}px`, lineHeight: 0.98, letterSpacing: '.02em', cursor: href ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', gap: '4px', transition: 'opacity .2s' }
        const skin = mode === 1
          ? { color: 'transparent', WebkitTextStroke: `1px ${SILVER}` }
          : mode === 2 ? chromeText : { color: BONE }
        const word = (
          <span style={{ ...base, ...skin }}
            onMouseOver={e => { e.currentTarget.style.opacity = '0.62' }}
            onMouseOut={e => { e.currentTarget.style.opacity = '1' }}>
            {text}{href && <ArrowUpRight size={Math.round(size * 0.3)} style={{ color: SILVER, WebkitTextStroke: 'none' }} />}
          </span>
        )
        return href
          ? <a key={`${it}:${i}`} href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{word}</a>
          : <span key={`${it}:${i}`}>{word}</span>
      })}
    </div>
  )
}

/* MediaCard — video (click to play), audio (live player), image, link.
   `featured` gives the first Work piece a taller, hero treatment. */
function MediaCard({ item, full, featured }) {
  const [play, setPlay] = useState(false)
  const [imgOk, setImgOk] = useState(true)
  const p = parseMedia(item.url)
  if (!p) return null
  const title = item.title || hostOf(item.url)
  const cardStyle = { borderRadius: '16px', overflow: 'hidden', border: `1px solid ${featured ? 'rgba(242,238,230,.16)' : HAIR_HI}`, background: CARD, boxShadow: featured ? '0 14px 44px rgba(0,0,0,.4)' : 'none' }

  if (p.kind === 'video') {
    return (
      <div style={cardStyle}>
        <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
          {play ? (
            <iframe src={p.embed} title={title || 'video'} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
          ) : (
            <button onClick={() => setPlay(true)} aria-label="Play" style={{ position: 'absolute', inset: 0, padding: 0, border: 'none', cursor: 'pointer', background: '#000' }}>
              {p.thumb && imgOk
                ? <img src={p.thumb} alt="" onError={() => setImgOk(false)} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: .9 }} />
                : <div style={{ width: '100%', height: '100%', background: `linear-gradient(150deg, rgba(199,201,209,.14), #08080D)` }} />}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(7,8,14,.2)' }}>
                <div style={{ width: featured ? '62px' : '52px', height: featured ? '62px' : '52px', borderRadius: '50%', background: 'rgba(7,8,14,.5)', backdropFilter: 'blur(4px)', border: `1px solid ${SILVER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 26px rgba(199,201,209,.3)' }}>
                  <Play size={featured ? 24 : 20} style={{ color: BONE, marginLeft: '3px' }} fill={BONE} />
                </div>
              </div>
            </button>
          )}
        </div>
        {title && <div style={{ padding: '13px 16px', fontSize: featured ? '13px' : '12px', color: BONE_MID, borderTop: `1px solid ${HAIR}`, fontFamily: 'DM Sans' }}>{title}</div>}
      </div>
    )
  }

  if (p.kind === 'audio') {
    return (
      <div style={cardStyle}>
        <iframe src={p.embed} title={title || 'audio'} loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" style={{ width: '100%', height: `${p.height}px`, border: 'none', display: 'block' }} />
        {item.title && <div style={{ padding: '13px 16px', fontSize: '12px', color: BONE_MID, borderTop: `1px solid ${HAIR}`, fontFamily: 'DM Sans' }}>{item.title}</div>}
      </div>
    )
  }

  if (p.kind === 'image') {
    return (
      <a href={p.href} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: '16px', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, textDecoration: 'none', background: CARD, position: 'relative' }}>
        {imgOk
          ? <img src={p.src} alt={title} loading="lazy" onError={() => setImgOk(false)} style={{ width: '100%', display: 'block', objectFit: 'cover', maxHeight: featured ? '460px' : (full ? '420px' : '180px') }} />
          : <div style={{ width: '100%', height: full ? '180px' : '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: BONE_LOW }}><ImageOff size={18} /></div>}
        {item.title && <div style={{ padding: '13px 16px', fontSize: '12px', color: BONE_MID, fontFamily: 'DM Sans' }}>{item.title}</div>}
      </a>
    )
  }

  // link
  return (
    <a href={p.href} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 18px', borderRadius: '14px', border: `1px solid ${HAIR_HI}`, background: CARD, textDecoration: 'none', transition: 'all .2s' }}
      onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(242,238,230,.34)'; e.currentTarget.style.transform = 'translateX(3px)' }}
      onMouseOut={e => { e.currentTarget.style.borderColor = HAIR_HI; e.currentTarget.style.transform = 'translateX(0)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: BONE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title || p.host}</div>
        <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, marginTop: '3px' }}>{p.host}</div>
      </div>
      <ArrowUpRight size={16} style={{ color: SILVER, flexShrink: 0 }} />
    </a>
  )
}

/* ---------- edit-mode helpers ---------- */
function Section({ title, hint, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
        <Mark type="dot" size={9} color={SILVER} />
        <div style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.3em', color: BONE_MID, textTransform: 'uppercase' }}>{title}</div>
      </div>
      <div style={{ height: '1px', width: '100%', background: `linear-gradient(90deg,${HAIR_HI},transparent)`, marginTop: '10px' }} />
      {hint && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, marginTop: '12px', lineHeight: 1.5 }}>{hint}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>{children}</div>
    </div>
  )
}
function Field({ label, hint, children }) {
  return <div><label style={monoLabel}>{label}</label>{hint && <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, margin: '-3px 0 7px', letterSpacing: '.04em' }}>{hint}</div>}{children}</div>
}
