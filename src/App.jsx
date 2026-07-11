import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'
import { LiveEventProvider } from '@/lib/useLiveEvent'
import { Analytics } from '@vercel/analytics/react'
import Layout from '@/components/Layout'
import EventLanding from '@/pages/EventLanding'
import Community from '@/pages/Community'
import Profile from '@/pages/Profile'
import Auth from '@/pages/Auth'
import ExperienceDetail from '@/pages/ExperienceDetail'
import PastEditions from '@/pages/PastEditions'
import ArtistProfile from '@/pages/ArtistProfile'
import TestPurchase from '@/pages/TestPurchase'
import UserProfile from '@/pages/UserProfile'
import ClaimWorld from '@/pages/ClaimWorld'
import Discover from '@/pages/Discover'
import NetworkAdmin from '@/pages/NetworkAdmin'
import OS from '@/pages/OS'
import DoorScanner from '@/pages/DoorScanner'

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

export default function App() {
  return (
    <AuthProvider>
      <LiveEventProvider>
        <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/claim" element={<ClaimWorld />} />{/* post-purchase → build your world */}
          {import.meta.env.DEV && OSHarness && (
            <Route path="/__os-harness" element={<Suspense fallback={null}><OSHarness /></Suspense>} />
          )}
          <Route path="/" element={<Layout />}>
            <Route index element={<EventLanding />} />
            <Route path="discover" element={<Discover />} />
            <Route path="community" element={<Community />} />
            <Route path="profile" element={<Profile />} />
            <Route path="experience/:slug" element={<ExperienceDetail />} />
            <Route path="editions" element={<PastEditions />} />
            <Route path="artist/:slug" element={<ArtistProfile />} />
            <Route path="test-purchase" element={<TestPurchase />} />
            <Route path="user/:id" element={<UserProfile />} />
            <Route path="network" element={<NetworkAdmin />} />{/* owner-only: grant verified */}
            <Route path="os" element={<OS />} />{/* network-only: internal team hub */}
            <Route path="door" element={<DoorScanner />} />{/* network-only: door check-in */}
            {/* Redirects from old routes */}
            <Route path="attendees" element={<Navigate to="/community" />} />
            <Route path="chat" element={<Navigate to="/community" />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </BrowserRouter>
      </LiveEventProvider>
      <Analytics />
    </AuthProvider>
  )
}
