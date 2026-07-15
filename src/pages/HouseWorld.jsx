import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/api/supabase'
import { useWide } from '@/lib/useIsDesktop'
import Mark from '@/components/Mark'
import { fetchCraftsForProfiles, categoryMeta } from '@/lib/crafts'
import { normListings, priceLabel, KINDS } from '@/lib/listings'
import { Calendar, MapPin, ArrowUpRight, ArrowRight, BadgeCheck, Loader2 } from 'lucide-react'

/* =========================================================================
   THE HOUSE WORLD — /c4 (D4, the flagship).
   The Collectiv4's own world on its own platform: the proof of concept
   that teaches what a world IS without explaining it. When the domain
   points at the platform, this is the first thing a visitor sees.

   Composed from REAL data only (Ley 11):
     THE ROOMS    — the events engine, featured (real rows from events)
     THE NETWORK  — verified members' worlds, spotlit (real profiles)
     THE CULTURE  — the 4-language (brand canon, not invented data)
     THE OFFER    — live pieces by verified members (real listings)
   Both founders credited, always (canon).
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
const CHROME = 'linear-gradient(100deg,#F6F6FA 0%,#A6ABBA 26%,#FCFCFE 50%,#8E94A6 73%,#EFEFF4 100%)' // deck formula — jewelry, one moment per screen (v8 D3)
const chromeText = { background: CHROME, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }

const safeImg = (raw) => (/^https?:\/\//i.test((raw || '').trim()) || (raw || '').startsWith('data:image/')) ? raw : ''
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase() : 'DATE TBA'
const isPast = (iso) => !!iso && new Date(iso) < new Date(new Date().toDateString())

/* the 4-language — brand canon, spoken short (never corporate) */
const CULTURE = [
  { mark: 'dot',      title: 'THE 4 MEANS INTENTION', line: 'What are we doing this for? What are we living for? For the people.' },
  { mark: 'ring',     title: 'WE ARE ALL ONE',        line: 'Division is artificial. Every world is its own — and all of them connect.' },
  { mark: 'diamond',  title: 'REAL LIFE IS SCARCE',   line: 'Digitally connected, actually alone. We build the room that brings you back.' },
  { mark: 'cross',    title: 'WORK THAT ECHOES',      line: 'Not dopamine content. Art with weight — what we do here echoes.' },
]

export default function HouseWorld() {
  const navigate = useNavigate()
  const wide = useWide()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState([])
  const [network, setNetwork] = useState([])
  const [craftsBy, setCraftsBy] = useState(new Map())
  const [offer, setOffer] = useState([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [evRes, netRes, listRes] = await Promise.all([
        // is_house=true: THE ROOMS on the HOUSE world are the house's own
        // nights — a member's event must never wear the C4 flagship's
        // authorship (review catch). Members' rooms live in the EVENT tab.
        supabase.from('events')
          .select('id,slug,title,edition,event_date,doors,venue,city,cover_url,status,tiers,vibe')
          .eq('status', 'published').eq('is_test', false).eq('is_house', true)
          .order('event_date', { ascending: true }),
        supabase.from('profiles')
          .select('id,full_name,username,discipline,avatar_url,cover_url,tagline,verified,is_demo')
          .eq('verified', true).eq('is_demo', false)
          .order('created_at', { ascending: true }).limit(8),
        supabase.from('listings')
          .select('id,profile_id,kind,title,price_cents,images,status,created_at')
          .eq('status', 'live')
          .order('created_at', { ascending: false }).limit(24),
      ])
      if (!alive) return
      setEvents(evRes.data || [])
      const net = netRes.data || []
      setNetwork(net)
      if (net.length) fetchCraftsForProfiles(net.map((p) => p.id)).then((m) => { if (alive) setCraftsBy(m) })
      // THE OFFER shows only verified members' live pieces — the house
      // curates; when a C4 account lists merch it leads this wall
      const ls = normListings(listRes.data)
      if (ls.length) {
        const ids = [...new Set(ls.map((l) => l.profile_id))]
        const { data: sellers } = await supabase.from('profiles')
          .select('id,full_name,verified,is_demo').in('id', ids)
        if (!alive) return
        const okSeller = new Set((sellers || []).filter((s) => s.verified && !s.is_demo).map((s) => s.id))
        const sellerName = Object.fromEntries((sellers || []).map((s) => [s.id, s.full_name]))
        setOffer(ls.filter((l) => okSeller.has(l.profile_id)).slice(0, 6).map((l) => ({ ...l, seller: sellerName[l.profile_id] })))
      }
      setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  const upcoming = events.filter((e) => !isPast(e.event_date))
  const past = events.filter((e) => isPast(e.event_date)).sort((a, b) => new Date(b.event_date) - new Date(a.event_date))
  const featured = upcoming[0] || null
  const lastRoom = !featured ? past[0] : null

  const frame = wide
    ? { maxWidth: '1440px', margin: '0 auto', paddingLeft: 'clamp(40px, 5vw, 76px)', paddingRight: 'clamp(40px, 5vw, 76px)' }
    : { paddingLeft: '24px', paddingRight: '24px' }

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: 'transparent', overflowX: 'hidden' }}>
      {/* the sky is the app's shared atmosphere (v8 D1) — /c4 is the stage:
          DENSE register, links alive. The flagship wears the full galaxy. */}

      {/* the house marquee — the welcome, once (Ley 8) */}
      <div style={{ position: 'relative', zIndex: 3, borderBottom: `1px solid ${HAIR}`, background: VOID }}>
        <div style={{ ...frame, padding: wide ? '9px clamp(40px, 5vw, 76px) 7px' : '9px 24px 7px', display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '8px', color: SILVER, opacity: .55, flexShrink: 0 }}>✦</span>
          <span style={{ fontFamily: 'Bebas Neue', fontSize: '13px', letterSpacing: '.2em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: .65, color: BONE }}>WE ARE ALL ONE · FOR THE PEOPLE · 4</span>
          <span aria-hidden style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${HAIR}, transparent)` }} />
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 2, ...frame, paddingTop: wide ? '52px' : '34px', paddingBottom: wide ? '90px' : '60px' }}>

        {/* ============ HERO — the house identity ============ */}
        <div style={{ maxWidth: wide ? '760px' : undefined }}>
          <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: wide ? '.34em' : '.28em', textTransform: 'uppercase', marginBottom: '10px' }}>◇ the house world · Houston</div>
          <h1 style={{ fontFamily: 'Bebas Neue', fontSize: wide ? 'clamp(72px, 8vw, 110px)' : '56px', letterSpacing: '.01em', lineHeight: .88, margin: 0, ...chromeText }}>THE COLLECTIV4</h1>
          <p style={{ fontFamily: 'DM Sans', fontSize: wide ? '17px' : '14.5px', color: BONE_MID, lineHeight: 1.7, margin: '18px 0 0', maxWidth: '560px' }}>
            A creative movement at the intersection of music, art and human connection.
            Every artist here has a world — a museum of what they make. The rooms are where those worlds meet.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '20px' }}>
            <button className="pressable" onClick={() => navigate('/community')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', background: BONE, border: 'none', borderRadius: '11px', padding: '12px 22px', color: VOID, fontFamily: 'Bebas Neue', fontSize: '15px', letterSpacing: '.06em', cursor: 'pointer', boxShadow: '0 4px 20px rgba(242,238,230,.14)' }}>
              MEET THE COMMUNITY <ArrowRight size={13} />
            </button>
            <button className="pressable" onClick={() => navigate('/')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', background: 'rgba(242,238,230,.05)', border: `1px solid ${HAIR_HI}`, borderRadius: '11px', padding: '12px 22px', color: BONE, fontFamily: 'Bebas Neue', fontSize: '15px', letterSpacing: '.06em', cursor: 'pointer' }}>
              THE ROOMS
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '70px 0' }}>
            <Loader2 size={20} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <>
            {/* ============ 01 · THE ROOMS — the events engine ============ */}
            <Chapter n="01" mark="dot" label="THE ROOMS" kicker={wide ? 'Ran By Artists · the engine' : 'Ran By Artists'} wide={wide}>
              {featured ? (
                <HouseRoom e={featured} wide={wide} featured onOpen={() => navigate(featured.slug ? `/e/${featured.slug}` : '/')} />
              ) : lastRoom ? (
                <div style={wide ? { display: 'grid', gridTemplateColumns: 'minmax(0,5fr) minmax(0,7fr)', gap: '22px', alignItems: 'stretch' } : { display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ padding: wide ? '34px 30px' : '26px 22px', borderRadius: '18px', border: `1px solid ${HAIR_HI}`, background: 'linear-gradient(150deg, rgba(242,238,230,.05), rgba(242,238,230,.01))', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '30px' : '24px', color: BONE, lineHeight: .95 }}>THE NEXT ONE IS BEING BUILT</div>
                    <p style={{ fontFamily: 'DM Sans', fontSize: '13px', color: BONE_MID, lineHeight: 1.6, margin: '10px 0 0' }}>
                      Stay close — the room always comes back. Meanwhile, the last one keeps the door warm.
                    </p>
                  </div>
                  <HouseRoom e={lastRoom} wide={wide} pastRoom onOpen={() => navigate(lastRoom.slug ? `/e/${lastRoom.slug}` : '/editions')} />
                </div>
              ) : (
                <p style={{ fontFamily: 'DM Mono', fontSize: '10px', color: BONE_LOW, letterSpacing: '.1em' }}>the first room is being built.</p>
              )}
              {upcoming.length > 1 && (
                <div style={{ display: wide ? 'grid' : 'flex', ...(wide ? { gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' } : { flexDirection: 'column' }), gap: '14px', marginTop: '16px' }}>
                  {upcoming.slice(1, 4).map((e) => (
                    <HouseRoom key={e.id} e={e} wide={wide} onOpen={() => navigate(e.slug ? `/e/${e.slug}` : '/')} />
                  ))}
                </div>
              )}
            </Chapter>

            {/* ============ 02 · THE NETWORK — worlds, spotlit ============ */}
            {network.length > 0 && (
              <Chapter n="02" mark="ring" label="THE NETWORK" kicker="verified · in the room" wide={wide}>
                <div className="no-scrollbar" style={wide
                  ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '14px' }
                  : { display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '6px', WebkitOverflowScrolling: 'touch' }}>
                  {network.map((p) => {
                    const crafts = craftsBy.get(p.id) || []
                    const lead = crafts[0]
                    const meta = lead ? categoryMeta(lead.category) : { tint: '199,201,209' }
                    const avatar = safeImg(p.avatar_url)
                    const name = p.full_name || 'Unnamed'
                    return (
                      <div key={p.id} className="disc-card pressable" role="button" tabIndex={0} aria-label={`Open ${name}'s world`}
                        onClick={() => navigate('/user/' + p.id)}
                        onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); navigate('/user/' + p.id) } }}
                        style={{ flexShrink: 0, minWidth: wide ? 0 : '196px', display: 'flex', alignItems: 'center', gap: '13px', border: `1px solid ${HAIR_HI}`, borderRadius: '14px', background: CARD, padding: '14px 15px', cursor: 'pointer' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', border: `1px solid rgba(${meta.tint},.5)`, background: VOID, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 12px rgba(${meta.tint},.1)` }}>
                          {avatar
                            ? <img src={avatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ fontFamily: 'Bebas Neue', fontSize: '18px', color: BONE }}>{name[0].toUpperCase()}</span>}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                            <span className="disc-name" style={{ fontFamily: 'Bebas Neue', fontSize: '19px', letterSpacing: '.02em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                            <BadgeCheck size={13} style={{ color: STAR, flexShrink: 0, filter: 'drop-shadow(0 0 5px rgba(232,233,237,.5))' }} />
                          </div>
                          {/* the craft is identity — it clamps to two lines,
                              never dies mid-word (panel catch, Ley 5) */}
                          <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: lead ? `rgb(${meta.tint})` : BONE_LOW, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: '5px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>
                            {lead ? `${lead.name}${crafts.length > 1 ? ` +${crafts.length - 1}` : ''}` : (p.discipline || 'in the network')}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Chapter>
            )}

            {/* ============ 03 · THE CULTURE — the 4-language ============ */}
            <Chapter n={network.length ? '03' : '02'} mark="diamond" label="THE CULTURE" kicker="the 4-language" wide={wide}>
              <div style={wide ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '14px' } : { display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {CULTURE.map((c) => (
                  <div key={c.title} style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', border: `1px solid ${HAIR}`, borderRadius: '15px', background: 'rgba(242,238,230,.02)', padding: wide ? '20px 22px' : '16px 18px' }}>
                    <Mark type={c.mark} size={13} color={SILVER} style={{ flexShrink: 0, marginTop: '4px', opacity: .85 }} />
                    <div>
                      <div style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '21px' : '18px', color: BONE, letterSpacing: '.04em', lineHeight: 1 }}>{c.title}</div>
                      <p style={{ fontFamily: 'DM Sans', fontSize: '12.5px', color: BONE_MID, lineHeight: 1.6, margin: '7px 0 0' }}>{c.line}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Chapter>

            {/* ============ 04 · THE OFFER — real pieces, real prices ============ */}
            <Chapter n={network.length ? '04' : '03'} mark="square" label="THE OFFER" kicker="by the network · real prices" wide={wide}>
              {offer.length > 0 ? (
                <div className="no-scrollbar" style={wide
                  ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '14px' }
                  : { display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '6px', WebkitOverflowScrolling: 'touch' }}>
                  {offer.map((l) => {
                    const img = safeImg(l.images?.[0]?.url)
                    return (
                      <div key={l.id} className="disc-card pressable" role="button" tabIndex={0} aria-label={`Open ${l.title}`}
                        onClick={() => navigate('/user/' + l.profile_id)}
                        onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); navigate('/user/' + l.profile_id) } }}
                        style={{ flexShrink: 0, minWidth: wide ? 0 : '186px', borderRadius: '14px', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, background: CARD, cursor: 'pointer' }}>
                        <div className="disc-banner" style={{ position: 'relative', height: '120px', background: VOID, overflow: 'hidden' }}>
                          {img
                            ? <img src={img} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(150deg, rgba(199,201,209,.1), transparent)' }} />}
                          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(7,8,14,0) 40%, rgba(14,14,19,.92) 100%)' }} />
                          <span style={{ position: 'absolute', top: '9px', left: '10px', fontFamily: 'DM Mono', fontSize: '7px', letterSpacing: '.18em', color: BONE_MID, border: `1px solid ${HAIR}`, borderRadius: '100px', padding: '3px 8px', background: 'rgba(7,8,14,.5)', textTransform: 'uppercase' }}>{KINDS[l.kind]?.label || 'PIECE'}</span>
                        </div>
                        <div style={{ padding: '11px 13px' }}>
                          <div style={{ fontFamily: 'DM Sans', fontSize: '12.5px', fontWeight: 600, color: BONE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '5px' }}>
                            <span style={{ fontFamily: 'Bebas Neue', fontSize: '17px', color: BONE }}>{priceLabel(l.price_cents)}</span>
                            {l.seller && <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.08em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.seller}</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ padding: '22px 22px', borderRadius: '15px', border: `1px solid ${HAIR_HI}`, background: 'linear-gradient(150deg, rgba(199,201,209,.04), rgba(199,201,209,.01))', maxWidth: '480px' }}>
                  <p style={{ fontFamily: 'DM Sans', fontSize: '13px', color: BONE_MID, lineHeight: 1.6, margin: 0 }}>
                    The wall is being hung — pieces and services by the network land here, with real prices. The drops come through the rooms first.
                  </p>
                </div>
              )}
            </Chapter>
          </>
        )}

        {/* ============ the signature — both founders, always ============ */}
        <div style={{ marginTop: wide ? '80px' : '56px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ height: '1px', flex: 1, background: `linear-gradient(90deg,transparent,${HAIR_HI})` }} />
          <Mark type="diamond" size={9} color={SILVER} style={{ opacity: .8, flexShrink: 0 }} />
          <span style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.2em', color: BONE_LOW, textTransform: 'uppercase', textAlign: 'center' }}>
            Pato Durán & Diego Villaseñor · Founders
          </span>
          <span style={{ fontFamily: 'Bebas Neue', fontSize: '16px', color: SILVER }}>4</span>
          <div style={{ height: '1px', flex: 1, background: `linear-gradient(270deg,transparent,${HAIR_HI})` }} />
        </div>
      </div>

      {/* grain lives in the app-wide varnish now (v8: one grain, 5%, over all) */}
    </div>
  )
}

/* ---- a chapter of the house world — same editorial spine as the museums ---- */
function Chapter({ n, mark, label, kicker, wide, children }) {
  return (
    <div style={{ marginTop: wide ? '74px' : '50px', position: 'relative' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: wide ? '16px' : '12px', marginBottom: wide ? '24px' : '18px' }}>
        <span aria-hidden style={{ position: 'absolute', left: wide ? '-10px' : '-6px', bottom: '-8px', fontFamily: 'Bebas Neue', fontSize: wide ? '96px' : '62px', lineHeight: 1, color: BONE, opacity: .05, pointerEvents: 'none', userSelect: 'none' }}>{n}</span>
        <Mark type={mark} size={wide ? 16 : 14} color={SILVER} style={{ flexShrink: 0, opacity: .9, position: 'relative' }} />
        <span style={{ fontFamily: 'DM Mono', fontSize: '11px', color: BONE_MID, letterSpacing: '.1em', flexShrink: 0, position: 'relative' }}>{n}</span>
        <span style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '36px' : '27px', letterSpacing: '.05em', lineHeight: 1, flexShrink: 0, color: BONE, position: 'relative' }}>{label}</span>
        <div style={{ flex: 1, minWidth: '14px', height: '1px', background: `linear-gradient(90deg, ${HAIR_HI}, transparent)` }} />
        {/* the kicker may shrink and trim — it must never touch the viewport
            edge on a phone (panel catch) */}
        {kicker && <span style={{ fontFamily: 'DM Mono', fontSize: wide ? '9px' : '8px', letterSpacing: '.26em', color: BONE_LOW, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{kicker}</span>}
      </div>
      {children}
    </div>
  )
}

/* ---- a room card in the house world's engine ---- */
function HouseRoom({ e, wide, featured, pastRoom, onOpen }) {
  const cover = safeImg(e.cover_url)
  const availableTiers = (e.tiers || []).filter((t) => t.status === 'available')
  const fromPrice = availableTiers.length ? Math.min(...availableTiers.map((t) => t.price)) / 100 : null
  return (
    <div onClick={onOpen} className="disc-card pressable" role="button" tabIndex={0} aria-label={`Open ${e.title}`}
      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onOpen() } }}
      style={{ position: 'relative', borderRadius: featured ? '20px' : '16px', overflow: 'hidden', border: `1px solid ${featured ? 'rgba(242,238,230,.16)' : HAIR_HI}`, background: CARD, cursor: 'pointer', boxShadow: featured ? '0 18px 60px rgba(0,0,0,.45)' : 'none' }}>
      <div className="disc-banner" style={{ position: 'relative', height: featured ? (wide ? '280px' : '190px') : '136px', overflow: 'hidden', background: VOID }}>
        {cover
          ? <img src={cover} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (
            /* no flyer → a DESIGNED void, never a black slab (panel catch):
               the house glow + the 4 monogram, faint, centered */
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 90% at 30% 0%, rgba(242,238,230,.08) 0%, transparent 60%), ${VOID}` }}>
              <span aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bebas Neue', fontSize: featured ? '120px' : '76px', lineHeight: 1, color: BONE, opacity: .06, userSelect: 'none' }}>4</span>
            </div>
          )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(7,8,14,.08) 25%, rgba(7,8,14,.6) 65%, rgba(9,9,14,.96) 100%)' }} />
        <span style={{ position: 'absolute', top: '12px', left: '12px', fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.18em', color: pastRoom ? BONE_MID : BONE, border: `1px solid ${pastRoom ? HAIR : 'rgba(242,238,230,.3)'}`, borderRadius: '100px', padding: '3px 10px', background: 'rgba(7,8,14,.55)', textTransform: 'uppercase' }}>
          {pastRoom ? 'the last room' : (e.edition || 'Ran By Artists')}
        </span>
        <div style={{ position: 'absolute', left: '16px', right: '16px', bottom: '13px' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: featured ? (wide ? '44px' : '32px') : '25px', letterSpacing: '.02em', lineHeight: .9, color: BONE, textShadow: '0 2px 20px rgba(0,0,0,.6)' }}>{e.title}</div>
        </div>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          <Calendar size={10} style={{ color: BONE_LOW }} />
          <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: BONE_MID, letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{fmtDate(e.event_date)}</span>
        </span>
        {(e.venue || e.city) && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
            <MapPin size={10} style={{ color: BONE_LOW, flexShrink: 0 }} />
            <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: BONE_LOW, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.venue || e.city}</span>
          </span>
        )}
        {fromPrice != null && <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_MID, letterSpacing: '.06em' }}>from ${fromPrice}</span>}
        <ArrowUpRight size={14} style={{ color: SILVER, marginLeft: 'auto', flexShrink: 0 }} />
      </div>
    </div>
  )
}
