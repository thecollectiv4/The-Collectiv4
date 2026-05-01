import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'
import Layout from '@/components/Layout'
import EventLanding from '@/pages/EventLanding'
import Attendees from '@/pages/Attendees'
import EventChat from '@/pages/EventChat'
import Profile from '@/pages/Profile'
import Auth from '@/pages/Auth'

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
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
