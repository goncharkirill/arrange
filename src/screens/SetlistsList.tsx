import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Setlist } from '@/types/db'
import { Button } from '@/components/ui/button'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export function SetlistsList() {
  const navigate = useNavigate()
  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSetlists() {
      const { data, error } = await supabase
        .from('setlists')
        .select('*')
        .order('date', { ascending: false })

      if (error) {
        setError(error.message)
      } else {
        setSetlists((data ?? []) as Setlist[])
      }
      setLoading(false)
    }
    fetchSetlists()
  }, [])

  async function handleNew() {
    const { data, error } = await supabase
      .from('setlists')
      .insert({ name: 'Новый сетлист' })
      .select()
      .single()

    if (error) {
      setError(error.message)
    } else if (data) {
      navigate(`/setlists/${data.id}`)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Песни
            </button>
            <h1 className="text-lg font-semibold tracking-tight">Сетлисты</h1>
          </div>
          <Button size="sm" onClick={handleNew}>+ Новый</Button>
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
        ) : setlists.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Сетлистов нет. Нажми «+ Новый».
          </p>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {setlists.map((setlist) => (
              <button
                key={setlist.id}
                onClick={() => navigate(`/setlists/${setlist.id}`)}
                className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{setlist.name}</div>
                  {setlist.venue && (
                    <div className="text-sm text-muted-foreground truncate">{setlist.venue}</div>
                  )}
                </div>
                {setlist.date && (
                  <div className="shrink-0 text-sm text-muted-foreground">
                    {formatDate(setlist.date)}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
