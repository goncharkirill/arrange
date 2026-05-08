import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Song } from '@/types/db'
import { Button } from '@/components/ui/button'

const STATUS_LABEL: Record<Song['status'], string> = {
  idea: 'Идея',
  learning: 'Учим',
  polishing: 'Шлифуем',
  setlist: 'Сетлист',
  archive: 'Архив',
}

const STATUS_COLOR: Record<Song['status'], string> = {
  idea: 'text-zinc-400',
  learning: 'text-amber-500',
  polishing: 'text-blue-500',
  setlist: 'text-green-500',
  archive: 'text-stone-400',
}

export function SongsList() {
  const navigate = useNavigate()
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSongs() {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        setError(error.message)
      } else {
        setSongs((data ?? []) as Song[])
      }
      setLoading(false)
    }
    fetchSongs()
  }, [])

  async function handleNew() {
    const { data, error } = await supabase
      .from('songs')
      .insert({ name: 'Новая песня', status: 'idea' })
      .select()
      .single()

    if (error) {
      setError(error.message)
    } else if (data) {
      navigate(`/songs/${data.id}`)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold tracking-tight">Песни</h1>
          <Button size="sm" onClick={handleNew}>+ Новая</Button>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-2xl px-4 py-4">
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Загрузка...</p>
        ) : songs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Песен нет. Нажми «+ Новая».
          </p>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {songs.map((song) => (
              <button
                key={song.id}
                onClick={() => navigate(`/songs/${song.id}`)}
                className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{song.name}</div>
                  {song.original_artist && (
                    <div className="text-sm text-muted-foreground truncate">{song.original_artist}</div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 text-sm">
                  {song.key_root && (
                    <span className="font-mono text-muted-foreground">
                      {song.key_root}{song.key_quality === 'maj' || !song.key_quality ? '' : song.key_quality}
                    </span>
                  )}
                  {song.bpm && (
                    <span className="text-muted-foreground">{song.bpm}</span>
                  )}
                  <span className={STATUS_COLOR[song.status]}>{STATUS_LABEL[song.status]}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
