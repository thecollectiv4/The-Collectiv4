import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'
import { LiveEventProvider } from '@/lib/useLiveEvent'
import { Analytics } from '@vercel/analytics/react'
import Layout from '@/components/Layout'
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
        </BrowserRouter>
      </LiveEventProvider>
      <Analytics />
    </AuthProvider>
  )
}
