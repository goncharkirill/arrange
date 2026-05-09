import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
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

function getKeyTone(quality: string | null): 'major' | 'minor' | 'none' {
  if (!quality) return 'none'
  if (quality === 'm') return 'minor'
  return 'major'
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontSize: 13 }}>
      Загрузка...
    </div>
  )

  if (!setlist) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--muted)', fontSize: 13 }}>
      <p>Сетлист не найден.</p>
      <button onClick={() => navigate('/setlists')} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13 }}>
        ← Назад
      </button>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Topbar ── */}
      <div style={{
        height: 52,
        borderBottom: '1px solid var(--hairline)',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 24px',
        flexShrink: 0,
      }}>
        {/* Breadcrumb */}
        <Link
          to="/setlists"
          style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none', transition: 'color 120ms' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
        >
          Setlists
        </Link>
        <span style={{ color: 'var(--faint)', fontSize: 13 }}>/</span>
        <input
          value={setlist.name}
          onChange={e => handleNameChange(e.target.value)}
          style={{
            fontSize: 13, color: 'var(--text)', fontWeight: 500,
            border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'var(--font-ui)',
          }}
        />

        <div style={{ flex: 1 }} />

        {/* Concert button */}
        <button
          onClick={() => navigate(`/setlists/${setlist.id}/concert`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--accent)',
            color: 'var(--accent-fg)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '0 14px', height: 30,
            fontSize: 13, fontWeight: 500,
            cursor: 'pointer',
            transition: 'opacity 120ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          ▶ Концерт
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {error && (
          <div style={{ marginBottom: 16, color: 'var(--minor)', fontSize: 13 }}>{error}</div>
        )}

        {/* Meta */}
        <div style={{
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--radius)',
          background: 'var(--surface)',
          padding: '16px 20px',
          marginBottom: 24,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--subtle)', marginBottom: 4 }}>Дата</label>
              <input
                type="date"
                value={setlist.date ?? ''}
                onChange={e => handleDateChange(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  padding: '6px 10px',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--subtle)', marginBottom: 4 }}>Площадка</label>
              <input
                value={setlist.venue ?? ''}
                onChange={e => handleVenueChange(e.target.value)}
                placeholder="Название места"
                style={{
                  width: '100%',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  padding: '6px 10px',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--subtle)', marginBottom: 4 }}>Заметки</label>
            <textarea
              value={setlist.notes ?? ''}
              onChange={e => handleNotesChange(e.target.value)}
              rows={2}
              placeholder="Любые заметки..."
              style={{
                width: '100%', resize: 'none',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xs)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                padding: '6px 10px',
                fontSize: 13,
                outline: 'none',
                fontFamily: 'var(--font-ui)',
              }}
            />
          </div>
        </div>

        {/* Songs header */}
        <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--subtle)', textTransform: 'uppercase', marginBottom: 10 }}>
          Песни · {items.length}
        </div>

        {/* Songs list */}
        {items.length > 0 && (
          <div style={{
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            background: 'var(--surface)',
            marginBottom: 12,
          }}>
            {items.map((item, index) => {
              const song = item.songs
              const keyRoot = item.custom_key_root ?? song.key_root
              const keyQuality = item.custom_key_quality ?? song.key_quality
              const keyTone = getKeyTone(keyQuality)
              const keyLabel = keyRoot ? `${keyRoot}${keyQuality === 'm' ? 'm' : ''}` : null
              const isExpanded = expanded.has(item.id)

              return (
                <div key={item.id} style={{ borderBottom: index < items.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', transition: 'background 80ms' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--surface-2)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                  >
                    {/* Position number */}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--subtle)', width: 20, flexShrink: 0, textAlign: 'right' }}>
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    {/* Song info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, color: 'var(--text)', fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {song.name}
                      </div>
                      {song.original_artist && (
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>{song.original_artist}</div>
                      )}
                    </div>

                    {/* Key + BPM */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {keyLabel && (
                        <span className="key-chip" data-tone={keyTone}>{keyLabel}</span>
                      )}
                      {song.bpm && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--subtle)' }}>{song.bpm}</span>
                      )}
                    </div>

                    {/* Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                      {(
                        [
                          { label: '↑', title: 'Выше', onClick: () => moveItem(index, -1), disabled: index === 0 },
                          { label: '↓', title: 'Ниже', onClick: () => moveItem(index, 1), disabled: index === items.length - 1 },
                          { label: '▾', title: 'Детали', onClick: () => toggleExpand(item.id), disabled: false, active: isExpanded },
                          { label: '×', title: 'Удалить', onClick: () => removeItem(item.id), disabled: false, danger: true },
                        ] as { label: string; title: string; onClick: () => void; disabled: boolean; active?: boolean; danger?: boolean }[]
                      ).map((btn, i) => (
                        <button
                          key={i}
                          onClick={btn.onClick}
                          disabled={btn.disabled}
                          title={btn.title}
                          style={{
                            width: 26, height: 26,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'none', border: 'none',
                            color: btn.active ? 'var(--text)' : 'var(--muted)',
                            cursor: btn.disabled ? 'default' : 'pointer',
                            opacity: btn.disabled ? 0.25 : 1,
                            borderRadius: 4,
                            fontSize: btn.label === '×' ? 18 : 13,
                            transition: 'color 100ms',
                          }}
                          onMouseEnter={e => {
                            if (!btn.disabled) {
                              e.currentTarget.style.color = btn.danger ? 'var(--minor)' : 'var(--text)'
                            }
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.color = btn.active ? 'var(--text)' : 'var(--muted)'
                          }}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div style={{
                      padding: '12px 16px 12px 52px',
                      background: 'var(--surface-2)',
                      borderTop: '1px solid var(--hairline)',
                      display: 'flex', flexDirection: 'column', gap: 12,
                    }}>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, color: 'var(--subtle)', marginBottom: 4 }}>Тональность</label>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <select
                              value={item.custom_key_root ?? ''}
                              onChange={e => saveItemField(item.id, { custom_key_root: e.target.value || null })}
                              style={{
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-xs)',
                                background: 'var(--surface)',
                                color: 'var(--text)',
                                padding: '4px 8px',
                                fontSize: 12,
                                fontFamily: 'var(--font-mono)',
                                outline: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              <option value="">— авто</option>
                              {ROOTS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <select
                              value={item.custom_key_quality ?? ''}
                              onChange={e => saveItemField(item.id, { custom_key_quality: e.target.value || null })}
                              style={{
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-xs)',
                                background: 'var(--surface)',
                                color: 'var(--text)',
                                padding: '4px 8px',
                                fontSize: 12,
                                fontFamily: 'var(--font-mono)',
                                outline: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              <option value="">—</option>
                              <option value="maj">maj</option>
                              <option value="m">m</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, color: 'var(--subtle)', marginBottom: 4 }}>Переход (заметки)</label>
                        <textarea
                          value={item.transition_notes ?? ''}
                          onChange={e => saveItemField(item.id, { transition_notes: e.target.value || null })}
                          rows={2}
                          placeholder="Например: плавно, без паузы..."
                          style={{
                            width: '100%', resize: 'none',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-xs)',
                            background: 'var(--surface)',
                            color: 'var(--text)',
                            padding: '6px 10px',
                            fontSize: 12,
                            outline: 'none',
                            fontFamily: 'var(--font-ui)',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Add song button */}
        <button
          onClick={openModal}
          style={{
            display: 'block', width: '100%',
            padding: '12px',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius)',
            background: 'transparent',
            color: 'var(--muted)',
            fontSize: 13,
            cursor: 'pointer',
            transition: 'color 100ms, border-color 100ms',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--text)'
            e.currentTarget.style.borderColor = 'var(--border-strong)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--muted)'
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          + Добавить песню
        </button>

        {/* Delete */}
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--hairline)' }}>
          <button
            onClick={deleteSetlist}
            style={{ fontSize: 12.5, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 100ms' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--minor)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            Удалить сетлист
          </button>
        </div>
      </div>

      {/* ── Add song modal ── */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'oklch(0 0 0 / 0.5)',
          display: 'flex', alignItems: 'flex-end',
        }}>
          <div style={{
            width: '100%', maxHeight: '70vh',
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Modal header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 20px',
              borderBottom: '1px solid var(--hairline)',
            }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16 }}
              >✕</button>
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск..."
                style={{
                  flex: 1, background: 'transparent',
                  border: 'none', outline: 'none',
                  fontSize: 14, color: 'var(--text)',
                  fontFamily: 'var(--font-ui)',
                }}
              />
            </div>

            {/* Song list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredSongs.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  Ничего не найдено
                </div>
              ) : (
                filteredSongs.map((song, i) => {
                  const alreadyIn = inSetlistIds.has(song.id)
                  return (
                    <button
                      key={song.id}
                      onClick={() => !alreadyIn && addSong(song)}
                      disabled={alreadyIn}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        width: '100%', padding: '10px 20px',
                        border: 'none',
                        borderBottom: i < filteredSongs.length - 1 ? '1px solid var(--hairline)' : 'none',
                        background: 'transparent',
                        cursor: alreadyIn ? 'default' : 'pointer',
                        opacity: alreadyIn ? 0.4 : 1,
                        textAlign: 'left',
                        transition: 'background 80ms',
                      }}
                      onMouseEnter={e => { if (!alreadyIn) e.currentTarget.style.background = 'var(--surface-2)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, color: 'var(--text)', fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {song.name}
                        </div>
                        {song.original_artist && (
                          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{song.original_artist}</div>
                        )}
                      </div>
                      {alreadyIn && (
                        <span style={{ fontSize: 11.5, color: 'var(--muted)', flexShrink: 0 }}>✓ уже в сетлисте</span>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
