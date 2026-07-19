import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWide, useVeryWide } from '@/lib/useIsDesktop'
import { fetchForYou, reasonsFor, eventReasonsFor } from '@/lib/forYou'
import { socialReady, follow, unfollow } from '@/lib/social'
import { isOwnerFounder } from '@/lib/osAccess'
import SeedPill, { SEED_BORDER } from '@/components/SeedMark'
import { categoryMeta } from '@/lib/crafts'
import { vibeMeta } from '@/lib/match'
import { Plus, UserCheck } from 'lucide-react'
import VerifiedMark from './VerifiedMark'

/* =========================================================================
   FOR YOU — the discovery feed (D2 · 0022): local talent, worlds and
   rooms matched by taste + crafts + follows + event character. Taste-based,
   never follower-based — serendipity with purpose.

   PRIVACY LAW (the product's soul): the ranking may use private taste
   invisibly, but the UI names ONLY speakable overlaps — shared crafts,
   shared PUBLIC tastes, shared sounds, city (lib/forYou.js composes them).
   A high match with nothing nameable gets the quiet line, nothing more.

   Ley 6 — people ARE the content: faces and names dominate, person cards
   alternate two compositions so a long scroll breathes. Ley 14 — event
   cards carry their declared temperature. Ley 11 — an empty universe is
   an honest, quiet moment with a door to the brainstorm.
   ========================================================================= */

const VOID = '#0A0A0D'
const BONE = '#F2EEE6'
const BONE_MID = '#9B9891'
const BONE_LOW = '#5B5952'
const SILVER = '#C7C9D1'
const STAR = '#E8E9ED'
const CARD = '#0E0E13'
const HAIR = 'rgba(242,238,230,0.08)'
const HAIR_HI = 'rgba(242,238,230,0.15)'
const WARN = '#E5A0A0'

const safeImg = (raw) => (/^https?:\/\//i.test((raw || '').trim()) || (raw || '').startsWith('data:image/')) ? raw : ''
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase() : 'DATE TBA'

export default function ForYou({ user, onBrainstorm, onEveryone }) {
  const navigate = useNavigate()
  const wide = useWide()
  const veryWide = useVeryWide()   // >=1440px: the masonry breathes into a third column
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  // follow chips only render when the social layer can keep their promise
  // (Ley 9 — the socialReady probe, same doctrine as everywhere else)
  const [socialOn, setSocialOn] = useState(false)
  const [followOverride, setFollowOverride] = useState({})   // id → optimistic truth
  const [followErr, setFollowErr] = useState({})             // id → honest rollback voice
  // guardrail 4 in the for-you (v10 · N1): 0036 made the seed RANK here for
  // founders — 0040 makes it LABELED. Same derivation Community uses: the
  // /os SHOW SEED switch (localStorage) + the owner check. Display-gating
  // only — a non-owner's payload never carries a seed row to begin with.
  const [showSeed, setShowSeed] = useState(false)

  useEffect(() => {
    let alive = true
    socialReady().then((ok) => { if (alive) setSocialOn(ok) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    let seedPref = import.meta.env?.VITE_DISCOVERY_PREVIEW === 'true'
    try { seedPref = seedPref || localStorage.getItem('c4_seed_visible') === '1' } catch { /* private mode */ }
    if (!user || !seedPref) { setShowSeed(false); return undefined }
    isOwnerFounder().then((ok) => { if (alive) setShowSeed(!!ok) })
    return () => { alive = false }
  }, [user])

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchForYou({}).then((d) => { if (alive) { setData(d); setLoading(false) } })
    return () => { alive = false }
  }, [user?.id])

  // the rhythm: ~3 people, then a room, repeat — events run out first, fine.
  // A room without a slug has no door and doesn't render (Ley 9).
  // Seed rows (owner-only in the payload, 0040) honor the /os toggle the
  // way Community does: SHOW SEED off = seed hidden, never unlabeled
  // (review catch — the founder must never mistake a fixture for a member).
  const feed = useMemo(() => {
    const people = (data?.people || []).filter((p) => !p.is_demo || showSeed)
    const events = (data?.events || []).filter((ev) => ev?.slug)
    const out = []
    let e = 0
    people.forEach((p, i) => {
      out.push({ kind: 'person', p, flip: i % 2 === 1 })
      if ((i + 1) % 3 === 0 && e < events.length) out.push({ kind: 'event', ev: events[e++] })
    })
    while (e < events.length) out.push({ kind: 'event', ev: events[e++] })
    return out
  }, [data, showSeed])

  const isFollowing = (p) => followOverride[p.id] ?? !!p.i_follow
  // optimistic + honest rollback WITH a voice (the UserProfile doctrine);
  // follow() itself retries through ensure_own_profile on 23503
  const toggleFollow = async (p) => {
    if (!user?.id) return
    const was = isFollowing(p)
    setFollowOverride((s) => ({ ...s, [p.id]: !was }))
    setFollowErr((s) => ({ ...s, [p.id]: '' }))
    try {
      if (was) await unfollow(user.id, p.id)
      else await follow(user.id, p.id)
    } catch (err) {
      setFollowOverride((s) => ({ ...s, [p.id]: was }))
      setFollowErr((s) => ({ ...s, [p.id]: err?.message || "that didn't land — try again" }))
    }
  }

  const city = (data?.city || '').toLowerCase()
  const empty = !loading && (!data || (!data.people?.length && !data.events?.length))

  return (
    /* wide (>=1024): fill the composed frame Community already sets (1440-capped,
       padded) — NOT an iPhone column centered in a desert (Ley 12 + Ley 4). The
       header and the masonry share the same left edge. Mobile stays a single
       vertical column, untouched. */
    <div>

      {/* the kicker — where the matching stands, city lowercase-proud */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '9px', marginTop: '18px' }}>
        <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '9px', color: SILVER }}>◇</span>
        <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.26em' }}>
          MATCHED BY TASTE{city ? ` · ${city}` : ''}
        </span>
      </div>

      {loading ? (
        /* three dim hairline frames — no spinner jank */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} aria-hidden style={{ height: i === 1 ? '108px' : '176px', borderRadius: '16px', border: `1px solid ${HAIR}`, background: 'rgba(242,238,230,.015)' }} />
          ))}
        </div>
      ) : empty ? (
        /* the honest empty — a quiet moment, two doors (Ley 11) */
        <div data-testid="foryou-empty" style={{ minHeight: '52vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', textAlign: 'center', padding: '40px 24px' }}>
          <span className="rise" aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '11px', color: BONE_LOW, animationDelay: '0ms' }}>◇</span>
          <div className="rise" style={{ fontFamily: 'DM Sans', fontSize: '14.5px', color: BONE_MID, lineHeight: 1.6, maxWidth: '280px', animationDelay: '70ms' }}>
            the universe hasn't heard your taste yet.
          </div>
          {/* buttons WRAPPED in .rise (never on the button itself — a filled
              rise animation outranks :active; plan 005's settled correction) */}
          <div className="rise" style={{ animationDelay: '140ms', display: 'flex' }}>
            <button className="pressable" onClick={onBrainstorm}
              style={{ marginTop: '8px', background: BONE, border: 'none', borderRadius: '11px', padding: '13px 24px', color: VOID, fontFamily: 'DM Sans', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              brainstorm your taste →
            </button>
          </div>
          <div className="rise" style={{ animationDelay: '210ms', display: 'flex' }}>
            <button className="pressable" onClick={onEveryone}
              style={{ background: 'transparent', border: 'none', padding: '6px 10px', cursor: 'pointer', fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.18em' }}>
              or wander everyone ↓
            </button>
          </div>
        </div>
      ) : (
        /* wide: a real editorial spread — a CSS masonry (2 cols, 3 at >=1440)
           the person + event cards flow through, filling the composed width.
           Mobile: the single vertical column, byte-for-byte as before. */
        <div data-testid="foryou-feed" className="feed-in" style={wide
          ? { columnCount: veryWide ? 3 : 2, columnGap: '16px', marginTop: '14px' }
          : { display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
          {feed.map((item) => {
            const key = item.kind === 'person' ? item.p.id : item.ev.slug
            const card = item.kind === 'person' ? (
              <PersonCard key={key} p={item.p} flip={item.flip} showSeed={showSeed}
                following={isFollowing(item.p)} canFollow={socialOn} err={followErr[item.p.id]}
                onOpen={() => navigate('/user/' + item.p.id)} onFollow={() => toggleFollow(item.p)} />
            ) : (
              <EventCard key={key} ev={item.ev} onOpen={() => navigate('/e/' + item.ev.slug)} />
            )
            // the masonry column-break wrapper only exists on wide; mobile
            // returns the bare card so its vertical rhythm never changes
            return wide
              ? <div key={key} style={{ breakInside: 'avoid', WebkitColumnBreakInside: 'avoid', marginBottom: '16px' }}>{card}</div>
              : card
          })}
        </div>
      )}
    </div>
  )
}

/* ---- a person, as the content (Ley 6) ----
   Two compositions alternate so the scroll breathes: avatar-over-cover
   (the museum face) and avatar-left (the ledger line). Same anatomy in
   both: identity → speakable reasons → one quiet action. */
function PersonCard({ p, flip, showSeed, following, canFollow, err, onOpen, onFollow }) {
  const cover = safeImg(p.cover_url)
  const avatar = safeImg(p.avatar_url)
  const name = p.name || p.username || 'Unnamed'
  // guardrail 4 (v10): a seed world in the feed is ALWAYS marked — the pill
  // rides the payload truth (is_demo), never the toggle (review catch: a
  // founder with SHOW SEED off must see no seed, not unlabeled seed — the
  // feed filter above handles hiding; this handles honesty). A member's
  // payload carries is_demo: false by construction (0040). ONE source:
  // the shared SeedMark pill.
  const isSeed = !!p.is_demo
  const seedBadge = isSeed ? <SeedPill is_demo={p.is_demo} /> : null
  const initial = (name[0] || '?').toUpperCase()
  const crafts = Array.isArray(p.crafts) ? p.crafts : []
  const primary = crafts.find((c) => c.is_primary) || crafts[0]
  const meta = primary ? categoryMeta(primary.category) : null
  const reasons = reasonsFor(p)
  const backdrop = cover || avatar
  const keyOpen = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onOpen() } }

  /* the shared lower anatomy: crafts line → reasons → action row */
  const body = (
    <>
      {primary && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px', minWidth: 0, overflow: 'hidden' }}>
          <span style={{ fontFamily: 'DM Mono', fontSize: '8.5px', color: `rgb(${meta.tint})`, letterSpacing: '.12em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{primary.name}</span>
          {crafts.length > 1 && <span style={{ fontFamily: 'DM Mono', fontSize: '7.5px', color: BONE_LOW, letterSpacing: '.1em', flexShrink: 0 }}>+{crafts.length - 1}</span>}
        </div>
      )}
      {/* the speakable reasons — nothing private ever lands here */}
      <div data-testid="foryou-reasons" style={{ fontFamily: 'DM Mono', fontSize: '9px', color: SILVER, letterSpacing: '.08em', lineHeight: 1.65, marginTop: '8px' }}>
        {reasons.join(' · ')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '11px' }}>
        {canFollow && (
          <button className="pressable" onClick={(ev) => { ev.stopPropagation(); onFollow() }}
            aria-label={following ? `Unfollow ${name}` : `Follow ${name}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: following ? 'rgba(199,201,209,.10)' : 'transparent', border: `1px solid ${following ? 'rgba(199,201,209,.45)' : HAIR_HI}`, borderRadius: '100px', padding: '6px 14px', color: following ? SILVER : BONE, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.16em', textTransform: 'uppercase', cursor: 'pointer', transition: 'background .2s, border-color .2s, color .2s, transform .2s' }}>
            {following ? <UserCheck size={10} /> : <Plus size={10} />}
            {following ? 'Connected' : 'Follow'}
          </button>
        )}
        {p.follows_me && !following && (
          <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.14em', textTransform: 'uppercase', border: `1px solid ${HAIR}`, borderRadius: '100px', padding: '4px 10px' }}>follows you</span>
        )}
      </div>
      {err && <div style={{ fontFamily: 'DM Mono', fontSize: '8.5px', color: WARN, letterSpacing: '.04em', marginTop: '7px' }}>{err}</div>}
    </>
  )

  if (!flip) {
    /* composition A — avatar over cover: the backdrop low, the face on top */
    return (
      <div data-testid={`foryou-person-${p.id}`} className="pressable" role="button" tabIndex={0}
        aria-label={`Open ${name}'s world`} onClick={onOpen} onKeyDown={keyOpen}
        style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: `1px solid ${isSeed ? SEED_BORDER : HAIR_HI}`, background: CARD, cursor: 'pointer' }}>
        <div style={{ position: 'relative', height: '132px', overflow: 'hidden', background: VOID }}>
          {backdrop
            ? <img src={backdrop} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bebas Neue', fontSize: '110px', lineHeight: 1, color: 'rgba(242,238,230,.06)' }}>{initial}</span>}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(7,8,14,0) 25%, #0E0E13 100%)' }} />
          {p.verified && <span title="In The Collectiv4 network" aria-label="Verified — in The Collectiv4 network" style={{ position: 'absolute', top: '10px', right: '10px', display: 'inline-flex' }}><VerifiedMark size={16} /></span>}
          {seedBadge && <span style={{ position: 'absolute', top: '9px', left: '9px', display: 'inline-flex' }}>{seedBadge}</span>}
        </div>
        <div style={{ position: 'absolute', left: '14px', top: '108px', width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${SILVER}`, background: CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,.5)', zIndex: 2 }}>
          {avatar
            ? <img src={avatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontFamily: 'Bebas Neue', fontSize: '21px', color: BONE }}>{initial}</span>}
        </div>
        <div style={{ padding: '30px 16px 15px' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: '25px', letterSpacing: '.02em', lineHeight: 1, color: BONE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          {body}
        </div>
      </div>
    )
  }

  /* composition B — avatar left, the cover only a dim wash behind (Ley 3:
     the name stays legible over ANY image, so the scrim is strong) */
  return (
    <div data-testid={`foryou-person-${p.id}`} className="pressable" role="button" tabIndex={0}
      aria-label={`Open ${name}'s world`} onClick={onOpen} onKeyDown={keyOpen}
      style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: `1px solid ${isSeed ? SEED_BORDER : HAIR_HI}`, background: CARD, cursor: 'pointer' }}>
      {cover && (
        <>
          <img src={cover} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: .2 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(10,10,13,.94) 0%, rgba(10,10,13,.72) 55%, rgba(10,10,13,.9) 100%)' }} />
        </>
      )}
      <div style={{ position: 'relative', display: 'flex', gap: '14px', padding: '16px' }}>
        <div style={{ width: '54px', height: '54px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${SILVER}`, background: CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {avatar
            ? <img src={avatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontFamily: 'Bebas Neue', fontSize: '23px', color: BONE }}>{initial}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0 }}>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '23px', letterSpacing: '.02em', lineHeight: 1, color: BONE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{name}</div>
            {p.verified && <VerifiedMark size={14} style={{ flexShrink: 0 }} />}
            {seedBadge && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{seedBadge}</span>}
          </div>
          {body}
        </div>
      </div>
    </div>
  )
}

/* ---- a room in the stream — it carries its declared temperature (Ley 14);
   undeclared renders clean, no invented character (Ley 11) ---- */
function EventCard({ ev, onOpen }) {
  const meta = ev.kind ? vibeMeta(ev.kind) : null
  const pulseClass = meta?.pulse === 'warm' ? 'temp-warm' : meta?.pulse === 'electric' ? 'temp-electric' : undefined
  const sounds = (Array.isArray(ev.sounds) ? ev.sounds : []).filter(Boolean).slice(0, 3)
  const reasons = eventReasonsFor(ev)
  const place = ev.venue || ev.city

  return (
    <div data-testid={`foryou-event-${ev.slug}`} className="pressable" role="button" tabIndex={0}
      aria-label={`Enter ${ev.title}`} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: `1px solid ${meta ? `rgba(${meta.tint},.28)` : HAIR_HI}`, background: CARD, cursor: 'pointer', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.24em', textTransform: 'uppercase' }}>A room</span>
        {meta && (
          <span className={pulseClass} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', border: `1px solid rgba(${meta.tint},.4)`, background: `rgba(${meta.tint},.06)`, borderRadius: '100px', padding: '3px 11px' }}>
            <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '9px', color: `rgb(${meta.tint})` }}>{meta.mark}</span>
            <span style={{ fontFamily: 'DM Mono', fontSize: '8.5px', letterSpacing: '.18em', textTransform: 'uppercase', color: BONE }}>{meta.label}</span>
          </span>
        )}
      </div>
      <div style={{ fontFamily: 'Bebas Neue', fontSize: '28px', letterSpacing: '.01em', lineHeight: .95, color: BONE, marginTop: '10px' }}>{ev.title}</div>
      <div style={{ fontFamily: 'DM Mono', fontSize: '9.5px', color: BONE_MID, letterSpacing: '.08em', marginTop: '8px' }}>
        {fmtDate(ev.event_date)}{place ? ` · ${String(place).toUpperCase()}` : ''}
      </div>
      {sounds.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
          {sounds.map((s) => (
            <span key={s} style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_MID, letterSpacing: '.1em', textTransform: 'lowercase', border: `1px solid ${HAIR}`, borderRadius: '100px', padding: '3px 9px' }}>{s}</span>
          ))}
        </div>
      )}
      {reasons.length > 0 && (
        <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: SILVER, letterSpacing: '.08em', lineHeight: 1.65, marginTop: '10px' }}>
          {reasons.join(' · ')}
        </div>
      )}
    </div>
  )
}
