import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/api/supabase'
import { useAuth } from '@/lib/AuthContext'
import { useLiveEvent } from '@/lib/useLiveEvent'
import { ArrowLeft } from 'lucide-react'
import ProfileMuseum from '@/components/ProfileMuseum'
import { fetchWorldPosts } from '@/lib/worldPosts'
import { fetchListings } from '@/lib/listings'
import { socialReady, fetchFollowState, follow, unfollow, startDM, fetchFriendState, requestFriend, respondFriend, removeFriend } from '@/lib/social'
import { fetchProfileCrafts } from '@/lib/crafts'
import { fetchPublicTastes } from '@/lib/tastes'
import { fetchUpcomingSets } from '@/lib/world'
import RelatedWorlds from '@/components/RelatedWorlds'

export default function UserProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const live = useLiveEvent()
  const [profile, setProfile] = useState(null)
  const [crafts, setCrafts] = useState([])
  const [posts, setPosts] = useState([])
  const [listings, setListings] = useState([])
  const [going, setGoing] = useState(false)
  const [loading, setLoading] = useState(true)
  // the social layer's face on this world (0017) — ready gates the doors
  const [social, setSocial] = useState({ ready: false, followers: 0, following: 0, iFollow: false })
  const [socialErr, setSocialErr] = useState('')
  // v6 (D4): the TASTE movement's speakable rows (RLS filters to public),
  // the SETS movement's upcoming rooms, and the amigo bond's pairwise state
  // (null = unknown/pre-0023 — the museum renders no door on null)
  const [publicTastes, setPublicTastes] = useState([])
  const [upcomingSets, setUpcomingSets] = useState([])
  const [friendState, setFriendState] = useState(null)
  // your own public world: no FOLLOW/MESSAGE doors at yourself (they could
  // never open — review catch); a quiet door back to curating instead
  const selfView = !!user && String(user.id) === String(id)

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      // Public read of the profile row (profiles_public_read RLS = using(true)).
      const { data: p } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()

      // "Going" status comes from the PII-safe RPC, NOT a ticket select — the
      // tickets_self_read RLS policy blocks reading another person's ticket.
      let att = null
      try {
        const { data } = await supabase.rpc('confirmed_attendees', live.id ? { p_event: live.id } : {})
        att = (data || []).find(a => String(a.id) === String(id)) || null
      } catch { /* RPC optional */ }

      // the world's dated timeline + its OFFER — RLS mirrors the profile's
      // own visibility for both (and both resolve empty pre-migration).
      // Crafts ride the same read gate (0020's honesty-gated public read).
      // v6: the public taste rows + upcoming hosted rooms ride the same
      // fan-out; the amigo state only asks when a session exists.
      const [wp, ls, ready, pc, pt, us, fs] = await Promise.all([
        fetchWorldPosts(id),
        fetchListings(id),
        socialReady(),
        fetchProfileCrafts(id),
        fetchPublicTastes(id),
        fetchUpcomingSets(id),
        user?.id ? fetchFriendState(user.id, id) : Promise.resolve(null),
      ])

      if (!alive) return
      setGoing(!!att)
      setPosts(wp)
      setListings(ls)
      setCrafts(pc)
      setPublicTastes(pt)
      setUpcomingSets(us)
      setFriendState(fs)
      setProfile(p || (att ? { id, full_name: att.name, avatar_url: att.avatar_url } : null))
      setLoading(false)
      if (ready) {
        fetchFollowState(id, user?.id).then((s) => { if (alive) setSocial({ ready: true, ...s }) })
      }
    }
    load()
    return () => { alive = false }
  }, [id, live.id, user?.id])

  /* follow / unfollow — optimista, con rollback CON VOZ: una escritura que
     falla nunca revierte en silencio (Ley 11).

     v12 — EL ESTADO FANTASMA AL PICAR RÁPIDO. La versión anterior leía
     `social` de su clausura y luego hacía `setSocial(was)` al fallar. Con dos
     toques rápidos eso se rompe de dos formas distintas:

       · Los dos toques capturan el MISMO `social` (el segundo se crea antes
         de que el primero re-renderice), así que ambos calculan el mismo
         "siguiente" — picar dos veces podía dejarte siguiendo cuando querías
         dejar de seguir.
       · Si el primero falla DESPUÉS de que el segundo ya escribió, su
         `setSocial(was)` restaura un estado viejo encima de uno más nuevo:
         la pantalla termina mostrando algo que ya no es cierto en la DB.
         Ese es exactamente el fantasma.

     Ahora hay un TURNO (`followTurn`). Cada toque toma uno; sólo el ÚLTIMO
     puede tocar el estado cuando su escritura vuelve. Y el optimista se
     calcula con la forma funcional de setState, que siempre lee el valor
     vigente en vez del que se congeló en la clausura — así el segundo toque
     parte de lo que el primero ya dejó. Rápido o lento, lo que se ve es lo
     que hay.

     La intención se guarda en un ref (no en el estado) para saber, al
     volver, qué se pidió realmente: la DB es la que manda, no la pantalla. */
  const followTurn = useRef(0)
  const onFollowToggle = useCallback(async () => {
    if (!user) { navigate(`/auth?next=/user/${id}`); return }
    const turn = ++followTurn.current
    let intent = null
    setSocialErr('')
    setSocial((s) => {
      intent = !s.iFollow                       // lo que este toque PIDE
      return intent
        ? { ...s, iFollow: true, followers: s.followers + 1 }
        : { ...s, iFollow: false, followers: Math.max(0, s.followers - 1) }
    })
    try {
      if (intent) await follow(user.id, id)
      else await unfollow(user.id, id)
    } catch (e) {
      // un toque viejo que llega tarde no puede pisar al que manda ahora
      if (turn !== followTurn.current) return
      setSocial((s) => (intent
        ? { ...s, iFollow: false, followers: Math.max(0, s.followers - 1) }
        : { ...s, iFollow: true, followers: s.followers + 1 }))
      setSocialErr(e?.message || "that didn't land — try again")
    }
  }, [user, id, navigate])

  // amigo — the mutual bond's three doors (0023), each optimistic with the
  // follow button's own discipline: rollback WITH a voice, never in silence.
  const onFriendRequest = useCallback(async () => {
    const was = friendState
    setFriendState('out'); setSocialErr('')
    try {
      // two reaches can meet: request_friend answers 'accepted' when
      // their request was already waiting on me
      const status = await requestFriend(id)
      setFriendState(status === 'accepted' ? 'friends' : 'out')
    } catch (e) {
      setFriendState(was)
      setSocialErr(e?.message || "that didn't land — try again")
    }
  }, [id, friendState])

  const onFriendAccept = useCallback(async () => {
    const was = friendState
    setFriendState('friends'); setSocialErr('')
    try {
      const status = await respondFriend(id, true)
      setFriendState(status === 'accepted' ? 'friends' : 'none')
    } catch (e) {
      setFriendState(was)
      setSocialErr(e?.message || "that didn't land — try again")
    }
  }, [id, friendState])

  const onFriendRemove = useCallback(async () => {
    const was = friendState
    setFriendState('none'); setSocialErr('')
    try {
      await removeFriend(id)
    } catch (e) {
      setFriendState(was)
      setSocialErr(e?.message || "that didn't land — try again")
    }
  }, [id, friendState])

  // message — the DM door (start_dm RPC creates/reopens the pair thread)
  const onMessage = useCallback(async (prefill) => {
    if (!user) { navigate(`/auth?next=/user/${id}`); return }
    try {
      const threadId = await startDM(id)
      navigate(`/messages/${threadId}`, typeof prefill === 'string' && prefill ? { state: { prefill } } : undefined)
    } catch (e) {
      alert(e?.message || "couldn't open the conversation — try again")
    }
  }, [user, id, navigate])

  // DM to buy / book — the same door, seeded with the piece (Ley 9: the
  // click keeps its promise — a real conversation about a real listing)
  const onDMSeller = useCallback((l) => {
    onMessage(`about “${l.title}” (${l.kind === 'service' ? 'booking' : 'buying'}) — `)
  }, [onMessage])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ fontFamily: 'DM Mono', fontSize: '11px', color: 'var(--cream-low)' }}>Loading...</div>
    </div>
  )

  if (!profile) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px', background: 'var(--bg)', padding: '40px' }}>
      <div style={{ fontSize: '13px', color: 'var(--cream-low)' }}>Profile not found</div>
      <button onClick={() => navigate('/community')} style={{ background: 'rgba(242,238,230,.06)', border: '1px solid var(--border-hi)', borderRadius: '8px', padding: '9px 18px', color: 'var(--cream-mid)', fontSize: '12px', cursor: 'pointer', fontFamily: 'DM Sans' }}>Back to Community</button>
    </div>
  )

  const topBar = (
    <>
      <button onClick={() => navigate(-1)} aria-label="Back" style={{ background: 'rgba(10,10,13,.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(242,238,230,.18)', borderRadius: '100px', width: '34px', height: '34px', color: 'var(--cream)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowLeft size={16} /></button>
      <span />
    </>
  )

  return (
    <>
      <ProfileMuseum
        profile={profile} crafts={crafts} isOwner={false} ticket={going} event={live} topBar={topBar}
        posts={posts}
        listings={listings}
        social={(authLoading || selfView) ? { ...social, ready: false } : { ...social, err: socialErr }}
        selfView={selfView}
        onSelfCurate={() => navigate('/profile')}
        onFollowToggle={onFollowToggle}
        onMessage={() => onMessage()}
        onDMSeller={selfView ? null : onDMSeller}
        publicTastes={publicTastes}
        upcomingSets={upcomingSets}
        friendship={(!selfView && user && friendState) ? { state: friendState, onRequest: onFriendRequest, onAccept: onFriendAccept, onRemove: onFriendRemove } : null}
      />
      {/* WORLDS IN ORBIT — the matching column's first public face (D2):
          real worlds sharing this person's craft, or nothing at all */}
      <RelatedWorlds profileId={id} crafts={crafts} />
    </>
  )
}
