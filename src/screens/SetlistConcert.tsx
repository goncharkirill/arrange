import { useEffect, useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Setlist, Block } from '@/types/db'
import { formatChord, transposeNote, transposeProgression } from '@/lib/chord'

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
    time_signature: string | null
    original_artist: string | null
  }
}

const BLOCK_TYPE_LABEL: Record<string, string> = {
  intro:        'INTRO',
  verse:        'VERSE',
  'pre-chorus': 'PRE-CH',
  chorus:       'CHORUS',
  bridge:       'BRIDGE',
  solo:         'SOLO',
  outro:        'OUTRO',
  break:        'BREAK',
  tag:          'TAG',
}

export function SetlistConcert() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [setlist, setSetlist] = useState<Setlist | null>(null)
  const [items, setItems] = useState<SetlistSongRow[]>([])
  const [blocksMap, setBlocksMap] = useState<Map<string, Block[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [transpose, setTranspose] = useState(0)

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

      if (setlistRes.data) setSetlist(setlistRes.data as Setlist)

      const songItems = (itemsRes.data ?? []) as unknown as SetlistSongRow[]
      setItems(songItems)

      // Load blocks for all songs
      const songIds = songItems.map(i => i.song_id)
      if (songIds.length > 0) {
        const { data: blocksData } = await supabase
          .from('blocks')
          .select('*')
          .in('song_id', songIds)
          .order('position')

        const map = new Map<string, Block[]>()
        for (const block of (blocksData ?? []) as Block[]) {
          const existing = map.get(block.song_id) ?? []
          existing.push(block)
          map.set(block.song_id, existing)
        }
        setBlocksMap(map)
      }

      setLoading(false)
    }
    load()
  }, [id])

  // Reset transpose when changing songs
  const prev = useCallback(() => {
    setCurrentIndex(c => {
      if (c <= 0) return c
      setTranspose(0)
      return c - 1
    })
  }, [])

  const next = useCallback(() => {
    setCurrentIndex(c => {
      if (c >= items.length - 1) return c
      setTranspose(0)
      return c + 1
    })
  }, [items.length])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        prev()
      } else if (e.key === 'Escape') {
        navigate(`/setlists/${id}`)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, navigate, id])

  if (loading) return (
    <div className="dark flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
      Загрузка...
    </div>
  )

  if (!setlist || items.length === 0) return (
    <div className="dark flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-400 text-sm">
      <p>{!setlist ? 'Сетлист не найден.' : 'Нет песен в сетлисте.'}</p>
      <button onClick={() => navigate(`/setlists/${id}`)}
        className="text-zinc-500 hover:text-zinc-300 transition-colors">
        ← Назад
      </button>
    </div>
  )

  const item = items[currentIndex]
  const song = item.songs
  const blocks = blocksMap.get(item.song_id) ?? []

  const keyRoot = item.custom_key_root ?? song.key_root
  const keyQuality = item.custom_key_quality ?? song.key_quality
  const displayKeyRoot = keyRoot ? transposeNote(keyRoot, transpose) : null
  const keyLabel = displayKeyRoot
    ? `${displayKeyRoot}${keyQuality === 'm' ? 'm' : ''}`
    : null

  // Next song's transition notes (if any)
  const nextItem = items[currentIndex + 1]
  const transitionNotes = item.transition_notes

  return (
    <div className="dark">
      <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 select-none overflow-hidden">

        {/* ── Top bar ── */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-2 shrink-0">
          <button
            onClick={() => navigate(`/setlists/${id}`)}
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm shrink-0"
          >
            ✕
          </button>

          <div className="flex-1 min-w-0">
            <span className="text-xs text-zinc-600 truncate">{setlist.name}</span>
          </div>

          {/* "▶ Блоки" button */}
          <button
            onClick={() => navigate(`/songs/${song.id}/concert`)}
            className="shrink-0 text-xs text-zinc-600 hover:text-zinc-400 transition-colors border border-zinc-800 rounded px-2 py-0.5"
          >
            ▶ Блоки
          </button>

          {/* Song counter */}
          <div className="shrink-0 text-sm text-zinc-500 font-mono">
            {currentIndex + 1} / {items.length}
          </div>
        </div>

        {/* ── Transpose bar ── */}
        <div className="flex items-center gap-2 border-b border-zinc-800/50 px-4 py-1.5 shrink-0">
          <span className="text-xs text-zinc-600">Транспо</span>
          <button
            onClick={() => setTranspose(t => t - 1)}
            className="h-6 w-6 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors text-sm flex items-center justify-center"
          >−</button>
          <span className={`w-8 text-center font-mono text-xs font-bold ${transpose !== 0 ? 'text-amber-400' : 'text-zinc-600'}`}>
            {transpose > 0 ? `+${transpose}` : transpose === 0 ? '0' : transpose}
          </span>
          <button
            onClick={() => setTranspose(t => t + 1)}
            className="h-6 w-6 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors text-sm flex items-center justify-center"
          >+</button>
          {transpose !== 0 && (
            <button onClick={() => setTranspose(0)}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors ml-1">
              сброс
            </button>
          )}
        </div>

        {/* ── Main content + tap zones ── */}
        <div className="relative flex-1 flex flex-col overflow-hidden">

          {/* Tap zones */}
          <div className="absolute inset-0 z-10 flex pointer-events-none">
            <button
              onClick={prev}
              disabled={currentIndex === 0}
              className="flex-1 pointer-events-auto opacity-0 hover:opacity-100 flex items-center justify-start pl-4 text-zinc-600 text-4xl transition-opacity disabled:pointer-events-none"
              aria-label="Предыдущая песня"
            >
              ‹
            </button>
            <button
              onClick={next}
              disabled={currentIndex === items.length - 1}
              className="flex-1 pointer-events-auto opacity-0 hover:opacity-100 flex items-center justify-end pr-4 text-zinc-600 text-4xl transition-opacity disabled:pointer-events-none"
              aria-label="Следующая песня"
            >
              ›
            </button>
          </div>

          {/* Song content */}
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 overflow-y-auto">

            {/* Position number */}
            <div className="mb-2 font-mono text-xs text-zinc-700">
              {String(currentIndex + 1).padStart(2, '0')}
            </div>

            {/* Song name */}
            <div className="mb-1 text-4xl font-bold tracking-tight text-zinc-100 text-center">
              {song.name}
            </div>

            {/* Artist */}
            {song.original_artist && (
              <div className="mb-4 text-sm text-zinc-600">{song.original_artist}</div>
            )}

            {/* Key · BPM · time signature */}
            <div className="mb-8 flex items-center gap-3 text-sm font-mono text-zinc-500">
              {keyLabel && <span className="text-zinc-300 font-bold">{keyLabel}</span>}
              {song.bpm && <><span className="text-zinc-700">·</span><span>{song.bpm} bpm</span></>}
              {song.time_signature && song.time_signature !== 'variable' && (
                <><span className="text-zinc-700">·</span><span>{song.time_signature}</span></>
              )}
            </div>

            {/* Blocks summary */}
            {blocks.length > 0 && (
              <div className="w-full max-w-lg space-y-1.5 mb-8">
                {blocks.map(block => {
                  const progression = block.progression ?? []
                  const displayProg = transpose !== 0 && Array.isArray(progression)
                    ? transposeProgression(
                        progression as { root: string; quality: string; bass?: string | null }[],
                        transpose,
                      )
                    : (progression as { root: string; quality: string; bass?: string | null }[])

                  const chordsStr = displayProg.length > 0
                    ? displayProg.map(c => formatChord(c.root, c.quality, c.bass)).join(' ')
                    : 'N.C.'

                  const typeLabel = BLOCK_TYPE_LABEL[block.type] ?? block.type.toUpperCase()

                  const barsLabel = block.repeat_count && block.repeat_count > 1
                    ? `×${block.repeat_count}`
                    : block.bars
                    ? `(${block.bars})`
                    : null

                  return (
                    <div key={block.id} className="flex items-baseline gap-3 text-sm overflow-hidden">
                      <span className="text-xs tracking-widest text-zinc-700 w-16 shrink-0">{typeLabel}</span>
                      <span className="font-mono text-zinc-300 flex-1 truncate">{chordsStr}</span>
                      {barsLabel && (
                        <span className="font-mono text-xs text-zinc-600 shrink-0">{barsLabel}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Transition note */}
            {transitionNotes && (
              <div className="w-full max-w-lg border-t border-zinc-800 pt-4 text-center">
                <span className="text-xs text-zinc-600">─── переход: </span>
                <span className="text-xs text-zinc-500 italic">{transitionNotes}</span>
                <span className="text-xs text-zinc-600"> ───</span>
              </div>
            )}

            {/* Next song hint */}
            {nextItem && !transitionNotes && (
              <div className="mt-4 text-xs text-zinc-700 text-center">
                Далее: {nextItem.songs.name}
              </div>
            )}
          </div>

          {/* ── Song nav dots + arrows ── */}
          <div className="shrink-0 flex items-center justify-center gap-3 pb-6 px-4">
            <button
              onClick={prev}
              disabled={currentIndex === 0}
              className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 transition-colors text-xl px-2"
            >
              ←
            </button>

            {/* Dots — max 16 shown */}
            <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-xs">
              {items.slice(0, 16).map((it, i) => (
                <button
                  key={it.id}
                  onClick={() => { setCurrentIndex(i); setTranspose(0) }}
                  className={`rounded-full transition-all ${
                    i === currentIndex
                      ? 'w-5 h-2 bg-zinc-100'
                      : 'w-2 h-2 bg-zinc-700 hover:bg-zinc-500'
                  }`}
                  title={it.songs.name}
                />
              ))}
              {items.length > 16 && (
                <span className="text-xs text-zinc-700 ml-1">+{items.length - 16}</span>
              )}
            </div>

            <button
              onClick={next}
              disabled={currentIndex === items.length - 1}
              className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 transition-colors text-xl px-2"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
