import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'
import { LiveEventProvider } from '@/lib/useLiveEvent'
import { Analytics } from '@vercel/analytics/react'
import Layout from '@/components/Layout'
import Atmosphere, { CosmosProvider, Grain } from '@/components/Atmosphere'
import Events from '@/pages/Events'
import Community from '@/pages/Community'
import Messages from '@/pages/Messages'
import Profile from '@/pages/Profile'
import Auth from '@/pages/Auth'
import ResetPassword from '@/pages/ResetPassword'
import ExperienceDetail from '@/pages/ExperienceDetail'
import PastEditions from '@/pages/PastEditions'
import ArtistRedirect from '@/pages/ArtistRedirect'
import TestPurchase from '@/pages/TestPurchase'
import UserProfile from '@/pages/UserProfile'
import ClaimWorld from '@/pages/ClaimWorld'
import EventPage from '@/pages/EventPage'
import NetworkAdmin from '@/pages/NetworkAdmin'
import OS from '@/pages/OS'
import DoorScanner from '@/pages/DoorScanner'
import HouseWorld from '@/pages/HouseWorld'
import { Terms, Privacy, Refunds } from '@/pages/Legal'

// DEV-ONLY layout harness (/__os-harness): mounts the OS instrument with
// mirror data so layout is verifiable without a member session. The
// import.meta.env.DEV guard is statically false in prod builds, so both the
// route and the chunk are excluded from the production bundle.
const OSHarness = import.meta.env.DEV ? lazy(() => import('@/pages/__OSHarness')) : null

// PREVIEW-ONLY motion harness (/__motion): the 31 aditivas of the Fase 3 audit
// playing on demand, so the ones that only fire behind real data/state (an
// empty events night, an incoming bell, a first publish) can be judged without
// writing anything to the live DB. Gated on a BUILD env flag — statically false
// in every build that doesn't set it, so route + chunk are excluded from prod.
const MotionHarness = import.meta.env.VITE_MOTION_HARNESS === '1' ? lazy(() => import('@/pages/__MotionHarness')) : null

// DEV-ONLY nav-mark proposal (/__icons) — statically excluded from prod.
const IconProposal = import.meta.env.DEV ? lazy(() => import('@/pages/__IconProposal')) : null

// DEV-ONLY preview of la puerta (/__gate), so the door can be judged on a real
// phone without pushing migration 0046 or flipping the flag on the live project.
// Lazy + null-const is the house pattern (see above): it is what actually gets
// the route AND its chunk eliminated from the prod bundle — a bare
// `import.meta.env.DEV && <Route .../>` left the path string behind.
const GatePreview = import.meta.env.DEV ? lazy(() => import('@/components/EarlyAccessGate')) : null

// Route changes start at the top — without this, opening a world (or any
// page) inherits the previous page's scroll position mid-museum.
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

/* Discover DISSOLVED (D1, decisión de Pato): its people function lives in
   /community, its events function in / (the EVENT tab). The old address
   redirects clean — shared links never 404. */
export default function App() {
  return (
    <AuthProvider>
      <LiveEventProvider>
        <BrowserRouter>
        <ScrollToTop />
        {/* v12 — ONE SKY, ABOVE THE ROUTER.
            The atmosphere used to mount inside Layout, which meant the six
            routes rendered outside Layout (/auth, /claim, /reset-password and
            the three legal pages) had no sky at all — they hand-rolled static
            void gradients. The auth flow and the post-purchase ceremony, the
            two most emotional moments in the product, were the flattest.

            It must live INSIDE BrowserRouter (presetForPath reads useLocation)
            and it must stay a plain SIBLING of <Routes>. That second part is
            load-bearing, not style: GlassNav's backdrop-filter breaks if any
            ancestor between it and the document root carries transform,
            opacity<1, filter or will-change (it becomes a backdrop root and
            the glass samples its parent instead of the page — the documented
            v11 failure). CosmosProvider renders no DOM of its own, so the
            chain stays clean. NEVER wrap this in a styled "stage" div. */}
        <CosmosProvider>
        <Atmosphere />
        <Grain />
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />{/* D3: recovery link lands here (top-level, before the catch-all) */}
          <Route path="/claim" element={<ClaimWorld />} />{/* post-purchase → build your world */}
          {/* Legal — standalone cosmos pages, anon-reachable, linked from checkout + footer */}
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/refunds" element={<Refunds />} />
          {import.meta.env.DEV && OSHarness && (
            <Route path="/__os-harness" element={<Suspense fallback={null}><OSHarness /></Suspense>} />
          )}
          {MotionHarness && (
            <Route path="/__motion" element={<Suspense fallback={null}><MotionHarness /></Suspense>} />
          )}
          {/* DEV-ONLY (/__gate): la puerta, standalone. See the const above. */}
          {GatePreview && (
            <Route path="/__gate" element={<Suspense fallback={null}><GatePreview onAccepted={() => {}} onSignIn={() => {}} /></Suspense>} />
          )}
          {/* DEV-ONLY (/__icons): the nav-mark proposal, side by side. Changes
              nothing — the bar still ships ✕ ○ ◇ ●. */}
          {import.meta.env.DEV && IconProposal && (
            <Route path="/__icons" element={<Suspense fallback={null}><IconProposal /></Suspense>} />
          )}
          <Route path="/" element={<Layout />}>
            <Route index element={<Events />} />{/* EVENT tab — every room on the platform */}
            <Route path="c4" element={<HouseWorld />} />{/* the house world — the flagship example (D4); becomes the front door when the domain points here */}
            <Route path="e/:slug" element={<EventPage />} />{/* any published event's public room (0016) */}
            <Route path="community" element={<Community />} />{/* the people — find yours */}
            <Route path="messages" element={<Messages />} />{/* the conversations (0017) */}
            <Route path="messages/:id" element={<Messages />} />
            <Route path="profile" element={<Profile />} />
            <Route path="experience/:slug" element={<ExperienceDetail />} />
            <Route path="editions" element={<PastEditions />} />
            <Route path="artist/:slug" element={<ArtistRedirect />} />{/* D1: /artist is dead — resolve to the real world or clean gone */}
            <Route path="test-purchase" element={<TestPurchase />} />
            <Route path="user/:id" element={<UserProfile />} />
            <Route path="network" element={<NetworkAdmin />} />{/* owner-only: grant verified */}
            <Route path="os" element={<OS />} />{/* network-only: internal team hub */}
            <Route path="door" element={<DoorScanner />} />{/* network-only: door check-in */}
            {/* Redirects from dissolved/old routes — clean, never a 404 */}
            <Route path="discover" element={<Navigate to="/community" replace />} />
            <Route path="attendees" element={<Navigate to="/community" replace />} />
            <Route path="chat" element={<Navigate to="/messages" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </CosmosProvider>
        </BrowserRouter>
      </LiveEventProvider>
      <Analytics />
    </AuthProvider>
  )
}
