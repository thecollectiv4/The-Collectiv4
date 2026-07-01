import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Edit3, Camera, MapPin, BadgeCheck, Plus, X, Music2, Film, Sparkles, Loader2, Play, ImageOff, ArrowUpRight } from 'lucide-react'

// stable id for editable rows (secure-context safe, with a plain fallback)
const uid = () => (globalThis.crypto?.randomUUID?.() || `r${Date.now()}${Math.random().toString(36).slice(2)}`)

/* =========================================================================
   ProfileMuseum — a personal WORLD, not a card.
   One component, two routes:
     • /profile      → owner view  (isOwner, with edit + cover/avatar upload)
     • /user/:id     → public view (read-only)

   Composed like an artist's site, not a database record:
     Hero (cover as a magazine cover, name set large) → Byline → Opening
     statement → three distinct taste "movements" (Sound / Screen / Influences,
     each with its own visual language) → Work. Accent-led, motion on scroll,
     players that play, invitations where a profile is still empty.
   ========================================================================= */

// --- palette pulled from the existing design tokens (index.css) ---
const ACCENTS = ['#C86040', '#5A8A3A', '#9A3050', '#5060A0', '#D4A040', '#4A7AFF', '#40B060']
function hash(seed = '') { let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0; return h }
function accentFor(seed = '') { return ACCENTS[hash(seed) % ACCENTS.length] }
// a second, different hue so the empty-cover mesh has depth
function accent2For(seed = '', primary) { const rest = ACCENTS.filter(c => c !== primary); return rest[hash(seed + 'x') % rest.length] }

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
    return { kind: 'audio', embed: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u)}&color=%23C86040&visual=true`, height: 280, href: u }
  if (isImage(u)) return { kind: 'image', src: u, href: u }
  return { kind: 'link', href: u, host: hostOf(u) }
}
function detectType(raw) { const p = parseMedia(raw); return !p ? 'link' : p.kind === 'image' ? 'image' : p.kind === 'link' ? 'link' : 'embed' }
const isPlayer = (p) => !!p && (p.kind === 'audio' || p.kind === 'video')

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

// --- film grain: a real texture layer, cheap + no asset. Sits over the cover. ---
const NOISE = "<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>"
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(NOISE)}")`

// --- scroll-reveal preset (framer-motion) ---
const reveal = {
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.7, ease: [0.22, 0.61, 0.36, 1] },
}

const inp = { width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-hi)', borderRadius: '10px', padding: '13px 15px', color: 'var(--cream)', fontFamily: 'DM Sans', fontSize: '14px', outline: 'none', transition: 'border-color .2s' }
const monoLabel = { fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.2em', color: 'var(--cream-low)', textTransform: 'uppercase', display: 'block', marginBottom: '7px' }
const onF = (e) => e.currentTarget.style.borderColor = 'rgba(242,230,208,.3)'
const onB = (e) => e.currentTarget.style.borderColor = 'var(--border-hi)'

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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <Loader2 size={20} style={{ color: 'var(--cream-low)', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  const accent = accentFor(data.id || data.username || data.full_name || 'c4')
  const accent2 = accent2For(data.id || data.username || data.full_name || 'c4', accent)
  const taste = normTaste(data.taste)
  const media = normMedia(data.media)
  const displayName = data.full_name || 'Unnamed'
  const initial = displayName[0].toUpperCase()
  const avatar = safeImg(data.avatar_url)
  const cover = safeImg(data.cover_url)
  const mesh = `radial-gradient(120% 130% at 0% 0%, ${accent}45 0%, transparent 55%), radial-gradient(130% 120% at 100% 15%, ${accent2}33 0%, transparent 60%), linear-gradient(165deg,#181109 0%,#0C0B0A 72%)`

  // which movements to show — owner sees invitations for the empty ones
  const show = {
    sound: taste.music.length > 0 || isOwner,
    screen: taste.films.length > 0 || isOwner,
    influences: taste.influences.length > 0 || isOwner,
    work: media.length > 0 || isOwner,
  }
  // editorial numbering, only across the movements actually rendered
  let counter = 0
  const num = {}
  ;['sound', 'screen', 'influences', 'work'].forEach(k => { if (show[k]) num[k] = String(++counter).padStart(2, '0') })
  const worldIsEmpty = !data.bio && !taste.music.length && !taste.films.length && !taste.influences.length && !media.length

  return (
    <div style={{ background: 'linear-gradient(180deg,#0E0D0C 0%,#0C0B0A 16%,#0A0908 34%,#0A0908 100%)', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ============ HERO — cover as a magazine cover ============ */}
      <div style={{ position: 'relative', height: 'clamp(340px, 58vh, 460px)', overflow: 'hidden' }}>
        {cover
          ? <motion.img src={cover} alt="" initial={{ scale: 1.12 }} animate={{ scale: 1 }} transition={{ duration: 2, ease: 'easeOut' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', background: mesh, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* faint monogram so an image-less cover still feels composed, not blank */}
              <span style={{ fontFamily: 'Bebas Neue', fontSize: '340px', lineHeight: 1, color: accent, opacity: 0.06, transform: 'translateY(-6%)', userSelect: 'none' }}>{initial}</span>
            </div>}

        {/* film grain */}
        <div style={{ position: 'absolute', inset: 0, background: GRAIN, backgroundSize: '140px 140px', opacity: 0.05, mixBlendMode: 'overlay', pointerEvents: 'none' }} />
        {/* scrim so name + kicker sit legibly, fading fully into the page */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,9,8,.12) 0%, rgba(10,9,8,0) 32%, rgba(10,9,8,.55) 72%, var(--bg) 100%)' }} />

        {/* top bar (back / sign-out) floats over the cover */}
        {topBar && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 5 }}>{topBar}</div>}

        {/* owner cover controls */}
        {isOwner && (
          <div style={{ position: 'absolute', top: '16px', right: '18px', display: 'flex', gap: '8px', zIndex: 4 }}>
            {cover && <button onClick={removeCover} style={pill}>Remove</button>}
            <button onClick={() => coverRef.current?.click()} style={{ ...pill, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {coverUploading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={11} />} {cover ? 'Change' : 'Cover'}
            </button>
            <input ref={coverRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadCover} />
          </div>
        )}

        {/* name set large, over the cover's lower edge */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: '20px', padding: '0 24px', zIndex: 3 }}>
          {data.discipline && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
              style={{ fontFamily: 'DM Mono', fontSize: '10px', color: accent, letterSpacing: '.22em', textTransform: 'uppercase', marginBottom: '10px', textShadow: '0 1px 12px rgba(0,0,0,.5)' }}>
              {data.discipline}
            </motion.div>
          )}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.85, delay: 0.16, ease: [0.22, 0.61, 0.36, 1] }}
            style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(48px, 15vw, 66px)', color: 'var(--cream)', letterSpacing: '.005em', lineHeight: 0.86, margin: 0, textShadow: '0 2px 30px rgba(0,0,0,.55)' }}>{displayName}</h1>
            {data.verified && <span title="Verified" style={{ display: 'inline-flex', alignItems: 'center', color: accent, marginBottom: '8px', filter: `drop-shadow(0 0 10px ${accent}66)` }}><BadgeCheck size={24} /></span>}
          </motion.div>
        </div>
      </div>

      {/* ============ BYLINE — avatar signature + meta ============ */}
      <div style={{ position: 'relative', padding: '18px 24px 0', zIndex: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ position: 'relative', width: '58px', height: '58px', flexShrink: 0, cursor: isOwner ? 'pointer' : 'default' }} onClick={() => isOwner && fileRef.current?.click()}>
            {avatar
              ? <img src={avatar} alt="" style={{ width: '58px', height: '58px', borderRadius: '50%', objectFit: 'cover', outline: `2px solid ${accent}`, outlineOffset: '2px', boxShadow: `0 6px 22px rgba(0,0,0,.5), 0 0 20px ${accent}2E` }} />
              : <div style={{ width: '58px', height: '58px', borderRadius: '50%', background: 'var(--bg-raised)', outline: `2px solid ${accent}`, outlineOffset: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bebas Neue', fontSize: '26px', color: accent }}>{initial}</div>}
            {isOwner && (
              <>
                <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={11} style={{ color: 'var(--cream-mid)' }} />
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadPhoto} />
                {uploading && <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(10,9,8,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={16} style={{ color: 'var(--cream-mid)', animation: 'spin 1s linear infinite' }} /></div>}
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', rowGap: '4px' }}>
            {data.username && <span style={{ fontFamily: 'DM Mono', fontSize: '12px', color: 'var(--cream-mid)' }}>@{data.username}</span>}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={11} style={{ color: 'var(--cream-low)' }} />
              <span style={{ fontFamily: 'DM Mono', fontSize: '11px', color: 'var(--cream-low)' }}>{data.city || 'Houston'}</span>
            </span>
            {ticket && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'DM Mono', fontSize: '10px', color: '#00D54B', border: '1px solid rgba(0,213,75,.22)', background: 'rgba(0,213,75,.05)', borderRadius: '100px', padding: '3px 10px' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#00D54B', boxShadow: '0 0 6px rgba(0,213,75,.5)' }} />
                GOING{event?.editionNumber ? ` · ${event.editionNumber}` : ''}
              </span>
            )}
          </div>
        </div>

        {/* tagline — the "right now" line, promoted to a featured statement */}
        {data.tagline ? (
          <p style={{ fontFamily: 'DM Sans', fontStyle: 'italic', fontSize: '19px', color: 'var(--cream)', lineHeight: 1.4, margin: '20px 0 0', maxWidth: '440px', letterSpacing: '.005em' }}>
            <span style={{ color: accent, fontStyle: 'normal', marginRight: '2px' }}>“</span>{data.tagline}<span style={{ color: accent, fontStyle: 'normal', marginLeft: '2px' }}>”</span>
          </p>
        ) : (isOwner && !editing && (
          <p style={{ fontFamily: 'DM Sans', fontStyle: 'italic', fontSize: '15px', color: 'var(--cream-low)', margin: '18px 0 0' }}>Add a line — what you're on, right now.</p>
        ))}

        {isOwner && !editing && (
          <button onClick={startEdit} style={{ marginTop: '20px', background: `${accent}12`, border: `1px solid ${accent}38`, borderRadius: '100px', padding: '9px 20px', color: 'var(--cream)', fontSize: '11.5px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px', fontFamily: 'DM Sans', letterSpacing: '.03em', transition: 'all .2s' }}
            onMouseOver={e => { e.currentTarget.style.background = `${accent}22`; e.currentTarget.style.borderColor = `${accent}66` }}
            onMouseOut={e => { e.currentTarget.style.background = `${accent}12`; e.currentTarget.style.borderColor = `${accent}38` }}>
            <Edit3 size={12} /> {worldIsEmpty ? 'Build your world' : 'Edit your world'}
          </button>
        )}
      </div>

      {/* ============ EDIT MODE ============ */}
      {editing ? (
        <div style={{ padding: '30px 24px 130px', display: 'flex', flexDirection: 'column', gap: '30px', animation: 'fadeUp .3s ease' }}>
          <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: 'var(--cream-mid)', letterSpacing: '.04em', lineHeight: 1.6, borderLeft: `2px solid ${accent}`, paddingLeft: '14px' }}>
            You're not filling out a form — you're building a world. Paste links and they come alive; write names and they become the walls of your museum.
          </div>

          <Section accent={accent} title="IDENTITY">
            <Field label="NAME"><input style={inp} value={name} placeholder="Your name" onChange={e => setName(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="HANDLE"><input style={inp} value={username} placeholder="@yourhandle" onChange={e => setUsername(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="DISCIPLINE"><input style={inp} value={discipline} placeholder="DJ · Painter · Photographer…" onChange={e => setDiscipline(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="CITY"><input style={inp} value={city} placeholder="Houston" onChange={e => setCity(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="RIGHT NOW" hint="One line, your voice. What you're on right now."><input style={inp} value={tagline} placeholder="Chasing the sound that doesn't exist yet." onChange={e => setTagline(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="THE OPENING" hint="A short statement — who you are, in your own words. This opens your world."><textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={bio} placeholder="Where you're from, what you make, what you're chasing." onChange={e => setBio(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
          </Section>

          <Section accent={accent} title="THE MUSEUM" hint="One per line. A name — or paste a link (Spotify, YouTube, SoundCloud) and it plays right here.">
            <Field label="SOUND"><textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={music} placeholder={'https://open.spotify.com/track/…\nFred again..\nFela Kuti'} onChange={e => setMusic(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="SCREEN"><textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={films} placeholder={'In the Mood for Love\nParis, Texas'} onChange={e => setFilms(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="INFLUENCES"><textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={influences} placeholder={'Virgil Abloh\nBauhaus\nHouston'} onChange={e => setInfluences(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
          </Section>

          <Section accent={accent} title="WORK" hint="Drop a link — sets, films, photos, drops. The good ones embed themselves.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {rows.map((row, i) => (
                <div key={row.id} style={{ border: '1px solid var(--border-hi)', borderRadius: '12px', padding: '12px', background: 'var(--bg-card)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <input style={{ ...inp, padding: '10px 13px' }} value={row.title} placeholder="Title (optional)" onChange={e => setRow(i, 'title', e.target.value)} onFocus={onF} onBlur={onB} />
                    <button onClick={() => delRow(i)} aria-label="Remove" style={{ background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.2)', borderRadius: '8px', width: '38px', height: '38px', flexShrink: 0, color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                  </div>
                  <input style={{ ...inp, padding: '10px 13px' }} value={row.url} placeholder="https://…" onChange={e => setRow(i, 'url', e.target.value)} onFocus={onF} onBlur={onB} />
                  {row.url && !safeUrl(row.url) && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: '#EF4444', marginTop: '6px' }}>Must start with http:// or https://</div>}
                </div>
              ))}
              <button onClick={addRow} style={{ background: 'transparent', border: '1px dashed var(--border-hi)', borderRadius: '12px', padding: '12px', color: 'var(--cream-mid)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'DM Sans' }}>
                <Plus size={14} /> Add a piece
              </button>
            </div>
          </Section>

          {saveErr && <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: '#EF4444', textAlign: 'center', marginTop: '-12px' }}>{saveErr}</div>}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => { setEditing(false); setSaveErr(null) }} style={{ flex: '0 0 auto', background: 'rgba(242,230,208,.04)', border: '1px solid rgba(242,230,208,.12)', borderRadius: '10px', padding: '14px 22px', color: 'var(--cream-mid)', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans' }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ flex: 1, background: 'var(--cream)', border: 'none', borderRadius: '10px', padding: '14px', color: 'var(--bg)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans', opacity: saving ? .6 : 1, transition: 'all .2s' }}>{saving ? 'Saving…' : 'Save your world'}</button>
          </div>
        </div>
      ) : (
        /* ============ VIEW MODE — the world ============ */
        <div style={{ padding: '4px 24px 120px' }}>

          {/* OPENING STATEMENT */}
          {data.bio && (
            <motion.p {...reveal} style={{ fontSize: '16.5px', color: 'var(--cream)', lineHeight: 1.8, maxWidth: '540px', margin: '38px 0 0', paddingLeft: '16px', borderLeft: `2px solid ${accent}`, fontFamily: 'DM Sans', fontWeight: 300 }}>
              {data.bio}
            </motion.p>
          )}

          {/* MOVEMENT — SOUND */}
          {show.sound && (
            <motion.div {...reveal} style={{ marginTop: data.bio ? '58px' : '44px' }}>
              <Marker n={num.sound} label="SOUND" kicker="on rotation" accent={accent} />
              {taste.music.length > 0
                ? <SoundMovement items={taste.music} accent={accent} />
                : <Invite accent={accent} icon={Music2}>The sound that runs through you. Paste a Spotify, YouTube or SoundCloud link and it plays right here — or just name the artists on rotation.</Invite>}
            </motion.div>
          )}

          {/* MOVEMENT — SCREEN */}
          {show.screen && (
            <motion.div {...reveal} style={{ marginTop: '58px' }}>
              <Marker n={num.screen} label="SCREEN" kicker="what i watch" accent={accent} />
              {taste.films.length > 0
                ? <PosterRail items={taste.films} accent={accent} />
                : <Invite accent={accent} icon={Film}>The films that shaped your eye. Titles become posters; a trailer link becomes a still you can open.</Invite>}
            </motion.div>
          )}

          {/* MOVEMENT — INFLUENCES */}
          {show.influences && (
            <motion.div {...reveal} style={{ marginTop: '58px' }}>
              <Marker n={num.influences} label="INFLUENCES" kicker="what shaped me" accent={accent} />
              {taste.influences.length > 0
                ? <WordWall items={taste.influences} accent={accent} />
                : <Invite accent={accent} icon={Sparkles}>The names, places and ideas behind your work. Written large — a wall of what made you.</Invite>}
            </motion.div>
          )}

          {/* MOVEMENT — WORK */}
          {show.work && (
            <motion.div {...reveal} style={{ marginTop: '58px' }}>
              <Marker n={num.work} label="WORK" kicker="what i make" accent={accent} />
              {media.length > 0 ? (
                <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {media.map((m, i) => <MediaCard key={`${m.url}:${i}`} item={m} accent={accent} full featured={i === 0} />)}
                </div>
              ) : <Invite accent={accent} icon={ArrowUpRight}>Show what you make. Drop links to your sets, films, photos, drops — they embed and play, right here.</Invite>}
            </motion.div>
          )}

          {/* closing mark */}
          {!worldIsEmpty && (
            <div style={{ marginTop: '64px', display: 'flex', alignItems: 'center', gap: '12px', opacity: .55 }}>
              <div style={{ height: '1px', flex: 1, background: 'linear-gradient(90deg,transparent,var(--border-hi))' }} />
              <span style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.22em', color: 'var(--cream-low)', textTransform: 'uppercase' }}>a world by {data.username ? `@${data.username}` : displayName}</span>
              <span style={{ fontFamily: 'Bebas Neue', fontSize: '15px', color: accent }}>4</span>
              <div style={{ height: '1px', flex: 1, background: 'linear-gradient(270deg,transparent,var(--border-hi))' }} />
            </div>
          )}

          {/* owner-only extras (full ticket card, events attended) rendered by the wrapper */}
          {ownerExtras}
        </div>
      )}
    </div>
  )
}

/* ---------- shared bits ---------- */
const pill = { background: 'rgba(10,9,8,.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(242,230,208,.18)', borderRadius: '100px', padding: '6px 12px', color: 'var(--cream)', fontSize: '10px', fontFamily: 'DM Sans', cursor: 'pointer' }

/* Editorial numbered section marker — "01 ── SOUND". */
function Marker({ n, label, kicker, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', marginBottom: '22px' }}>
      <span style={{ fontFamily: 'DM Mono', fontSize: '11px', color: accent, letterSpacing: '.1em', lineHeight: 1, paddingBottom: '6px' }}>{n}</span>
      <div>
        {kicker && <div style={{ fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.3em', color: 'var(--cream-low)', textTransform: 'uppercase', marginBottom: '7px' }}>{kicker}</div>}
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '32px', color: 'var(--cream)', letterSpacing: '.04em', lineHeight: 0.85 }}>{label}</div>
      </div>
      <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg,${accent}66,transparent)`, marginBottom: '9px' }} />
    </div>
  )
}

/* An empty movement, styled into the world — an invitation, never a barren shell. */
function Invite({ children, accent, icon: Icon }) {
  return (
    <div style={{ marginTop: '4px', padding: '24px 22px', borderRadius: '16px', border: `1px solid ${accent}26`, background: `linear-gradient(150deg, ${accent}0E, ${accent}04)`, display: 'flex', gap: '16px', alignItems: 'flex-start', maxWidth: '480px' }}>
      <div style={{ width: '38px', height: '38px', flexShrink: 0, borderRadius: '10px', border: `1px solid ${accent}40`, background: `${accent}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={17} style={{ color: accent }} strokeWidth={1.6} />
      </div>
      <p style={{ fontSize: '13.5px', color: 'var(--cream-mid)', lineHeight: 1.65, margin: 0, fontFamily: 'DM Sans' }}>{children}</p>
    </div>
  )
}

/* Little category tag inside a movement. */
function Tag({ label, count, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '14px' }}>
      <span style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.22em', color: 'var(--cream-mid)', textTransform: 'uppercase' }}>{label}</span>
      {count != null && <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--cream-low)' }}>{String(count).padStart(2, '0')}</span>}
      <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg,var(--border-hi),transparent)' }} />
    </div>
  )
}

/* ---------- SOUND: a featured player + an editorial tracklist ---------- */
function SoundMovement({ items, accent }) {
  const parsed = items.map((it, i) => ({ it, i, p: parseMedia(it) }))
  const players = parsed.filter(x => isPlayer(x.p))
  const featured = players[0] || null
  const morePlayers = players.slice(1)
  const tracks = parsed.filter(x => !isPlayer(x.p)) // names + plain links

  return (
    <div style={{ marginTop: '4px' }}>
      {featured && (
        <div style={{ marginBottom: tracks.length || morePlayers.length ? '26px' : 0 }}>
          <Tag label="On repeat" accent={accent} />
          <MediaCard item={{ url: featured.it }} accent={accent} full featured />
        </div>
      )}

      {tracks.length > 0 && (
        <div>
          {featured && <Tag label="In rotation" count={tracks.length} accent={accent} />}
          <div>
            {tracks.map((t, i) => <Track key={`${t.it}:${t.i}`} index={i + 1} value={t.it} accent={accent} />)}
          </div>
        </div>
      )}

      {morePlayers.length > 0 && (
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {morePlayers.map((m) => <MediaCard key={`${m.it}:${m.i}`} item={{ url: m.it }} accent={accent} full />)}
        </div>
      )}
    </div>
  )
}

/* A tracklist row — reads like the back of a record sleeve. */
function Track({ index, value, accent }) {
  const p = parseMedia(value)
  const link = p && p.kind === 'link' ? p : null
  const text = link ? (link.host || value) : value
  const inner = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '15px 6px', borderBottom: '1px solid var(--border)', color: 'var(--cream)', transition: 'all .25s ease' }}
      onMouseOver={e => { e.currentTarget.style.color = accent; e.currentTarget.style.paddingLeft = '14px'; e.currentTarget.style.borderColor = `${accent}44` }}
      onMouseOut={e => { e.currentTarget.style.color = 'var(--cream)'; e.currentTarget.style.paddingLeft = '6px'; e.currentTarget.style.borderColor = 'var(--border)' }}>
      <span style={{ fontFamily: 'DM Mono', fontSize: '11px', color: accent, opacity: .7, minWidth: '20px' }}>{String(index).padStart(2, '0')}</span>
      <span style={{ flex: 1, fontFamily: 'Bebas Neue', fontSize: '23px', letterSpacing: '.02em', color: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
      {link && <ArrowUpRight size={15} style={{ color: accent, flexShrink: 0 }} />}
    </div>
  )
  return link
    ? <a href={link.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>{inner}</a>
    : inner
}

/* ---------- SCREEN: a horizontal poster rail ---------- */
function PosterRail({ items, accent }) {
  return (
    <div className="no-scrollbar" style={{ marginTop: '4px', display: 'flex', gap: '14px', overflowX: 'auto', scrollSnapType: 'x proximity', paddingBottom: '6px', WebkitOverflowScrolling: 'touch' }}>
      {items.map((it, i) => <PosterCard key={`${it}:${i}`} value={it} index={i + 1} accent={accent} />)}
    </div>
  )
}
function PosterCard({ value, index, accent }) {
  const [imgOk, setImgOk] = useState(true)
  const p = parseMedia(value)
  const img = p && p.kind === 'image' ? p.src : (p && p.kind === 'video' ? p.thumb : null)
  const href = p && (p.kind === 'link' || p.kind === 'image' || p.kind === 'video') ? p.href : null
  // a plain name renders as-is; any URL falls back to its host, never the raw string
  const label = !p ? value : (p.kind === 'link' ? (p.host || value) : (hostOf(value) || value))

  const body = (img && imgOk) ? (
    <>
      <img src={img} alt={label} loading="lazy" onError={() => setImgOk(false)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,9,8,.05) 40%, rgba(10,9,8,.85) 100%)' }} />
      {p.kind === 'video' && (
        <div style={{ position: 'absolute', top: '10px', right: '10px', width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(10,9,8,.55)', border: `1px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Play size={13} style={{ color: 'var(--cream)', marginLeft: '2px' }} fill="var(--cream)" />
        </div>
      )}
      <div style={{ position: 'absolute', left: '12px', right: '12px', bottom: '12px', fontFamily: 'Bebas Neue', fontSize: '18px', color: 'var(--cream)', letterSpacing: '.02em', lineHeight: 1.02, textShadow: '0 1px 10px rgba(0,0,0,.6)' }}>{label}</div>
    </>
  ) : (
    // typographic poster — no image, still a curated object
    <>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${accent}22 0%, ${accent}08 45%, #0C0B0A 100%)` }} />
      <div style={{ position: 'absolute', top: '10px', left: '12px', fontFamily: 'DM Mono', fontSize: '9px', color: accent, letterSpacing: '.14em' }}>{String(index).padStart(2, '0')}</div>
      <div style={{ position: 'absolute', bottom: '-10px', right: '-4px', fontFamily: 'Bebas Neue', fontSize: '120px', lineHeight: 1, color: accent, opacity: .1, pointerEvents: 'none' }}>{(label || '?')[0].toUpperCase()}</div>
      <div style={{ position: 'absolute', left: '12px', right: '12px', bottom: '14px', fontFamily: 'Bebas Neue', fontSize: '22px', color: 'var(--cream)', letterSpacing: '.02em', lineHeight: 1.0 }}>{label}</div>
    </>
  )

  const card = (
    <div style={{ position: 'relative', flex: '0 0 auto', width: '148px', height: '212px', borderRadius: '14px', overflow: 'hidden', border: `1px solid ${accent}2E`, background: 'var(--bg-card)', scrollSnapAlign: 'start', transition: 'transform .25s ease, border-color .25s ease', cursor: href ? 'pointer' : 'default' }}
      onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = `${accent}77` }}
      onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = `${accent}2E` }}>
      {body}
    </div>
  )
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{card}</a>
    : card
}

/* ---------- INFLUENCES: a typographic word-wall ---------- */
function WordWall({ items, accent }) {
  const sizes = [34, 46, 26, 40, 30, 52, 28, 38]
  return (
    <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '10px 20px' }}>
      {items.map((it, i) => {
        const p = parseMedia(it)
        const href = p && p.kind === 'link' ? p.href : null
        const text = p && p.kind === 'link' ? (p.host || it) : it
        const size = sizes[i % sizes.length]
        const outline = i % 3 === 1 // every third word is an outline — collage rhythm
        const word = (
          <span style={{
            fontFamily: 'Bebas Neue', fontSize: `${size}px`, lineHeight: 0.98, letterSpacing: '.01em', cursor: href ? 'pointer' : 'default',
            color: outline ? 'transparent' : 'var(--cream)',
            WebkitTextStroke: outline ? `1px ${accent}` : 'none',
            transition: 'color .2s, -webkit-text-stroke-color .2s', display: 'inline-flex', alignItems: 'center', gap: '4px',
          }}
            onMouseOver={e => { e.currentTarget.style.color = accent; e.currentTarget.style.WebkitTextStroke = `1px ${accent}` }}
            onMouseOut={e => { e.currentTarget.style.color = outline ? 'transparent' : 'var(--cream)'; e.currentTarget.style.WebkitTextStroke = outline ? `1px ${accent}` : 'none' }}>
            {text}{href && <ArrowUpRight size={Math.round(size * 0.32)} style={{ color: accent, WebkitTextStroke: 'none' }} />}
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
function MediaCard({ item, accent, full, featured }) {
  const [play, setPlay] = useState(false)
  const [imgOk, setImgOk] = useState(true)
  const p = parseMedia(item.url)
  if (!p) return null
  const title = item.title || hostOf(item.url)

  if (p.kind === 'video') {
    return (
      <div style={{ borderRadius: '16px', overflow: 'hidden', border: `1px solid ${featured ? accent + '33' : 'var(--border-hi)'}`, background: 'var(--bg-card)', boxShadow: featured ? `0 12px 40px rgba(0,0,0,.35)` : 'none' }}>
        <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
          {play ? (
            <iframe src={p.embed} title={title || 'video'} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
          ) : (
            <button onClick={() => setPlay(true)} aria-label="Play" style={{ position: 'absolute', inset: 0, padding: 0, border: 'none', cursor: 'pointer', background: '#000' }}>
              {p.thumb && imgOk
                ? <img src={p.thumb} alt="" onError={() => setImgOk(false)} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: .92 }} />
                : <div style={{ width: '100%', height: '100%', background: `linear-gradient(150deg, ${accent}30, #0C0B0A)` }} />}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,9,8,.18)' }}>
                <div style={{ width: featured ? '62px' : '52px', height: featured ? '62px' : '52px', borderRadius: '50%', background: 'rgba(10,9,8,.55)', backdropFilter: 'blur(4px)', border: `1.5px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 24px ${accent}40` }}>
                  <Play size={featured ? 24 : 20} style={{ color: 'var(--cream)', marginLeft: '3px' }} fill="var(--cream)" />
                </div>
              </div>
            </button>
          )}
        </div>
        {title && <div style={{ padding: '13px 16px', fontSize: featured ? '13px' : '12px', color: 'var(--cream-mid)', borderTop: '1px solid var(--border)', fontFamily: 'DM Sans' }}>{title}</div>}
      </div>
    )
  }

  if (p.kind === 'audio') {
    return (
      <div style={{ borderRadius: '16px', overflow: 'hidden', border: `1px solid ${featured ? accent + '33' : 'var(--border-hi)'}`, background: 'var(--bg-card)', boxShadow: featured ? `0 12px 40px rgba(0,0,0,.35)` : 'none' }}>
        <iframe src={p.embed} title={title || 'audio'} loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" style={{ width: '100%', height: `${p.height}px`, border: 'none', display: 'block' }} />
        {item.title && <div style={{ padding: '13px 16px', fontSize: '12px', color: 'var(--cream-mid)', borderTop: '1px solid var(--border)', fontFamily: 'DM Sans' }}>{item.title}</div>}
      </div>
    )
  }

  if (p.kind === 'image') {
    return (
      <a href={p.href} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-hi)', textDecoration: 'none', background: 'var(--bg-card)', position: 'relative' }}>
        {imgOk
          ? <img src={p.src} alt={title} loading="lazy" onError={() => setImgOk(false)} style={{ width: '100%', display: 'block', objectFit: 'cover', maxHeight: featured ? '460px' : (full ? '420px' : '180px') }} />
          : <div style={{ width: '100%', height: full ? '180px' : '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cream-low)' }}><ImageOff size={18} /></div>}
        {item.title && <div style={{ padding: '13px 16px', fontSize: '12px', color: 'var(--cream-mid)', fontFamily: 'DM Sans' }}>{item.title}</div>}
      </a>
    )
  }

  // link
  return (
    <a href={p.href} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 18px', borderRadius: '14px', border: '1px solid var(--border-hi)', background: 'var(--bg-card)', textDecoration: 'none', transition: 'all .2s' }}
      onMouseOver={e => { e.currentTarget.style.borderColor = `${accent}55`; e.currentTarget.style.transform = 'translateX(3px)' }}
      onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border-hi)'; e.currentTarget.style.transform = 'translateX(0)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--cream)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title || p.host}</div>
        <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--cream-low)', marginTop: '3px' }}>{p.host}</div>
      </div>
      <ArrowUpRight size={16} style={{ color: accent, flexShrink: 0 }} />
    </a>
  )
}

/* ---------- edit-mode helpers ---------- */
function Section({ title, hint, accent, children }) {
  return (
    <div>
      <div style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.3em', color: 'var(--cream-low)', textTransform: 'uppercase' }}>{title}</div>
      <div style={{ height: '2px', width: '34px', background: accent, marginTop: '8px', borderRadius: '2px' }} />
      {hint && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--cream-low)', marginTop: '10px', lineHeight: 1.5 }}>{hint}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>{children}</div>
    </div>
  )
}
function Field({ label, hint, children }) {
  return <div><label style={monoLabel}>{label}</label>{hint && <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: 'var(--cream-low)', margin: '-3px 0 7px', letterSpacing: '.04em' }}>{hint}</div>}{children}</div>
}
