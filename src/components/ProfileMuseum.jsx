import { useState, useEffect, useRef } from 'react'
import { Edit3, Camera, MapPin, BadgeCheck, ExternalLink, Plus, X, Music2, Film, Sparkles, Loader2, Play, ImageOff } from 'lucide-react'

// stable id for editable rows (secure-context safe, with a plain fallback)
const uid = () => (globalThis.crypto?.randomUUID?.() || `r${Date.now()}${Math.random().toString(36).slice(2)}`)

/* =========================================================================
   ProfileMuseum — a personal WORLD, not a card.
   One component, two routes:
     • /profile      → owner view  (isOwner, with edit + cover/avatar upload)
     • /user/:id     → public view (read-only)
   Cover · Identity · The Museum (taste, media-rich) · Work · verified badge.
   Editorial, visual-first, accent-led — every profile is its own world.
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
  const hasTaste = taste.music.length || taste.films.length || taste.influences.length
  const displayName = data.full_name || 'Unnamed'
  const avatar = safeImg(data.avatar_url)
  const cover = safeImg(data.cover_url)
  const mesh = `radial-gradient(120% 130% at 0% 0%, ${accent}40 0%, transparent 55%), radial-gradient(130% 120% at 100% 20%, ${accent2}30 0%, transparent 60%), linear-gradient(165deg,#17120D 0%,#0C0B0A 70%)`

  return (
    <div style={{ background: 'linear-gradient(180deg,#0E0D0C 0%,#0C0B0A 18%,#0A0908 38%,#0A0908 100%)', minHeight: '100vh' }}>

      {/* ============ COVER ============ */}
      <div style={{ position: 'relative', height: '208px', overflow: 'hidden' }}>
        {cover
          ? <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', background: mesh }} />}
        {/* grain + scrim so the avatar/name sit legibly on top */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,9,8,.15) 0%, rgba(10,9,8,.35) 55%, var(--bg) 100%)' }} />

        {/* top bar (back / sign-out) floats over the cover */}
        {topBar && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 4 }}>{topBar}</div>}

        {/* owner cover controls */}
        {isOwner && (
          <div style={{ position: 'absolute', bottom: '14px', right: '14px', display: 'flex', gap: '8px', zIndex: 4 }}>
            {cover && <button onClick={removeCover} style={pill}>Remove</button>}
            <button onClick={() => coverRef.current?.click()} style={{ ...pill, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {coverUploading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={11} />} {cover ? 'Change cover' : 'Add cover'}
            </button>
            <input ref={coverRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadCover} />
          </div>
        )}
      </div>

      {/* ============ IDENTITY ============ */}
      <div style={{ position: 'relative', padding: '0 24px', marginTop: '-46px', zIndex: 3 }}>
        {/* avatar overlapping the cover edge */}
        <div style={{ position: 'relative', width: '100px', height: '100px', cursor: isOwner ? 'pointer' : 'default' }} onClick={() => isOwner && fileRef.current?.click()}>
          {avatar
            ? <img src={avatar} alt="" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--bg)', outline: `2px solid ${accent}`, boxShadow: `0 8px 30px rgba(0,0,0,.5), 0 0 30px ${accent}26` }} />
            : <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--bg-raised)', border: '3px solid var(--bg)', outline: `2px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bebas Neue', fontSize: '42px', color: accent, boxShadow: `0 8px 30px rgba(0,0,0,.5), 0 0 30px ${accent}26` }}>{displayName[0].toUpperCase()}</div>}
          {isOwner && (
            <>
              <div style={{ position: 'absolute', bottom: '2px', right: '2px', width: '30px', height: '30px', borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Camera size={13} style={{ color: 'var(--cream-mid)' }} />
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadPhoto} />
              {uploading && <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(10,9,8,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={20} style={{ color: 'var(--cream-mid)', animation: 'spin 1s linear infinite' }} /></div>}
            </>
          )}
        </div>

        {/* name / discipline / tagline / meta */}
        <div style={{ marginTop: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: 'Bebas Neue', fontSize: '44px', color: 'var(--cream)', letterSpacing: '.01em', lineHeight: .95, margin: 0 }}>{displayName}</h1>
            {data.verified && <span title="Verified" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: accent }}><BadgeCheck size={22} /></span>}
          </div>

          {data.discipline && <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: accent, letterSpacing: '.16em', marginTop: '8px', textTransform: 'uppercase' }}>{data.discipline}</div>}

          {data.tagline && (
            <p style={{ fontFamily: 'DM Sans', fontStyle: 'italic', fontSize: '16px', color: 'var(--cream)', lineHeight: 1.45, margin: '12px 0 0', maxWidth: '460px' }}>
              <span style={{ color: accent, fontStyle: 'normal' }}>“</span>{data.tagline}<span style={{ color: accent, fontStyle: 'normal' }}>”</span>
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
            {data.username && <span style={{ fontFamily: 'DM Mono', fontSize: '11px', color: 'var(--cream-mid)' }}>@{data.username}</span>}
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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

          {isOwner && !editing && (
            <button onClick={startEdit} style={{ marginTop: '16px', background: 'rgba(242,230,208,.05)', border: '1px solid rgba(242,230,208,.16)', borderRadius: '100px', padding: '8px 18px', color: 'var(--cream)', fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px', fontFamily: 'DM Sans', letterSpacing: '.02em', transition: 'all .2s' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(242,230,208,.11)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(242,230,208,.05)'}>
              <Edit3 size={11} /> Edit your world
            </button>
          )}
        </div>
      </div>

      {/* ============ EDIT MODE ============ */}
      {editing ? (
        <div style={{ padding: '28px 24px 130px', display: 'flex', flexDirection: 'column', gap: '28px', animation: 'fadeUp .3s ease' }}>
          <Section accent={accent} title="IDENTITY">
            <Field label="NAME"><input style={inp} value={name} placeholder="Your name" onChange={e => setName(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="HANDLE"><input style={inp} value={username} placeholder="@yourhandle" onChange={e => setUsername(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="DISCIPLINE"><input style={inp} value={discipline} placeholder="DJ · Painter · Photographer…" onChange={e => setDiscipline(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="CITY"><input style={inp} value={city} placeholder="Houston" onChange={e => setCity(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="RIGHT NOW" hint="One line, your voice. What you're on right now."><input style={inp} value={tagline} placeholder="Chasing the sound that doesn't exist yet." onChange={e => setTagline(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="BIO"><textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={bio} placeholder="Who are you, in your own words?" onChange={e => setBio(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
          </Section>

          <Section accent={accent} title="THE MUSEUM" hint="One per line. A name — or paste a link (Spotify, YouTube, SoundCloud) and it plays right here.">
            <Field label="SOUND"><textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={music} placeholder={'Fred again..\nhttps://open.spotify.com/track/…\nFela Kuti'} onChange={e => setMusic(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
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
        /* ============ VIEW MODE ============ */
        <div style={{ padding: '26px 24px 120px' }}>
          {data.bio && <p className="fade-up-1" style={{ fontSize: '15px', color: 'var(--cream-mid)', lineHeight: 1.75, maxWidth: '560px', margin: '0' }}>{data.bio}</p>}

          {/* THE MUSEUM */}
          {(hasTaste || isOwner) && (
            <div className="fade-up-2" style={{ marginTop: data.bio ? '42px' : '30px' }}>
              <Heading accent={accent} kicker="what shaped me">THE MUSEUM</Heading>
              {hasTaste ? (
                <div style={{ marginTop: '22px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
                  <SoundWall icon={Music2} label="SOUND" items={taste.music} accent={accent} />
                  <VisualWall icon={Film} label="SCREEN" items={taste.films} accent={accent} />
                  <VisualWall icon={Sparkles} label="INFLUENCES" items={taste.influences} accent={accent} />
                </div>
              ) : <Empty accent={accent}>Your taste is your world. Add the sound, the films, the influences that shaped you — paste a link and it plays right here.</Empty>}
            </div>
          )}

          {/* WORK */}
          {(media.length > 0 || isOwner) && (
            <div className="fade-up-3" style={{ marginTop: '46px' }}>
              <Heading accent={accent} kicker="what i make">WORK</Heading>
              {media.length > 0 ? (
                <div style={{ marginTop: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {media.map((m, i) => <MediaCard key={`${m.url}:${i}`} item={m} accent={accent} full />)}
                </div>
              ) : <Empty accent={accent}>Show what you make. Drop links to your sets, films, photos, drops — they embed and play, right here.</Empty>}
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

function Heading({ children, accent, kicker }) {
  return (
    <div>
      {kicker && <div style={{ fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.28em', color: accent, textTransform: 'uppercase', marginBottom: '6px' }}>{kicker}</div>}
      <div style={{ fontFamily: 'Bebas Neue', fontSize: '26px', color: 'var(--cream)', letterSpacing: '.04em', lineHeight: 1 }}>{children}</div>
      <div style={{ height: '2px', width: '40px', background: accent, marginTop: '9px', borderRadius: '2px' }} />
    </div>
  )
}
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
function Empty({ children, accent }) {
  return <div style={{ marginTop: '16px', padding: '22px 22px', border: `1px dashed ${accent}3A`, borderRadius: '14px', background: `${accent}07`, fontSize: '13px', color: 'var(--cream-mid)', lineHeight: 1.6, maxWidth: '460px' }}>{children}</div>
}
function CategoryLabel({ icon: Icon, label, count, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '13px' }}>
      <Icon size={13} style={{ color: accent }} strokeWidth={1.6} />
      <span style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.22em', color: 'var(--cream-mid)' }}>{label}</span>
      <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--cream-low)' }}>{String(count).padStart(2, '0')}</span>
      <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg,var(--border-hi),transparent)' }} />
    </div>
  )
}

/* SOUND — a tracklist that can actually play. Links → players, names → placards. */
function SoundWall({ icon, label, items, accent }) {
  if (!items?.length) return null
  return (
    <div>
      <CategoryLabel icon={icon} label={label} count={items.length} accent={accent} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.map((it, i) => {
          const p = parseMedia(it)
          if (p && p.kind !== 'link') return <MediaCard key={`${it}:${i}`} item={{ url: it }} accent={accent} full />
          return <TrackCard key={`${it}:${i}`} index={i + 1} value={it} accent={accent} link={p?.kind === 'link' ? p : null} />
        })}
      </div>
    </div>
  )
}
function TrackCard({ index, value, accent, link }) {
  const text = link ? (link.host || value) : value
  const inner = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border-hi)', background: 'var(--bg-card)', transition: 'all .2s' }}
      onMouseOver={e => { e.currentTarget.style.borderColor = `${accent}55`; e.currentTarget.style.background = `${accent}0A` }}
      onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border-hi)'; e.currentTarget.style.background = 'var(--bg-card)' }}>
      <span style={{ fontFamily: 'Bebas Neue', fontSize: '20px', color: `${accent}`, opacity: .8, minWidth: '24px' }}>{String(index).padStart(2, '0')}</span>
      <span style={{ flex: 1, fontFamily: 'Bebas Neue', fontSize: '21px', letterSpacing: '.02em', color: 'var(--cream)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
      {link && <ExternalLink size={14} style={{ color: accent, flexShrink: 0 }} />}
    </div>
  )
  return link
    ? <a href={link.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{inner}</a>
    : inner
}

/* SCREEN / INFLUENCES — a visual wall. Links → thumbnails, names → placards. */
function VisualWall({ icon, label, items, accent }) {
  if (!items?.length) return null
  return (
    <div>
      <CategoryLabel icon={icon} label={label} count={items.length} accent={accent} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
        {items.map((it, i) => {
          const p = parseMedia(it)
          if (p && (p.kind === 'video' || p.kind === 'image')) return <MediaCard key={`${it}:${i}`} item={{ url: it }} accent={accent} />
          return <Placard key={`${it}:${i}`} value={p?.kind === 'link' ? (p.host || it) : it} href={p?.kind === 'link' ? p.href : null} accent={accent} />
        })}
      </div>
    </div>
  )
}
function Placard({ value, href, accent }) {
  const card = (
    <div style={{ position: 'relative', overflow: 'hidden', minHeight: '92px', display: 'flex', alignItems: 'flex-end', padding: '14px', borderRadius: '12px', border: `1px solid ${accent}2A`, background: `linear-gradient(150deg, ${accent}12, ${accent}05)`, transition: 'all .2s' }}
      onMouseOver={e => { e.currentTarget.style.borderColor = `${accent}66`; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseOut={e => { e.currentTarget.style.borderColor = `${accent}2A`; e.currentTarget.style.transform = 'translateY(0)' }}>
      <div style={{ position: 'absolute', top: '-8px', right: '-6px', fontFamily: 'Bebas Neue', fontSize: '64px', color: accent, opacity: .08, lineHeight: 1, pointerEvents: 'none' }}>{(value || '?')[0].toUpperCase()}</div>
      <span style={{ position: 'relative', fontFamily: 'Bebas Neue', fontSize: '19px', letterSpacing: '.02em', color: 'var(--cream)', lineHeight: 1.05 }}>{value}</span>
      {href && <ExternalLink size={12} style={{ position: 'absolute', top: '12px', left: '12px', color: accent }} />}
    </div>
  )
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{card}</a> : card
}

/* MediaCard — video (click to play), audio (live player), image, link. */
function MediaCard({ item, accent, full }) {
  const [play, setPlay] = useState(false)
  const [imgOk, setImgOk] = useState(true)
  const p = parseMedia(item.url)
  if (!p) return null
  const title = item.title || (p.kind === 'link' ? '' : '') || hostOf(item.url)

  if (p.kind === 'video') {
    return (
      <div style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border-hi)', background: 'var(--bg-card)' }}>
        <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
          {play ? (
            <iframe src={p.embed} title={title || 'video'} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
          ) : (
            <button onClick={() => setPlay(true)} aria-label="Play" style={{ position: 'absolute', inset: 0, padding: 0, border: 'none', cursor: 'pointer', background: '#000' }}>
              {p.thumb && imgOk
                ? <img src={p.thumb} alt="" onError={() => setImgOk(false)} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: .92 }} />
                : <div style={{ width: '100%', height: '100%', background: `linear-gradient(150deg, ${accent}30, #0C0B0A)` }} />}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,9,8,.18)' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(10,9,8,.55)', backdropFilter: 'blur(4px)', border: `1.5px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 24px ${accent}40` }}>
                  <Play size={20} style={{ color: 'var(--cream)', marginLeft: '3px' }} fill="var(--cream)" />
                </div>
              </div>
            </button>
          )}
        </div>
        {title && <div style={{ padding: '11px 15px', fontSize: '12px', color: 'var(--cream-mid)', borderTop: '1px solid var(--border)' }}>{title}</div>}
      </div>
    )
  }

  if (p.kind === 'audio') {
    return (
      <div style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border-hi)', background: 'var(--bg-card)' }}>
        <iframe src={p.embed} title={title || 'audio'} loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" style={{ width: '100%', height: `${p.height}px`, border: 'none', display: 'block' }} />
        {item.title && <div style={{ padding: '11px 15px', fontSize: '12px', color: 'var(--cream-mid)', borderTop: '1px solid var(--border)' }}>{item.title}</div>}
      </div>
    )
  }

  if (p.kind === 'image') {
    return (
      <a href={p.href} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: full ? '14px' : '12px', overflow: 'hidden', border: '1px solid var(--border-hi)', textDecoration: 'none', background: 'var(--bg-card)' }}>
        {imgOk
          ? <img src={p.src} alt={title} loading="lazy" onError={() => setImgOk(false)} style={{ width: '100%', display: 'block', objectFit: 'cover', maxHeight: full ? '420px' : '180px' }} />
          : <div style={{ width: '100%', height: full ? '180px' : '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cream-low)' }}><ImageOff size={18} /></div>}
        {item.title && <div style={{ padding: '11px 15px', fontSize: '12px', color: 'var(--cream-mid)' }}>{item.title}</div>}
      </a>
    )
  }

  // link
  return (
    <a href={p.href} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '15px 17px', borderRadius: '12px', border: '1px solid var(--border-hi)', background: 'var(--bg-card)', textDecoration: 'none', transition: 'all .2s' }}
      onMouseOver={e => { e.currentTarget.style.borderColor = `${accent}55`; e.currentTarget.style.transform = 'translateX(3px)' }}
      onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border-hi)'; e.currentTarget.style.transform = 'translateX(0)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--cream)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title || p.host}</div>
        <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--cream-low)', marginTop: '3px' }}>{p.host}</div>
      </div>
      <ExternalLink size={15} style={{ color: accent, flexShrink: 0 }} />
    </a>
  )
}
