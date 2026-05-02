import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'
import Layout from '@/components/Layout'
import EventLanding from '@/pages/EventLanding'
import Community from '@/pages/Community'
import Profile from '@/pages/Profile'
import Auth from '@/pages/Auth'
import ExperienceDetail from '@/pages/ExperienceDetail'
import PastEditions from '@/pages/PastEditions'
import ArtistProfile from '@/pages/ArtistProfile'
import DoorScanner from '@/pages/DoorScanner'
import UserProfile from '@/pages/UserProfile'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<EventLanding />} />
            <Route path="community" element={<Community />} />
            <Route path="profile" element={<Profile />} />
            <Route path="experience/:slug" element={<ExperienceDetail />} />
            <Route path="editions" element={<PastEditions />} />
            <Route path="artist/:slug" element={<ArtistProfile />} />
            <Route path="scanner" element={<DoorScanner />} />
            <Route path="user/:id" element={<UserProfile />} />
            {/* Redirects from old routes */}
            <Route path="attendees" element={<Navigate to="/community" />} />
            <Route path="chat" element={<Navigate to="/community" />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
