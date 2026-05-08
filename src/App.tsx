import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SongsList } from '@/screens/SongsList'
import { SongEditor } from '@/screens/SongEditor'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SongsList />} />
        <Route path="/songs/new" element={<SongEditor />} />
        <Route path="/songs/:id" element={<SongEditor />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
