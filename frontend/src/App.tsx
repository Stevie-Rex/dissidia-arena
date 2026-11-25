import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { FriendsList } from './components/Layout'
import Shell from './layouts/Shell'
import { AppStateProvider } from './state/AppState'
import { AppearanceProvider } from './state/Appearance'
import Home from './pages/Home'
import Welcome from './pages/Welcome'
import Hub from './pages/Hub'
import Ladder from './pages/Ladder'
import Queue from './pages/Queue'
import MatchRoom from './pages/MatchRoom'
import MatchDetails from './pages/MatchDetails'
import Profile from './pages/Profile'
import ProfileEdit from './pages/ProfileEdit'
import { Bracket, Tournaments } from './pages/Tournaments'
import Party from './pages/Party'
import { Character, Meta } from './pages/Meta'
import Discord from './pages/Discord'
import Rewards from './pages/Rewards'
import Config from './pages/Config'
import AdminCases, { CasePage } from './pages/AdminCases'
import { HelpRequestPage } from './pages/AdminHelp'
import AdminLog from './pages/AdminLog'
import MasterPanel from './pages/MasterPanel'

// Lab, round 1 (#40): dev-only, never merges. Rendered outside the providers so it makes no API calls.
const Lab = import.meta.env.DEV ? lazy(() => import('./lab/Lab')) : null

export default function App() {
  const { pathname } = useLocation()
  if (Lab && pathname.startsWith('/lab'))
    return (
      <Suspense fallback={null}>
        <Lab />
      </Suspense>
    )
  return (
    <AppStateProvider>
      <AppearanceProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="welcome" element={<Welcome />} />
          <Route path=":game" element={<Hub />} />
          <Route path=":game/ladder" element={<Ladder />} />
          <Route path=":game/meta" element={<Meta />} />
          <Route path=":game/characters/:slug" element={<Character />} />
          <Route path="queue" element={<Queue />} />
          <Route path="match/live" element={<MatchRoom />} />
          <Route path="matches/:id" element={<MatchDetails />} />
          <Route path="players/me/edit" element={<ProfileEdit />} />
          <Route path="players/:id" element={<Profile />} />
          <Route path="tournaments" element={<Tournaments />} />
          <Route path="tournaments/:id" element={<Bracket />} />
          <Route path="party" element={<Party />} />
          <Route path="friends" element={<FriendsList />} />
          <Route path="discord" element={<Discord />} />
          <Route path="rewards" element={<Rewards />} />
          <Route path="config" element={<Config />} />
          <Route path="admin" element={<AdminCases />} />
          <Route path="admin/cases/:id" element={<CasePage />} />
          <Route path="admin/help-requests/:id" element={<HelpRequestPage />} />
          <Route path="admin/log" element={<AdminLog />} />
          <Route path="master" element={<MasterPanel />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      </AppearanceProvider>
    </AppStateProvider>
  )
}
