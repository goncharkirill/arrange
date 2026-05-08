import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Song, Block, ChordVoicing, SongStatus, KeyQuality, BlockType } from '@/types/db'
import { ROOTS, QUALITIES, formatChord, transposeProgression, transposeNote } from '@/lib/chord'
import { Button } from '@/components/ui/button'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: SongStatus; label: string }[] = [
  { value: 'idea',      label: 'Идея' },
  { value: 'learning',  label: 'Учим' },
  { value: 'polishing', label: 'Шлифуем' },
  { value: 'setlist',   label: 'Сетлист' },
  { value: 'archive',   label: 'Архив' },
]

const BLOCK_TYPES: { value: BlockType; label: string }[] = [
  { value: 'intro',       label: 'Intro' },
  { value: 'verse',       label: 'Verse' },
  { value: 'pre-chorus',  label: 'Pre-Ch' },
  { value: 'chorus',      label: 'Chorus' },
  { value: 'bridge',      label: 'Bridge' },
  { value: 'solo',        label: 'Solo' },
  { value: 'outro',       label: 'Outro' },
  { value: 'break',       label: 'Break' },
  { value: 'tag',         label: 'Tag' },
]

const BLOCK_COLORS: Record<BlockType, string> = {
  intro:       'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  verse:       'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'pre-chorus':'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  chorus:      'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  bridge:      'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  solo:        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  outro:       'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  break:       'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  tag:         'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChordPickerProps {
  value: ChordVoicing | null
  onChange: (c: ChordVoicing) => void
  onClose: () => void
}

// ─── Chord Picker ─────────────────────────────────────────────────────────────

function ChordPicker({ value, onChange, onClose }: ChordPickerProps) {
  const [root, setRoot] = useState(value?.root ?? 'C')
  const [quality, setQuality] = useState(value?.quality ?? 'maj')
  const [bass, setBass] = useState(value?.bass ?? '')
  const [showBass, setShowBass] = useState(!!value?.bass)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  function confirm() {
    onChange({ root, quality, bass: showBass && bass ? bass : null })
    onClose()
  }

  const roots = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

  return (
    <div ref={ref} className="absolute z-50 mt-1 rounded-xl border border-border bg-card p-3 shadow-lg w-64">
      {/* Root grid */}
      <div className="mb-2 grid grid-cols-6 gap-1">
        {roots.map(r => (
          <button
            key={r}
            onClick={() => setRoot(r)}
            className={`rounded px-1 py-1 text-xs font-mono font-semibold transition-colors ${
              root === r
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted text-foreground'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Quality grid */}
      <div className="mb-2 grid grid-cols-3 gap-1">
        {QUALITIES.map(q => (
          <button
            key={q.value}
            onClick={() => setQuality(q.value)}
            className={`rounded px-2 py-1 text-xs font-mono transition-colors ${
              quality === q.value
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted text-foreground'
            }`}
          >
            {root}{q.label || ''}
          </button>
        ))}
      </div>

      {/* Bass note */}
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => setShowBass(v => !v)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showBass ? '− убрать бас' : '+ slash bass'}
        </button>
        {showBass && (
          <select
            value={bass}
            onChange={e => setBass(e.target.value)}
            className="flex-1 rounded border border-border bg-background px-2 py-0.5 text-xs font-mono"
          >
            <option value="">—</option>
            {roots.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={confirm}>
          {formatChord(root, quality, showBass && bass ? bass : null) || root}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
      </div>
    </div>
  )
}

// ─── Block Row ────────────────────────────────────────────────────────────────

interface BlockRowProps {
  block: Block
  transpose: number
  onUpdate: (id: string, patch: Partial<Block>) => void
  onDelete: (id: string) => void
}

function BlockRow({ block, transpose, onUpdate, onDelete }: BlockRowProps) {
  const [pickerIndex, setPickerIndex] = useState<number | null>(null)
  const progression = block.progression ?? []
  const displayProg = transpose !== 0
    ? transposeProgression(progression, transpose)
    : progression

  function addChord() {
    const newProg = [...progression, { root: 'C', quality: 'maj', bass: null }]
    onUpdate(block.id, { progression: newProg })
  }

  function updateChord(i: number, c: ChordVoicing) {
    const newProg = [...progression]
    newProg[i] = c
    onUpdate(block.id, { progression: newProg })
  }

  function removeChord(i: number) {
    const newProg = progression.filter((_, idx) => idx !== i)
    onUpdate(block.id, { progression: newProg })
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      {/* Block header */}
      <div className="mb-2 flex items-center gap-2">
        {/* Type selector */}
        <select
          value={block.type}
          onChange={e => onUpdate(block.id, { type: e.target.value as BlockType })}
          className={`rounded-md px-2 py-0.5 text-xs font-semibold border-0 ${BLOCK_COLORS[block.type]}`}
        >
          {BLOCK_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {/* Bars */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <input
            type="number"
            min={1}
            max={64}
            value={block.bars ?? ''}
            onChange={e => onUpdate(block.id, { bars: e.target.value ? Number(e.target.value) : null })}
            placeholder="—"
            className="w-10 rounded border border-border bg-background px-1.5 py-0.5 text-center font-mono text-xs"
          />
          <span>тактов</span>
        </div>

        {/* Repeat */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>×</span>
          <input
            type="number"
            min={1}
            max={16}
            value={block.repeat_count ?? ''}
            onChange={e => onUpdate(block.id, { repeat_count: e.target.value ? Number(e.target.value) : null })}
            placeholder="1"
            className="w-10 rounded border border-border bg-background px-1.5 py-0.5 text-center font-mono text-xs"
          />
        </div>

        <button
          onClick={() => onDelete(block.id)}
          className="ml-auto text-muted-foreground hover:text-destructive transition-colors text-sm"
          title="Удалить блок"
        >
          ×
        </button>
      </div>

      {/* Chord progression */}
      <div className="flex flex-wrap items-center gap-1.5 min-h-[2rem]">
        {displayProg.map((chord, i) => (
          <div key={i} className="relative">
            <button
              onClick={() => setPickerIndex(pickerIndex === i ? null : i)}
              className="rounded-md bg-muted px-2.5 py-1 font-mono text-sm font-semibold hover:bg-muted/70 transition-colors"
            >
              {formatChord(chord.root, chord.quality, chord.bass)}
            </button>
            {pickerIndex === i && (
              <ChordPicker
                value={progression[i]}
                onChange={c => { updateChord(i, c); setPickerIndex(null) }}
                onClose={() => setPickerIndex(null)}
              />
            )}
            <button
              onClick={() => removeChord(i)}
              className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] leading-none hover:opacity-80"
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={addChord}
          className="rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground transition-colors font-mono"
        >
          + аккорд
        </button>
      </div>

      {/* Lyrics */}
      <textarea
        value={block.lyrics ?? ''}
        onChange={e => onUpdate(block.id, { lyrics: e.target.value || null })}
        placeholder="Текст (необязательно)..."
        rows={2}
        className="mt-2 w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-sm text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function SongEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [song, setSong] = useState<Song | null>(null)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [transpose, setTranspose] = useState(0)

  // Debounce timer for meta saves
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load ──
  useEffect(() => {
    if (!id) return
    async function load() {
      const [songRes, blocksRes] = await Promise.all([
        supabase.from('songs').select('*').eq('id', id).single(),
        supabase.from('blocks').select('*').eq('song_id', id).order('position'),
      ])
      if (songRes.data) setSong(songRes.data as Song)
      if (blocksRes.data) setBlocks(blocksRes.data as Block[])
      setLoading(false)
    }
    load()
  }, [id])

  // ── Save song meta (debounced) ──
  function updateMeta(patch: Partial<Song>) {
    if (!song) return
    setSong(prev => prev ? { ...prev, ...patch } : prev)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      await supabase.from('songs').update(patch).eq('id', song.id)
      setSaving(false)
    }, 800)
  }

  // ── Block operations ──
  async function addBlock() {
    if (!id) return
    const position = blocks.length
    const { data } = await supabase
      .from('blocks')
      .insert({ song_id: id, position, type: 'verse', bars: 8 })
      .select()
      .single()
    if (data) setBlocks(prev => [...prev, data as Block])
  }

  async function updateBlock(blockId: string, patch: Partial<Block>) {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, ...patch } : b))
    await supabase.from('blocks').update(patch).eq('id', blockId)
  }

  async function deleteBlock(blockId: string) {
    setBlocks(prev => prev.filter(b => b.id !== blockId))
    await supabase.from('blocks').delete().eq('id', blockId)
  }

  // ── Apply transpose to DB ──
  async function applyTranspose() {
    if (!transpose || !song) return
    const newRoot = song.key_root ? transposeNote(song.key_root, transpose) : song.key_root
    await supabase.from('songs').update({ key_root: newRoot }).eq('id', song.id)

    const updates = blocks.map(b => {
      if (!b.progression?.length) return Promise.resolve()
      const newProg = transposeProgression(b.progression, transpose)
      return supabase.from('blocks').update({ progression: newProg }).eq('id', b.id)
    })
    await Promise.all(updates)

    setSong(prev => prev ? { ...prev, key_root: newRoot ?? prev.key_root } : prev)
    setBlocks(prev => prev.map(b => b.progression?.length
      ? { ...b, progression: transposeProgression(b.progression, transpose) }
      : b
    ))
    setTranspose(0)
  }

  // ── Delete song ──
  async function deleteSong() {
    if (!song) return
    if (!confirm(`Удалить «${song.name}»? Это действие нельзя отменить.`)) return
    await supabase.from('songs').delete().eq('id', song.id)
    navigate('/')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground text-sm">
        Загрузка...
      </div>
    )
  }

  if (!song) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground text-sm">
        Песня не найдена.
      </div>
    )
  }

  const keyDisplay = song.key_root
    ? `${transposeNote(song.key_root, transpose)}${song.key_quality === 'maj' || !song.key_quality ? '' : song.key_quality}`
    : '—'

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate('/')}
            className="text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            ← Назад
          </button>
          <div className="flex-1 min-w-0">
            <input
              value={song.name}
              onChange={e => updateMeta({ name: e.target.value })}
              className="w-full bg-transparent font-semibold text-base focus:outline-none truncate"
              placeholder="Название"
            />
          </div>
          {saving && <span className="text-xs text-muted-foreground">Сохраняю...</span>}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-4 space-y-4">

        {/* Meta */}
        <div className="rounded-xl border border-border bg-card p-4 grid grid-cols-2 gap-3 text-sm">
          {/* Artist */}
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground">Исполнитель</label>
            <input
              value={song.original_artist ?? ''}
              onChange={e => updateMeta({ original_artist: e.target.value || null })}
              placeholder="—"
              className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Key */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Тональность</label>
            <div className="flex gap-1">
              <select
                value={song.key_root ?? ''}
                onChange={e => updateMeta({ key_root: e.target.value || null })}
                className="flex-1 rounded border border-border bg-background px-2 py-1.5 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">—</option>
                {ROOTS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                value={song.key_quality ?? 'maj'}
                onChange={e => updateMeta({ key_quality: e.target.value as KeyQuality })}
                className="w-20 rounded border border-border bg-background px-2 py-1.5 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {QUALITIES.map(q => <option key={q.value} value={q.value}>{q.value}</option>)}
              </select>
            </div>
          </div>

          {/* BPM */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">BPM</label>
            <input
              type="number"
              min={20}
              max={300}
              value={song.bpm ?? ''}
              onChange={e => updateMeta({ bpm: e.target.value ? Number(e.target.value) : null })}
              placeholder="—"
              className="w-full rounded border border-border bg-background px-3 py-1.5 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Status */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Статус</label>
            <select
              value={song.status}
              onChange={e => updateMeta({ status: e.target.value as SongStatus })}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Time signature */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Размер</label>
            <select
              value={song.time_signature ?? '4/4'}
              onChange={e => updateMeta({ time_signature: e.target.value })}
              className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {['4/4', '3/4', '6/8', '12/8', '5/4', '7/8'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Transpose */}
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <span className="text-sm text-muted-foreground">Транспонирование</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTranspose(t => t - 1)}
              className="h-7 w-7 rounded-md border border-border text-sm hover:bg-muted transition-colors flex items-center justify-center"
            >−</button>
            <span className="w-12 text-center font-mono text-sm font-semibold">
              {transpose === 0 ? keyDisplay : (transpose > 0 ? `+${transpose}` : transpose)}
            </span>
            <button
              onClick={() => setTranspose(t => t + 1)}
              className="h-7 w-7 rounded-md border border-border text-sm hover:bg-muted transition-colors flex items-center justify-center"
            >+</button>
          </div>
          {transpose !== 0 && (
            <Button size="sm" variant="outline" onClick={applyTranspose}>
              Применить → {keyDisplay}
            </Button>
          )}
          {transpose !== 0 && (
            <button
              onClick={() => setTranspose(0)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Сброс
            </button>
          )}
        </div>

        {/* Blocks */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Блоки
            </h2>
            <button
              onClick={addBlock}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              + Добавить блок
            </button>
          </div>

          {blocks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Нет блоков. Нажми «+ Добавить блок».
            </p>
          ) : (
            blocks.map(block => (
              <BlockRow
                key={block.id}
                block={block}
                transpose={transpose}
                onUpdate={updateBlock}
                onDelete={deleteBlock}
              />
            ))
          )}
        </div>

        {/* Danger zone */}
        <div className="pt-4 pb-8">
          <button
            onClick={deleteSong}
            className="text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            Удалить песню
          </button>
        </div>
      </div>
    </div>
  )
}
