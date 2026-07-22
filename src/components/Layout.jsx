import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useRef, useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useOSAccess } from '@/lib/osAccess'
import { signalsUnread, SIGNALS_EVENT } from '@/lib/signals'
import { supabase } from '@/api/supabase'
import { useIsDesktop, useWide } from '@/lib/useIsDesktop'
import { useFirstRun } from '@/lib/firstRun'
import AuthModal from './AuthModal'
import CreateCentral from './CreateCentral'
import GlassNav from './GlassNav'
import GlassNavDesktop from './GlassNavDesktop'
import Onboarding from './Onboarding'
import Tutorial from './Tutorial'
/* v12: Atmosphere/Grain/CosmosProvider moved to App.jsx (one sky, mounted
   above <Routes> so every route gets it — not just Layout's children).
   Verificado antes de soltar el import: App.jsx los monta en la línea 87.

   Reconciliación: Mark/BUBBLE/WELL/BONE_GLOW ya NO se importan aquí. Eran
   para la barra que Layout dibujaba a mano; ahora esa barra es
   GlassNavDesktop y ella los usa. Dejarlos importados sin usar es basura
   que el próximo lector interpreta como "esto todavía hace algo". */
import { glassSurface } from '@/lib/glass'

/* The re-architecture (D1, decisión de Pato — LOCKED): EVENT = solo
   eventos (the directory of rooms), COMMUNITY = solo personas, MESSAGES =
   the conversations (D2), PROFILE = your world.

   v13 — LOS ÍCONOS AHORA COMUNICAN FUNCIÓN (pedido de Pato/Diego).
   Hasta v12 el nav usaba las marcas abstractas de carta estelar (✕ ○ ◇ ●):
   preciosas, de marca, y MUDAS — una "✕" para EVENT no dice evento, y el
   reporte lo marcó. Las marcas abstractas se quedan como separadores de
   sección (su trabajo real, CLAUDE.md), pero la NAVEGACIÓN necesita que el
   ícono diga a dónde va sin leer la palabra.

   Los cinco tipos ya vivían en Mark.jsx como propuesta ("nada renderiza
   estos hasta que un fundador lo diga"). El fundador lo dijo. Cada uno está
   dibujado en la MISMA mano —trazo geométrico, mismo peso, mismo envolvente—
   así que siguen siendo marca de la casa, no pictogramas de stock:
     · marquee — un póster con su cabecera: la sala, anunciada (EVENT)
     · people  — dos círculos que se encuentran; el solape ES la tesis (COMMUNITY)
     · bubble  — el glifo universal de "algo se dijo" (MESSAGES)
     · world   — un mundo en órbita: cada perfil es un museo, no una persona (PROFILE)
   CREATE conserva su + (el gesto universal de crear), en el centro geométrico.
   El tratamiento liquid-glass del slot no cambia — sólo el glifo adentro. */
const tabs = [
  { to: '/',          mark: 'marquee', label: 'Event',     requiresAuth: false },
  { to: '/community', mark: 'people',  label: 'Community', requiresAuth: false },
  { to: '/messages',  mark: 'bubble',  label: 'Messages',  requiresAuth: true },
  { to: '/profile',   mark: 'world',   label: 'Profile',   requiresAuth: true },
]

// Public routes never force the sign-in modal (Event + Community are
// top-of-funnel — and a shared world link must open the world, not a wall:
// /user/:id is the museum's public face, anon included; /e/:slug is any
// event's public room; /c4 is the HOUSE world — the flagship front door
// when the domain points here, so a wall there would defeat its purpose).
const PUBLIC_PATHS = ['/', '/community', '/c4']
const isPublicPath = (path) => PUBLIC_PATHS.includes(path) || path.startsWith('/user/') || path.startsWith('/e/')

// Routes with a real desktop composition — the 430px phone frame releases
// here at >=1024px. Everything else keeps the centered phone frame under
// the wide header until it earns its own desktop architecture. /e/:slug
// renders the same EventShow spread the old landing wore.
//
// v12: entran `editions` y `experience`. Eran EL síntoma del reporte "en
// compu se sigue viendo como móvil": al no estar aquí, en una pantalla de
// 1440px salían como una columna de 430px debajo de un encabezado de 1440 —
// un teléfono varado en medio de un monitor. Medido, no supuesto.
//
// Lo que NO entra sigue sin entrar a propósito: /auth, /claim, /reset-password
// y /legal son formularios, y una columna angosta y centrada es su forma
// CORRECTA en escritorio, no una deuda. La diferencia es que ahora es una
// decisión y no un olvido.
//
// v12: entra `settings`. Parece un formulario —y por esa regla se habría
// quedado fuera— pero no lo es: es una LISTA larga de secciones, y en un
// monitor una lista dentro de un marco de 430px es justo el teléfono varado
// que el comentario de arriba describe. Entra al modo ancho y se pone su
// propio techo de 760px adentro (Settings.jsx), que es lo que un settings de
// escritorio necesita: columna cómoda, no pantalla completa.
const wideDesigned = (path) =>
  path === '/' || /^\/(community|messages|profile|user|e|c4|editions|experience|settings|connections|bookings)(\/|$)/.test(path)

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { state: osState } = useOSAccess()
  const isDesktop = useIsDesktop()
  const prevIdx = useRef(0)
  const [transClass, setTransClass] = useState('page-transition')
  // Don't auto-open the sign-in modal when landing on a public route — and never
  // while the session is still rehydrating. On a hard load `user` is null until
  // getSession() resolves; computing showAuth from that flashed the modal at
  // signed-in members. Auto-open only once, on a CONFIRMED unauthenticated state.
  const [showAuth, setShowAuth] = useState(false)
  const [authDismissed, setAuthDismissed] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const autoPrompted = useRef(false)

  // CREATE — the + at the center of the app (Ley 13). Signed-out taps meet
  // the door, not a dead button; signed-in taps open the intentions.
  const openCreate = () => {
    if (authLoading) return
    if (!user) { setShowAuth(true); return }
    setCreateOpen(true)
  }
  useEffect(() => {
    if (authLoading || autoPrompted.current) return
    // Consume the one-shot on the FIRST resolution regardless of outcome — if it
    // only armed-off when unauthenticated, a later mid-session SIGNED_OUT (cross-tab
    // sign-out, failed token refresh) would pop the modal unprompted. First-load only.
    autoPrompted.current = true
    if (!user && !isPublicPath(location.pathname)) setShowAuth(true)
  }, [authLoading, user])

  // D4 retention heartbeat: one honest ping per authed session (the RPC is
  // idempotent — one row per profile per day; demo/purged never inflate it,
  // enforced server-side). Pinned to auth.uid(); fires once when identity
  // resolves, never for anon. Fire-and-forget — never blocks the UI.
  useEffect(() => {
    if (authLoading || !user) return
    supabase.rpc('log_return', { p_surface: location.pathname.slice(0, 40) }).then(() => {}, () => {})
  }, [authLoading, user]) // eslint-disable-line react-hooks/exhaustive-deps

  // LAS CAMPANAS (v10 D2): the bell count on the Messages mark — the ONE
  // living thing the stream puts on this screen. Refreshes on navigation
  // and whenever a surface announces a change; 0 on any failure (a badge
  // never invents). Anon carries no bell.
  const [bellCount, setBellCount] = useState(0)
  useEffect(() => {
    if (authLoading || !user) { setBellCount(0); return undefined }
    let alive = true
    const refresh = () => signalsUnread().then((n) => { if (alive) setBellCount(n) })
    refresh()
    window.addEventListener(SIGNALS_EVENT, refresh)
    return () => { alive = false; window.removeEventListener(SIGNALS_EVENT, refresh) }
  }, [authLoading, user, location.pathname])

  // The tab row is the same four for everyone now (v11) — nothing about who
  // you are can change its shape, so it can never reflow under your thumb.
  const currentIdx = tabs.findIndex(t => t.to === '/' ? location.pathname === '/' : location.pathname.startsWith(t.to))
  const isSubPage = currentIdx === -1

  useEffect(() => {
    if (isSubPage) {
      setTransClass('page-slide-right')
    } else if (currentIdx > prevIdx.current) {
      setTransClass('page-slide-right')
    } else if (currentIdx < prevIdx.current) {
      setTransClass('page-slide-left')
    } else {
      setTransClass('')            // same tab (e.g. /messages → /messages/:id): no page animation
    }
    if (!isSubPage) prevIdx.current = currentIdx
  }, [location.pathname])

  const handleTabClick = (tab) => {
    // Only gate tabs that actually require auth; public tabs navigate freely.
    // While auth is still resolving, navigate optimistically — the target page's
    // own three-way guard settles it (an unresolved identity is not "signed out").
    if (tab.requiresAuth && !authLoading && !user) {
      setShowAuth(true)
    } else {
      navigate(tab.to)
    }
  }

  // WORK surfaces are fluid from 768px up: /os runs its own instrument shell
  // (left rail inside the page) — the consumer bottom tab bar must not render
  // there, and the global 430px phone frame (body max-width) is released while
  // inside. Below 768px, /os keeps the phone pattern like every other tab.
  // (DESKTOP_QUERY lives in useIsDesktop.js — half-screen windows count.)
  const osDesktop = isDesktop && location.pathname.startsWith('/os')
  useEffect(() => {
    document.body.classList.toggle('os-full', osDesktop)
    return () => document.body.classList.remove('os-full')
  }, [osDesktop])

  // CONSUMER wide mode (>=1024px): a top header carries the navigation and
  // the bottom phone tabs disappear — desktop stops being a stretched phone.
  // The frame itself releases only on routes with a real desktop composition.
  const wide = useWide()

  /* PRIMERA VEZ (v14) — la bienvenida y el recorrido de siete marcas. El hook
     decide, ordena y persiste (profiles.onboarding_seen / tutorial_seen, 0049);
     Layout sólo los monta. Nada se abre para un anónimo ni mientras la
     identidad sigue sin resolver: useFirstRun espera a loading===false, que es
     la misma disciplina de tres estados que gobierna el resto de este archivo
     (un `user` nulo mientras carga NO es "no ha entrado"). */
  const firstRun = useFirstRun()

  // Las superficies de TRABAJO — ver la nota junto al montaje, abajo.
  const isWorkSurface = location.pathname.startsWith('/os') || location.pathname.startsWith('/door')

  const consumerWide = wide && !location.pathname.startsWith('/os')
  const wideFull = consumerWide && wideDesigned(location.pathname)
  useEffect(() => {
    document.body.classList.toggle('wide-full', wideFull)
    return () => document.body.classList.remove('wide-full')
  }, [wideFull])

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>

      {/* v12: the sky MOVED UP — <Atmosphere/> + <Grain/> + <CosmosProvider>
          now live in App.jsx, mounted above <Routes> so the six routes that
          render OUTSIDE this Layout (/auth, /claim, /reset-password, /terms,
          /privacy, /refunds) finally get the same universe. They had been
          hand-rolling static void gradients with no stars — the auth flow and
          the whole post-purchase ceremony were the only rooms with no sky.
          Still ONE sky for the whole app; it just hangs one level higher.
          The zIndex contract is unchanged: sky 0, page 1 (see below). */}

      {/* Wide header — the desktop navigation (fixed spans the viewport; the
          body frame doesn't constrain position:fixed). Bebas mark as the door
          home, DM Mono tabs, hairline below. One instrument, editorial. */}
      {consumerWide && (
        /* v12 — THE DESKTOP HEADER FINALLY USES THE HOUSE GLASS.
           It was rgba(var(--void-rgb),.92) + blur(14px): 92% opaque, so there was
           nothing to see THROUGH — which is why "the glass doesn't work on
           desktop". glassSurface() had exactly one call site app-wide
           (GlassNav), and GlassNav never mounts at >=1024px, so the app's
           flagship material rendered at ZERO desktop widths. v11 unified the
           buttons and left the container behind; this is that drift closed.
           The two projected drop shadows are dropped — they are sized for a
           floating pill and read as a skirt under a top-flush bar — and the
           three insets stay, because the specular top edge is the thing that
           makes it read as glass rather than as a tint. */
        <header className="glass-header" style={{
          ...glassSurface({
            border: 'none',
            borderBottom: '1px solid rgba(var(--ink-rgb),0.14)',
            borderRadius: 0,
            boxShadow: [
              'inset 0 1.5px 0 rgba(var(--ink-rgb),0.30)',
              'inset 0 -1px 0 rgba(var(--void-rgb),0.55)',
              'inset 0 30px 44px -30px rgba(var(--ink-rgb),0.26)',
            ].join(', '),
          }),
          position:'fixed', top:0, left:0, right:0, zIndex:9999, height:'56px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0 clamp(24px, 4vw, 56px)',
        }}>
          <div onClick={()=>navigate('/')} style={{ display:'flex', alignItems:'baseline', gap:'10px', cursor:'pointer' }}>
            <span style={{ fontFamily:'Bebas Neue', fontSize:'18px', color:'var(--cream)', letterSpacing:'.08em' }}>THE COLLECTIV4</span>
            <span style={{ fontFamily:'DM Mono', fontSize:'8px', color:'var(--cream-dim)', letterSpacing:'.3em', textTransform:'uppercase' }}>◇ the creative universe</span>
          </div>
          {/* v12: la barra de arriba dejó de vivir suelta aquí. Es un
              componente hermano de GlassNav y comparte glass.js con él —
              mismo círculo de vidrio por marca, mismo chip que se desliza,
              misma pastilla rellena para CREATE. Era justo estar suelta lo
              que la dejó derivar a cajitas planas junto a un CREATE de
              vidrio. */}
          <GlassNavDesktop tabs={tabs} currentIdx={currentIdx} bellCount={bellCount}
            onTab={handleTabClick} onCreate={openCreate} />
        </header>
      )}

      {/* v11: the bar FLOATS now, and it sits 28px up so it clears the band
          iOS Safari reserves for re-expanding its collapsed toolbar. The
          runway under the page tracks that offset — it has to clear the slab,
          the 28px gap AND the home indicator. Derived from GlassNav's
          DOCK_BOTTOM; if that moves, this moves with it. */}
      <main style={{ flex:1, paddingTop: consumerWide ? '56px' : 0,
        paddingBottom: (osDesktop || consumerWide) ? 0 : 'calc(98px + env(safe-area-inset-bottom, 0px))' }}>
        {/* position+zIndex are load-bearing: the shared Atmosphere sits at
            zIndex 0 — the page lifts itself one layer above the sky, and
            the sky shows through wherever the page leaves void. */}
        <div key={location.pathname} className={transClass} style={{ position:'relative', zIndex:1 }}>
          <Outlet />
        </div>
      </main>

      {/* Auth Modal - shows on first load when not signed in */}
      {showAuth && !user && <AuthModal onClose={()=>{setShowAuth(false);setAuthDismissed(true)}} />}
      {/* Also show if they try to navigate without auth after dismissing */}

      {/* Nav - consumer surfaces + mobile /os; never on desktop /os or wide (the header carries it).
          v11: the bar is now GlassNav — same tabs, same destinations, same
          handlers, same CREATE-at-the-geometric-center split (Ley 13). Only
          the skin moved out of this file. */}
      {!osDesktop && !consumerWide && (
        <GlassNav tabs={tabs} currentIdx={currentIdx} bellCount={bellCount}
          onTab={handleTabClick} onCreate={openCreate} />
      )}

      {/* CREATE — the intentions behind the + (only what you can do TODAY) */}
      {createOpen && user && (
        <CreateCentral user={user} isMemberVerified={osState === 'granted'} onClose={()=>setCreateOpen(false)} />
      )}

      {/* PRIMERA VEZ — se ven UNA vez y en este orden. Los dos portalean a
          document.body (zIndex 10030: por encima de la barra 9999, de AuthModal
          10000, de CREATE 10005 y de GlassSheet 10020), así que dónde se
          escriban en este árbol no cambia el apilado.

          LAS FUNCIONES VAN DIRECTAS, sin envolver en flecha: el argumento es
          load-bearing en las dos. Onboarding llama onDone(started) —true desde
          "Begin", false desde Skip/Escape— y con eso completeOnboarding decide
          si el recorrido sigue o si se cierran los dos juntos. Tutorial llama
          onDone(persist) con el valor vivo de "Don't show this again", y
          completeTutorial NO escribe nada cuando es false, que es justo lo que
          la casilla sin marcar promete. `onDone={() => f()}` tiraría ambos.

          FUERA DE LAS SUPERFICIES DE TRABAJO: /os es el instrumento de
          fundadores y /door es el escáner de la puerta. Un tour de consumidor
          encima de cualquiera de los dos —sobre todo del escáner, en plena
          noche de evento— es exactamente el momento equivocado. El respaldo de
          0049 ya dejó a los fundadores en `true`, así que esto es cinturón
          redundante a propósito, no la única defensa. */}
      {!isWorkSurface && firstRun.needsOnboarding && <Onboarding onDone={firstRun.completeOnboarding} />}
      {!isWorkSurface && firstRun.needsTutorial && <Tutorial onDone={firstRun.completeTutorial} />}
    </div>
  )
}
