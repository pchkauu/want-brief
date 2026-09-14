import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { api } from './api'
import { InboxScreen } from './features/inbox/InboxScreen'
import { LoadScreen } from './features/load/LoadScreen'
import { LoginScreen } from './features/login/LoginScreen'
import { MatrixScreen } from './features/matrix/MatrixScreen'
import { NotesScreen } from './features/notes/NotesScreen'
import { SettingsScreen } from './features/sources/SettingsScreen'
import { TodayScreen } from './features/today/TodayScreen'
import { TrackScreen } from './features/track/TrackScreen'
import { Shell } from './shared/Shell'

const client = new QueryClient()

function Gate() {
  const me = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
    retry: false,
  })
  if (me.isLoading) {
    return <div className="login-stage">booting…</div>
  }
  if (me.isError) {
    return <Navigate to="/login" replace />
  }
  return <Shell />
}

export default function App() {
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route element={<Gate />}>
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="/today" element={<TodayScreen />} />
            <Route path="/inbox" element={<InboxScreen />} />
            <Route path="/matrix" element={<MatrixScreen />} />
            <Route path="/track" element={<TrackScreen />} />
            <Route path="/notes" element={<NotesScreen />} />
            <Route path="/load" element={<LoadScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
