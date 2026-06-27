import { useState, useEffect, useRef } from 'react'
import { Edit3, Camera, MapPin, BadgeCheck, ExternalLink, Plus, X, Music2, Film, Sparkles, Loader2 } from 'lucide-react'

// stable id for editable rows (secure-context safe, with a plain fallback)
const uid = () => (globalThis.crypto?.randomUUID?.() || `r${Date.now()}${Math.random().toString(36).slice(2)}`)

/* =========================================================================
   ProfileMuseum — the shared "personal world" surface.
   One component, two routes:
     • /profile      → owner view  (isOwner, with edit + avatar upload)
     • /user/:id     → public view (read-only)
   Sections: Identity · The Museum (taste) · Work (media) · verified badge.
   Aesthetic stolen from ArtistProfile: accent glow, DM Mono labels, Bebas
   headers. Every profile gets its own accent → every profile its own world.
   ========================================================================= */

// --- palette pulled from the existing design tokens (index.css) ---
const ACCENTS = ['#C86040', '#5A8A3A', '#9A3050', '#5060A0', '#D4A040', '#4A7AFF', '#40B060']
function accentFor(seed = '') {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return ACCENTS[h % ACCENTS.length]
}

// --- only ever trust http(s) urls (no javascript:, data:, etc.) ---
function safeUrl(raw) {
  const u = (raw || '').trim()
  return /^https?:\/\//i.test(u) ? u : ''
}
function hostOf(raw) {
  try { return new URL(safeUrl(raw)).hostname.replace(/^www\./, '') } catch { return '' }
}
function isImage(raw) { return /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(safeUrl(raw)) }

// --- known embeds only (whitelist) → no arbitrary iframe injection ---
function getEmbed(raw) {
  const u = safeUrl(raw); if (!u) return null
  let m
  if ((m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)))
    return { src: `https://www.youtube.com/embed/${m[1]}`, ratio: true }
  if ((m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)))
    return { src: `https://player.vimeo.com/video/${m[1]}`, ratio: true }
  if ((m = u.match(/open\.spotify\.com\/(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/)))
    return { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, height: m[1] === 'track' ? 152 : 352 }
  if (/soundcloud\.com\//.test(u))
    return { src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u)}&color=%23C86040&visual=false`, height: 166 }
  return null
}
function detectType(raw) {
  if (getEmbed(raw)) return 'embed'
  if (isImage(raw)) return 'image'
  return 'link'
}

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

export default function ProfileMuseum({ profile, isOwner = false, onSave, onUploadAvatar, ticket, topBar, ownerExtras }) {
  const [data, setData] = useState(profile)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  // edit-form state
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [discipline, setDiscipline] = useState('')
  const [city, setCity] = useState('')
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
    const patch = {
      full_name: name.trim() || null,
      username: username.trim().replace(/^@/, '') || null,
      discipline: discipline.trim() || null,
      city: city.trim() || null,
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
      console.error('Avatar upload failed:', err)   // keep the previous avatar; spinner clears below
    } finally {
      setUploading(false)
      input.value = ''   // allow re-selecting the same file (change event refires)
    }
  }

  if (!data) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ fontFamily: 'DM Mono', fontSize: '11px', color: 'var(--cream-low)' }}>Loading...</div>
    </div>
  )

  const accent = accentFor(data.id || data.username || data.full_name || 'c4')
  const taste = normTaste(data.taste)
  const media = normMedia(data.media)
  const hasTaste = taste.music.length || taste.films.length || taste.influences.length
  const displayName = data.full_name || 'Unnamed'
  // avatar is the one URL that reaches public viewers — keep it on the same
  // whitelist as every other URL (http(s) or an uploaded data:image), else fall back.
  const avatar = (safeUrl(data.avatar_url) || (data.avatar_url || '').startsWith('data:image/')) ? data.avatar_url : ''

  return (
    <div style={{ background: 'linear-gradient(180deg,#0E0D0C 0%,#0C0B0A 20%,#0A0908 40%,#0A0908 100%)', minHeight: '100vh' }}>
      {/* top bar slot (sign-out for owner / back for public) */}
      {topBar && <div style={{ padding: '18px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>{topBar}</div>}

      {/* ============ HERO ============ */}
      <div style={{ position: 'relative', overflow: 'hidden', padding: '36px 28px 24px', textAlign: 'center' }}>
        <div style={{ position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)', width: '320px', height: '320px', borderRadius: '50%', background: `radial-gradient(circle,${accent}1F 0%,transparent 70%)`, filter: 'blur(60px)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* avatar */}
          <div style={{ position: 'relative', width: '96px', height: '96px', margin: '0 auto 16px', cursor: isOwner ? 'pointer' : 'default' }} onClick={() => isOwner && fileRef.current?.click()}>
            {avatar
              ? <img src={avatar} alt="" style={{ width: '96px', height: '96px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${accent}55`, boxShadow: `0 0 26px ${accent}1A` }} />
              : <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'var(--bg-raised)', border: `2px solid ${accent}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bebas Neue', fontSize: '40px', color: accent, boxShadow: `0 0 26px ${accent}1A` }}>{displayName[0].toUpperCase()}</div>}
            {isOwner && (
              <>
                <div style={{ position: 'absolute', bottom: '0', right: '0', width: '30px', height: '30px', borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={13} style={{ color: 'var(--cream-mid)' }} />
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadPhoto} />
                {uploading && <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(10,9,8,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={20} style={{ color: 'var(--cream-mid)', animation: 'spin 1s linear infinite' }} /></div>}
              </>
            )}
          </div>

          {/* name + verified */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span style={{ fontFamily: 'Bebas Neue', fontSize: '34px', color: 'var(--cream)', letterSpacing: '.02em', lineHeight: 1 }}>{displayName}</span>
            {data.verified && <BadgeCheck size={20} style={{ color: accent }} />}
          </div>

          {data.discipline && <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: accent, letterSpacing: '.08em', marginTop: '9px', textTransform: 'uppercase' }}>{data.discipline}</div>}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '7px', flexWrap: 'wrap' }}>
            {data.username && <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: 'var(--cream-mid)' }}>@{data.username}</span>}
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={10} style={{ color: 'var(--cream-low)' }} />
              <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: 'var(--cream-low)' }}>{data.city || 'Houston'}</span>
            </span>
          </div>

          {isOwner && !editing && (
            <button onClick={startEdit} style={{ marginTop: '16px', background: 'rgba(242,230,208,.04)', border: '1px solid rgba(242,230,208,.14)', borderRadius: '100px', padding: '7px 18px', color: 'var(--cream-mid)', fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px', fontFamily: 'DM Sans', transition: 'all .2s' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(242,230,208,.1)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(242,230,208,.04)'}>
              <Edit3 size={11} /> Edit your world
            </button>
          )}
        </div>
      </div>

      {/* ============ EDIT MODE ============ */}
      {editing ? (
        <div style={{ padding: '4px 28px 120px', display: 'flex', flexDirection: 'column', gap: '26px', animation: 'fadeUp .3s ease' }}>
          <Section accent={accent} title="IDENTITY">
            <Field label="NAME"><input style={inp} value={name} placeholder="Your name" onChange={e => setName(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="HANDLE"><input style={inp} value={username} placeholder="@yourhandle" onChange={e => setUsername(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="DISCIPLINE"><input style={inp} value={discipline} placeholder="DJ · Painter · Photographer…" onChange={e => setDiscipline(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="CITY"><input style={inp} value={city} placeholder="Houston" onChange={e => setCity(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="BIO"><textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={bio} placeholder="Who are you, in your own words?" onChange={e => setBio(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
          </Section>

          <Section accent={accent} title="THE MUSEUM" hint="One per line. The taste that makes you, you.">
            <Field label="SOUND"><textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={music} placeholder={'Fred again..\nNicolás Jaar\nFela Kuti'} onChange={e => setMusic(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
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

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setEditing(false)} style={{ flex: '0 0 auto', background: 'rgba(242,230,208,.04)', border: '1px solid rgba(242,230,208,.12)', borderRadius: '10px', padding: '14px 22px', color: 'var(--cream-mid)', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans' }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ flex: 1, background: 'var(--cream)', border: 'none', borderRadius: '10px', padding: '14px', color: 'var(--bg)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans', opacity: saving ? .6 : 1, transition: 'all .2s' }}>{saving ? 'Saving…' : 'Save your world'}</button>
          </div>
        </div>
      ) : (
        /* ============ VIEW MODE ============ */
        <div style={{ padding: '8px 28px 110px' }}>
          {data.bio && <p style={{ fontSize: '14px', color: 'var(--cream-mid)', lineHeight: 1.7, textAlign: 'center', maxWidth: '440px', margin: '4px auto 0' }}>{data.bio}</p>}

          {/* going-to-event badge (public + owner who hasn't got the full card) */}
          {ticket && (
            <div style={{ marginTop: '24px', padding: '15px 18px', borderRadius: '12px', background: 'rgba(0,213,75,.04)', border: '1px solid rgba(0,213,75,.14)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00D54B', boxShadow: '0 0 6px rgba(0,213,75,.4)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--cream)' }}>Going to RBA Edition 002</div>
                <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--cream-low)', marginTop: '2px' }}>June 13, 2026 · Houston</div>
              </div>
            </div>
          )}

          {/* THE MUSEUM */}
          {(hasTaste || isOwner) && (
            <div style={{ marginTop: '34px' }}>
              <Heading accent={accent}>THE MUSEUM</Heading>
              {hasTaste ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '18px' }}>
                  <TasteRow icon={Music2} label="SOUND" items={taste.music} accent={accent} />
                  <TasteRow icon={Film} label="SCREEN" items={taste.films} accent={accent} />
                  <TasteRow icon={Sparkles} label="INFLUENCES" items={taste.influences} accent={accent} />
                </div>
              ) : <Empty>Your taste is your world. Add the sound, the films, the influences that shaped you.</Empty>}
            </div>
          )}

          {/* WORK */}
          {(media.length > 0 || isOwner) && (
            <div style={{ marginTop: '40px' }}>
              <Heading accent={accent}>WORK</Heading>
              {media.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '18px' }}>
                  {media.map((m, i) => <MediaItem key={i} item={m} accent={accent} />)}
                </div>
              ) : <Empty>Show what you make. Drop links to your sets, films, photos, drops — they embed automatically.</Empty>}
            </div>
          )}

          {/* owner-only extras (full ticket card, events attended) rendered by the wrapper */}
          {ownerExtras}
        </div>
      )}
    </div>
  )
}

/* ---------- small presentational helpers ---------- */
function Heading({ children, accent }) {
  return (
    <div>
      <div style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.3em', color: 'var(--cream-low)', textTransform: 'uppercase' }}>{children}</div>
      <div style={{ height: '2px', width: '34px', background: accent, marginTop: '8px', borderRadius: '2px', opacity: .8 }} />
    </div>
  )
}
function Section({ title, hint, accent, children }) {
  return (
    <div>
      <Heading accent={accent}>{title}</Heading>
      {hint && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--cream-low)', marginTop: '8px', lineHeight: 1.5 }}>{hint}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>{children}</div>
    </div>
  )
}
function Field({ label, children }) {
  return <div><label style={monoLabel}>{label}</label>{children}</div>
}
function Empty({ children }) {
  return <div style={{ marginTop: '14px', padding: '18px 20px', border: '1px dashed var(--border-hi)', borderRadius: '12px', fontSize: '12px', color: 'var(--cream-low)', lineHeight: 1.6 }}>{children}</div>
}
function TasteRow({ icon: Icon, label, items, accent }) {
  if (!items || !items.length) return null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
        <Icon size={12} style={{ color: accent }} strokeWidth={1.6} />
        <span style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.2em', color: 'var(--cream-mid)' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {items.map((it, i) => (
          <span key={i} style={{ fontFamily: 'DM Sans', fontSize: '12px', color: 'var(--cream-mid)', background: `${accent}0D`, border: `1px solid ${accent}26`, borderRadius: '100px', padding: '6px 13px' }}>{it}</span>
        ))}
      </div>
    </div>
  )
}
function MediaItem({ item, accent }) {
  const url = safeUrl(item.url)
  if (!url) return null
  const embed = getEmbed(url)
  const title = item.title || hostOf(url)

  if (embed) {
    return (
      <div style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border-hi)', background: 'var(--bg-card)' }}>
        {embed.ratio ? (
          <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
            <iframe src={embed.src} title={title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
          </div>
        ) : (
          <iframe src={embed.src} title={title} loading="lazy" allow="autoplay; clipboard-write; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" style={{ width: '100%', height: `${embed.height}px`, border: 'none', display: 'block' }} />
        )}
        {item.title && <div style={{ padding: '11px 15px', fontSize: '12px', color: 'var(--cream-mid)', borderTop: '1px solid var(--border)' }}>{item.title}</div>}
      </div>
    )
  }

  if (isImage(url)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border-hi)', textDecoration: 'none' }}>
        <img src={url} alt={title} loading="lazy" style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
        {item.title && <div style={{ padding: '11px 15px', fontSize: '12px', color: 'var(--cream-mid)', background: 'var(--bg-card)' }}>{item.title}</div>}
      </a>
    )
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '15px 17px', borderRadius: '12px', border: '1px solid var(--border-hi)', background: 'var(--bg-card)', textDecoration: 'none', transition: 'all .2s' }}
      onMouseOver={e => { e.currentTarget.style.borderColor = `${accent}55`; e.currentTarget.style.transform = 'translateX(3px)' }}
      onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border-hi)'; e.currentTarget.style.transform = 'translateX(0)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--cream)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--cream-low)', marginTop: '3px' }}>{hostOf(url)}</div>
      </div>
      <ExternalLink size={15} style={{ color: accent, flexShrink: 0 }} />
    </a>
  )
}
