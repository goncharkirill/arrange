import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
        <Route path="/" element={<SongsList />} />
        <Route path="/songs/new" element={<SongEditor />} />
        <Route path="/songs/:id" element={<SongEditor />} />
        <Route path="/songs/:id/concert" element={<Concert />} />
        <Route path="/setlists" element={<SetlistsList />} />
        <Route path="/setlists/:id" element={<SetlistEditor />} />
        <Route path="/setlists/:id/concert" element={<SetlistConcert />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
