import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Setlist, Song } from '@/types/db'
import { ROOTS } from '@/lib/chord'

type SetlistSongRow = {
  id: string
  setlist_id: string
  song_id: string
  position: number
  custom_key_root: string | null
  custom_key_quality: string | null
  transition_notes: string | null
  songs: {
    id: string
    name: string
    key_root: string | null
    key_quality: string | null
    bpm: number | null
    original_artist: string | null
  }
}

export function SetlistEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [setlist, setSetlist] = useState<Setlist | null>(null)
  const [items, setItems] = useState<SetlistSongRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Add song modal
  const [showModal, setShowModal] = useState(false)
  const [allSongs, setAllSongs] = useState<Song[]>([])
  const [search, setSearch] = useState('')

  // Debounce refs for meta fields
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load ──
  useEffect(() => {
    if (!id) return
    const setlistId = id

    async function load() {
      const [setlistRes, itemsRes] = await Promise.all([
        supabase.from('setlists').select('*').eq('id', setlistId).single(),
        supabase
          .from('setlist_songs')
          .select('*, songs(*)')
          .eq('setlist_id', setlistId)
          .order('position'),
      ])

      if (setlistRes.error) {
        setError(setlistRes.error.message)
      } else {
        setSetlist(setlistRes.data as Setlist)
      }

      if (itemsRes.data) {
        setItems(itemsRes.data as unknown as SetlistSongRow[])
      }
      setLoading(false)
    }
    load()
  }, [id])

  // ── Auto-save meta with debounce ──
  const saveMeta = useCallback(
    (patch: Partial<Setlist>) => {
      if (!id) return
      const setlistId = id
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        const { error } = await supabase
          .from('setlists')
          .update(patch)
          .eq('id', setlistId)
        if (error) setError(error.message)
      }, 800)
    },
    [id],
  )

  function handleNameChange(value: string) {
    setSetlist(s => s ? { ...s, name: value } : s)
    saveMeta({ name: value })
  }

  function handleDateChange(value: string) {
    setSetlist(s => s ? { ...s, date: value || null } : s)
    saveMeta({ date: value || null })
  }

  function handleVenueChange(value: string) {
    setSetlist(s => s ? { ...s, venue: value || null } : s)
    saveMeta({ venue: value || null })
  }

  function handleNotesChange(value: string) {
    setSetlist(s => s ? { ...s, notes: value || null } : s)
    saveMeta({ notes: value || null })
  }

  // ── Reorder ──
  async function moveItem(index: number, direction: -1 | 1) {
    if (!id) return
    const setlistId = id
    const newItems = [...items]
    const swapIndex = index + direction
    if (swapIndex < 0 || swapIndex >= newItems.length) return

    const a = { ...newItems[index], position: newItems[swapIndex].position }
    const b = { ...newItems[swapIndex], position: newItems[index].position }
    newItems[index] = a
    newItems[swapIndex] = b
    newItems.sort((x, y) => x.position - y.position)
    setItems(newItems)

    await supabase
      .from('setlist_songs')
      .upsert([
        { id: a.id, setlist_id: setlistId, song_id: a.song_id, position: a.position },
        { id: b.id, setlist_id: setlistId, song_id: b.song_id, position: b.position },
      ])
  }

  // ── Remove song ──
  async function removeItem(itemId: string) {
    setItems(prev => prev.filter(i => i.id !== itemId))
    await supabase.from('setlist_songs').delete().eq('id', itemId)
  }

  // ── Save per-song custom fields ──
  const saveItemField = useCallback(
    (itemId: string, patch: { custom_key_root?: string | null; custom_key_quality?: string | null; transition_notes?: string | null }) => {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...patch } : i))
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        await supabase.from('setlist_songs').update(patch).eq('id', itemId)
      }, 800)
    },
    [],
  )

  // ── Open modal: load all songs ──
  async function openModal() {
    setSearch('')
    setShowModal(true)
    const { data } = await supabase.from('songs').select('*').order('name')
    setAllSongs((data ?? []) as Song[])
  }

  // ── Add song to setlist ──
  async function addSong(song: Song) {
    if (!id) return
    const setlistId = id
    const nextPosition = items.length > 0 ? Math.max(...items.map(i => i.position)) + 1 : 1

    const { data, error } = await supabase
      .from('setlist_songs')
      .insert({
        setlist_id: setlistId,
        song_id: song.id,
        position: nextPosition,
      })
      .select('*, songs(*)')
      .single()

    if (!error && data) {
      setItems(prev => [...prev, data as unknown as SetlistSongRow])
    }
    setShowModal(false)
  }

  // ── Delete setlist ──
  async function deleteSetlist() {
    if (!id) return
    const setlistId = id
    if (!window.confirm('Удалить сетлист?')) return
    await supabase.from('setlists').delete().eq('id', setlistId)
    navigate('/setlists')
  }

  function toggleExpand(itemId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const inSetlistIds = new Set(items.map(i => i.song_id))
  const filteredSongs = allSongs.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  )

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Загрузка...
    </div>
  )

  if (!setlist) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-sm text-muted-foreground">
      <p>Сетлист не найден.</p>
      <button onClick={() => navigate('/setlists')} className="hover:text-foreground transition-colors">
        ← Назад
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate('/setlists')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            ✕
          </button>
          <input
            value={setlist.name}
            onChange={e => handleNameChange(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-lg font-semibold tracking-tight outline-none border border-transparent rounded px-1 hover:border-border focus:border-border transition-colors"
          />
          <button
            onClick={() => navigate(`/setlists/${setlist.id}/concert`)}
            className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            ▶ Концерт
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-4 space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Meta */}
        <div className="rounded-xl border border-border p-4 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Дата</label>
              <input
                type="date"
                value={setlist.date ?? ''}
                onChange={e => handleDateChange(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring transition-colors"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Площадка</label>
              <input
                value={setlist.venue ?? ''}
                onChange={e => handleVenueChange(e.target.value)}
                placeholder="Название места"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring transition-colors placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Заметки</label>
            <textarea
              value={setlist.notes ?? ''}
              onChange={e => handleNotesChange(e.target.value)}
              rows={2}
              placeholder="Любые заметки..."
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring transition-colors placeholder:text-muted-foreground resize-none"
            />
          </div>
        </div>

        {/* Songs */}
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground tracking-widest uppercase">
            Песни · {items.length}
          </div>

          {items.length > 0 && (
            <div className="divide-y divide-border rounded-xl border border-border overflow-hidden mb-3">
              {items.map((item, index) => {
                const song = item.songs
                const keyRoot = item.custom_key_root ?? song.key_root
                const keyQuality = item.custom_key_quality ?? song.key_quality
                const keyLabel = keyRoot
                  ? `${keyRoot}${keyQuality === 'm' ? 'm' : ''}`
                  : null
                const isExpanded = expanded.has(item.id)

                return (
                  <div key={item.id}>
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                      {/* Position */}
                      <span className="font-mono text-xs text-muted-foreground w-5 shrink-0 text-right">
                        {String(index + 1).padStart(2, '0')}
                      </span>

                      {/* Song info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{song.name}</div>
                        {song.original_artist && (
                          <div className="text-xs text-muted-foreground truncate">{song.original_artist}</div>
                        )}
                      </div>

                      {/* Key + BPM */}
                      <div className="flex items-center gap-2 shrink-0 text-sm">
                        {keyLabel && (
                          <span className="font-mono text-muted-foreground">{keyLabel}</span>
                        )}
                        {song.bpm && (
                          <span className="text-xs text-muted-foreground">{song.bpm}</span>
                        )}
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => moveItem(index, -1)}
                          disabled={index === 0}
                          className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors rounded"
                          title="Выше"
                        >↑</button>
                        <button
                          onClick={() => moveItem(index, 1)}
                          disabled={index === items.length - 1}
                          className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors rounded"
                          title="Ниже"
                        >↓</button>
                        <button
                          onClick={() => toggleExpand(item.id)}
                          className={`h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded ${isExpanded ? 'text-foreground' : ''}`}
                          title="Детали"
                        >▾</button>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors rounded"
                          title="Удалить"
                        >×</button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-4 pb-3 pt-1 bg-muted/20 space-y-3 border-t border-border/50">
                        <div className="flex gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Тональность</label>
                            <div className="flex gap-1">
                              <select
                                value={item.custom_key_root ?? ''}
                                onChange={e => saveItemField(item.id, { custom_key_root: e.target.value || null })}
                                className="rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
                              >
                                <option value="">— авто</option>
                                {ROOTS.map(r => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                              <select
                                value={item.custom_key_quality ?? ''}
                                onChange={e => saveItemField(item.id, { custom_key_quality: e.target.value || null })}
                                className="rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
                              >
                                <option value="">—</option>
                                <option value="maj">maj</option>
                                <option value="m">m</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Переход (заметки)</label>
                          <textarea
                            value={item.transition_notes ?? ''}
                            onChange={e => saveItemField(item.id, { transition_notes: e.target.value || null })}
                            rows={2}
                            placeholder="Например: плавно, без паузы..."
                            className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring placeholder:text-muted-foreground resize-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <button
            onClick={openModal}
            className="w-full rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            + Добавить песню
          </button>
        </div>

        {/* Delete */}
        <div className="pt-4 border-t border-border">
          <button
            onClick={deleteSetlist}
            className="text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            Удалить сетлист
          </button>
        </div>
      </div>

      {/* Add song modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur flex flex-col">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <button
              onClick={() => setShowModal(false)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ✕
            </button>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredSongs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Ничего не найдено</p>
            ) : (
              <div className="divide-y divide-border">
                {filteredSongs.map(song => {
                  const alreadyIn = inSetlistIds.has(song.id)
                  return (
                    <button
                      key={song.id}
                      onClick={() => !alreadyIn && addSong(song)}
                      disabled={alreadyIn}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                        alreadyIn
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{song.name}</div>
                        {song.original_artist && (
                          <div className="text-xs text-muted-foreground truncate">{song.original_artist}</div>
                        )}
                      </div>
                      {alreadyIn && (
                        <span className="text-xs text-muted-foreground shrink-0">✓ уже в сетлисте</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
