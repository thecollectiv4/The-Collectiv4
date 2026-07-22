import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { useLiveEvent } from '@/lib/useLiveEvent'
import { SlidersHorizontal, Calendar, MapPin, Clock, ChevronRight, Copy, Check } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import ProfileMuseum from '@/components/ProfileMuseum'
import AuthResolving from '@/components/AuthResolving'
import { uploadWorldImage, removeWorldImages, worldPathFromUrl } from '@/lib/worldStorage'
import { fetchWorldPosts, deleteWorldPost, updateWorldPostCaption } from '@/lib/worldPosts'
import { fetchListings, deleteListing, setListingStatus } from '@/lib/listings'
import { socialReady, fetchFollowState } from '@/lib/social'
import { fetchProfileCrafts } from '@/lib/crafts'
import { fetchMyTastes } from '@/lib/tastes'
import { fetchUpcomingSets } from '@/lib/world'
import { isOwnerFounder } from '@/lib/osAccess'
import { glassControl } from '@/lib/glass'
import { IdentityCardSheet, IdentityCardButton } from '@/components/IdentityCard'
import StatusSheet from '@/components/StatusSheet'
import { fetchMyStatus, TIERS } from '@/lib/tiers'

export default function Profile() {
  // signOut ya no se desestructura aquí: se fue con el botón a /settings.
  // Un import/binding vivo sin uso es basura que el próximo lector lee como
  // "esto todavía hace algo" (misma nota que Layout.jsx dejó en su día).
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const live = useLiveEvent()
  const [profile, setProfile] = useState(null)
  // the person's real crafts (0020), primary first. null = still loading —
  // the migration band must never FLASH at a migrated member while the
  // fetch is in flight (loaded-empty and not-yet-loaded are different truths)
  const [crafts, setCrafts] = useState(null)
  // the quiet layer (0022). null = still loading — saveTastes replaces the
  // WHOLE set, so the builder must never mount over a half-loaded one (the
  // same loaded-empty vs not-yet-loaded discipline as crafts)
  const [tastes, setTastes] = useState(null)
  const [posts, setPosts] = useState([])
  const [listings, setListings] = useState([])
  // v11: OS left the tab bar and became a quiet door here. FOUNDERS ONLY —
  // isOwnerFounder() reads data.owner from my_os_identity(), which is the
  // is_owner() email allowlist checked server-side; `granted` is NOT this
  // (that means any verified member). Defaults false = fail-closed, and the
  // door is display-gating only: /os re-checks on every read regardless.
  const [isFounder, setIsFounder] = useState(false)
  // upcoming rooms this member hosts — the SETS movement's rows (v6)
  const [upcomingSets, setUpcomingSets] = useState([])
  const [social, setSocial] = useState({ ready: false, followers: 0, following: 0, iFollow: false })
  const [ticket, setTicket] = useState(null)
  const [ticketEvent, setTicketEvent] = useState(null)  // the ticket's OWN event row — never the live event's name on someone else's ticket
  const [attended, setAttended] = useState([])          // real past events this user held a confirmed ticket for
  const [copied, setCopied] = useState(false)
  /* v14 — LA CREDENCIAL Y EL NIVEL, leídos UNA vez y compartidos.
     `statusRecord` en null NO significa "nivel cero": significa "todavía no
     sé", y las dos superficies lo distinguen a propósito (la tarjeta deja el
     renglón vacío, la hoja muestra su estado de carga). Esa diferencia entre
     "no cargado" y "cargado y es cero" es la disciplina entera de esta
     feature — la misma que este archivo ya aplica a crafts y tastes.
     Un solo fetch alimenta a las dos: la tarjeta recibe el `tier` y la hoja
     recibe el mismo registro como `preloaded`, así abrir la hoja desde aquí
     no paga un segundo viaje. */
  const [cardOpen, setCardOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [statusRecord, setStatusRecord] = useState(null)

  // Three-way guard: loading · authenticated · unauthenticated. On a hard load
  // (direct URL, the confirmation email's CTA) this effect fires BEFORE Supabase
  // rehydrates the session from storage — user is null because getSession() hasn't
  // resolved yet, not because the visitor is signed out. Never redirect on an
  // unresolved identity; only a CONFIRMED unauthenticated state sends to /auth.
  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/auth'); return }
    load()
    // fire-and-forget, same idiom as ForYou/PeopleSearch/Community: any
    // failure leaves isFounder false and the OS door simply doesn't appear.
    isOwnerFounder().then(setIsFounder, () => setIsFounder(false))
  }, [user, authLoading])

  // CREATE central posts/listings from anywhere in the app — when it lands
  // one while this museum is mounted, the wall refreshes without a reload.
  useEffect(() => {
    if (!user) return
    const onPosted = () => fetchWorldPosts(user.id).then(setPosts)
    const onListed = () => fetchListings(user.id).then(setListings)
    window.addEventListener('c4:posted', onPosted)
    window.addEventListener('c4:listed', onListed)
    return () => {
      window.removeEventListener('c4:posted', onPosted)
      window.removeEventListener('c4:listed', onListed)
    }
  }, [user])

  /* EL NIVEL — se lee aquí y no dentro de la tarjeta ni de la hoja, porque
     las dos tienen que decir LO MISMO y un doble fetch puede aterrizar en
     desorden. `alive` corta la carrera clásica: cambiar de cuenta mientras
     vuela la respuesta no puede pintar el nivel del anterior.
     Va ANTES del return temprano de abajo — un hook después de un return
     condicional rompe el orden de hooks de React. */
  useEffect(() => {
    if (authLoading || !user) return undefined
    let alive = true
    fetchMyStatus(user.id).then((r) => { if (alive) setStatusRecord(r) }, () => {})
    return () => { alive = false }
  }, [authLoading, user])

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
    fetchProfileCrafts(user.id).then(setCrafts)  // the craft spine (0020)
    fetchMyTastes(user.id).then(setTastes)    // the quiet layer (0022)
    fetchWorldPosts(user.id).then(setPosts)   // the world's dated timeline (0016)
    fetchListings(user.id).then(setListings)  // the world's OFFER (0017)
    fetchUpcomingSets(user.id).then(setUpcomingSets)  // the SETS movement (v6)
    // the owner's honest count — renders once the social layer is live
    socialReady().then((ready) => {
      if (!ready) return
      fetchFollowState(user.id, null).then((s) => setSocial({ ready: true, ...s }))
    })

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
  // …or rewrites the line under one. State takes the ROW the server returned,
  // not the draft — same "the DB's truth" posture as delete above.
  const onEditPost = async (post, caption) => {
    const row = await updateWorldPostCaption(post, caption)
    setPosts((ps) => ps.map((p) => (p.id === row.id ? { ...p, caption: row.caption } : p)))
  }

  // The OFFER: sold / relist / delete — the owner curates their own wall.
  const onSetListingStatus = async (l, status) => {
    await setListingStatus(l.id, status)
    setListings((ls) => ls.map((x) => x.id === l.id ? { ...x, status } : x))
  }
  const onDeleteListing = async (l) => {
    await deleteListing(l)
    setListings((ls) => ls.filter((x) => x.id !== l.id))
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

  {/* v12 — AQUÍ HABÍA UN "SIGN OUT" Y AHORA HAY UNA PUERTA.
      Cerrar sesión se mudó a /settings, que es donde vive junto a todo lo
      demás que gobierna tu cuenta (§09). Dejarlo en los dos lados era la
      opción cobarde: dos botones que hacen lo mismo en una barra de dos
      elementos, y el de aquí compitiendo por espacio con la puerta que
      lleva a las otras ocho secciones.
      Se pierde un toque de atajo y se gana un lugar donde buscar. Si Diego
      lo quiere de vuelta arriba, es este bloque y nada más. */}
  const topBar = (
    <>
      {/* v14 — LA CREDENCIAL, en la ranura que llevaba dos versiones vacía.
          Aquí vivía un <span/> puesto sólo para empujar el botón de Settings
          a la derecha con space-between. Ahora ese hueco carga la puerta al
          objeto de la casa, y el par lee como par: la misma receta de
          glassControl, el mismo radio, el mismo hover. */}
      <IdentityCardButton onClick={() => setCardOpen(true)} />
      {/* ghost silver, same register as the Cover pill — the palette admits
          no salmon, not even as "danger" (panel catch, Ley 14) */}
      {/* v12.1 — receta compartida en vez del blur(8px) de la casa de al
          lado. Flota sobre la portada, así que el vidrio de verdad es
          justamente lo que hace que la foto se siga viendo detrás. */}
      <button onClick={() => navigate('/settings')} aria-label="Settings"
        style={{ ...glassControl(), borderRadius: '100px', padding: '6px 14px', color: 'var(--silver)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'DM Sans', transition: 'border-color .2s' }}
        onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(var(--silver-rgb),.45)'} onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(var(--ink-rgb),0.22)'}>
        <SlidersHorizontal size={11} /> Settings
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
      {/* v14 — YOUR STATUS. La puerta al nivel, con la misma gramática de
          tarjeta-puerta que ya usan YOUR TICKET y THE INSTRUMENT: cuerpo
          arriba, filete punteado, renglón de acción abajo. No se inventa una
          forma nueva para una fila más.

          EL RENGLÓN DE LA DERECHA DICE LA VERDAD EN TRES TIEMPOS:
            · statusRecord null      → nada (todavía no sé, y "no sé" no se
                                       pinta como "cero")
            · leído pero sin nivel   → nada, nunca un nombre inventado
            · leído                  → el nombre real del peldaño
          Ese silencio mientras carga es deliberado: un nivel equivocado
          durante 300ms es una mentira corta, y aquí no hay mentiras cortas. */}
      <div style={{ marginTop: '44px' }}>
        <div style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.3em', color: 'var(--cream-low)', textTransform: 'uppercase', marginBottom: '16px' }}>YOUR STATUS</div>
        <div onClick={() => setStatusOpen(true)} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatusOpen(true) } }}
          style={{ border: '1px solid var(--border-hi)', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color .3s' }}
          onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(var(--ink-rgb),.2)'}
          onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-hi)'}>
          <div style={{ padding: '22px 24px', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <span style={{ fontFamily: 'DM Mono', fontSize: '11px', color: 'var(--silver)', letterSpacing: '.08em' }}>◇</span>
                <span style={{ fontFamily: 'Bebas Neue', fontSize: '22px', color: 'var(--cream)', letterSpacing: '.02em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {statusRecord?.status?.tier?.name || 'YOUR LEVEL'}
                </span>
              </div>
            </div>
            <div style={{ fontFamily: 'DM Sans', fontSize: '12px', color: 'var(--cream-low)', marginTop: '8px', lineHeight: 1.5 }}>
              Where you stand, and what moves you up. Counted from what you actually do here.
            </div>
          </div>
          <div style={{ padding: '14px 24px', borderTop: '1px dashed var(--border-hi)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: 'var(--cream-low)' }}>SEE THE LADDER</span>
            <ChevronRight size={14} style={{ color: 'var(--cream-low)' }} />
          </div>
        </div>
      </div>

      {/* YOUR TICKET */}
      <div style={{ marginTop: '40px' }}>
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
                      {copied ? <Check size={14} style={{ color: 'var(--silver)' }} /> : <Copy size={14} style={{ color: 'var(--cream-low)' }} />}
                    </button>
                  </div>
                </>
              )}
              {Number.isFinite(Number(ticket.price_paid)) && ticket.price_paid !== null && (
                <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--cream-low)', letterSpacing: '.06em' }}>{fmtPrice(Number(ticket.price_paid))} PAID</div>
              )}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px dashed var(--border-hi)', background: 'rgba(var(--silver-rgb),.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--silver)', boxShadow: '0 0 6px rgba(var(--silver-rgb),.4)' }} />
              <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: 'var(--silver)', letterSpacing: '.06em', fontWeight: 600 }}>CONFIRMED</span>
            </div>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--border-hi)', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color .3s' }}
            onClick={() => navigate('/')}
            onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(var(--ink-rgb),.2)'} onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-hi)'}>
            <div style={{ padding: '24px', background: 'var(--bg-card)' }}>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: '24px', color: 'var(--cream)' }}>{live.name} {live.editionNumber && <span style={{ color: 'var(--cream)' }}>{live.editionNumber}</span>}</div>
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
                {/* AQUÍ VIVÍA UN ✕ INERTE. Era la marca de la casa para
                    "la noche" (el mismo glifo de la pestaña EVENT), pero
                    puesto al final de una fila y alineado a la derecha —
                    exactamente donde vive un botón de borrar — leía como un
                    control que te quita el evento al que fuiste. Un control
                    muerto que además parece destructivo es lo peor de los dos
                    mundos: confunde y asusta.
                    No se sustituye por nada: la fila ya dice el evento, el
                    lugar y la fecha. Hacerlo funcional sería darle ruta, y
                    esta pasada es limpieza visual, no rutas nuevas. */}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* YOUR BOOKINGS — the payment layer's door (0051). Same card-door
          grammar as THE INSTRUMENT below. Every member can offer services,
          so this shows on every own-profile — the dashboard behind it
          renders honest zeros until something real is sold. */}
      <div style={{ marginTop: '40px' }}>
        <div style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.3em', color: 'var(--cream-low)', textTransform: 'uppercase', marginBottom: '16px' }}>YOUR BOOKINGS</div>
        <div onClick={() => navigate('/bookings')} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/bookings') } }}
          style={{ border: '1px solid var(--border-hi)', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color .3s' }}
          onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(var(--ink-rgb),.2)'}
          onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-hi)'}>
          <div style={{ padding: '22px 24px', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontFamily: 'DM Mono', fontSize: '11px', color: 'var(--silver)', letterSpacing: '.08em' }}>●</span>
              <span style={{ fontFamily: 'Bebas Neue', fontSize: '22px', color: 'var(--cream)', letterSpacing: '.02em', lineHeight: 1 }}>THE OFFER, WORKING</span>
            </div>
            <div style={{ fontFamily: 'DM Sans', fontSize: '12px', color: 'var(--cream-low)', marginTop: '8px', lineHeight: 1.5 }}>
              Your services, your payment links, who booked you — and your real number.
            </div>
          </div>
          <div style={{ padding: '14px 24px', borderTop: '1px dashed var(--border-hi)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: 'var(--cream-low)' }}>ENTER</span>
            <ChevronRight size={14} style={{ color: 'var(--cream-low)' }} />
          </div>
        </div>
      </div>

      {/* THE INSTRUMENT — /os. It used to be a fifth tab in the bottom bar,
          which meant a founder-only tool was shaping a public-facing row and
          the bar changed size depending on who you were. It lives here now:
          founders only, last, quiet.

          Two independent gates stack. This whole `ownerExtras` fragment is
          only ever passed by Profile.jsx (your OWN profile) — UserProfile.jsx
          renders other people and never passes it — and `isFounder` is the
          server's is_owner() verdict on top. Display-gating only: /os is
          RLS-gated server-side no matter what renders here. */}
      {isFounder && (
        <div style={{ marginTop: '40px' }}>
          <div style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.3em', color: 'var(--cream-low)', textTransform: 'uppercase', marginBottom: '16px' }}>THE INSTRUMENT</div>
          <div onClick={() => navigate('/os')}
            style={{ border: '1px solid var(--border-hi)', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color .3s' }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(var(--ink-rgb),.2)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-hi)'}>
            <div style={{ padding: '22px 24px', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: 'DM Mono', fontSize: '11px', color: 'var(--silver)', letterSpacing: '.08em' }}>△</span>
                <span style={{ fontFamily: 'Bebas Neue', fontSize: '22px', color: 'var(--cream)', letterSpacing: '.02em', lineHeight: 1 }}>OS</span>
              </div>
              <div style={{ fontFamily: 'DM Sans', fontSize: '12px', color: 'var(--cream-low)', marginTop: '8px', lineHeight: 1.5 }}>
                The board, the network, the drops — the room behind the room.
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px dashed var(--border-hi)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: 'var(--cream-low)' }}>ENTER</span>
              <ChevronRight size={14} style={{ color: 'var(--cream-low)' }} />
            </div>
          </div>
        </div>
      )}
    </>
  )

  return (
    <>
    <ProfileMuseum
      profile={profile}
      crafts={crafts || []}
      craftsReady={crafts !== null}
      onCraftsSaved={setCrafts}
      tastes={tastes}
      onTastesSaved={setTastes}
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
      onEditPost={onEditPost}
      listings={listings}
      onSetListingStatus={onSetListingStatus}
      onDeleteListing={onDeleteListing}
      social={social}
      // the WHOLE set (v6): the museum renders only the public rows and
      // counts the quiet ones for the owner — never names them. null while
      // loading keeps the TASTE invite from flashing over an unknown truth.
      publicTastes={tastes}
      upcomingSets={upcomingSets}
    />

    {/* Las dos superficies de v14. Portalean solas a document.body (GlassSheet),
        así que su lugar en este árbol no cambia el apilado — están al final
        por lectura, no por z-index.

        La tarjeta recibe el MISMO registro que alimenta la fila de arriba, con
        el total de peldaños adjunto para poder imprimir "03/05". Si el registro
        aún no llegó, `tier` va en null y la tarjeta deja el renglón vacío en
        vez de degradar a un peldaño que no se ha comprobado. */}
    <IdentityCardSheet
      open={cardOpen}
      profile={profile}
      tier={statusRecord && { ...statusRecord, total: TIERS.length }}
      onClose={() => setCardOpen(false)}
    />
    {statusOpen && (
      <StatusSheet
        profileId={user.id}
        preloaded={statusRecord}
        onClose={() => setStatusOpen(false)}
      />
    )}
    </>
  )
}
