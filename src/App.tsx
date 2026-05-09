import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { SongsList } from '@/screens/SongsList'
import { SongEditor } from '@/screens/SongEditor'
import { Concert } from '@/screens/Concert'
import { SetlistsList } from '@/screens/SetlistsList'
import { SetlistEditor } from '@/screens/SetlistEditor'
import { SetlistConcert } from '@/screens/SetlistConcert'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><SongsList /></Layout>} />
        <Route path="/songs/new" element={<Layout><SongEditor /></Layout>} />
        <Route path="/songs/:id" element={<Layout><SongEditor /></Layout>} />
        <Route path="/songs/:id/concert" element={<Concert />} />
        <Route path="/setlists" element={<Layout><SetlistsList /></Layout>} />
        <Route path="/setlists/:id" element={<Layout><SetlistEditor /></Layout>} />
        <Route path="/setlists/:id/concert" element={<SetlistConcert />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
