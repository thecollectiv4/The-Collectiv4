import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import Map from '@/pages/Map'
import Connect from '@/pages/Connect'
import Messages from '@/pages/Messages'
import Profile from '@/pages/Profile'
import EventDetail from '@/pages/EventDetail'
import FindAMove from '@/pages/FindAMove'
import Auth from '@/pages/Auth'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="map" element={<Map />} />
            <Route path="connect" element={<Connect />} />
            <Route path="messages" element={<Messages />} />
            <Route path="profile" element={<Profile />} />
            <Route path="event/:id" element={<EventDetail />} />
            <Route path="find-a-move" element={<FindAMove />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
