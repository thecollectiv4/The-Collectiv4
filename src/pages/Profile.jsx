import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { useLiveEvent } from '@/lib/useLiveEvent'
import { LogOut, Calendar, MapPin, Clock, ChevronRight, Copy, Check } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import ProfileMuseum from '@/components/ProfileMuseum'
import AuthResolving from '@/components/AuthResolving'
import { uploadWorldImage, removeWorldImages, worldPathFromUrl } from '@/lib/worldStorage'
import { fetchWorldPosts, deleteWorldPost } from '@/lib/worldPosts'

export default function Profile() {
  const { user, loading: authLoading, signOut } = useAuth()
  const navigate = useNavigate()
  const live = useLiveEvent()
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [ticket, setTicket] = useState(null)
  const [ticketEvent, setTicketEvent] = useState(null)  // the ticket's OWN event row — never the live event's name on someone else's ticket
  const [attended, setAttended] = useState([])          // real past events this user held a confirmed ticket for
  const [copied, setCopied] = useState(false)

  // Three-way guard: loading · authenticated · unauthenticated. On a hard load
  // (direct URL, the confirmation email's CTA) this effect fires BEFORE Supabase
  // rehydrates the session from storage — user is null because getSession() hasn't
  // resolved yet, not because the visitor is signed out. Never redirect on an
  // unresolved identity; only a CONFIRMED unauthenticated state sends to /auth.
  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/auth'); return }
    load()
  }, [user, authLoading])

  // CREATE central posts from anywhere in the app — when it lands one while
  // this museum is mounted, the timeline refreshes without a hard reload.
  useEffect(() => {
    if (!user) return
    const onPosted = () => fetchWorldPosts(user.id).then(setPosts)
    window.addEventListener('c4:posted', onPosted)
    return () => window.removeEventListener('c4:posted', onPosted)
  }, [user])

  // Cosmos holding state while identity resolves (or right before the redirect fires).
  if (authLoading || !user) return <AuthResolving />

  const load = async () => {
    let { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!data) {
      const nm = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
      // user_id is NOT NULL on the (Base44-era) profiles table — omitting it made
      // this insert fail silently, so real signups never got a profile row. Set it
      // to the auth uid (same as id) so first-profile creation actually succeeds.
      // username starts NULL, never '' — profiles_username_key is UNIQUE, so the
      // SECOND ''-handle member would hit a duplicate-key error the old code
      // swallowed, and every later "save" would update ZERO rows in silence
      // (caught live by the QA walkthrough, 11 jul). NULLs never collide.
      // city starts EMPTY — a location the user never claimed is invented data.
      const { data: newP, error: insErr } = await supabase.from('profiles').insert({
        id: user.id, user_id: user.id, full_name: nm, username: null, bio: '', city: ''
      }).select().single()
      data = newP
      if (!data) {
        // insert lost a race or collided — the row may exist now; read it back
        // rather than building a ghost the DB never accepts writes for.
        console.error('Profile insert failed:', insErr)
        const { data: again } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        data = again || { id: user.id, full_name: nm, username: null, bio: '', avatar_url: '', city: '' }
      }
    }
    setProfile(data)
    fetchWorldPosts(user.id).then(setPosts)   // the world's dated timeline (0016)

    // Best-effort: link any ticket bought under this user's verified email but left
    // orphaned (no user_id at checkout) to their account, so it shows here. Safe to
    // fail if the RPC isn't deployed yet — the normal path already links via buyer_id.
    try { await supabase.rpc('claim_my_tickets') } catch (e) { /* non-fatal */ }

    // Load the buyer's ticket — key on buyer_id for tickets_self_read RLS. Two guards:
    //  1. is_test EXCLUSION — a hidden QA/test event is RLS-hidden, but its ticket ROW is
    //     owner-readable, so it would otherwise leak onto this profile (and any surface
    //     that renders a ticket). Never render a test-event ticket. Same principle as
    //     is_demo: filter it out here. (tickets.event_id has no PostgREST FK to embed, so
    //     resolve the test event ids first and exclude them.)
    //  2. order + limit(1) — a buyer can hold >1 confirmed ticket; a bare .maybeSingle()
    //     returns null on >1 match, silently hiding a real ticket. Show the most recent.
    const { data: testEvents } = await supabase.from('events').select('id').eq('is_test', true)
    const testIds = (testEvents || []).map((e) => e.id)
    let tq = supabase.from('tickets').select('*').eq('buyer_id', user.id).eq('status', 'confirmed')
    if (testIds.length) tq = tq.not('event_id', 'in', `(${testIds.join(',')})`)
    const { data: allTickets } = await tq.order('created_at', { ascending: false })
    const tk = allTickets?.[0] || null
    if (tk) setTicket(tk)

    // Resolve the REAL events behind this user's tickets (no FK to embed — known
    // debt — so it's a second query). The ticket card shows ITS event. The
    // attended list requires checked_in — a confirmed ticket proves PURCHASE,
    // the door scan proves PRESENCE, and "attended" may only claim the second.
    // If there's nothing real to show, the surfaces stay empty — never invented.
    const evIds = [...new Set((allTickets || []).map((t) => t.event_id).filter(Boolean))]
    if (evIds.length) {
      const { data: evs } = await supabase.from('events')
        .select('id,title,edition,event_date,doors,venue,city').in('id', evIds)
      const byId = Object.fromEntries((evs || []).map((e) => [e.id, e]))
      if (tk) setTicketEvent(byId[tk.event_id] || null)
      const checkedInIds = new Set((allTickets || []).filter((t) => t.checked_in === true).map((t) => t.event_id))
      setAttended((evs || [])
        .filter((e) => checkedInIds.has(e.id) && e.event_date && new Date(e.event_date) < new Date())
        .sort((a, b) => new Date(b.event_date) - new Date(a.event_date)))
    }
  }

  // Owner save — writes every museum column EXCEPT `verified` (locked to service role
  // by the lock_verified trigger). Passes profiles_self_update RLS (auth.uid()=id).
  // The parent copy stays in sync: a later avatar/cover upload changes the prop
  // identity, and the museum re-syncs from it — a stale copy here would visually
  // revert (and could then re-persist over) the world that was just saved.
  const onSave = async (patch) => {
    // '' would collide on the UNIQUE handle index — an empty handle is NULL
    if ('username' in patch && !patch.username) patch = { ...patch, username: null }
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
    if (error) {
      if ((error.message || '').includes('profiles_username_key')) throw new Error('that handle is taken — try another')
      throw error
    }
    setProfile(p => ({ ...p, ...patch }))
  }

  // Image upload — Supabase Storage (bucket 'worlds', 0014). The DB row holds
  // the public URL; the object lives under the user's OWN uid folder (storage
  // RLS). Old base64 avatars keep rendering — only NEW uploads change shape.
  // The replaced object is removed best-effort AFTER the row points elsewhere.
  const uploadImage = (col, prefix) => async (file) => {
    const { path, url } = await uploadWorldImage(user.id, file, prefix)
    const prev = worldPathFromUrl(profile?.[col])
    const { error } = await supabase.from('profiles').update({ [col]: url }).eq('id', user.id)
    if (error) { removeWorldImages([path]); throw error }
    setProfile(p => ({ ...p, [col]: url }))
    if (prev) removeWorldImages([prev])
    return url
  }
  const onUploadAvatar = uploadImage('avatar_url', 'avatar')
  // Cover: a file uploads like the avatar; null clears it.
  const onUploadCover = async (file) => {
    if (!file) {
      const prev = worldPathFromUrl(profile?.cover_url)
      const { error } = await supabase.from('profiles').update({ cover_url: null }).eq('id', user.id)
      if (error) throw error
      setProfile(p => ({ ...p, cover_url: null }))
      if (prev) removeWorldImages([prev])
      return null
    }
    return uploadImage('cover_url', 'cover')(file)
  }
  // Gallery: the museum uploads as the owner curates; the array persists on save.
  const onUploadGallery = (file) => uploadWorldImage(user.id, file, 'g')
  const onCleanupImages = (paths) => removeWorldImages(paths)

  // Moments: the owner removes a piece; the timeline re-reads the DB's truth.
  const onDeletePost = async (post) => {
    await deleteWorldPost(post)
    setPosts((ps) => ps.filter((p) => p.id !== post.id))
  }

  // Builder v3: the conversational opening's polish layer (/api/curate).
  // Returns null on ANY failure — the client-side decision tree already
  // composed a full plan, so degradation is silent by design (Ley 15).
  const onCurate = async ({ craft, feel, show }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return null
      const res = await fetch('/api/curate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ craft, feel, show }),
      })
      if (!res.ok) return null
      return await res.json()
    } catch { return null }
  }

  const topBar = (
    <>
      <span />
      <button onClick={async () => { await signOut(); navigate('/') }}
        style={{ background: 'rgba(229,160,160,.06)', border: '1px solid rgba(229,160,160,.2)', borderRadius: '8px', padding: '6px 14px', color: '#E5A0A0', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'DM Sans', transition: 'all .2s' }}
        onMouseOver={e => e.currentTarget.style.background = 'rgba(229,160,160,.15)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(229,160,160,.06)'}>
        <LogOut size={11} /> Sign Out
      </button>
    </>
  )

  // Every value on these cards is a DB fact or absent — no invented tier names,
  // door times, cities, prices or attendance. Empty and honest beats full and fake.
  const fmtPrice = (cents) => `$${cents % 100 === 0 ? cents / 100 : (cents / 100).toFixed(2)}`
  const fmtEvDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const availableTiers = (live.raw?.tiers || []).filter((t) => t.status === 'available')
  const fromPrice = availableTiers.length ? Math.min(...availableTiers.map((t) => t.price)) : null
  const tkTitleLine = ticketEvent
    ? `${ticketEvent.title}${ticketEvent.edition ? ' ' + ((ticketEvent.edition.match(/\d+/) || [''])[0] || ticketEvent.edition) : ''}`
    : 'YOUR TICKET'
  const tkMetaLine = ticketEvent
    ? [ticketEvent.event_date ? fmtEvDate(ticketEvent.event_date) : null, ticketEvent.city].filter(Boolean).join(' · ').toUpperCase()
    : ''

  const ownerExtras = (
    <>
      {/* YOUR TICKET */}
      <div style={{ marginTop: '44px' }}>
        <div style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.3em', color: 'var(--cream-low)', textTransform: 'uppercase', marginBottom: '16px' }}>YOUR TICKET</div>
        {ticket ? (
          <div style={{ border: '1px solid var(--border-hi)', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '24px', background: 'var(--bg-card)', textAlign: 'center' }}>
              {/* The ticket's OWN event — a ticket must never wear another event's name. */}
              <div style={{ fontFamily: 'Bebas Neue', fontSize: '22px', color: 'var(--cream)', marginBottom: '4px' }}>{tkTitleLine}</div>
              {tkMetaLine && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--cream-low)', letterSpacing: '.08em', marginBottom: '20px' }}>{tkMetaLine}</div>}
              {ticket.qr_code && (
                <>
                  <div style={{ display: 'inline-block', padding: '16px', background: '#FFFFFF', borderRadius: '12px', marginBottom: '16px' }}>
                    <QRCodeSVG value={ticket.qr_code} size={140} level="H" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontFamily: 'DM Mono', fontSize: '12px', color: 'var(--cream)', letterSpacing: '.04em', fontWeight: 600 }}>{ticket.qr_code}</span>
                    <button onClick={() => { navigator.clipboard.writeText(ticket.qr_code); setCopied(true); setTimeout(() => setCopied(false), 2000) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                      {copied ? <Check size={14} style={{ color: '#C7C9D1' }} /> : <Copy size={14} style={{ color: 'var(--cream-low)' }} />}
                    </button>
                  </div>
                </>
              )}
              {Number.isFinite(Number(ticket.price_paid)) && ticket.price_paid !== null && (
                <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--cream-low)', letterSpacing: '.06em' }}>{fmtPrice(Number(ticket.price_paid))} PAID</div>
              )}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px dashed var(--border-hi)', background: 'rgba(199,201,209,.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C7C9D1', boxShadow: '0 0 6px rgba(199,201,209,.4)' }} />
              <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: '#C7C9D1', letterSpacing: '.06em', fontWeight: 600 }}>CONFIRMED</span>
            </div>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--border-hi)', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', transition: 'all .3s' }}
            onClick={() => navigate('/')}
            onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(242,238,230,.2)'} onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-hi)'}>
            <div style={{ padding: '24px', background: 'var(--bg-card)' }}>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: '24px', color: 'var(--cream)' }}>{live.name} {live.editionNumber && <span style={{ color: '#F2EEE6' }}>{live.editionNumber}</span>}</div>
              <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: 'var(--cream-low)', marginTop: '4px', letterSpacing: '.08em' }}>{live.edition || 'UPCOMING'}</div>
              <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
                {[[Calendar, live.dateMed.toUpperCase()], live.doors ? [Clock, live.doors.toUpperCase()] : null, live.city ? [MapPin, live.city.toUpperCase()] : null]
                  .filter(Boolean).map(([Icon, text], i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon size={11} strokeWidth={1.2} style={{ color: 'var(--cream)' }} />
                    <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: 'var(--cream-mid)', letterSpacing: '.06em' }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px dashed var(--border-hi)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: 'var(--cream-low)' }}>
                {fromPrice != null ? `Get your ticket · from ${fmtPrice(fromPrice)}` : 'Tickets not on sale yet'}
              </span>
              <ChevronRight size={14} style={{ color: 'var(--cream-low)' }} />
            </div>
          </div>
        )}
      </div>

      {/* EVENTS ATTENDED — real confirmed tickets for past events, or nothing. */}
      {attended.length > 0 && (
        <div style={{ marginTop: '40px' }}>
          <div style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.3em', color: 'var(--cream-low)', textTransform: 'uppercase', marginBottom: '16px' }}>EVENTS ATTENDED</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            {attended.map((e, i) => (
              <div key={e.id} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--cream)' }}>{e.title}{e.venue ? ` — ${e.venue}` : ''}</div>
                  <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--cream-low)', marginTop: '2px' }}>{e.event_date ? fmtEvDate(e.event_date) : ''}</div>
                </div>
                <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: '#C7C9D1', letterSpacing: '.08em' }}>✕</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )

  return (
    <ProfileMuseum
      profile={profile}
      isOwner
      onSave={onSave}
      onUploadAvatar={onUploadAvatar}
      onUploadCover={onUploadCover}
      onUploadGallery={onUploadGallery}
      onCleanupImages={onCleanupImages}
      onCurate={onCurate}
      onViewPublic={() => navigate(`/user/${user.id}`)}
      topBar={topBar}
      ownerExtras={ownerExtras}
      posts={posts}
      onDeletePost={onDeletePost}
    />
  )
}
