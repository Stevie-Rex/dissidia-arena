import { Navigate, Route, Routes } from 'react-router-dom'
import Layout, { FriendsList } from './components/Layout'
import { AppStateProvider } from './state/AppState'
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

export default function App() {
  return (
    <AppStateProvider>
      <Routes>
        <Route element={<Layout />}>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AppStateProvider>
  )
}
