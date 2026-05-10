import { useEffect, useCallback, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Song, Block } from '@/types/db'
import { formatChord, transposeProgression, transposeNote, normalizeProgression } from '@/lib/chord'

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

export function Concert() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [song, setSong] = useState<Song | null>(null)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState(0)
  const [transpose, setTranspose] = useState(0)
  const [autoscroll, setAutoscroll] = useState(false)
  const [scrollSpeed, setScrollSpeed] = useState(40) // px per second
  const lyricsRef = useRef<HTMLDivElement>(null)
  const scrollRafRef = useRef<number | null>(null)

  // ── Load ──
  useEffect(() => {
    if (!id) return
    const songId = id
    async function load() {
      const [songRes, blocksRes] = await Promise.all([
        supabase.from('songs').select('*').eq('id', songId).single(),
        supabase.from('blocks').select('*').eq('song_id', songId).order('position'),
      ])
      if (songRes.data) setSong(songRes.data as Song)
      if (blocksRes.data) setBlocks(blocksRes.data as Block[])
      setLoading(false)
    }
    load()
  }, [id])

  // ── Navigation ──
  const prev = useCallback(() => setCurrent(c => Math.max(0, c - 1)), [])
  const next = useCallback(() => setCurrent(c => Math.min(blocks.length - 1, c + 1)), [blocks.length])

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
        navigate(`/songs/${id}`)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, navigate, id])

  // Reset scroll on block change
  useEffect(() => {
    if (lyricsRef.current) lyricsRef.current.scrollTop = 0
  }, [current])

  // ── Autoscroll ──
  useEffect(() => {
    if (!autoscroll) {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current)
      return
    }
    const el = lyricsRef.current
    if (!el) return

    let last = performance.now()
    function tick(now: number) {
      if (!el) return
      const dt = (now - last) / 1000
      last = now
      el.scrollTop += scrollSpeed * dt
      scrollRafRef.current = requestAnimationFrame(tick)
    }
    scrollRafRef.current = requestAnimationFrame(tick)
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current)
    }
  }, [autoscroll, scrollSpeed])

  if (loading) return (
    <div className="dark flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
      Загрузка...
    </div>
  )

  if (!song || blocks.length === 0) return (
    <div className="dark flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-400 text-sm">
      <p>{!song ? 'Песня не найдена.' : 'Нет блоков.'}</p>
      <button onClick={() => navigate(`/songs/${id}`)}
        className="text-zinc-500 hover:text-zinc-300 transition-colors">
        ← Назад
      </button>
    </div>
  )

  const block = blocks[current]
  const rows = normalizeProgression(block.progression)
  const displayRows = transpose !== 0 ? transposeProgression(rows, transpose) : rows

  const keyRoot = song.key_root
    ? transposeNote(song.key_root, transpose)
    : null
  const keyLabel = keyRoot
    ? `${keyRoot}${song.key_quality === 'm' ? 'm' : ''}`
    : null

  const timeSignature = block.time_signature ?? song.time_signature

  return (
    // Force dark mode regardless of system preference
    <div className="dark">
      <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 select-none overflow-hidden">

        {/* ── Top bar ── */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-2 shrink-0">
          <button
            onClick={() => navigate(`/songs/${id}`)}
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm shrink-0"
          >
            ✕
          </button>

          <div className="flex-1 min-w-0">
            <span className="font-semibold truncate text-sm">{song.name}</span>
          </div>

          <div className="flex items-center gap-3 shrink-0 text-sm text-zinc-400">
            {keyLabel && (
              <span className="font-mono font-bold text-zinc-200">{keyLabel}</span>
            )}
            {song.bpm && (
              <span className="font-mono">{song.bpm} bpm</span>
            )}
            {timeSignature && timeSignature !== 'variable' && (
              <span className="font-mono">{timeSignature}</span>
            )}
          </div>

          {/* Block counter */}
          <div className="shrink-0 text-sm text-zinc-500 font-mono">
            {current + 1} / {blocks.length}
          </div>
        </div>

        {/* ── Transpose bar ── */}
        <div className="flex items-center justify-between border-b border-zinc-800/50 px-4 py-1.5 shrink-0">
          <div className="flex items-center gap-2">
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

          {/* Autoscroll */}
          <div className="flex items-center gap-2">
            {autoscroll && (
              <input
                type="range" min={10} max={120} value={scrollSpeed}
                onChange={e => setScrollSpeed(Number(e.target.value))}
                className="w-16 accent-amber-400"
              />
            )}
            <button
              onClick={() => setAutoscroll(v => !v)}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                autoscroll
                  ? 'bg-amber-400/20 text-amber-400'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {autoscroll ? '⏸ скролл' : '▶ скролл'}
            </button>
          </div>
        </div>

        {/* ── Main: tap zones + block content ── */}
        <div className="relative flex-1 flex flex-col overflow-hidden">

          {/* Tap zones (left = prev, right = next) */}
          <div className="absolute inset-0 z-10 flex pointer-events-none">
            <button
              onClick={prev}
              disabled={current === 0}
              className="flex-1 pointer-events-auto opacity-0 hover:opacity-100 flex items-center justify-start pl-4 text-zinc-600 text-4xl transition-opacity disabled:pointer-events-none"
              aria-label="Предыдущий блок"
            >
              ‹
            </button>
            <button
              onClick={next}
              disabled={current === blocks.length - 1}
              className="flex-1 pointer-events-auto opacity-0 hover:opacity-100 flex items-center justify-end pr-4 text-zinc-600 text-4xl transition-opacity disabled:pointer-events-none"
              aria-label="Следующий блок"
            >
              ›
            </button>
          </div>

          {/* Block content */}
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 overflow-hidden">

            {/* Block type */}
            <div className="mb-6 text-xs font-bold tracking-[0.3em] text-zinc-600">
              {BLOCK_TYPE_LABEL[block.type] ?? block.type.toUpperCase()}
              {block.bars && (
                <span className="ml-3 tracking-normal text-zinc-700">
                  {block.bars} тактов{block.repeat_count && block.repeat_count > 1 ? ` × ${block.repeat_count}` : ''}
                </span>
              )}
            </div>

            {/* Chord progression */}
            {displayRows.length === 0 ? (
              <div className="mb-8 text-zinc-700 font-mono text-2xl italic">N.C.</div>
            ) : (
              <div className="flex flex-col gap-2 mb-8">
                {displayRows.map((row, ri) => (
                  <div key={ri} className="flex flex-wrap justify-center gap-x-6 gap-y-2">
                    {row.map((chord, ci) => (
                      <span key={ci} className="font-mono text-5xl font-bold tracking-tight text-zinc-100 leading-none">
                        {formatChord(chord.root, chord.quality, chord.bass)}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Lyrics */}
            {block.lyrics && (
              <div
                ref={lyricsRef}
                className="max-h-40 w-full max-w-lg overflow-y-auto text-center text-zinc-400 text-base leading-relaxed whitespace-pre-wrap scrollbar-none"
                style={{ scrollbarWidth: 'none' }}
              >
                {block.lyrics}
              </div>
            )}
          </div>

          {/* ── Block nav dots + arrows ── */}
          <div className="shrink-0 flex items-center justify-center gap-3 pb-6 px-4">
            <button
              onClick={prev}
              disabled={current === 0}
              className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 transition-colors text-xl px-2"
            >
              ←
            </button>

            {/* Dots — max 16 shown */}
            <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-xs">
              {blocks.slice(0, 16).map((b, i) => (
                <button
                  key={b.id}
                  onClick={() => setCurrent(i)}
                  className={`rounded-full transition-all ${
                    i === current
                      ? 'w-5 h-2 bg-zinc-100'
                      : 'w-2 h-2 bg-zinc-700 hover:bg-zinc-500'
                  }`}
                  title={BLOCK_TYPE_LABEL[b.type] ?? b.type}
                />
              ))}
              {blocks.length > 16 && (
                <span className="text-xs text-zinc-700 ml-1">+{blocks.length - 16}</span>
              )}
            </div>

            <button
              onClick={next}
              disabled={current === blocks.length - 1}
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
