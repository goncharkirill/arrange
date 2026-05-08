import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SongsList } from '@/screens/SongsList'
import { SongEditor } from '@/screens/SongEditor'
import { Concert } from '@/screens/Concert'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SongsList />} />
        <Route path="/songs/new" element={<SongEditor />} />
        <Route path="/songs/:id" element={<SongEditor />} />
        <Route path="/songs/:id/concert" element={<Concert />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
