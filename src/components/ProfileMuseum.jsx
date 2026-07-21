import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Edit3, Camera, MapPin, Plus, X, Music2, Film, Sparkles, Loader2, Play, ImageOff, ArrowUpRight, ImagePlus, ArrowUp, ArrowDown, UserPlus, UserCheck, MessageCircle, Tag as TagIcon } from 'lucide-react'
import VerifiedMark from './VerifiedMark'
import { CARD_TINT, cardGlass, glassControl } from '@/lib/glass'
import WorldBuilder from '@/components/WorldBuilder'
import WorldMoments from '@/components/WorldMoments'
import WorldOffer from '@/components/WorldOffer'
import SeedPill from '@/components/SeedMark'
import { MoreChip } from '@/components/Chip'
import { useCosmosOverride } from '@/components/Atmosphere'
import CraftPicker from '@/components/CraftPicker'
import Mark from '@/components/Mark'
import PeopleSheet from '@/components/PeopleSheet'
import CraftsSheet from '@/components/CraftsSheet'
import { VOCAB, VOCAB_PHRASE } from '@/lib/socialVocab'
import { fetchFollowers, fetchFollowing } from '@/lib/social'
import { useWide } from '@/lib/useIsDesktop'
import { THEMES, nameSkin, DEFAULT_MARQUEE, marqueeOf, normGallery, normLinks, worldCompleteness, MODULES, normModules, defaultModulesFor, craftKindOf } from '@/lib/world'
import { craftLine, saveProfileCrafts, categoryMeta, kindOfCrafts } from '@/lib/crafts'
import { TASTE_DOMAINS } from '@/lib/tastes'
import { EASE_HOUSE_ARR, tintChannel } from '@/lib/cosmos'

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
const VOID = 'var(--bg)'
const BONE = 'var(--cream)'
const BONE_MID = 'var(--cream-soft)'
const BONE_LOW = 'var(--cream-dim)'
const SILVER = 'var(--silver)'                                  // solid chrome for lines / marks
const STAR = 'var(--star)'
/* v11: translúcida, no opaca — el vidrio de los chips necesita algo
   vivo que muestrear, y la atmósfera de la app pasa por detrás. */
const CARD = CARD_TINT
const CARD_HI = 'var(--card-hi-solid)'
const HAIR = 'rgba(var(--ink-rgb),0.08)'
const HAIR_HI = 'rgba(var(--ink-rgb),0.15)'
const PAGE_BG = 'linear-gradient(180deg,var(--bg-top) 0%,var(--bg-deep-2) 55%,var(--bg-deep) 100%)'

/* THE COVER DISSOLVE (v12). Two ramps that have to stay in register — they
   run over the same bleeding box, so a stop means the same pixel in both.

   COVER_FADE masks the photograph itself: solid through the whole hero, then
   a long release to true transparency. Because it ends at alpha 0 rather than
   at a colour, the tail of the cover reveals the app's live atmosphere
   instead of a painted black slab — that is the whole difference between a
   cut and a dissolve.

   COVER_SCRIM is the legibility band (Ley 3): it peaks where the identity
   block lands and then releases to nothing. Ending it opaque is exactly what
   drew the hard edge before. Both are near-void var(--bg-deep)/var(--bg) rather than
   var(--bg-deep-2) so the tail matches the page it dissolves into — three different
   blacks used to meet at that seam.

   ─── RECONCILIACIÓN v12: DOS ARREGLOS DISTINTOS, LOS DOS VIVOS ────────────

   Las dos ramas rehicieron esta portada al mismo tiempo, cada una arreglando
   un defecto REAL Y DISTINTO. No se pisan porque no hablan de lo mismo:

   · GEOMETRÍA (Diego) — DÓNDE ocurre la disolución. Las paradas venían en
     porcentajes fijos sobre una caja cuya altura es hero + sangrado, o sea
     el 74% caía en un píxel distinto en cada pantalla y el degradado se
     despegaba del nombre. Ahora son FUNCIONES ancladas con calc() al BORDE
     INFERIOR, así la foto se apaga donde de verdad termina, en cualquier
     alto de hero. Y la foto crece para llenar su sección.

   · PISO DEL VELO (Pato) — el scrim tenía un AGUJERO: caía a alpha 0 en el
     22-26%, así que la franja alta corría a fuerza completa y era justo la
     que gritaba. Ahora nunca suelta el piso atmosférico (~.30).

   · GRADO (Pato) — CUÁNTO grita la foto. Entraba a saturación y brillo
     completos y peleaba con el nombre por la misma atención. Bajarle
     saturación y brillo no es esconder la obra: es ponerla detrás del vidrio
     de una galería. El texto manda, la foto susurra.

   Uno dice dónde se apaga, el otro cuánto suena, el tercero tapa un hueco.
   Los tres se aplican juntos. El piso de Pato quedó plegado DENTRO de la
   función de Diego (las tres primeras paradas), que es lo único que había
   que coser a mano.

   ⚠ PENDIENTE DE OJO DE DIEGO: la única tensión estética real de todo el
   merge. "Más grande y presente" (Diego) y "más callada" (Pato) tiran en
   direcciones opuestas sobre la MISMA foto. Mecánicamente conviven; si al
   verla la portada se siente demasiado apagada, subir COVER_GRADE es una
   línea. Nadie más que Diego puede decidir eso mirándola. */
const coverFade = (bleed) => `linear-gradient(180deg,
  #000 0%,
  #000 calc(100% - ${bleed + 150}px),
  rgba(var(--shadow-rgb),.88) calc(100% - ${bleed + 96}px),
  rgba(var(--shadow-rgb),.62) calc(100% - ${bleed + 40}px),
  rgba(var(--shadow-rgb),.34) calc(100% - ${Math.round(bleed * 0.62)}px),
  rgba(var(--shadow-rgb),.14) calc(100% - ${Math.round(bleed * 0.30)}px),
  rgba(var(--shadow-rgb),0) 100%)`

/* las tres primeras paradas llevan el PISO de Pato (nunca soltar el velo
   arriba); de ahí para abajo manda el anclaje al borde inferior de Diego */
/* Las TRES primeras paradas salen por variable — son el "velo de atmósfera"
   y son las únicas que cambian de registro (index.css explica por qué). De la
   cuarta para abajo son PROTECCIÓN DE TEXTO: ahí vive el bloque de identidad
   y el velo tiene que pesar lo mismo en los dos temas o el nombre se pierde.
   No se tocan. */
/* v12.3 — LAS POSICIONES TAMBIÉN CAMBIAN POR TEMA, NO SÓLO LAS α.

   Diego: "en light la portada difumina demasiado arriba; que baje más y
   difumine mucho más abajo, idéntico a dark". Audité por qué no igualaba y
   la respuesta es contraintuitiva: LAS PARADAS YA ERAN IDÉNTICAS en los dos
   registros. El problema no era dónde empieza el velo sino CUÁNTO SE NOTA
   que empieza.

     dark:  el velo va de .34 a .62  → salto de .28 sobre una foto ya velada
     light: el velo va de .12 a .62  → salto de .50 sobre una foto limpia

   Al arreglar la neblina (v12.2) bajé el velo de arriba de light a .12, que
   era correcto — pero eso volvió VISIBLE el arranque de la rampa. Con la
   misma geometría, dark disuelve sin que notes dónde y light enseña una
   línea. Números iguales, resultado distinto, porque el sustrato es distinto.

   Medido en pantalla: la rampa arrancaba a 158px de un scrim de 668px, y el
   primer texto (la línea de oficios) recién aparece a 311px. O sea ~150px de
   velo puestos ENCIMA de nada. Esos 150px son exactamente lo que Diego ve.

   Así que las posiciones salen por variable y en light la rampa empieza ~100
   px más abajo: la foto se mantiene limpia hasta casi tocar el texto, y de
   ahí el velo sube rápido pero SÓLO donde hace falta. El pico (.90/.88) no
   se mueve — ahí vive el nombre y ésa es su protección. */
const coverScrim = (bleed) => `linear-gradient(180deg,
  rgba(var(--void-rgb),var(--cover-veil-top)) 0%,
  rgba(var(--void-rgb),var(--cover-veil-hi)) 22%,
  rgba(var(--void-rgb),var(--cover-veil-mid)) calc(100% - ${bleed}px - var(--cover-o1)),
  rgba(var(--void-rgb),.62) calc(100% - ${bleed}px - var(--cover-o2)),
  rgba(var(--void-rgb),.90) calc(100% - ${bleed + 96}px),
  rgba(var(--void-rgb),.88) calc(100% - ${bleed + 20}px),
  rgba(var(--void-rgb),.50) calc(100% - ${Math.round(bleed * 0.55)}px),
  rgba(var(--void-rgb),.14) calc(100% - ${Math.round(bleed * 0.22)}px),
  rgba(var(--void-rgb),0) 100%)`

/* LA ZONA DE PORTADA. La foto llena de verdad la sección de arriba, y el
   sangrado crece con ella para que la disolución tenga por dónde correr —
   un fade largo necesita distancia, no sólo buenas paradas. */
/* v12.4 — LA PORTADA LLENA LA ZONA SUPERIOR EN CUALQUIER ALTO DE PANTALLA.

   Bug de Diego en su iPhone 17: la foto se cortaba arriba y quedaba espacio
   sin cubrir. La causa era el tope fijo del clamp — `clamp(460px, 72vh,
   620px)`: en una pantalla más alta 72vh supera los 620px, el clamp lo
   RECORTA a 620, y arriba de la foto queda una banda muerta. Un tope en px es
   una apuesta sobre el alto máximo de un teléfono, y el iPhone 17 la perdió.

   Se cambia por `dvh` sin tope. `dvh` (dynamic viewport height) es el alto
   REAL de la ventana descontando la barra de Safari cuando está, así que la
   portada sigue el viewport de verdad en cualquier aparato — 393px o el que
   venga — en vez de adivinar. El piso de 460px se queda como red para una
   ventana absurdamente corta (un teléfono de lado); el techo se va, porque un
   techo era justo el problema.

   Escritorio no cambia: ahí la portada NO debe comerse la pantalla (la obra
   es el sujeto, no la foto — la nota de reconciliación de abajo lo explica),
   así que conserva su clamp con tope. El bug era sólo de teléfono. */
const HERO_H = { wide: 'clamp(420px, 52vh, 560px)', phone: 'max(460px, 82dvh)' }
/* el sangrado de escritorio baja con el hero: 300px de disolución bajo un
   hero de 52vh se comería el arranque del museo, que es justo lo que Pato
   vino a destapar. */
const COVER_BLEED = { wide: 210, phone: 230 }

/* el grado de Pato: la foto detrás del vidrio, no gritando. El contraste sube
   apenas para que no se vuelva lodo al oscurecerla — perder brillo sin
   recuperar forma es lo que aplana una foto.

   ── REVISIÓN DE DIEGO (v12.1): "se ve plana/apagada, súbele — pero no tanto"
   La clave para subirla SIN romper nada es que los tres controles no cuestan
   lo mismo:

     · saturación y contraste compran RIQUEZA y casi no tocan la legibilidad
       del texto que va encima
     · el brillo es el ÚNICO que de verdad la amenaza

   Y hay algo que estaba haciendo doble trabajo: quien protege al texto no es
   este grado, es coverScrim() — que llega al 88–90% de velo justo debajo del
   bloque de identidad. O sea que el brillo al .62 estaba oscureciendo una
   foto que el scrim ya iba a tapar de todos modos. Puro apagón sin beneficio.

   Así que la saturación sube fuerte (.70 → 1.0, la foto vuelve a su color
   real), el contraste un punto más (1.06 → 1.13, recupera forma), y el brillo
   apenas se suelta (.62 → .74). Es un realce, no un filtro: nada pasa de 1.0
   salvo el contraste, así que ningún color se inventa saturación que la foto
   no traía. */
/* v12.2 — el grado se mudó a index.css (`--cover-grade`) porque tiene que
   cambiar por tema, y el tema vive allá.

   `filter` admite var() y resuelve — medido, no supuesto. La regla de "sólo
   literales" que documenta glass.js es de `backdrop-filter` (WebKit 289800),
   que es OTRA propiedad y que aquí no se toca: ningún backdrop-filter de la
   app pasó a variable. Si algún día alguien mueve uno, ése sí se rompe sólo
   en Safari y sin avisar. */
const COVER_GRADE = 'var(--cover-grade)'
// desktop: misma receta, un paso más abajo — una portada ancha tira mucha más
// luz total que la de un teléfono al mismo brillo por píxel (Ley 3).
const COVER_GRADE_WIDE = 'var(--cover-grade-wide)'

/* ── LA REJILLA VERTICAL (Pato) ──────────────────────────────────────────
   Cada franja traía su propio margen inventado (2px, 6px, 14px, 16px, 18px,
   20px…). Un solo compás en múltiplos de 4, aplicado desde el CONTENEDOR con
   `gap` y no repartiendo márgenes por hijo: así ninguna franja futura puede
   inventarse su propio espaciado sin que se note. */
const S = { xs: 4, sm: 8, md: 14, lg: 22, xl: 34 }

/* ── ELEVACIÓN, NO BORDES (Pato) ─────────────────────────────────────────
   Dark-first: la profundidad se construye apilando capas de luz apenas
   distintas sobre el void, no dibujando contornos. */
const ELEV_1 = 'rgba(var(--ink-rgb),.045)'   // superficie en reposo
const ELEV_2 = 'rgba(var(--ink-rgb),.085)'   // superficie que invita a tocar

/* CHIPS ANCLADOS A UNA REJILLA (Pato): la cura es fijar la ALTURA, no el
   padding — así toda pastilla mide igual aunque cambie el icono o el idioma. */
const CHIP_H = 38
const chipBase = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  height: `${CHIP_H}px`, padding: '0 18px', borderRadius: '100px',
  fontFamily: 'DM Sans', fontSize: '12px', fontWeight: 600, letterSpacing: '.02em',
  whiteSpace: 'nowrap', cursor: 'pointer',
  transition: 'background .2s, border-color .2s, color .2s, transform .2s',
}
// liquid-chrome / brushed-metal gradient — clipped to text on display words only
const CHROME = 'var(--chrome)' // deck formula — jewelry, one moment per screen (v8 D3)
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
// world vocabulary (marquee/skins/gallery/links/completeness) → @/lib/world,
// shared with WorldBuilder so the museum and the guided build never drift.

// --- film grain: a real texture layer, cheap + no asset ---

// --- scroll-reveal preset (framer-motion) ---
// full transform strings: GPU-composited (y/scale shorthands run on the main
// thread); reduced-motion collapses to opacity-only. House curve.
const useReveal = () => {
  const reduced = useReducedMotion()
  return {
    initial: { opacity: 0, transform: reduced ? 'none' : 'translateY(26px)' },
    whileInView: { opacity: 1, transform: 'translateY(0px)' },
    viewport: { once: true, margin: '-60px' },
    transition: { duration: 0.7, ease: EASE_HOUSE_ARR },
  }
}

const inp = { width: '100%', background: CARD, border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '13px 15px', color: BONE, fontFamily: 'DM Sans', fontSize: '14px', outline: 'none', transition: 'border-color .2s' }
const monoLabel = { fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.22em', color: BONE_LOW, textTransform: 'uppercase', display: 'block', marginBottom: '7px' }
const onF = (e) => e.currentTarget.style.borderColor = 'rgba(var(--ink-rgb),.34)'
const onB = (e) => e.currentTarget.style.borderColor = HAIR_HI

// star-chart marks, one per movement
const MARKS = { gallery: 'dot', moments: 'star', offer: 'square', sound: 'ring', screen: 'triangle', influences: 'diamond', work: 'cross', taste: 'plus', sets: 'ring' }

// SETS rows: the date as catalog mono — "AUG 28", never an invented time
const fmtSetDate = (iso) => { try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() } catch { return '' } }

// `event` is the normalized live-event object from useLiveEvent (name/edition/date/
// city); the wrapper passes it so the "going" badge shows the real upcoming event.
// `ticket` is the boolean "is this person going".
// `social` — { ready, followers, following, iFollow } from the wrapper (0017);
// `listings` — the world's OFFER. Social buttons render only when the layer is
// live in the DB (Ley 9: a door that can't open doesn't render).
// v6 (D4): `publicTastes` — the quiet layer's speakable rows (owner gets the
// whole set and this file filters is_public; null = still loading, never
// flash an invite over an unknown truth); `upcomingSets` — published rooms
// this person hosts; `friendship` — { state, onRequest, onAccept, onRemove }
// from the wrapper (0023), absent = the door doesn't render.
export default function ProfileMuseum({ profile, crafts = [], craftsReady = true, onCraftsSaved, tastes = null, onTastesSaved, isOwner = false, onSave, onUploadAvatar, onUploadCover, onUploadGallery, onCleanupImages, onCurate, onViewPublic, ticket, event, topBar, ownerExtras, posts = [], onDeletePost, listings = [], onDeleteListing, onSetListingStatus, social, selfView = false, onSelfCurate, onFollowToggle, onMessage, onDMSeller, publicTastes = null, upcomingSets = [], friendship = null }) {
  const wide = useWide()                               // >=1024px: the museum composes editorially
  const navigate = useNavigate()                       // SETS rows walk into their event rooms
  const reveal = useReveal()                           // scroll-reveal preset (reduced-motion aware)
  const reducedMotion = useReducedMotion()             // the cover holds still when motion is reduced
  // v8 (D2): this world claims the app's shared sky — its own deterministic
  // stars, tinted by the primary craft's temperature (Ley 14). Must run
  // before any early return (hooks law); falls back to instrument silver.
  const skyCraft = crafts.find((c) => c.isPrimary) || crafts[0]
  useCosmosOverride(
    profile?.id || profile?.username || 'a-world',
    skyCraft ? categoryMeta(skyCraft.category).tint : '199,201,209',
    'medium',
  )
  const [data, setData] = useState(profile)
  const [editing, setEditing] = useState(false)
  const [building, setBuilding] = useState(false)     // the guided build (sheet over the live museum)
  const [celebrating, setCelebrating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const [upErr, setUpErr] = useState(null)
  // v12 — lo que antes era texto muerto y ahora se abre:
  //   peopleSheet: 'followers' | 'following' | null
  //   craftsOpen:  la lista completa detrás del +N
  const [peopleSheet, setPeopleSheet] = useState(null)
  const [craftsOpen, setCraftsOpen] = useState(false)
  const fileRef = useRef(null)
  const coverRef = useRef(null)
  const galleryFileRef = useRef(null)

  // edit-form state
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  // crafts: the curated set replaces the free-text discipline (0020) — the
  // summary line is derived on save, never typed
  const [editCrafts, setEditCrafts] = useState([])
  const [editPrimary, setEditPrimary] = useState(null)
  const [city, setCity] = useState('')
  const [tagline, setTagline] = useState('')
  const [bio, setBio] = useState('')
  const [marquee, setMarquee] = useState('')
  const [theme, setTheme] = useState('chrome')
  const [music, setMusic] = useState('')
  const [films, setFilms] = useState('')
  const [influences, setInfluences] = useState('')
  const [rows, setRows] = useState([])
  const [linkRows, setLinkRows] = useState([])
  const [galRows, setGalRows] = useState([])
  // YOUR ROOMS (v6, 0024): every module key with its switch, in the owner's
  // order — ON rows persist as world_modules, the kind-default saves as null
  const [roomRows, setRoomRows] = useState([])
  // did the owner actually compose rooms THIS session? A seeded-but-untouched
  // editor must never freeze a stale order — nor wipe a real one (see save()).
  const [roomsTouched, setRoomsTouched] = useState(false)
  const [galUploading, setGalUploading] = useState(0)
  const [galErr, setGalErr] = useState(null)
  // storage bookkeeping: what THIS edit session uploaded (delete on cancel)
  // and which previously-saved objects were removed (delete after save).
  const sessionUploads = useRef(new Set())
  const removedSaved = useRef(new Set())

  // Entering edit takes a snapshot of `data` (see startEdit). Don't let a parent
  // re-fetch clobber an open form mid-edit — or mid-BUILD, where unsaved
  // keystrokes live in `data` as the live preview; re-sync only when idle.
  useEffect(() => { if (!editing && !building) setData(profile) }, [profile])

  // A newborn world greets its owner with the guided build, once. After that
  // it's always one tap away — never a forced tour.
  useEffect(() => {
    if (!isOwner || !data || editing || building) return
    const empty = !(data.discipline || '').trim() && !(data.tagline || '').trim() && normGallery(data.gallery).length === 0
    let seen = null
    try { seen = localStorage.getItem('world_build_seen_v1') } catch { /* private mode */ }
    if (empty && !seen) {
      try { localStorage.setItem('world_build_seen_v1', '1') } catch { /* private mode */ }
      setBuilding(true)
    }
  }, [isOwner, data?.id])

  const startEdit = () => {
    // the edit form SNAPSHOTS the saved crafts — entering before they've
    // loaded would snapshot [], and saving that would atomically WIPE the
    // member's real set (review catch, HIGH). The window is sub-second;
    // the click simply lands when the truth is in hand.
    if (!craftsReady) return
    const t = normTaste(data?.taste)
    setName(data?.full_name || '')
    setUsername(data?.username || '')
    setEditCrafts(crafts.map((c) => ({ id: c.id, name: c.name, slug: c.slug, category: c.category })))
    setEditPrimary((crafts.find((c) => c.isPrimary) || crafts[0])?.id || null)
    setCity(data?.city || '')
    setTagline(data?.tagline || '')
    setBio(data?.bio || '')
    // the field shows exactly what loops (default included); clearing it turns the ticker off
    setMarquee(marqueeOf(data?.marquee_text))
    setTheme(THEMES.some(x => x.key === data?.world_theme) ? data.world_theme : 'chrome')
    setMusic(fromList(t.music))
    setFilms(fromList(t.films))
    setInfluences(fromList(t.influences))
    setRows(normMedia(data?.media).map(m => ({ id: uid(), title: m.title || '', url: m.url || '' })))
    setLinkRows(normLinks(data?.world_links).map(l => ({ id: uid(), label: l.label || '', url: l.url || '' })))
    setGalRows(normGallery(data?.gallery).map(g => ({ id: uid(), path: g.path || null, url: g.url, caption: g.caption || '' })))
    // YOUR ROOMS seeds from what composes today: the saved order ON, every
    // other known room appended OFF at the end (nothing hides from the form)
    const roomsOn = normModules(data?.world_modules) || defaultModulesFor(kindOfCrafts(crafts) || craftKindOf(data?.discipline))
    setRoomRows([
      ...roomsOn.map((k) => ({ key: k, on: true })),
      ...Object.keys(MODULES).filter((k) => !roomsOn.includes(k)).map((k) => ({ key: k, on: false })),
    ])
    setRoomsTouched(false)
    sessionUploads.current = new Set()
    removedSaved.current = new Set()
    setGalErr(null)
    setEditing(true)
  }

  const addRow = () => setRows(r => [...r, { id: uid(), title: '', url: '' }])
  const setRow = (i, k, v) => setRows(r => r.map((row, j) => j === i ? { ...row, [k]: v } : row))
  const delRow = (i) => setRows(r => r.filter((_, j) => j !== i))

  const addLinkRow = () => setLinkRows(r => [...r, { id: uid(), label: '', url: '' }])
  const setLinkRow = (i, k, v) => setLinkRows(r => r.map((row, j) => j === i ? { ...row, [k]: v } : row))
  const delLinkRow = (i) => setLinkRows(r => r.filter((_, j) => j !== i))

  // gallery: upload NOW (the wall builds live), persist the ARRAY on save.
  const addGalleryFiles = async (e) => {
    const input = e.target
    const files = Array.from(input.files || [])
    input.value = ''
    if (!files.length || !onUploadGallery) return
    setGalErr(null)
    for (const f of files) {
      setGalUploading(n => n + 1)
      try {
        const { path, url } = await onUploadGallery(f)
        sessionUploads.current.add(path)
        setGalRows(r => [...r, { id: uid(), path, url, caption: '' }])
      } catch (err) {
        console.error('Gallery upload failed:', err)
        setGalErr(err?.message || "Couldn't upload — try again.")
      } finally {
        setGalUploading(n => n - 1)
      }
    }
  }
  const setGalCaption = (i, v) => setGalRows(r => r.map((row, j) => j === i ? { ...row, caption: v } : row))
  const moveGalRow = (i, dir) => setGalRows(r => {
    const j = i + dir
    if (j < 0 || j >= r.length) return r
    const c = [...r]; const [x] = c.splice(i, 1); c.splice(j, 0, x); return c
  })
  // side effects OUTSIDE the state updater — StrictMode double-invokes
  // updaters in dev, which would double-delete and corrupt the bookkeeping
  const delGalRow = (i) => {
    const row = galRows[i]
    if (row?.path) {
      // this session's upload → gone for good right now; a saved object waits
      // for the save to land (cancel must be able to bring it back).
      if (sessionUploads.current.has(row.path)) { sessionUploads.current.delete(row.path); onCleanupImages?.([row.path]) }
      else removedSaved.current.add(row.path)
    }
    setGalRows(r => r.filter((_, j) => j !== i))
  }

  // YOUR ROOMS: switch, reorder, and the ghost door back to the craft's order.
  // Every real edit marks the session TOUCHED (roomsTouched → save writes an
  // explicit composition; untouched stays on truth). Side effects live OUTSIDE
  // the state updater — StrictMode double-invokes updaters in dev.
  const toggleRoom = (k) => {
    const row = roomRows.find(r => r.key === k)
    // Ley 11 — a world needs at least one open room; block the last one OFF.
    // Turning a room ON is always allowed.
    if (row?.on && roomRows.filter(r => r.on).length <= 1) return
    setRoomsTouched(true)
    setRoomRows(rs => rs.map(r => r.key === k ? { ...r, on: !r.on } : r))
  }
  const moveRoom = (k, dir) => {
    setRoomsTouched(true)
    setRoomRows(rs => {
      const i = rs.findIndex(r => r.key === k)
      const j = i + dir
      if (i < 0 || j < 0 || j >= rs.length) return rs
      const c = [...rs]; const [x] = c.splice(i, 1); c.splice(j, 0, x); return c
    })
  }
  const resetRooms = () => {
    setRoomsTouched(true)
    const withLead = editCrafts.map((c) => ({ ...c, isPrimary: c.id === editPrimary }))
    setRoomRows(defaultModulesFor(kindOfCrafts(withLead) || craftKindOf(data?.discipline)).map((k) => ({ key: k, on: true })))
  }

  const cancelEdit = () => {
    // uploads that never got saved don't belong to anyone — clean them up
    if (sessionUploads.current.size) onCleanupImages?.([...sessionUploads.current])
    sessionUploads.current = new Set()
    removedSaved.current = new Set()
    setEditing(false)
    setSaveErr(null)
    setGalErr(null)
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    setSaveErr(null)
    const craftsWithLead = editCrafts.map((c) => ({ ...c, isPrimary: c.id === editPrimary }))
    const patch = {
      full_name: name.trim() || null,
      username: username.trim().replace(/^@/, '') || null,
      // derived from the chosen crafts — legacy surfaces keep reading truth.
      // Removing EVERY craft removes the derived line too (a stale summary
      // would survive as zombie truth — review catch); only a NEVER-migrated
      // legacy line is preserved untouched.
      discipline: editCrafts.length ? craftLine(craftsWithLead) : (crafts.length ? null : (data?.discipline || null)),
      city: city.trim() || null,
      tagline: tagline.trim() || null,
      bio: bio.trim() || null,
      // '' is a real value: the owner turned the ticker off
      marquee_text: marquee.trim(),
      // stored explicitly (chrome included) — a chosen skin counts as chosen
      world_theme: theme,
      taste: { music: toList(music), films: toList(films), influences: toList(influences) },
      media: rows.map(r => ({ url: (r.url || '').trim(), title: (r.title || '').trim() }))
        .filter(r => safeUrl(r.url))
        .map(r => ({ type: detectType(r.url), url: r.url, title: r.title })),
      world_links: linkRows.map(r => ({ label: (r.label || '').trim(), url: (r.url || '').trim() }))
        .filter(r => safeUrl(r.url)),
      gallery: galRows.map(r => ({ path: r.path || null, url: r.url, caption: (r.caption || '').trim() })),
    }
    // YOUR ROOMS → world_modules (0024): the ON keys in the owner's order.
    const enabledRooms = roomRows.filter(r => r.on).map(r => r.key)
    if (!roomsTouched) {
      // the owner never composed rooms this session — preserve the stored
      // truth (null = defaults, or a real prior composition). NOT the seeded
      // order: it was built from the OLD craft's default and would freeze a
      // stale array when the craft was edited this session (review catch).
      patch.world_modules = normModules(data?.world_modules)
    } else {
      // Ley 11 — a world needs >=1 open room; the editor blocks the last-off,
      // so this is a defensive stop, never the silent revert-to-full-default.
      if (enabledRooms.length === 0) {
        setSaveErr('a world needs at least one open room')
        setSaving(false)
        return
      }
      // a composition that equals the edited craft's kind-default exactly saves
      // NULL — the world stays on defaults, so future default improvements reach it.
      const roomsDefault = defaultModulesFor(kindOfCrafts(craftsWithLead) || craftKindOf(patch.discipline))
      patch.world_modules = (enabledRooms.length === roomsDefault.length && enabledRooms.every((k, i) => k === roomsDefault[i]))
        ? null
        : enabledRooms
    }
    try {
      // crafts commit first (atomic, 0020) — if they refuse, nothing else moves
      if (editCrafts.length || crafts.length) {
        await saveProfileCrafts(editCrafts.map((c) => c.id), editPrimary)
        onCraftsSaved?.(craftsWithLead)
      }
      if (onSave) await onSave(patch)
      // the save landed — removed saved objects are truly unreferenced now
      if (removedSaved.current.size) onCleanupImages?.([...removedSaved.current])
      sessionUploads.current = new Set()
      removedSaved.current = new Set()
      setData(d => ({ ...d, ...patch }))
      setEditing(false)
    } catch (err) {
      console.error('Save failed:', err)
      // surface the REAL reason — a schema/RLS rejection must never wear a
      // "check your connection" costume (honest surfaces, always)
      setSaveErr(err?.message ? `Couldn't save — ${err.message}` : "Couldn't save — check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  const uploadPhoto = async (e) => {
    const input = e.target
    const file = input.files?.[0]
    if (!file || !onUploadAvatar) return
    setUploading(true)
    setUpErr(null)
    try {
      const url = await onUploadAvatar(file)
      if (url) setData(d => ({ ...d, avatar_url: url }))
    } catch (err) {
      console.error('Avatar upload failed:', err)
      setUpErr(err?.message ? `Photo upload failed — ${err.message}` : 'Photo upload failed — try again.')
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
    setUpErr(null)
    try {
      const url = await onUploadCover(file)
      if (url) setData(d => ({ ...d, cover_url: url }))
    } catch (err) {
      console.error('Cover upload failed:', err)
      setUpErr(err?.message ? `Cover upload failed — ${err.message}` : 'Cover upload failed — try again.')
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
  const gallery = normGallery(data.gallery)
  const links = normLinks(data.world_links)
  const worldTheme = THEMES.some(x => x.key === data.world_theme) ? data.world_theme : 'chrome'
  const displaySkin = nameSkin(worldTheme)
  /* EL MARQUEE SÓLO EXISTE SI ALGUIEN LO ESCRIBIÓ. `marqueeOf` devuelve el
     texto POR DEFECTO cuando el campo viene vacío, así que 260 de 299 perfiles
     mostraban exactamente la misma frase de bienvenida. Una frase que se
     repite idéntica en todos los mundos no es una bienvenida: es relleno, y
     delata que nadie la escribió.
     El helper se queda vivo — lo usa el EDITOR para proponer el default
     cuando abres a escribir. Lo que cambia es sólo qué se PINTA: tu texto o
     nada. El vacío aquí es void Cosmos, que es justo lo que queremos. */
  /* v12.4 — `marqueeText` se quitó junto con el marquee del render (Diego lo
     eliminó del perfil). El dato sigue en la fila (data.marquee_text) y en el
     builder; sólo no se lee aquí. Si vuelve, se recompone en una línea. */
  const completeness = worldCompleteness(data)
  const displayName = data.full_name || 'Unnamed'
  const initial = displayName[0].toUpperCase()
  const avatar = safeImg(data.avatar_url)
  const cover = safeImg(data.cover_url)
  // cuánto sangra la portada por debajo del hero = cuánta distancia tiene la
  // disolución para correr. Las dos rampas (máscara y scrim) se anclan a él.
  const bleed = wide ? COVER_BLEED.wide : COVER_BLEED.phone

  /* Un craft es una puerta al RESTO de la gente que lo comparte. Vive aquí y
     no como prop porque siempre significa exactamente lo mismo — pasarlo
     desde fuera sólo abriría la puerta a que dos pantallas lo interpretaran
     distinto. Community ya lee ?craft= del URL (0020/D2): esto se cuelga de
     la columna de descubrimiento que ya existe, no inventa una paralela. */
  const openCraft = (slug) => {
    setCraftsOpen(false)
    navigate(`/community?craft=${encodeURIComponent(slug)}`)
  }

  // the world's COMPOSITION (v6, 0024): the owner's saved order, or the
  // kind-default — the craft decides what leads. A module missing from the
  // order renders NOTHING, owner included: off is off (honest walls).
  const moduleOrder = normModules(data.world_modules) || defaultModulesFor(kindOfCrafts(crafts) || craftKindOf(data.discipline))
  // the quiet layer's speakable face: render ONLY public rows (the owner's
  // read carries the whole set); the private ones are counted, never named
  const tasteRows = Array.isArray(publicTastes) ? publicTastes : []
  const publicTasteItems = tasteRows.filter((t) => t && t.is_public)
  const quietCount = tasteRows.length - publicTasteItems.length

  // which movements to show — owner sees invitations for the empty ones.
  // OFFER: public sees it only when live pieces hang; the owner sees the
  // invitation only once the layer is live in the DB (honest pre-0017).
  const liveListings = listings.filter((l) => l.status === 'live')

  /* ════ UN CUARTO SE MUESTRA SI TIENE ALGO DENTRO. PUNTO. ════

     Antes cada llave llevaba `|| isOwner`, y eso tenía una consecuencia que
     sólo se ve al abrir un perfil recién hecho: el dueño aterrizaba en OCHO
     tarjetas de invitación seguidas, una por cuarto vacío, ~1,200px de "aún
     no subes nada". Le pasaba a TODO el que llegaba, en el peor momento
     posible — el primer segundo de su propio mundo. Ocho invitaciones no
     invitan; abruman, y leen como formulario a medio llenar.

     Ahora el gate es sólo contenido, para dueño y para público por igual, y
     los cuartos vacíos se juntan MÁS ABAJO en UNA sola invitación compuesta
     (ver `emptyRooms`). El público no nota diferencia: nunca vio invitaciones.
     El dueño pasa de ocho paredes vacías a una puerta. */
  const show = {
    gallery: gallery.length > 0,
    moments: posts.length > 0,
    offer: liveListings.length > 0,
    sound: taste.music.length > 0,
    screen: taste.films.length > 0,
    influences: taste.influences.length > 0,
    work: media.length > 0,
    taste: publicTasteItems.length > 0,
    // SETS: hosting isn't universal — absence is honest silence, no invite
    sets: upcomingSets.length > 0,
  }

  /* Los cuartos que el dueño todavía no llena, en el orden que él mismo
     compuso. Dos leyes viejas se respetan aquí en vez de perderse con las
     tarjetas que las cargaban:
     · SETS nunca invita — no todo el mundo organiza, y su ausencia es
       silencio honesto, no una tarea pendiente.
     · OFFER y TASTE sólo invitan cuando su capa está VIVA y CARGADA. Invitar
       a un cuarto que todavía no existe en la base es una puerta muerta
       (Ley 9), y `publicTastes` en null es una verdad desconocida, no un
       cuarto vacío. */
  const roomReady = {
    offer: listings.length > 0 || !!social?.ready,
    taste: Array.isArray(publicTastes),
  }
  const emptyRooms = isOwner
    ? moduleOrder.filter((k) => k !== 'sets' && !show[k] && (roomReady[k] ?? true))
    : []
  // editorial catalog numbering, only across the movements actually rendered
  let counter = 0
  const num = {}
  moduleOrder.forEach(k => { if (show[k]) num[k] = String(++counter).padStart(2, '0') })
  // v6: public tastes and upcoming sets are walls too — a world showing a
  // real movement must never also claim "nothing on the walls yet"
  const worldIsEmpty = !data.bio && !taste.music.length && !taste.films.length && !taste.influences.length && !media.length && !gallery.length && !links.length && !posts.length && !listings.length && !publicTasteItems.length && !upcomingSets.length

  /* the movements as a keyed vocabulary (v6) — the blocks themselves are
     the SAME rooms as always; moduleOrder decides who renders and in what
     order. `mt` is the sequencing wrapper's only variable: the first
     rendered movement composes against the opening. */
  const MOVEMENTS = {
    /* MOVEMENT — GALLERY (the person's own work leads the museum) */
    gallery: (mt) => (
      <motion.div key="gallery" {...reveal} style={{ marginTop: mt }}>
        <Marker mark={MARKS.gallery} n={num.gallery} label="GALLERY" kicker="the work, on walls" wide={wide} />
        {gallery.length > 0
          ? <GalleryGrid items={gallery} wide={wide} />
          : <Invite icon={ImagePlus}>This space is for your work — three pieces turn it on. Shots, canvases, fits, stills, hung in your order.</Invite>}
      </motion.div>
    ),

    /* MOVEMENT — MOMENTS (the gallery extended into a dated timeline;
        posts arrive through CREATE central — Ley 13) */
    moments: (mt) => (
      <motion.div key="moments" {...reveal} style={{ marginTop: mt }}>
        <Marker mark={MARKS.moments} n={num.moments} label="MOMENTS" kicker="posted, with a date" wide={wide} />
        {posts.length > 0
          ? <WorldMoments posts={posts} isOwner={isOwner} onDelete={onDeletePost} wide={wide} />
          : <Invite icon={Plus}>Moments live here — images and a line, dated the day you post them. Tap the + in the nav and put one into the world.</Invite>}
      </motion.div>
    ),

    /* MOVEMENT — THE OFFER (listings, 0017 — Estrella Polar: the
        museum that also WORKS. Pieces + services with a real price;
        buying is a DM until the payment layer lands — Ley 11) */
    offer: (mt) => (
      <motion.div key="offer" {...reveal} style={{ marginTop: mt }}>
        <Marker mark={MARKS.offer} n={num.offer} label="THE OFFER" kicker="the wall, working · for sale" wide={wide} />
        {(isOwner ? listings.length : liveListings.length) > 0
          ? <WorldOffer listings={listings} isOwner={isOwner} onDMSeller={onDMSeller} onSetStatus={onSetListingStatus} onDelete={onDeleteListing} wide={wide} />
          : <Invite icon={TagIcon}>Your work, with a price on the wall — a piece to sell or a service to book. Tap the + in the nav and put one up.</Invite>}
      </motion.div>
    ),

    /* MOVEMENT — SOUND */
    sound: (mt) => (
      <motion.div key="sound" {...reveal} style={{ marginTop: mt }}>
        <Marker mark={MARKS.sound} n={num.sound} label="SOUND" kicker="on rotation" wide={wide} />
        {taste.music.length > 0
          ? <SoundMovement items={taste.music} wide={wide} />
          : <Invite icon={Music2}>The sound that runs through you. Paste a Spotify, YouTube or SoundCloud link and it plays right here — or just name the artists on rotation.</Invite>}
      </motion.div>
    ),

    /* MOVEMENT — SCREEN */
    screen: (mt) => (
      <motion.div key="screen" {...reveal} style={{ marginTop: mt }}>
        <Marker mark={MARKS.screen} n={num.screen} label="SCREEN" kicker="what i watch" wide={wide} />
        {taste.films.length > 0
          ? <PosterRail items={taste.films} wide={wide} />
          : <Invite icon={Film}>The films that shaped your eye. Titles become posters; a trailer link becomes a still you can open.</Invite>}
      </motion.div>
    ),

    /* MOVEMENT — INFLUENCES */
    influences: (mt) => (
      <motion.div key="influences" {...reveal} style={{ marginTop: mt }}>
        <Marker mark={MARKS.influences} n={num.influences} label="INFLUENCES" kicker="what shaped me" wide={wide} />
        {taste.influences.length > 0
          ? <WordWall items={taste.influences} wide={wide} />
          : <Invite icon={Sparkles}>The names, places and ideas behind your work. Written large — a wall of what made you.</Invite>}
      </motion.div>
    ),

    /* MOVEMENT — WORK */
    work: (mt) => (
      <motion.div key="work" {...reveal} style={{ marginTop: mt }}>
        <Marker mark={MARKS.work} n={num.work} label="WORK" kicker="what i make" wide={wide} />
        {media.length > 0 ? (
          wide ? (
            /* the first piece leads full-width; the rest hang two-across */
            <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '26px' }}>
              <MediaCard item={media[0]} full featured />
              {media.length > 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '26px', alignItems: 'start' }}>
                  {media.slice(1).map((m, i) => <MediaCard key={`${m.url}:${i + 1}`} item={m} full />)}
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {media.map((m, i) => <MediaCard key={`${m.url}:${i}`} item={m} full featured={i === 0} />)}
            </div>
          )
        ) : <Invite icon={ArrowUpRight}>Show what you make. Drop links to your sets, films, photos, drops — they embed and play, right here.</Invite>}
      </motion.div>
    ),

    /* MOVEMENT — TASTE (v6, 0022): the quiet layer's public face — only
        what stepped into the light hangs; the rest works in silence and
        is COUNTED for the owner, never named */
    taste: (mt) => (
      <motion.div key="taste" data-testid="movement-taste" {...reveal} style={{ marginTop: mt }}>
        <Marker mark={MARKS.taste} n={num.taste} label="TASTE" kicker="made public — the rest works in silence" wide={wide} />
        {publicTasteItems.length > 0 ? (
          <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: wide ? '780px' : undefined }}>
            {TASTE_DOMAINS.map((d) => {
              const items = publicTasteItems.filter((t) => t.domain === d.key)
              if (!items.length) return null
              return (
                <div key={d.key}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px' }}>
                    <Mark type={d.mark} size={9} color={SILVER} style={{ opacity: .8, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.24em', color: BONE_MID, textTransform: 'uppercase' }}>{d.label}</span>
                    <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg,${HAIR_HI},transparent)` }} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {items.map((t) => (
                      <span key={t.id || `${t.domain}:${t.label}`} style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', color: BONE_MID, border: `1px solid ${HAIR_HI}`, borderRadius: '4px', padding: '6px 11px' }}>{t.label}</span>
                    ))}
                  </div>
                </div>
              )
            })}
            {isOwner && quietCount > 0 && (
              <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.12em' }}>· {quietCount} quiet</div>
            )}
          </div>
        ) : (
          /* owner only (the public never reaches this branch) — the same
              door the listening band opens: the builder, on the brainstorm */
          <button className="pressable" onClick={() => setBuilding(true)}
            style={{ display: 'block', width: '100%', maxWidth: '480px', background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}>
            <Invite icon={Sparkles}>
              {quietCount > 0
                ? `The quiet layer holds ${quietCount} ${quietCount === 1 ? 'taste' : 'tastes'} — step one into the light.`
                : 'Brainstorm your taste — music, film, what keeps you alive. Quiet by default; only what you make public hangs here.'}
            </Invite>
          </button>
        )}
      </motion.div>
    ),

    /* MOVEMENT — SETS (v6): upcoming rooms this person hosts — real
        published events only; absence is honest silence, never an invite */
    sets: (mt) => (
      <motion.div key="sets" data-testid="movement-sets" {...reveal} style={{ marginTop: mt }}>
        <Marker mark={MARKS.sets} n={num.sets} label="SETS" kicker="where it plays next" wide={wide} />
        <div style={{ marginTop: '4px', maxWidth: wide ? '780px' : undefined }}>
          {upcomingSets.map((ev) => (
            <button key={ev.id} className="row-lead" onClick={() => ev.slug && navigate(`/e/${ev.slug}`)}
              style={{ display: 'flex', alignItems: 'baseline', gap: '16px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: `1px solid ${HAIR}`, padding: '15px 6px', cursor: 'pointer' }}
              onMouseOver={e => { e.currentTarget.style.borderColor = HAIR_HI }}
              onMouseOut={e => { e.currentTarget.style.borderColor = HAIR }}>
              <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: SILVER, letterSpacing: '.1em', whiteSpace: 'nowrap', flexShrink: 0, minWidth: '52px' }}>{fmtSetDate(ev.event_date)}</span>
              <span style={{ flex: 1, minWidth: 0, fontFamily: 'Bebas Neue', fontSize: '23px', letterSpacing: '.03em', color: BONE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</span>
              {(ev.venue || ev.city) && (
                <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.08em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '38%', flexShrink: 0 }}>{[ev.venue, ev.city].filter(Boolean).join(' · ')}</span>
              )}
              <ArrowUpRight size={13} style={{ color: SILVER, flexShrink: 0, alignSelf: 'center' }} />
            </button>
          ))}
        </div>
      </motion.div>
    ),
  }

  // the museum's editorial frame on wide screens — one container, all sections
  const frame = wide
    ? { maxWidth: '1440px', margin: '0 auto', paddingLeft: 'clamp(40px, 5vw, 76px)', paddingRight: 'clamp(40px, 5vw, 76px)' }
    : { paddingLeft: '24px', paddingRight: '24px' }

  return (
    <div style={{ position: 'relative', zIndex: 1, background: 'transparent', minHeight: '100vh', overflowX: 'hidden' }}>
      {/* the sky behind this world is the app's shared atmosphere (v8 D1) —
          claimed above with this person's seed + craft temperature */}

      {/* v12.4 — EL MARQUEE SE ELIMINÓ (pedido de Diego, segunda pasada).
          En v12.3 lo MOVÍ de encima de la portada al cuerpo; Diego lo vio ahí
          y decidió que sobra en cualquier lado. Se va del render por completo.

          NO se toca el dato: `marquee_text` sigue en la fila y en el builder,
          por si algún día vuelve a tener un lugar — borrar la columna sería
          destruir texto que la persona escribió para resolver un pedido de
          layout, y esas dos cosas no se cruzan. Simplemente nada del perfil lo
          pinta. Si Diego lo quiere de vuelta, es un componente y una línea. */}

      {/* ============ HERO — cover as a magazine cover, in the void ============ */}
      {/* RECONCILIACIÓN — cada quien tenía razón EN SU PANTALLA.

          Diego marcó capturas de TELÉFONO: ahí la portada se quedaba corta y
          la disolución moría antes de tiempo → su alto de teléfono gana
          (62vh→72vh, tope 500→620).

          Pato observó ESCRITORIO: a 66vh + 180px de sangrado, abrir un mundo
          en laptop mostraba una fotografía y nada más — había que hacer
          scroll para enterarte de que la persona HACE algo. En teléfono la
          misma proporción deja asomar las primeras obras, que es por qué se
          leía bien ahí y mal aquí → su alto de escritorio gana (52vh).

          No es un punto medio: es que hablaban de dos pantallas distintas.
          La foto es atmósfera; la obra es el sujeto (Ley del Lujo Inmersivo). */}
      <div style={{ position: 'relative', height: wide ? HERO_H.wide : HERO_H.phone, background: 'transparent' }}>
        {/* THE ART LAYER (v11). It used to be flush with the hero and buried
            under a scrim that went fully opaque at the bottom — a hard cut
            painted over the photo. Now it BLEEDS past the hero and DISSOLVES:
            a mask carries the image to real transparency, so what shows
            through underneath is the app's own atmosphere, not a black slab.

            Three things this layer has to keep doing:
            · overflow:hidden stays HERE (not on the hero) — the 2s
              scale(1.12)→scale(1) intro needs something to clip against,
              and the no-cover monogram is 176-300px tall.
            · zIndex 0 keeps it behind the identity block (3) and behind every
              section below (all transparent at 3), so the dissolve passes
              BEHIND the tagline instead of colliding with it.
            · pointerEvents none — it now overlaps content that must stay
              clickable. */}
        <div aria-hidden="true" style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          bottom: cover ? `-${bleed}px` : 0,
          overflow: 'hidden', zIndex: 0, pointerEvents: 'none',
          ...(cover ? { maskImage: coverFade(bleed), WebkitMaskImage: coverFade(bleed) } : null),
        }}>
          {cover
            /* v12: a touch further down on wide. The grade is a per-pixel
               value but the eye reads TOTAL light, and a 1440px-wide cover
               throws ~4x the photons of a phone's at identical brightness.
               Same intent as the mobile grade, corrected for area. */
            ? <motion.img src={cover} alt="" initial={{ transform: reducedMotion ? 'scale(1)' : 'scale(1.12)' }} animate={{ transform: 'scale(1)' }} transition={{ duration: 2, ease: 'easeOut' }} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: wide ? COVER_GRADE_WIDE : COVER_GRADE }} />
            : (
              /* no cover → the open sky (the page's constellation) + monogram
                 (monogram in BONE — the name owns the screen's one chrome, Ley 8) */
              <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 88% at 50% 4%, rgba(var(--silver-rgb),.06) 0%, transparent 55%)` }}>
                <StarField seed={seed} wide={wide} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {/* LA INICIAL, CON JERARQUÍA DE LUJO. Estaba a 300/480px:
                      a ese tamaño deja de ser una marca de agua y se vuelve
                      una valla publicitaria detrás de la cara. Bajarla no le
                      quita presencia — se la da, porque ahora acompaña al
                      nombre en vez de competir con él. El vacío alrededor es
                      el lujo; la letra sólo lo firma. */}
                  <span style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '300px' : '176px', lineHeight: 1, transform: 'translateY(-6%)', userSelect: 'none', opacity: 0.05, color: BONE }}>{initial}</span>
                </div>
              </div>
            )}
        </div>

        {/* scrim — GUARANTEED identity legibility over any art (Ley 3): the
            band peaks exactly where the name sits and then releases to fully
            transparent. It bleeds with the art so the two ramps stay in
            register; ending it opaque is what used to draw the seam. */}
        <div aria-hidden="true" style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          bottom: cover ? `-${bleed}px` : 0,
          zIndex: 1, pointerEvents: 'none',
          background: cover ? coverScrim(bleed) : 'linear-gradient(180deg, rgba(var(--void-rgb),.10) 0%, rgba(var(--void-rgb),0) 26%, rgba(var(--void-rgb),.30) 48%, rgba(var(--void-rgb),.72) 72%, rgba(var(--void-rgb),.95) 92%, var(--bg-deep-2) 100%)',
        }} />

        {/* top bar (back / sign-out) floats over the cover */}
        {topBar && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 5 }}>{topBar}</div>}

        {/* owner cover controls — BELOW the topBar row (Sign Out lives at the
            same top-right corner; stacking them collided the two controls) */}
        {isOwner && (
          <div style={{ position: 'absolute', top: topBar ? '56px' : '16px', right: '18px', display: 'flex', gap: '8px', zIndex: 5 }}>
            {cover && <button onClick={removeCover} style={pill}>Remove</button>}
            <button onClick={() => coverRef.current?.click()} style={{ ...pill, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {coverUploading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={11} />} {cover ? 'Change' : 'Cover'}
            </button>
            <input ref={coverRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadCover} />
          </div>
        )}

        {/* IDENTITY BLOCK — who this is and what they make, as ONE composed
            unit above the fold (Ley 2: the 3-second answer; Ley 3: identity
            never competes — editorial scale over a scrim, not a 140px war
            with the art).

            LA ENTRADA CINÉTICA, Y LA LEY QUE NO SE ROMPIÓ PARA TENERLA.
            Antes decía "NO entrance animation, by decision: identity must
            never depend on an animation firing". La ley sigue viva; lo que
            cambió es que ya no hace falta elegir. `.identity-in` anima DESDE
            un estado desplazado HACIA el natural, sin `forwards` y sin
            opacity:0 en el estado base — así que si la animación no corre
            (pestaña oculta, motor lento, movimiento reducido) el bloque ya
            está exactamente donde debe estar. La identidad no depende de
            nada; la animación sólo la afina.
            Sube de 18 a 26px del borde: el aire bajo el nombre es lo que lo
            hace leer editorial en vez de pegado al canto. */}
        <div className="identity-in" style={{ position: 'absolute', left: 0, right: 0, bottom: wide ? `${S.xl}px` : '26px', zIndex: 3 }}>
          <div style={{ ...frame, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: wide ? '56px' : '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: wide ? '20px' : '13px', minWidth: 0 }}>
              {/* the face — part of the identity block, not a footnote below */}
              <div style={{ position: 'relative', width: wide ? '74px' : '52px', height: wide ? '74px' : '52px', flexShrink: 0, marginBottom: '6px', cursor: isOwner ? 'pointer' : 'default' }} onClick={() => isOwner && fileRef.current?.click()}>
                {avatar
                  /* EL ANILLO ERA UN CONTORNO DURO: 1px de plata sólida a 2px de
                     distancia, que sobre el void lee como sticker recortado.
                     Ahora es un aro de luz —hueso al 28% pegado al canto, más
                     un halo suave— o sea el mismo lenguaje especular del vidrio
                     de la barra. Elevación, no borde. */
                  ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 0 1px rgba(var(--ink-rgb),.28), 0 6px 22px rgba(var(--shadow-rgb),.55)' }} />
                  : <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: CARD_HI, boxShadow: '0 0 0 1px rgba(var(--ink-rgb),.28), 0 6px 22px rgba(var(--shadow-rgb),.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bebas Neue', fontSize: wide ? '32px' : '24px', color: BONE }}>{initial}</div>}
                {isOwner && (
                  <>
                    <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '22px', height: '22px', borderRadius: '50%', background: CARD, border: `1px solid ${HAIR_HI}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Camera size={10} style={{ color: BONE_MID }} />
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadPhoto} />
                    {uploading && <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(var(--void-rgb),.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={16} style={{ color: BONE_MID, animation: 'spin 1s linear infinite' }} /></div>}
                  </>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                {/* the craft line — real crafts from the taxonomy when they
                    exist (primary leads, lit by its category's temperature);
                    the legacy free-text line only when they don't (Ley 3:
                    identity always legible, never invented) */}
                {crafts.length > 0 ? (
                  /* el oficio ACOMPAÑA al nombre, no compite: una zona, un
                     protagonista. .82 de opacidad lo manda al susurro sin
                     tocarle el color de categoría, que sí es información. */
                  <div data-testid="hero-crafts" style={{ display: 'flex', alignItems: 'baseline', gap: '9px', flexWrap: 'wrap', marginBottom: wide ? '9px' : '7px', textShadow: '0 1px 8px rgba(var(--shadow-rgb),.5)', opacity: .82 }}>
                    {/* primary ALWAYS leads — regardless of the order the
                        set arrived in (fresh save vs DB read) */}
                    {/* v12: cada craft es una PUERTA — lleva a Community
                        filtrado por él, o sea a las otras personas que lo
                        comparten. Antes eran etiquetas muertas. */}
                    {[...crafts].sort((a, b) => (b.isPrimary === true) - (a.isPrimary === true)).slice(0, 3).map((c, i) => {
                      const meta = categoryMeta(c.category)
                      const isP = c.isPrimary || (i === 0 && !crafts.some(x => x.isPrimary))
                      return (
                        <span key={c.slug} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '9px' }}>
                          {i > 0 && <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '7px', color: BONE_LOW }}>◆</span>}
                          <button className="pressable" data-testid={`hero-craft-${c.slug}`}
                            onClick={() => openCraft(c.slug)}
                            aria-label={`See other ${c.name}s`}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                              fontFamily: 'DM Mono', fontSize: wide ? '10px' : '9px', letterSpacing: '.3em', textTransform: 'uppercase',
                              color: isP ? `rgb(${tintChannel(meta.tint)})` : BONE_MID }}>
                            {c.name}
                          </button>
                        </span>
                      )
                    })}
                    {/* el +N deja de ser un dato que no se puede abrir: la app
                        te decía que había más y no te dejaba verlo */}
                    {crafts.length > 3 && (
                      <MoreChip n={crafts.length - 3} onClick={() => setCraftsOpen(true)}
                        label={`See all ${crafts.length} crafts`} />
                    )}
                  </div>
                ) : data.discipline && (
                  <div style={{ fontFamily: 'DM Mono', fontSize: wide ? '10px' : '9px', color: SILVER, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: wide ? '9px' : '7px', textShadow: '0 1px 8px rgba(var(--shadow-rgb),.5)', opacity: .82 }}>
                    {data.discipline}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: wide ? '14px' : '10px', flexWrap: 'wrap' }}>
                  {/* EL NOMBRE MANDA — pero por jerarquía, no por tamaño.
                      Bajó de 52→46px (móvil) y ganó tracking: a la escala
                      anterior competía con la portada a gritos; a ésta la
                      gana en silencio, porque ya nada más en la zona pesa lo
                      mismo. La sombra también bajó (24px/.6 → 16px/.45): con
                      la foto ya atenuada, una sombra pesada deja de ser
                      legibilidad y se vuelve halo — y el halo es lo que se
                      lee como barato. */}
                  <h1 style={{ fontFamily: 'Bebas Neue', fontSize: wide ? 'clamp(48px, 5.2vw, 76px)' : 'clamp(34px, 9.5vw, 46px)', letterSpacing: '.02em', lineHeight: 0.9, margin: 0, textShadow: '0 2px 16px rgba(var(--shadow-rgb),.45)', ...displaySkin }}>{displayName}</h1>
                  {data.verified && <span title="In The Collectiv4 network" aria-label="Verified — in The Collectiv4 network" style={{ display: 'inline-flex', alignItems: 'center', marginBottom: wide ? '10px' : '5px' }}><VerifiedMark size={wide ? 24 : 19} /></span>}
                  {/* guardrail 4: the museum itself — the destination of every
                      labeled card tap — carries the truth on its own hero */}
                  <span style={{ display: 'inline-flex', marginBottom: wide ? '12px' : '7px' }}><SeedPill is_demo={data.is_demo} size={8.5} /></span>
                </div>
                {(data.username || data.city || ticket) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '11px', flexWrap: 'wrap', rowGap: '4px', marginTop: wide ? '10px' : '8px', textShadow: '0 1px 8px rgba(var(--shadow-rgb),.5)' }}>
                    {data.username && <span style={{ fontFamily: 'DM Mono', fontSize: '11px', color: BONE_MID, letterSpacing: '.04em' }}>@{data.username}</span>}
                    {/* City renders only when the user claimed one — no invented hometown. */}
                    {data.city && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={10} style={{ color: BONE_LOW }} />
                      <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: BONE_LOW, letterSpacing: '.04em' }}>{data.city}</span>
                    </span>}
                    {ticket && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'DM Mono', fontSize: '9px', color: BONE, border: `1px solid ${HAIR_HI}`, background: 'rgba(var(--void-rgb),.45)', borderRadius: '100px', padding: '3px 10px', letterSpacing: '.1em' }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: STAR, boxShadow: `0 0 8px rgba(var(--star-rgb),.7)` }} />
                        GOING{event?.editionNumber ? ` · ${event.editionNumber}` : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* the quote, composed INTO the hero on wide — not floating below */}
            {wide && data.tagline && (
              /* v12 desktop: space-between at 1440 threw 612px of dead air
                 between the name and the quote — a pull-quote pinned to the
                 window edge with nothing to relate to. Pulled in off the edge
                 and widened, so it reads as the right-hand column of a spread
                 rather than an island. It is still an editorial judgment call
                 (see the handback) — the alternative is moving it under the
                 identity block entirely, which is Pato's taste to settle. */
              <p style={{ fontFamily: 'DM Sans', fontStyle: 'italic', fontSize: '18px', color: BONE, lineHeight: 1.5, margin: '0 0 8px', maxWidth: '420px', marginRight: 'clamp(0px, 7vw, 150px)', flexShrink: 0, borderLeft: `1px solid ${HAIR_HI}`, paddingLeft: '20px', textShadow: '0 1px 12px rgba(var(--shadow-rgb),.7)' }}>
                <span style={{ color: SILVER, fontStyle: 'normal', marginRight: '2px' }}>“</span>{data.tagline}<span style={{ color: SILVER, fontStyle: 'normal', marginLeft: '2px' }}>”</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ============ BYLINE — the doors + the owner's tools ============
          Identity (face, name, craft, handle) lives in the hero block now;
          this strip carries the quote (mobile), the links, and the meter —
          composed, not abandoned (Ley 4). */}
      <div style={{ position: 'relative', ...frame, paddingTop: `${wide ? S.lg : S.md}px`, zIndex: 3 }}>
        {/* EL RITMO VIVE AQUÍ, NO EN LOS HIJOS. Este div era un envoltorio sin
            estilos y cada franja de abajo cargaba su propio marginTop — de ahí
            los siete valores distintos. Ahora el espaciado es del CONTENEDOR,
            así que cualquier franja que se agregue después entra en compás
            sola, sin que nadie tenga que acordarse de la regla.

            POR QUÉ `.byline-rhythm` (un `> * + *`) Y NO UN FLEX COLUMN CON GAP:
            probé el flex primero y rompe la franja del dueño. Aquí adentro
            conviven DOS tipos de hijo — bandas que deben ocupar todo el ancho
            (el medidor, la migración de crafts) y pastillas que deben encogerse
            a su contenido. En flex column hay que elegir: `flex-start` encoge
            las bandas hasta colapsarlas, `stretch` estira las pastillas hasta
            volverlas barras. Ninguno de los dos es lo que había.
            El bloque normal ya hace lo correcto con ambos, así que se queda
            bloque y sólo se le monta el ritmo encima. Un margen entre hermanos,
            cero cambios de formato. */}
        <div className="byline-rhythm" style={{ '--byline-gap': `${wide ? S.md : S.lg}px` }}>

        {/* tagline — mobile keeps it here as the featured statement; on wide
            it's already composed into the hero */}
        {!wide && (data.tagline ? (
          <p style={{ fontFamily: 'DM Sans', fontStyle: 'italic', fontSize: '17px', color: BONE, lineHeight: 1.5, margin: 0, maxWidth: '460px', letterSpacing: '.005em' }}>
            <span style={{ color: SILVER, fontStyle: 'normal', marginRight: '2px' }}>“</span>{data.tagline}<span style={{ color: SILVER, fontStyle: 'normal', marginLeft: '2px' }}>”</span>
          </p>
        ) : (isOwner && !editing && (
          /* ERA UN <p>: se veía clickeable y no hacía nada. Nada que parezca
             interactivo puede estar muerto — es lo contrario del lujo. Ahora
             abre el editor, que es a donde el texto ya prometía llevarte. */
          <button className="pressable" onClick={startEdit} data-testid="add-tagline"
            style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'DM Sans', fontStyle: 'italic', fontSize: '15px', color: BONE_LOW }}>
            Add a line — what you're on, right now.
          </button>
        )))}
        {wide && !data.tagline && isOwner && !editing && (
          <button className="pressable" onClick={startEdit} data-testid="add-tagline-wide"
            style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'DM Sans', fontStyle: 'italic', fontSize: '15px', color: BONE_LOW }}>
            Add a line — what you're on, right now.
          </button>
        )}

        {/* CONNECT — the social layer's face on the world (0017): follow +
            message + the honest count. Renders only when the layer is LIVE
            in the DB (Ley 9: no dead doors) and never for the owner's own
            world (you don't follow yourself — you see your count). */}
        {!editing && social?.ready && !isOwner && (
          /* rowGap explícito: al envolverse, la segunda fila tiene que caer
             en el mismo ritmo que la primera — si no, la tira se desalinea
             justo en los teléfonos angostos, que es donde más se nota. */
          <div style={{ display: 'flex', alignItems: 'center', gap: `${S.sm}px`, rowGap: `${S.sm}px`, flexWrap: 'wrap' }}>
            <button className="pressable" onClick={onFollowToggle} aria-pressed={social.iFollow}
              data-testid="follow-btn"
              style={{ ...chipBase, background: social.iFollow ? 'rgba(var(--silver-rgb),.1)' : BONE, border: social.iFollow ? `1px solid rgba(var(--silver-rgb),.4)` : '1px solid transparent', color: social.iFollow ? BONE : VOID }}>
              {social.iFollow ? <UserCheck size={13} /> : <UserPlus size={13} />}
              {/* v12: decía "CONNECTED" cuando quiere decir "ya lo sigues" —
                  la MISMA palabra que rotulaba el conteo de seguidores diez
                  píxeles más allá. Las etiquetas viven en socialVocab.js. */}
              {social.iFollow ? VOCAB.followingState : VOCAB.followAction}
            </button>
            {/* AMIGO (0023) — the mutual bond's door, in the same chip
                grammar. No friendship prop = no door (pre-migration or a
                load error must never render a dead promise — Ley 9). */}
            {/* v13-polish — UNA SOLA PUERTA. Antes cada estado hacía su cosa
                acá mismo: pedir a secas, aceptar a secas, y REQUESTED era un
                chip muerto que no llevaba a ningún lado. Ahora los cuatro
                estados abren la MISMA hoja de intención que Community, que es
                la que sabe qué ofrecer en cada uno (las cuatro intenciones, el
                "Accept & send", el círculo íntimo si ya están conectados).
                Sin onConnect —una superficie vieja que no la pasa— cae al
                comportamiento anterior: nada se rompe por omisión. */}
            {friendship && (
              friendship.state === 'friends' ? (
                <button className="pressable" data-testid="friend-btn"
                  onClick={() => friendship.onConnect
                    ? friendship.onConnect()
                    : (window.confirm(VOCAB_PHRASE.removeConnection) && friendship.onRemove?.())}
                  style={{ ...chipBase, background: 'rgba(var(--silver-rgb),.1)', border: '1px solid rgba(var(--silver-rgb),.4)', color: BONE }}>
                  {VOCAB.connected} <span aria-hidden style={{ fontSize: '8px', color: SILVER }}>●</span>
                </button>
              ) : friendship.state === 'in' ? (
                <button className="pressable" data-testid="friend-btn"
                  onClick={() => friendship.onConnect ? friendship.onConnect() : friendship.onAccept?.()}
                  style={{ ...chipBase, background: BONE, border: '1px solid transparent', color: VOID }}>
                  {VOCAB.connectIncoming}
                </button>
              ) : friendship.state === 'out' ? (
                /* REQUESTED ya no es una lápida: se puede volver a entrar y
                   sumar a la conversación mientras el otro decide. */
                <button className="pressable" data-testid="friend-btn"
                  onClick={() => friendship.onConnect?.()}
                  aria-disabled={!friendship.onConnect}
                  style={{ ...chipBase, background: 'transparent', border: `1px solid ${HAIR_HI}`, color: BONE_LOW, cursor: friendship.onConnect ? 'pointer' : 'default' }}>
                  {VOCAB.connectPending}
                </button>
              ) : (
                <button className="pressable" data-testid="friend-btn"
                  onClick={() => friendship.onConnect ? friendship.onConnect() : friendship.onRequest?.()}
                  style={{ ...chipBase, background: ELEV_1, border: `1px solid ${HAIR_HI}`, color: BONE }}
                  onMouseOver={e => { e.currentTarget.style.background = ELEV_2; e.currentTarget.style.borderColor = 'rgba(var(--ink-rgb),.35)' }}
                  onMouseOut={e => { e.currentTarget.style.background = ELEV_1; e.currentTarget.style.borderColor = HAIR_HI }}>
                  {VOCAB.connectAction}
                </button>
              )
            )}
            <button className="pressable" onClick={onMessage} data-testid="message-btn"
              style={{ ...chipBase, background: ELEV_1, border: `1px solid ${HAIR_HI}`, color: BONE }}
              onMouseOver={e => { e.currentTarget.style.background = ELEV_2; e.currentTarget.style.borderColor = 'rgba(var(--ink-rgb),.35)' }}
              onMouseOut={e => { e.currentTarget.style.background = ELEV_1; e.currentTarget.style.borderColor = HAIR_HI }}>
              <MessageCircle size={13} /> MESSAGE
            </button>
            {/* v12: los conteos se PICAN y abren a la gente. Eran el dato más
                obviamente vivo de la pantalla y no llevaban a ningún lado.
                Se puede porque la RLS de follows entrega la arista cuando los
                dos mundos son públicos (0034) — ver social.js. */}
            {(social.followers > 0 || social.following > 0) && (
              /* la misma altura que las pastillas (Pato): el conteo pertenece a
                 la fila, no flota junto a ella. Y se pica (Diego). */
              <span style={{ display: 'inline-flex', alignItems: 'center', height: `${CHIP_H}px`, gap: '4px' }}>
                {social.followers > 0 && (
                  <button className="pressable" data-testid="followers-count" onClick={() => setPeopleSheet('followers')}
                    style={countBtn}>
                    <span style={{ color: SILVER, fontSize: '11px' }}>{social.followers}</span> {VOCAB.followers}
                  </button>
                )}
                {social.following > 0 && (
                  <button className="pressable" data-testid="following-count" onClick={() => setPeopleSheet('following')}
                    style={countBtn}>
                    <span style={{ color: SILVER, fontSize: '11px' }}>{social.following}</span> {VOCAB.following}
                  </button>
                )}
              </span>
            )}
            {social.err && (
              <span role="alert" style={{ flexBasis: '100%', fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--warn)', letterSpacing: '.04em' }}>⚠ {social.err}</span>
            )}
          </div>
        )}
        {/* looking at your OWN world from the public side — one honest door
            back to curating, never follow-yourself buttons (review catch) */}
        {!editing && selfView && onSelfCurate && (
          <button className="pressable" onClick={onSelfCurate} data-testid="self-world"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: ELEV_1, border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '8px 16px', color: BONE_MID, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
            ◇ this is your world — curate it →
          </button>
        )}
        {/* the owner's own count — one honest line, never a vanity wall.
            v12: también se pica; tu propia gente es lo primero que quieres
            poder abrir. */}
        {!editing && social?.ready && isOwner && social.followers > 0 && (
          <button className="pressable" data-testid="owner-followers-count" onClick={() => setPeopleSheet('followers')}
            style={{ ...countBtn, marginTop: wide ? '6px' : '14px', padding: '4px 0' }}>
            <span style={{ color: SILVER, fontSize: '11px' }}>{social.followers}</span> {VOCAB_PHRASE.ownFollowers}
          </button>
        )}

        {/* world links — the doors out of this world (IG, portfolio, sound) */}
        {!editing && links.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${S.sm}px` }}>
            {links.map((l, i) => (
              <a key={`${l.url}:${i}`} href={safeUrl(l.url)} target="_blank" rel="noopener noreferrer" className="pressable"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.16em', textTransform: 'uppercase', color: BONE_MID, border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '6px 13px', textDecoration: 'none', transition: 'border-color .2s, color .2s, transform .2s' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(var(--silver-rgb),.5)'; e.currentTarget.style.color = BONE }}
                onMouseOut={e => { e.currentTarget.style.borderColor = HAIR_HI; e.currentTarget.style.color = BONE_MID }}>
                {l.label || hostOf(l.url)}
                <ArrowUpRight size={10} style={{ color: SILVER }} />
              </a>
            ))}
          </div>
        )}
        {isOwner && !editing && links.length === 0 && (
          /* mismo caso que el de arriba: parecía botón, era un div */
          <button className="pressable" onClick={startEdit} data-testid="add-links"
            style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.1em' }}>
            + add your links — IG, portfolio, sound
          </button>
        )}
        {upErr && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--warn)', letterSpacing: '.04em' }}>⚠ {upErr}</div>}

        {isOwner && !editing && !building && (
          <div>
            {/* IN-UI CRAFT MIGRATION (D1): a legacy free-text discipline is
                invited to become REAL crafts — recognition, not a form. The
                band lives until the person chooses; nothing is rewritten
                behind their back (Ley 11). */}
            {craftsReady && crafts.length === 0 && (data.discipline || '').trim() && (
              <button data-testid="craft-migration" className="pressable" onClick={() => setBuilding(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '460px', textAlign: 'left', background: 'linear-gradient(150deg, rgba(var(--silver-rgb),.07), rgba(var(--silver-rgb),.015))', border: `1px solid rgba(var(--silver-rgb),.3)`, borderRadius: '13px', padding: '13px 16px', cursor: 'pointer', marginBottom: '14px', transition: 'border-color .25s ease' }}
                onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(var(--silver-rgb),.55)'}
                onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(var(--silver-rgb),.3)'}>
                <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '13px', color: SILVER, flexShrink: 0 }}>◇</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: 'Bebas Neue', fontSize: '17px', color: BONE, letterSpacing: '.04em', lineHeight: 1 }}>THE UNIVERSE NOW SPEAKS CRAFT</span>
                  <span style={{ display: 'block', fontFamily: 'DM Mono', fontSize: '8.5px', color: BONE_MID, letterSpacing: '.06em', marginTop: '5px', lineHeight: 1.5 }}>
                    turn “{(data.discipline || '').slice(0, 32)}{(data.discipline || '').length > 32 ? '…' : ''}” into your real crafts — it powers who finds you
                  </span>
                </span>
                <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '12px', color: SILVER, flexShrink: 0 }}>→</span>
              </button>
            )}
            {/* THE LISTENING BAND (v6): a member with real crafts and zero
                tastes is invited to brainstorm — the quiet layer that turns
                the for-you on. Same grammar as the craft band, one register
                quieter. tastes===null (still loading) never flashes it. */}
            {tastes !== null && tastes.length === 0 && crafts.length > 0 && (
              <button data-testid="taste-invite" className="pressable" onClick={() => setBuilding(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '460px', textAlign: 'left', background: 'rgba(var(--silver-rgb),.03)', border: `1px solid ${HAIR_HI}`, borderRadius: '13px', padding: '12px 16px', cursor: 'pointer', marginBottom: '14px', transition: 'border-color .25s ease' }}
                onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(var(--silver-rgb),.4)'}
                onMouseOut={e => e.currentTarget.style.borderColor = HAIR_HI}>
                <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '13px', color: SILVER, flexShrink: 0 }}>○</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: 'DM Mono', fontSize: '7.5px', color: BONE_LOW, letterSpacing: '.24em', textTransform: 'uppercase' }}>EL MUNDO v6</span>
                  <span style={{ display: 'block', fontFamily: 'Bebas Neue', fontSize: '16px', color: BONE, letterSpacing: '.04em', lineHeight: 1, marginTop: '4px' }}>THE UNIVERSE LISTENS</span>
                  <span style={{ display: 'block', fontFamily: 'DM Mono', fontSize: '8.5px', color: BONE_MID, letterSpacing: '.06em', marginTop: '5px', lineHeight: 1.5 }}>
                    brainstorm your taste and your for-you comes alive — quiet by default, only you see it
                  </span>
                </span>
                <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '12px', color: SILVER, flexShrink: 0 }}>→</span>
              </button>
            )}
            {/* the meter — how lit the world is, hairline not game */}
            {completeness.pct < 100 && (
              <div style={{ maxWidth: '260px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.24em', textTransform: 'uppercase' }}>your world</span>
                  <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_MID, letterSpacing: '.1em' }}>{completeness.pct}%</span>
                </div>
                <div style={{ height: '1px', background: HAIR, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', transform: `scaleX(${completeness.pct / 100})`, transformOrigin: 'left', background: SILVER, opacity: .7, transition: 'transform .5s var(--ease-house)' }} />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <button className="pressable" onClick={() => completeness.pct < 100 ? setBuilding(true) : startEdit()} style={{ background: 'rgba(var(--ink-rgb),.05)', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '9px 20px', color: BONE, fontSize: '11.5px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px', fontFamily: 'DM Sans', letterSpacing: '.03em', transition: 'background .2s, border-color .2s, transform .2s' }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(var(--ink-rgb),.11)'; e.currentTarget.style.borderColor = 'rgba(var(--ink-rgb),.34)' }}
                onMouseOut={e => { e.currentTarget.style.background = 'rgba(var(--ink-rgb),.05)'; e.currentTarget.style.borderColor = HAIR_HI }}>
                <Edit3 size={12} /> {completeness.pct < 100 ? 'Build your world →' : 'Curate your world'}
              </button>
              {completeness.pct < 100 && (
                <button onClick={startEdit} style={{ background: 'transparent', border: 'none', padding: 0, color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  or curate it all at once
                </button>
              )}
            </div>
          </div>
        )}
        </div>{/* /wide byline grid */}
      </div>

      {/* ============ EDIT MODE ============ */}
      {editing ? (
        <div style={{ position: 'relative', padding: '30px 0 130px', ...frame, display: 'flex', flexDirection: 'column', gap: '30px', animation: 'fadeUp .3s ease', zIndex: 3, ...(wide && { maxWidth: '780px', paddingLeft: 'clamp(40px, 5vw, 76px)', paddingRight: 'clamp(40px, 5vw, 76px)' }) }}>
          <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: BONE_MID, letterSpacing: '.04em', lineHeight: 1.6, borderLeft: `1px solid ${SILVER}`, paddingLeft: '14px' }}>
            You're not filling out a form — you're building a world. Paste links and they come alive; write names and they become the walls of your museum.
          </div>

          <Section title="IDENTITY">
            <Field label="NAME"><input style={inp} value={name} placeholder="Your name" onChange={e => setName(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="HANDLE"><input style={inp} value={username} placeholder="@yourhandle" onChange={e => setUsername(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="YOUR CRAFTS" hint="Real crafts from the universe's own taxonomy — you can be many. Tap a chosen one to hand it the lead.">
              <CraftPicker value={editCrafts} primaryId={editPrimary} maxHeight="26vh"
                seedQuery={editCrafts.length ? '' : ((data?.discipline || '').split(/[·,/&+]| and /i)[0] || '').trim().slice(0, 24)}
                onChange={(next, nextPrimary) => { setEditCrafts(next); setEditPrimary(nextPrimary) }} />
            </Field>
            <Field label="CITY"><input style={inp} value={city} placeholder="Houston" onChange={e => setCity(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="RIGHT NOW" hint="One line, your voice. What you're on right now."><input style={inp} value={tagline} placeholder="Chasing the sound that doesn't exist yet." onChange={e => setTagline(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="THE OPENING" hint="A short statement — who you are, in your own words. This opens your world."><textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={bio} placeholder="Where you're from, what you make, what you're chasing." onChange={e => setBio(e.target.value)} onFocus={onF} onBlur={onB} /></Field>
            <Field label="MARQUEE" hint="The line that loops across the top of your world. Clear it to turn the ticker off.">
              <input style={inp} value={marquee} maxLength={80} placeholder={DEFAULT_MARQUEE} onChange={e => setMarquee(e.target.value)} onFocus={onF} onBlur={onB} />
            </Field>
            <Field label="WORLD SKIN" hint="How your name is set — same universe, your composition.">
              <div style={{ display: 'flex', gap: '10px' }}>
                {THEMES.map(t => {
                  const active = theme === t.key
                  return (
                    <button key={t.key} onClick={() => setTheme(t.key)}
                      style={{ flex: 1, background: active ? 'rgba(var(--silver-rgb),.08)' : CARD, border: `1px solid ${active ? SILVER : HAIR_HI}`, borderRadius: '12px', padding: '14px 6px 10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', transition: 'background .2s, border-color .2s' }}>
                      <span style={{ fontFamily: 'Bebas Neue', fontSize: '24px', lineHeight: 1, ...nameSkin(t.key) }}>Aa</span>
                      <span style={{ fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.2em', textTransform: 'uppercase', color: active ? BONE : BONE_LOW }}>{t.label}</span>
                    </button>
                  )
                })}
              </div>
            </Field>
          </Section>

          <Section title="GALLERY" hint="Your work as images — upload, caption, and order the wall. First image leads.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {galRows.map((row, i) => (
                <div key={row.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', border: `1px solid ${HAIR_HI}`, borderRadius: '12px', padding: '10px', background: CARD }}>
                  <img src={row.url} alt="" style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0, border: `1px solid ${HAIR}` }} />
                  <input style={{ ...inp, padding: '10px 13px' }} value={row.caption} placeholder="Caption (optional)" onChange={e => setGalCaption(i, e.target.value)} onFocus={onF} onBlur={onB} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                    <button onClick={() => moveGalRow(i, -1)} disabled={i === 0} aria-label="Move up" style={{ ...galBtn, opacity: i === 0 ? .3 : 1 }}><ArrowUp size={12} /></button>
                    <button onClick={() => moveGalRow(i, 1)} disabled={i === galRows.length - 1} aria-label="Move down" style={{ ...galBtn, opacity: i === galRows.length - 1 ? .3 : 1 }}><ArrowDown size={12} /></button>
                  </div>
                  <button onClick={() => delGalRow(i)} aria-label="Remove" style={{ background: 'rgba(229,160,160,.08)', border: '1px solid rgba(229,160,160,.2)', borderRadius: '8px', width: '38px', height: '38px', flexShrink: 0, color: 'var(--warn)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                </div>
              ))}
              {galErr && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--warn)' }}>{galErr}</div>}
              <button onClick={() => galleryFileRef.current?.click()} disabled={galUploading > 0}
                style={{ background: 'transparent', border: `1px dashed ${HAIR_HI}`, borderRadius: '12px', padding: '12px', color: BONE_MID, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'DM Sans', opacity: galUploading > 0 ? .6 : 1 }}>
                {galUploading > 0 ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <ImagePlus size={14} />}
                {galUploading > 0 ? `Uploading ${galUploading}…` : 'Add images'}
              </button>
              <input ref={galleryFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple style={{ display: 'none' }} onChange={addGalleryFiles} />
            </div>
          </Section>

          <Section title="LINKS" hint="The doors out of your world — IG, portfolio, SoundCloud, site.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {linkRows.map((row, i) => (
                <div key={row.id} style={{ border: `1px solid ${HAIR_HI}`, borderRadius: '12px', padding: '12px', background: CARD }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <input style={{ ...inp, padding: '10px 13px' }} value={row.label} placeholder="Label (IG, Portfolio…)" onChange={e => setLinkRow(i, 'label', e.target.value)} onFocus={onF} onBlur={onB} />
                    <button onClick={() => delLinkRow(i)} aria-label="Remove" style={{ background: 'rgba(229,160,160,.08)', border: '1px solid rgba(229,160,160,.2)', borderRadius: '8px', width: '38px', height: '38px', flexShrink: 0, color: 'var(--warn)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                  </div>
                  <input style={{ ...inp, padding: '10px 13px' }} value={row.url} placeholder="https://…" onChange={e => setLinkRow(i, 'url', e.target.value)} onFocus={onF} onBlur={onB} />
                  {row.url && !safeUrl(row.url) && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--warn)', marginTop: '6px' }}>Must start with http:// or https://</div>}
                </div>
              ))}
              <button onClick={addLinkRow} style={{ background: 'transparent', border: `1px dashed ${HAIR_HI}`, borderRadius: '12px', padding: '12px', color: BONE_MID, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'DM Sans' }}>
                <Plus size={14} /> Add a link
              </button>
            </div>
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
                    <button onClick={() => delRow(i)} aria-label="Remove" style={{ background: 'rgba(229,160,160,.08)', border: '1px solid rgba(229,160,160,.2)', borderRadius: '8px', width: '38px', height: '38px', flexShrink: 0, color: 'var(--warn)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                  </div>
                  <input style={{ ...inp, padding: '10px 13px' }} value={row.url} placeholder="https://…" onChange={e => setRow(i, 'url', e.target.value)} onFocus={onF} onBlur={onB} />
                  {row.url && !safeUrl(row.url) && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--warn)', marginTop: '6px' }}>Must start with http:// or https://</div>}
                </div>
              ))}
              <button onClick={addRow} style={{ background: 'transparent', border: `1px dashed ${HAIR_HI}`, borderRadius: '12px', padding: '12px', color: BONE_MID, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'DM Sans' }}>
                <Plus size={14} /> Add a piece
              </button>
            </div>
          </Section>

          <Section title="YOUR ROOMS" hint="The movements of your world — turn a room on or off, and set the order they open in. Off is off: a closed room shows to no one.">
            <div data-testid="rooms-editor" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {roomRows.map((r, i) => {
                // Ley 11 — a world needs >=1 open room: the last ON toggle can't
                // turn itself off (turning others on is always free)
                const lastOn = r.on && roomRows.filter((x) => x.on).length === 1
                return (
                <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: '11px', border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '10px 12px', background: CARD, opacity: r.on ? 1 : .55, transition: 'opacity .2s' }}>
                  <Mark type={MARKS[r.key]} size={10} color={SILVER} style={{ flexShrink: 0, opacity: .85 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.18em', textTransform: 'uppercase', color: r.on ? BONE : BONE_LOW }}>{MODULES[r.key].label}</div>
                    <div style={{ fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.06em', color: BONE_LOW, marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{MODULES[r.key].kicker}</div>
                  </div>
                  <button className="pressable" data-testid={`room-toggle-${r.key}`} onClick={() => toggleRoom(r.key)} aria-pressed={r.on} aria-disabled={lastOn}
                    title={lastOn ? 'a world needs at least one open room' : undefined}
                    style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.2em', border: `1px solid ${r.on ? 'rgba(var(--silver-rgb),.4)' : HAIR_HI}`, borderRadius: '100px', padding: '5px 13px', background: r.on ? 'rgba(var(--silver-rgb),.1)' : 'transparent', color: r.on ? BONE : BONE_LOW, cursor: lastOn ? 'default' : 'pointer', flexShrink: 0, transition: 'background .2s, border-color .2s, color .2s, transform .2s' }}>
                    {r.on ? 'ON' : 'OFF'}
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                    <button className="pressable" data-testid={`room-up-${r.key}`} onClick={() => moveRoom(r.key, -1)} disabled={i === 0} aria-label="Move up" style={{ ...galBtn, opacity: i === 0 ? .3 : 1 }}><ArrowUp size={12} /></button>
                    <button className="pressable" data-testid={`room-down-${r.key}`} onClick={() => moveRoom(r.key, 1)} disabled={i === roomRows.length - 1} aria-label="Move down" style={{ ...galBtn, opacity: i === roomRows.length - 1 ? .3 : 1 }}><ArrowDown size={12} /></button>
                  </div>
                </div>
                )
              })}
              {/* the honest floor — surfaced only when one room is holding the world open */}
              {roomRows.filter((r) => r.on).length === 1 && (
                <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.1em', padding: '0 2px' }}>
                  a world needs at least one open room
                </div>
              )}
              <button className="pressable" onClick={resetRooms}
                style={{ background: 'transparent', border: 'none', padding: '2px 0', alignSelf: 'flex-start', color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                reset to my craft's order
              </button>
            </div>
          </Section>

          {saveErr && <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: 'var(--warn)', textAlign: 'center', marginTop: '-12px' }}>{saveErr}</div>}
          {/* both gates wait for in-flight gallery uploads — saving or cancelling
              mid-upload would drop the image and orphan its storage object */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={cancelEdit} disabled={galUploading > 0} style={{ flex: '0 0 auto', background: 'rgba(var(--ink-rgb),.04)', border: `1px solid ${HAIR}`, borderRadius: '10px', padding: '14px 22px', color: BONE_MID, fontSize: '13px', cursor: galUploading > 0 ? 'default' : 'pointer', fontFamily: 'DM Sans', opacity: galUploading > 0 ? .5 : 1 }}>Cancel</button>
            <button onClick={save} disabled={saving || galUploading > 0} style={{ flex: 1, background: BONE, border: 'none', borderRadius: '10px', padding: '14px', color: VOID, fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans', opacity: (saving || galUploading > 0) ? .6 : 1, transition: 'opacity .2s' }}>{saving ? 'Saving…' : galUploading > 0 ? 'Uploading…' : 'Save your world'}</button>
          </div>
        </div>
      ) : (
        /* ============ VIEW MODE — the world ============ */
        <div style={{ position: 'relative', ...frame, paddingTop: '4px', paddingBottom: wide ? '140px' : '120px', zIndex: 3 }}>
          {/* the SPINE (D3, Ley 4): one continuous hairline down the margin
              threads the chapters into a single editorial body — the museum
              reads as a magazine, never as stacked cards */}
          {wide && (
            <div aria-hidden style={{ position: 'absolute', left: 'calc(clamp(40px, 5vw, 76px) - 26px)', top: '90px', bottom: '150px', width: '1px', background: `linear-gradient(180deg, transparent, ${HAIR_HI} 10%, ${HAIR} 90%, transparent)` }} />
          )}

          {/* OPENING STATEMENT */}
          {data.bio && (
            <motion.p {...reveal} style={{ fontSize: wide ? '21px' : '16.5px', color: BONE, lineHeight: 1.8, maxWidth: wide ? '720px' : '540px', margin: wide ? '52px 0 0' : '38px 0 0', paddingLeft: wide ? '22px' : '16px', borderLeft: `1px solid ${SILVER}`, fontFamily: 'DM Sans', fontWeight: 300 }}>
              {data.bio}
            </motion.p>
          )}

          {/* THE MOVEMENTS — composed by moduleOrder (v6): the same rooms
              as always, sequenced by the craft or the owner's own hand. A
              module off the order renders NOTHING (off is off). GALLERY
              keeps its opening margin only when it still leads. */}
          {moduleOrder.filter((k) => show[k]).map((k, i) => {
            const std = wide ? '84px' : '58px'
            return MOVEMENTS[k]((k === 'gallery' && i === 0 && !data.bio) ? '44px' : std)
          })}

          {/* ════ LOS CUARTOS QUE FALTAN — UNA PUERTA, NO OCHO ════

              Esto reemplaza las ocho tarjetas de invitación que abrían todo
              perfil nuevo. Mismo trabajo —decirle al dueño qué le falta y
              llevarlo al builder— en una sola pieza que se lee en dos
              segundos en vez de ~1,200px que se leían como abandono.

              Por qué NOMBRA los cuartos en vez de sólo contarlos: "4 cuartos
              a oscuras" sin decir cuáles obliga a bajar a buscarlos. El
              nombre ES la invitación; el resto es aire.

              Va al FINAL, después de lo que el mundo ya tiene: lo que
              construiste manda, lo que falta susurra. Al revés sería un
              formulario con un perfil abajo. */}
          {isOwner && !editing && emptyRooms.length > 0 && (
            <div style={{
              marginTop: wide ? '72px' : '52px',
              padding: wide ? '30px 32px' : '26px 22px',
              borderRadius: '18px', background: ELEV_1,
              border: `1px solid ${HAIR}`,
              maxWidth: wide ? '620px' : undefined,
            }}>
              <div style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.3em', color: BONE_LOW, textTransform: 'uppercase' }}>◇ your world</div>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '30px' : '25px', letterSpacing: '.03em', color: BONE, lineHeight: 1, marginTop: `${S.md}px` }}>
                {emptyRooms.length} {emptyRooms.length === 1 ? 'ROOM' : 'ROOMS'} STILL DARK
              </div>
              <div style={{ fontFamily: 'DM Mono', fontSize: '9.5px', letterSpacing: '.16em', color: BONE_MID, textTransform: 'uppercase', marginTop: `${S.sm}px`, lineHeight: 1.9 }}>
                {emptyRooms.map((k) => MODULES[k]?.label || k).join('  ·  ')}
              </div>
              <button className="pressable" data-testid="rooms-dark-build" onClick={() => setBuilding(true)}
                style={{ ...chipBase, marginTop: `${S.lg}px`, background: BONE, border: '1px solid transparent', color: VOID }}>
                BUILD YOUR WORLD →
              </button>
            </div>
          )}

          {/* an EMPTY world visited by the public: one honest statement, not
              40% of raw void — the absence gets a voice (panel catch, Leyes
              4/11), and the page still closes with its signature below. */}
          {!isOwner && worldIsEmpty && (
            /* the empty state OWNS its row on desktop — centered on the
               layout's axis, never a lone cell beside two-thirds of raw
               void (panel catch, Ley 4) */
            <div style={{ marginTop: '44px', padding: wide ? '46px 40px' : '34px 26px', borderRadius: '16px', border: `1px solid ${HAIR_HI}`, background: 'linear-gradient(150deg, rgba(var(--silver-rgb),.05), rgba(var(--silver-rgb),.01))', textAlign: 'center', maxWidth: wide ? '680px' : undefined, marginLeft: wide ? 'auto' : undefined, marginRight: wide ? 'auto' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>◇ world forming</span>
                <SeedPill is_demo={data.is_demo} size={7} />
              </div>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: '26px', color: BONE, letterSpacing: '.03em', lineHeight: .95, marginTop: '10px' }}>NOTHING ON THE WALLS YET</div>
              <p style={{ fontFamily: 'DM Sans', fontSize: '13px', color: BONE_MID, lineHeight: 1.6, margin: '10px auto 0', maxWidth: '320px' }}>
                {displayName} just claimed this world — the work, the sound and the taste are on their way.
              </p>
            </div>
          )}

          {/* closing mark — every visited world signs its page */}
          {(!worldIsEmpty || !isOwner) && (
            <div style={{ marginTop: '64px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ height: '1px', flex: 1, background: `linear-gradient(90deg,transparent,${HAIR_HI})` }} />
              <Mark type="diamond" size={9} color={SILVER} style={{ opacity: .8, flexShrink: 0 }} />
              <span style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.24em', color: BONE_LOW, textTransform: 'uppercase' }}>a world by {data.username ? `@${data.username}` : displayName}</span>
              <SeedPill is_demo={data.is_demo} size={7} />
              <span style={{ fontFamily: 'Bebas Neue', fontSize: '16px', color: SILVER }}>4</span>
              <div style={{ height: '1px', flex: 1, background: `linear-gradient(270deg,transparent,${HAIR_HI})` }} />
            </div>
          )}

          {/* owner-only extras (full ticket card, events attended) rendered by the wrapper */}
          {ownerExtras && <div style={wide ? { maxWidth: '560px' } : undefined}>{ownerExtras}</div>}
        </div>
      )}

      {/* page grain now lives in the app-wide varnish (v8: one grain, 5%, over all) */}

      {/* ============ THE GUIDED BUILD — sheet below, world forming above ============ */}
      {/* portaled to <body>: fixed overlays must never inherit a transformed
          ancestor as their containing block (walkthrough catch) */}
      {/* craftsReady gates the mount: the builder seeds its picker from the
          SAVED crafts at mount — opening over a half-loaded set would show a
          member an empty picker for crafts they already chose. tastes !== null
          holds the same door for the quiet layer (0022): its save replaces
          the WHOLE set, so a null-seeded commit would erase a member's tastes */}
      {building && craftsReady && tastes !== null && createPortal(
        <WorldBuilder
          data={data}
          crafts={crafts}
          onCraftsSaved={onCraftsSaved}
          tastes={tastes}
          onTastesSaved={onTastesSaved}
          onDraft={(partial) => setData(d => ({ ...d, ...partial }))}
          onCommit={async (patch) => { if (onSave) await onSave(patch); setData(d => ({ ...d, ...patch })) }}
          onUploadGallery={onUploadGallery}
          onCleanupImages={onCleanupImages}
          onCurate={onCurate}
          onClose={() => setBuilding(false)}
          onPublished={() => { setBuilding(false); setCelebrating(true) }}
        />,
        document.body
      )}

      {/* ============ PUBLISHED — a sober moment, then back to the world ============ */}
      {celebrating && createPortal(
        <div role="dialog" aria-label="Your world is live" style={{ position: 'fixed', inset: 0, zIndex: 10010, background: `radial-gradient(120% 88% at 50% 8%, rgba(var(--silver-rgb),.09) 0%, transparent 55%), ${VOID}`, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn .6s ease' }}>
          {/* void + type only — the app-wide grain varnishes this moment too;
              the person's starfield belongs to their hero, not fullscreen blobs */}
          {/* the ceremony stages in — the house .rise procession, exactly as
              ClaimWorld/CreateCentral/WorldBuilder already do it (A-02). Buttons
              are WRAPPED in .rise, never carry it (a filled rise outranks :active). */}
          <div style={{ position: 'relative', textAlign: 'center', padding: '0 30px', maxWidth: '380px' }}>
            <div className="rise" style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>◇ published</div>
            <div className="rise rise-1" style={{ fontFamily: 'Bebas Neue', fontSize: '52px', lineHeight: .95, marginTop: '16px', ...chromeText }}>YOUR WORLD<br />IS LIVE</div>
            <p className="rise rise-2" style={{ fontFamily: 'DM Sans', fontSize: '13.5px', color: BONE_MID, lineHeight: 1.65, marginTop: '16px' }}>
              Your card in Discover. Your museum. Yours.
            </p>
            <div className="rise rise-3" style={{ marginTop: '26px', display: 'flex', justifyContent: 'center' }}>
              <button className="pressable" onClick={() => { setCelebrating(false); onViewPublic?.() }}
                style={{ marginTop: 0, width: '100%', background: BONE, border: 'none', borderRadius: '10px', padding: '14px', color: VOID, fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans' }}>
                SEE IT AS THE WORLD SEES IT
              </button>
            </div>
            <div className="rise rise-4" style={{ marginTop: '14px', display: 'flex', justifyContent: 'center' }}>
              <button className="pressable" onClick={() => setCelebrating(false)}
                style={{ marginTop: 0, background: 'transparent', border: 'none', color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
                keep curating
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── lo que antes era texto muerto (v12) ──────────────────────────
          Van por PORTAL a document.body por la misma razón que la ceremonia
          de arriba: el museo tiene ancestros con `transform` (la intro de la
          portada, las revelaciones al hacer scroll), y un transform vivo se
          vuelve el bloque contenedor de todo `position:fixed` que cuelgue de
          él — la hoja se anclaría al documento en vez de a la pantalla. Ya
          pasó una vez con la hoja del builder y quedó anotado arriba. */}
      {peopleSheet && createPortal(
        <PeopleSheet
          wide={wide}
          title={peopleSheet === 'followers' ? VOCAB.followers : VOCAB.following}
          kicker={`◇ ${displayName}`}
          loadKey={`${peopleSheet}:${data.id}`}
          load={peopleSheet === 'followers'
            ? () => fetchFollowers(data.id)
            : () => fetchFollowing(data.id)}
          onOpenPerson={(id) => { setPeopleSheet(null); navigate(`/user/${id}`) }}
          onClose={() => setPeopleSheet(null)}
        />,
        document.body
      )}
      {craftsOpen && createPortal(
        <CraftsSheet wide={wide} name={displayName} crafts={crafts}
          onPickCraft={openCraft} onClose={() => setCraftsOpen(false)} />,
        document.body
      )}
    </div>
  )
}

/* ---------- shared bits ---------- */
/* v12.1 — este llevaba `blur(8px)` inventado aquí y un fondo al 60% de vacío,
   que sobre una portada clara tapaba la foto en vez de dejarla ver. Ahora es
   la receta compartida (glass.js): mismo material que el resto de los
   controles sueltos de la app, y una sola línea que cambiar si se afina. */
const pill = { ...glassControl(), borderRadius: '100px', padding: '6px 12px', color: BONE, fontSize: '10px', fontFamily: 'DM Sans', cursor: 'pointer' }
const galBtn = { background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '7px', width: '26px', height: '25px', color: BONE_MID, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }

/* los conteos del vínculo: se ven igual que antes (nada de botón pintado —
   siguen siendo dato, no decoración) pero ahora son botones de verdad. Sin
   `border:none` explícito el user-agent les mete su propio borde y la línea
   se ensucia. */
const countBtn = {
  background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer',
  fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW,
  letterSpacing: '.12em', textTransform: 'uppercase',
}

/* v12.4 — WorldMarquee se eliminó junto con su único call site (Diego quitó
   el marquee del perfil). Era la ÚNICA función que lo dibujaba, así que
   dejarla definida sin llamar es código muerto que el próximo lector
   interpreta como "esto todavía se usa". El dato (marquee_text) vive en la
   fila; el componente que lo pintaba, no. Su CSS (.world-ticker / worldTicker
   en index.css) tampoco se toca en otro lado — se quita allá también. */

/* GalleryGrid — the wall. Mobile: first image leads full-bleed, the rest hang
   two-across. Wide: a salon wall — an asymmetric 12-column museum grid, rows
   of unequal pieces in a deliberate rhythm ([8·4] [4·4·4] [7·5], repeating).
   Captions in catalog mono. Order = the array, always. */
const SALON = [
  { span: 8, h: 'clamp(340px, 36vw, 540px)' },
  { span: 4, h: 'clamp(340px, 36vw, 540px)' },
  { span: 4, h: 'clamp(280px, 29vw, 430px)' },
  { span: 4, h: 'clamp(280px, 29vw, 430px)' },
  { span: 4, h: 'clamp(280px, 29vw, 430px)' },
  { span: 7, h: 'clamp(320px, 33vw, 500px)' },
  { span: 5, h: 'clamp(320px, 33vw, 500px)' },
]
function GalleryGrid({ items, wide }) {
  if (wide) {
    return (
      <div style={{ marginTop: '4px', display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px', alignItems: 'start' }}>
        {items.map((g, i) => {
          const cell = SALON[i % SALON.length]
          return <GalleryPiece key={`${g.url}:${i}`} item={g} featured={i === 0} span={cell.span} fixedH={cell.h} index={i} />
        })}
      </div>
    )
  }
  const [featured, ...rest] = items
  return (
    <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <GalleryPiece item={featured} featured />
      {rest.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
          {rest.map((g, i) => <GalleryPiece key={`${g.url}:${i}`} item={g} />)}
        </div>
      )}
    </div>
  )
}
function GalleryPiece({ item, featured, span, fixedH, index }) {
  const [ok, setOk] = useState(true)
  const src = safeImg(item.url)
  if (!src || !ok) return null
  const salon = span != null
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className={salon ? 'salon-piece' : undefined}
      style={{ display: 'block', textDecoration: 'none', ...(salon && { gridColumn: `span ${span}`, minWidth: 0 }) }}>
      <div
        style={{ borderRadius: featured ? '16px' : '12px', overflow: 'hidden', border: `1px solid ${featured ? 'rgba(var(--ink-rgb),.16)' : HAIR_HI}`, background: CARD, boxShadow: featured ? '0 14px 44px rgba(var(--shadow-rgb),.4)' : 'none' }}>
        <img src={src} alt={item.caption || ''} loading="lazy" onError={() => setOk(false)}
          style={salon
            ? { width: '100%', height: fixedH, display: 'block', objectFit: 'cover' }
            : { width: '100%', display: 'block', objectFit: 'cover', maxHeight: featured ? '480px' : '220px', minHeight: featured ? undefined : '120px' }} />
      </div>
      {(item.caption || salon) && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '8px' }}>
          {salon && <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.18em', flexShrink: 0 }}>{String(index + 1).padStart(2, '0')}</span>}
          {item.caption && <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.08em', lineHeight: 1.5 }}>{item.caption}</span>}
        </div>
      )}
    </a>
  )
}

/* Mark (the star-chart geometric set) now lives in @/components/Mark —
   the nav and every surface draw from the same brand-mark vocabulary. */

/* A deterministic constellation for the no-cover state — the person's own star chart.
   The viewBox scales with the hero, so on wide screens the radii must scale
   DOWN or the stars balloon into planets (1 viewBox unit ≈ 14px at 1440). */
function StarField({ seed, wide }) {
  const k = wide ? 0.34 : 1
  const rnd = mulberry32(hash(seed) + 9)
  const stars = Array.from({ length: 48 }, () => ({ x: +(rnd() * 100).toFixed(2), y: +(rnd() * 100).toFixed(2), r: +(0.5 + rnd() * 1.4).toFixed(2), o: +(0.12 + rnd() * 0.6).toFixed(2) }))
  const links = Array.from({ length: 6 }, () => [stars[Math.floor(rnd() * stars.length)], stars[Math.floor(rnd() * stars.length)]]).filter(([a, b]) => a && b && a !== b)
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
      {links.map((l, i) => <line key={i} x1={l[0].x} y1={l[0].y} x2={l[1].x} y2={l[1].y} stroke={SILVER} strokeWidth={0.1 * (wide ? 0.5 : 1)} opacity="0.16" />)}
      {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={(s.r / 2) * k} fill={STAR} opacity={s.o} />)}
    </svg>
  )
}

/* Editorial CHAPTER marker (D3 — the museum reads as a magazine, not a
   stack of boxes): an oversized ghost folio numeral sits behind the label
   like a lookbook spread number; the mark + hairline carry the thread.
   Labels in solid BONE: the world's single chrome moment is the NAME (Ley 8). */
function Marker({ mark, n, label, kicker, wide }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: wide ? '16px' : '12px', marginBottom: wide ? '26px' : '20px' }}>
      {/* the folio — a chapter numeral, felt more than read */}
      <span aria-hidden style={{ position: 'absolute', left: wide ? '-10px' : '-6px', bottom: '-8px', fontFamily: 'Bebas Neue', fontSize: wide ? '96px' : '62px', lineHeight: 1, color: BONE, opacity: .05, pointerEvents: 'none', userSelect: 'none' }}>{n}</span>
      <Mark type={mark} size={wide ? 16 : 14} color={SILVER} style={{ flexShrink: 0, opacity: .9, position: 'relative' }} />
      <span style={{ fontFamily: 'DM Mono', fontSize: '11px', color: BONE_MID, letterSpacing: '.1em', flexShrink: 0, position: 'relative' }}>{n}</span>
      <span style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '38px' : '29px', letterSpacing: '.05em', lineHeight: 1, flexShrink: 0, color: BONE, position: 'relative' }}>{label}</span>
      <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${HAIR_HI}, transparent)` }} />
      {kicker && <span style={{ fontFamily: 'DM Mono', fontSize: wide ? '9px' : '8px', letterSpacing: '.26em', color: BONE_LOW, textTransform: 'uppercase', flexShrink: 0 }}>{kicker}</span>}
    </div>
  )
}

/* An empty movement, styled into the world — an invitation, never a barren shell. */
function Invite({ children, icon: Icon }) {
  return (
    <div style={{ marginTop: '4px', padding: '24px 22px', borderRadius: '16px', border: `1px solid ${HAIR_HI}`, background: 'linear-gradient(150deg, rgba(var(--silver-rgb),.05), rgba(var(--silver-rgb),.01))', display: 'flex', gap: '16px', alignItems: 'flex-start', maxWidth: '480px' }}>
      <div style={{ width: '38px', height: '38px', flexShrink: 0, borderRadius: '10px', border: `1px solid ${HAIR_HI}`, background: 'rgba(var(--silver-rgb),.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

/* ---------- SOUND: a featured player + an editorial tracklist ----------
   Wide: the record-sleeve spread — the player holds the left page (7/12),
   the tracklist runs down the right (5/12). Mobile stacks as before. */
function SoundMovement({ items, wide }) {
  const parsed = items.map((it, i) => ({ it, i, p: parseMedia(it) }))
  const players = parsed.filter(x => isPlayer(x.p))
  const featured = players[0] || null
  const morePlayers = players.slice(1)
  const tracks = parsed.filter(x => !isPlayer(x.p)) // names + plain links

  const featuredBlock = featured && (
    <div style={{ marginBottom: !wide && (tracks.length || morePlayers.length) ? '26px' : 0 }}>
      <Tag label="On repeat" />
      <MediaCard item={{ url: featured.it }} full featured />
    </div>
  )
  const tracksBlock = tracks.length > 0 && (
    <div>
      {featured && <Tag label="In rotation" count={tracks.length} />}
      <div>
        {tracks.map((t, i) => <Track key={`${t.it}:${t.i}`} index={i + 1} value={t.it} />)}
      </div>
    </div>
  )
  const moreBlock = morePlayers.length > 0 && (
    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {morePlayers.map((m) => <MediaCard key={`${m.it}:${m.i}`} item={{ url: m.it }} full />)}
    </div>
  )

  if (wide && featured && (tracks.length > 0 || morePlayers.length > 0)) {
    return (
      <div style={{ marginTop: '4px', display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '48px', alignItems: 'start' }}>
        <div>{featuredBlock}</div>
        <div>{tracksBlock}{moreBlock}</div>
      </div>
    )
  }
  return (
    <div style={{ marginTop: '4px', ...(wide && { maxWidth: '780px' }) }}>
      {featuredBlock}
      {tracksBlock}
      {moreBlock}
    </div>
  )
}

/* A tracklist row — reads like the back of a record sleeve. */
function Track({ index, value }) {
  const p = parseMedia(value)
  const link = p && p.kind === 'link' ? p : null
  const text = link ? (link.host || value) : value
  const inner = (
    <div className="row-lead" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '15px 6px', borderBottom: `1px solid ${HAIR}`, color: BONE }}
      onMouseOver={e => { e.currentTarget.style.borderColor = HAIR_HI }}
      onMouseOut={e => { e.currentTarget.style.borderColor = HAIR }}>
      <span style={{ fontFamily: 'DM Mono', fontSize: '11px', color: SILVER, opacity: .7, minWidth: '20px' }}>{String(index).padStart(2, '0')}</span>
      <span style={{ flex: 1, fontFamily: 'Bebas Neue', fontSize: '23px', letterSpacing: '.03em', color: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
      {link && <ArrowUpRight size={15} style={{ color: SILVER, flexShrink: 0 }} />}
    </div>
  )
  return link
    ? <a href={link.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>{inner}</a>
    : inner
}

/* ---------- SCREEN: a horizontal poster rail (a filmstrip on wide) ----------
   A SINGLE title on wide composes as a featured spread — poster + a hairline
   that owns the band — never a lone phone-sized card adrift in void (Ley 4:
   el espacio se compone, no se abandona). */
function PosterRail({ items, wide }) {
  if (wide && items.length === 1) {
    return (
      <div style={{ marginTop: '4px', display: 'flex', alignItems: 'flex-end', gap: '32px' }}>
        <PosterCard value={items[0]} index={1} wide big />
        <div aria-hidden style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '26px' }}>
          <div style={{ height: '1px', background: `linear-gradient(90deg, ${HAIR_HI}, transparent)` }} />
          <span style={{ fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.26em', color: BONE_LOW, textTransform: 'uppercase' }}>01 / 01 on the screen wall</span>
        </div>
      </div>
    )
  }
  return (
    <div className="no-scrollbar" style={{ marginTop: '4px', display: 'flex', gap: wide ? '20px' : '14px', overflowX: 'auto', scrollSnapType: 'x proximity', paddingBottom: '6px', WebkitOverflowScrolling: 'touch' }}>
      {items.map((it, i) => <PosterCard key={`${it}:${i}`} value={it} index={i + 1} wide={wide} />)}
    </div>
  )
}
function PosterCard({ value, index, wide, big }) {
  const [imgOk, setImgOk] = useState(true)
  const p = parseMedia(value)
  const img = p && p.kind === 'image' ? p.src : (p && p.kind === 'video' ? p.thumb : null)
  const href = p && (p.kind === 'link' || p.kind === 'image' || p.kind === 'video') ? p.href : null
  // a plain name renders as-is; any URL falls back to its host, never the raw string
  const label = !p ? value : (p.kind === 'link' ? (p.host || value) : (hostOf(value) || value))

  const body = (img && imgOk) ? (
    <>
      <img src={img} alt={label} loading="lazy" onError={() => setImgOk(false)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(var(--void-rgb),.05) 40%, rgba(var(--void-rgb),.88) 100%)' }} />
      {p.kind === 'video' && (
        <div style={{ position: 'absolute', top: '10px', right: '10px', width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(var(--void-rgb),.55)', border: `1px solid ${SILVER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Play size={13} style={{ color: BONE, marginLeft: '2px' }} fill={BONE} />
        </div>
      )}
      <div style={{ position: 'absolute', left: '12px', right: '12px', bottom: '12px', fontFamily: 'Bebas Neue', fontSize: '18px', color: BONE, letterSpacing: '.03em', lineHeight: 1.02, textShadow: '0 1px 10px rgba(var(--shadow-rgb),.7)' }}>{label}</div>
    </>
  ) : (
    // typographic poster — no image, still a curated object in the void
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(var(--silver-rgb),.11) 0%, rgba(var(--silver-rgb),.02) 45%, var(--bg-deep-2) 100%)' }} />
      <div style={{ position: 'absolute', top: '10px', left: '12px', fontFamily: 'DM Mono', fontSize: '9px', color: SILVER, letterSpacing: '.16em' }}>{String(index).padStart(2, '0')}</div>
      <div style={{ position: 'absolute', top: '10px', right: '11px' }}><Mark type="diamond" size={9} color={SILVER} style={{ opacity: .5 }} /></div>
      <div style={{ position: 'absolute', bottom: '-10px', right: '-4px', fontFamily: 'Bebas Neue', fontSize: '120px', lineHeight: 1, opacity: .08, pointerEvents: 'none', color: BONE }}>{(label || '?')[0].toUpperCase()}</div>
      <div style={{ position: 'absolute', left: '12px', right: '12px', bottom: '14px', fontFamily: 'Bebas Neue', fontSize: '22px', color: BONE, letterSpacing: '.03em', lineHeight: 1.0 }}>{label}</div>
    </>
  )

  const card = (
    <div style={{ position: 'relative', flex: '0 0 auto', width: big ? '286px' : wide ? '196px' : '148px', height: big ? '410px' : wide ? '280px' : '212px', borderRadius: '14px', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, background: CARD, scrollSnapAlign: 'start', transition: 'transform .25s ease, border-color .25s ease', cursor: href ? 'pointer' : 'default' }}
      onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(var(--ink-rgb),.34)' }}
      onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = HAIR_HI }}>
      {body}
    </div>
  )
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{card}</a>
    : card
}

/* ---------- INFLUENCES: a typographic word-wall (bone · chrome · outline) ---------- */
function WordWall({ items, wide }) {
  const sizes = wide ? [56, 78, 42, 66, 48, 88, 44, 62] : [34, 46, 26, 40, 30, 52, 28, 38]
  return (
    <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: wide ? '16px 34px' : '10px 20px', maxWidth: wide ? '1180px' : undefined }}>
      {items.map((it, i) => {
        const p = parseMedia(it)
        const href = p && p.kind === 'link' ? p.href : null
        const text = p && p.kind === 'link' ? (p.host || it) : it
        const size = sizes[i % sizes.length]
        const mode = i % 3 // 0 bone · 1 outline · 2 silver (chrome belongs to the name — Ley 8)
        const base = { fontFamily: 'Bebas Neue', fontSize: `${size}px`, lineHeight: 0.98, letterSpacing: '.02em', cursor: href ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', gap: '4px', transition: 'opacity .2s' }
        const skin = mode === 1
          ? { color: 'transparent', WebkitTextStroke: `1px ${SILVER}` }
          : mode === 2 ? { color: SILVER } : { color: BONE }
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
  const cardStyle = { borderRadius: '16px', overflow: 'hidden', border: `1px solid ${featured ? 'rgba(var(--ink-rgb),.16)' : HAIR_HI}`, background: CARD, boxShadow: featured ? '0 14px 44px rgba(var(--shadow-rgb),.4)' : 'none' }

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
                : <div style={{ width: '100%', height: '100%', background: `linear-gradient(150deg, rgba(var(--silver-rgb),.14), var(--bg-deep-2))` }} />}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(var(--void-rgb),.2)' }}>
                {/* WebkitBackdropFilter was missing: Safari 17.6 and older
                    know only the prefixed property, so this circle lost its
                    blur entirely on exactly the phones the app is built for.
                    The inset highlight is the v11 edge treatment — the blur
                    is real here (its backdrop is the video's own thumbnail). */}
                <div style={{ width: featured ? '62px' : '52px', height: featured ? '62px' : '52px', borderRadius: '50%', background: 'rgba(var(--void-rgb),.5)', WebkitBackdropFilter: 'saturate(150%) blur(6px)', backdropFilter: 'saturate(150%) blur(6px)', border: `1px solid ${SILVER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 0.5px rgba(255,255,255,.4), 0 0 26px rgba(var(--silver-rgb),.3)' }}>
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
    <a href={p.href} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 18px', borderRadius: '14px', border: `1px solid ${HAIR_HI}`, background: CARD, textDecoration: 'none', transition: 'border-color .2s, transform .2s' }}
      onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(var(--ink-rgb),.34)'; e.currentTarget.style.transform = 'translateX(3px)' }}
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
