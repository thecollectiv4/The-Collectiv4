import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'
import Layout from '@/components/Layout'
import EventLanding from '@/pages/EventLanding'
import Attendees from '@/pages/Attendees'
import EventChat from '@/pages/EventChat'
import Profile from '@/pages/Profile'
import Auth from '@/pages/Auth'
import DJProfile from '@/pages/DJProfile'
import AttendeeProfile from '@/pages/AttendeeProfile'
import ExperienceDetail from '@/pages/ExperienceDetail'
import PastEditions from '@/pages/PastEditions'
import ArtistProfile from '@/pages/ArtistProfile'
import DoorScanner from '@/pages/DoorScanner'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<EventLanding />} />
            <Route path="attendees" element={<Attendees />} />
            <Route path="chat" element={<EventChat />} />
            <Route path="profile" element={<Profile />} />
            <Route path="dj/:handle" element={<DJProfile />} />
            <Route path="attendee/:id" element={<AttendeeProfile />} />
            <Route path="experience/:slug" element={<ExperienceDetail />} />
            <Route path="editions" element={<PastEditions />} />
            <Route path="artist/:slug" element={<ArtistProfile />} />
            <Route path="scanner" element={<DoorScanner />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
