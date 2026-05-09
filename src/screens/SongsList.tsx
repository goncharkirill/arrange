import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Song, Band, SongStatus } from '@/types/db'

const STATUS_LABEL: Record<SongStatus, string> = {
  idea:      'Идея',
  learning:  'Учим',
  polishing: 'Шлифуем',
  setlist:   'Сетлист',
  archive:   'Архив',
}

type SortKey = 'name' | 'updated'

function relativeDate(iso: string): string {
  const now = new Date()
  const d = new Date(iso)
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'сегодня'
  if (diffDays === 1) return 'вчера'
  if (diffDays < 30) return `${diffDays} дн. назад`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} мес. назад`
  return `${Math.floor(diffDays / 365)} г. назад`
}

function getKeyTone(quality: string | null): 'major' | 'minor' | 'none' {
  if (!quality) return 'none'
  if (quality === 'm' || quality === 'm7' || quality === 'dim') return 'minor'
  return 'major'
}

interface KeyChipProps {
  root: string | null
  quality: string | null
}
function KeyChip({ root, quality }: KeyChipProps) {
  if (!root) return <span className="key-chip" data-tone="none">—</span>
  const tone = getKeyTone(quality)
  const label = `${root}${quality === 'm' ? 'm' : quality === 'maj' || !quality ? '' : quality}`
  return <span className="key-chip" data-tone={tone}>{label}</span>
}

interface StatusChipProps { status: SongStatus }
function StatusChip({ status }: StatusChipProps) {
  return <span className="status-chip" data-s={status}>{STATUS_LABEL[status]}</span>
}

// Song icon cell: colored square with initial letter
function SongIcon({ song, band }: { song: Song; band: Band | undefined }) {
  const color = band?.color ?? 'oklch(0.55 0.012 80)'
  return (
    <div style={{
      width: 30, height: 30,
      borderRadius: 8,
      background: color,
      display: 'grid', placeItems: 'center',
      flexShrink: 0,
      fontFamily: 'var(--font-mono)',
      fontSize: 12, fontWeight: 600,
      color: 'oklch(0.98 0 0)',
    }}>
      {song.name.charAt(0).toUpperCase()}
    </div>
  )
}

const SEARCH_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--muted)', flexShrink: 0 }}>
    <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
)

const STATUS_FILTERS: { value: SongStatus | null; label: string }[] = [
  { value: null,       label: 'Все' },
  { value: 'idea',      label: 'Идея' },
  { value: 'learning',  label: 'Учим' },
  { value: 'polishing', label: 'Шлифуем' },
  { value: 'setlist',   label: 'Сетлист' },
  { value: 'archive',   label: 'Архив' },
]

const STATUS_DOT_VAR: Record<SongStatus, string> = {
  idea:      'var(--status-idea-fg)',
  learning:  'var(--status-learning-fg)',
  polishing: 'var(--status-polishing-fg)',
  setlist:   'var(--status-setlist-fg)',
  archive:   'var(--status-archive-fg)',
}

export function SongsList() {
  const navigate = useNavigate()
  const [songs, setSongs] = useState<Song[]>([])
  const [bands, setBands] = useState<Band[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<SongStatus | null>(null)
  const [sort, setSort] = useState<SortKey>('name')

  useEffect(() => {
    async function fetchData() {
      const [songsRes, bandsRes] = await Promise.all([
        supabase.from('songs').select('*'),
        supabase.from('bands').select('*').order('name'),
      ])
      if (songsRes.error) {
        setError(songsRes.error.message)
      } else {
        setSongs((songsRes.data ?? []) as Song[])
      }
      if (bandsRes.data) setBands(bandsRes.data as Band[])
      setLoading(false)
    }
    fetchData()
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

  const bandsMap = new Map(bands.map(b => [b.id, b]))

  const filtered = songs.filter(s => {
    if (filterStatus && s.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      return s.name.toLowerCase().includes(q) || (s.original_artist?.toLowerCase().includes(q) ?? false)
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, 'ru')
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })

  const statusCounts = new Map<SongStatus | 'all', number>()
  statusCounts.set('all', songs.length)
  for (const s of songs) {
    statusCounts.set(s.status, (statusCounts.get(s.status) ?? 0) + 1)
  }

  // ── Topbar ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Topbar */}
      <div style={{
        height: 56,
        borderBottom: '1px solid var(--hairline)',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 24px',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap' }}>
          Songs
        </span>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          flex: 1, maxWidth: 320,
          background: 'var(--surface-2)',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--radius-sm)',
          padding: '0 10px',
          height: 32,
        }}>
          {SEARCH_ICON}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск песни..."
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent',
              fontSize: 13, color: 'var(--text)',
            }}
          />
          {search.length === 0 && (
            <kbd style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'var(--subtle)',
              background: 'var(--surface-3)',
              padding: '1px 5px',
              borderRadius: 4,
              border: '1px solid var(--border)',
            }}>⌘K</kbd>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* New song button */}
        <button
          onClick={handleNew}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--accent)',
            color: 'var(--accent-fg)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '0 14px',
            height: 32,
            fontSize: 13, fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'opacity 120ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          + Новая песня
        </button>
      </div>

      {/* Filter bar */}
      <div style={{
        borderBottom: '1px solid var(--hairline)',
        padding: '8px 24px',
        display: 'flex', alignItems: 'center', gap: 6,
        flexShrink: 0,
        background: 'var(--surface)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--subtle)', marginRight: 2 }}>Status</span>

        {STATUS_FILTERS.map(f => {
          const active = filterStatus === f.value
          const count = f.value === null ? statusCounts.get('all') : statusCounts.get(f.value)
          const dot = f.value ? STATUS_DOT_VAR[f.value] : null
          return (
            <button
              key={f.value ?? 'all'}
              onClick={() => setFilterStatus(f.value)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 10px',
                borderRadius: 999,
                border: active ? '1px solid var(--border-strong)' : '1px solid transparent',
                background: active ? 'var(--surface-2)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--muted)',
                fontSize: 12.5, fontWeight: active ? 500 : 400,
                cursor: 'pointer',
                transition: 'all 100ms',
              }}
            >
              {dot && (
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: dot, flexShrink: 0,
                }} />
              )}
              {f.label}
              {count !== undefined && (
                <span style={{ color: 'var(--subtle)', fontSize: 11 }}>{count}</span>
              )}
            </button>
          )
        })}

        {/* Divider */}
        <div style={{ width: 1, height: 16, background: 'var(--hairline)', margin: '0 6px' }} />

        <span style={{ fontSize: 11, color: 'var(--subtle)', marginRight: 2 }}>Sort</span>
        {(['name', 'updated'] as SortKey[]).map(s => (
          <button
            key={s}
            onClick={() => setSort(s)}
            style={{
              padding: '3px 10px',
              borderRadius: 999,
              border: sort === s ? '1px solid var(--border-strong)' : '1px solid transparent',
              background: sort === s ? 'var(--surface-2)' : 'transparent',
              color: sort === s ? 'var(--text)' : 'var(--muted)',
              fontSize: 12.5, fontWeight: sort === s ? 500 : 400,
              cursor: 'pointer',
              transition: 'all 100ms',
            }}
          >
            {s === 'name' ? 'По имени' : 'По дате'}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 24px', color: 'var(--minor)', fontSize: 13 }}>{error}</div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            Загрузка...
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            {search || filterStatus ? 'Ничего не найдено' : 'Песен нет. Нажми «+ Новая песня».'}
          </div>
        ) : (
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
          }}>
            <thead>
              <tr style={{
                position: 'sticky', top: 0,
                background: 'var(--surface)',
                borderBottom: '1px solid var(--hairline)',
                zIndex: 1,
              }}>
                <th style={{ width: 40, padding: '8px 12px 8px 24px' }} />
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500, color: 'var(--subtle)', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Песня</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500, color: 'var(--subtle)', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Тон.</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500, color: 'var(--subtle)', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>BPM</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500, color: 'var(--subtle)', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Размер</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500, color: 'var(--subtle)', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Статус</th>
                <th style={{ textAlign: 'right', padding: '8px 24px 8px 12px', fontWeight: 500, color: 'var(--subtle)', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Обновлено</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(song => {
                const band = song.band_id ? bandsMap.get(song.band_id) : undefined
                return (
                  <tr
                    key={song.id}
                    onClick={() => navigate(`/songs/${song.id}`)}
                    style={{ cursor: 'pointer', borderBottom: '1px solid var(--hairline)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 12px 10px 24px' }}>
                      <SongIcon song={song} band={band} />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 }}>
                        {song.name}
                      </div>
                      {song.original_artist && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
                          {song.original_artist}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <KeyChip root={song.key_root} quality={song.key_quality} />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {song.bpm ?? '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
                      {song.time_signature ?? '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <StatusChip status={song.status} />
                    </td>
                    <td style={{ padding: '10px 24px 10px 12px', textAlign: 'right', fontSize: 12, color: 'var(--subtle)', whiteSpace: 'nowrap' }}>
                      {relativeDate(song.updated_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
