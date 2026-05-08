import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Song } from '@/types/db'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const STATUS_LABEL: Record<Song['status'], string> = {
  idea: 'Идея',
  learning: 'Учим',
  polishing: 'Шлифуем',
  setlist: 'Сетлист',
  archive: 'Архив',
}

export function SongsList() {
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  async function fetchSongs() {
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setSongs((data ?? []) as Song[])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchSongs()
  }, [])

  async function addTestSong() {
    setAdding(true)
    const { error } = await supabase.from('songs').insert({
      name: 'Тестовая песня',
      original_artist: 'Test Artist',
      status: 'idea',
      key_root: 'A',
      key_quality: 'maj',
      bpm: 120,
      time_signature: '4/4',
    })

    if (error) {
      setError(error.message)
    } else {
      await fetchSongs()
    }
    setAdding(false)
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Песни</h1>
          <Button onClick={addTestSong} disabled={adding}>
            {adding ? 'Добавляю...' : '+ Тестовая песня'}
          </Button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Ошибка: {error}
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground text-sm">Загрузка...</p>
        ) : songs.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Песен пока нет. Нажми кнопку выше, чтобы добавить тестовую.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {songs.map((song) => (
              <Card key={song.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{song.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {song.original_artist && <span>{song.original_artist}</span>}
                    {song.key_root && (
                      <span className="font-mono">
                        {song.key_root}{song.key_quality === 'maj' ? '' : song.key_quality}
                      </span>
                    )}
                    {song.bpm && <span>{song.bpm} bpm</span>}
                    <span className="ml-auto">{STATUS_LABEL[song.status]}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
