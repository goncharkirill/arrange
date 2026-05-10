import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '@/lib/supabase'
import type { Band, Song, Block, ChordVoicing, SongStatus, KeyQuality, BlockType } from '@/types/db'
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

const KEY_QUALITIES: { value: KeyQuality; label: string }[] = [
  { value: 'maj', label: 'мажор' },
  { value: 'm',   label: 'минор' },
]

const TIME_SIGNATURES = ['4/4', '3/4', '6/8', '12/8', '5/4', '7/8']
const VARIABLE_TIME = 'variable'

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getKeyTone(quality: string | null): 'major' | 'minor' | 'none' {
  if (!quality) return 'none'
  if (quality === 'm' || quality === 'm7' || quality === 'dim') return 'minor'
  return 'major'
}

function isMinorQuality(quality: string): boolean {
  return quality === 'm' || quality === 'm7' || quality === 'dim'
}

// ─── Chord Picker ─────────────────────────────────────────────────────────────

interface ChordPickerProps {
  value: ChordVoicing | null
  onChange: (c: ChordVoicing) => void
  onClose: () => void
  rect: DOMRect
}

function ChordPicker({ value, onChange, onClose, rect }: ChordPickerProps) {
  const [root, setRoot] = useState(value?.root ?? 'C')
  const [quality, setQuality] = useState(value?.quality ?? 'maj')
  const [bass, setBass] = useState(value?.bass ?? '')
  const [showBass, setShowBass] = useState(!!value?.bass)
  const ref = useRef<HTMLDivElement>(null)

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

  // Flip upward if not enough space below
  const spaceBelow = window.innerHeight - rect.bottom
  const pickerHeight = 280
  const top = spaceBelow >= pickerHeight ? rect.bottom + 4 : rect.top - pickerHeight - 4

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        zIndex: 9999,
        top,
        left: Math.min(rect.left, window.innerWidth - 268),
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 12,
        boxShadow: 'var(--shadow-md)',
        width: 256,
      }}
    >
      {/* Root grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3, marginBottom: 8 }}>
        {roots.map(r => (
          <button
            key={r}
            onClick={() => setRoot(r)}
            style={{
              borderRadius: 4,
              padding: '4px 2px',
              fontSize: 11.5,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              transition: 'background 100ms',
              background: root === r ? 'var(--accent)' : 'var(--surface-2)',
              color: root === r ? 'var(--accent-fg)' : 'var(--text)',
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Quality grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, marginBottom: 8 }}>
        {QUALITIES.map(q => (
          <button
            key={q.value}
            onClick={() => setQuality(q.value)}
            style={{
              borderRadius: 4,
              padding: '4px 6px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 100ms',
              background: quality === q.value ? 'var(--accent)' : 'var(--surface-2)',
              color: quality === q.value ? 'var(--accent-fg)' : 'var(--text)',
            }}
          >
            {root}{q.label}
          </button>
        ))}
      </div>

      {/* Bass */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setShowBass(v => !v)}
          style={{ fontSize: 11.5, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {showBass ? '− убрать бас' : '+ slash bass'}
        </button>
        {showBass && (
          <select
            value={bass}
            onChange={e => setBass(e.target.value)}
            style={{
              flex: 1, borderRadius: 4,
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text)',
              padding: '2px 6px',
              fontSize: 11.5,
              fontFamily: 'var(--font-mono)',
            }}
          >
            <option value="">—</option>
            {roots.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="sm" style={{ flex: 1 }} onClick={confirm}>
          {formatChord(root, quality, showBass && bass ? bass : null) || root}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
      </div>
    </div>,
    document.body
  )
}

// ─── Block Row (sortable div row) ────────────────────────────────────────────

interface BlockRowProps {
  block: Block
  transpose: number
  variableTime: boolean
  onUpdate: (id: string, patch: Partial<Block>) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
}

function BlockRow({ block, transpose, variableTime, onUpdate, onDelete, onDuplicate }: BlockRowProps) {
  const [pickerIndex, setPickerIndex] = useState<number | null>(null)
  const [pickerRect, setPickerRect] = useState<DOMRect | null>(null)
  const [hovered, setHovered] = useState(false)
  const progression = block.progression ?? []
  const displayProg = transpose !== 0 ? transposeProgression(progression, transpose) : progression

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })

  function addChord() {
    onUpdate(block.id, { progression: [...progression, { root: 'C', quality: 'maj', bass: null }] })
  }

  function updateChord(i: number, c: ChordVoicing) {
    const newProg = [...progression]
    newProg[i] = c
    onUpdate(block.id, { progression: newProg })
  }

  function removeChord(i: number) {
    onUpdate(block.id, { progression: progression.filter((_, idx) => idx !== i) })
  }

  const hasExtra = !!(block.bass_notes || block.note)

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '20px auto auto 1fr auto',
        alignItems: 'start',
        borderBottom: '1px solid var(--hairline)',
        background: isDragging ? 'var(--surface-3)' : hovered ? 'var(--surface-2)' : 'transparent',
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
        position: 'relative',
      }}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        style={{
          padding: '12px 0 12px 6px',
          cursor: 'grab',
          color: hovered ? 'var(--muted)' : 'var(--faint)',
          display: 'flex', alignItems: 'flex-start',
          touchAction: 'none',
        }}
        title="Перетащить"
      >
        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
          <circle cx="3" cy="3" r="1.2"/><circle cx="7" cy="3" r="1.2"/>
          <circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/>
          <circle cx="3" cy="11" r="1.2"/><circle cx="7" cy="11" r="1.2"/>
        </svg>
      </div>

      {/* Type badge */}
      <div style={{ padding: '10px 12px 10px 6px' }}>
        <select
          value={block.type}
          onChange={e => onUpdate(block.id, { type: e.target.value as BlockType })}
          className="type-badge"
          data-t={block.type}
          style={{ border: 'none', cursor: 'pointer', appearance: 'none', paddingRight: 7 }}
        >
          {BLOCK_TYPES.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
        </select>
      </div>

      {/* Bars */}
      <div style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted)', fontSize: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)' }}>(</span>
          <input
            type="number" min={1} max={64}
            value={block.bars ?? ''}
            onChange={e => onUpdate(block.id, { bars: e.target.value ? Number(e.target.value) : null })}
            placeholder="?"
            style={{
              width: 28, textAlign: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 12,
              border: 'none', background: 'transparent',
              color: 'var(--text)', outline: 'none',
            }}
          />
          <span style={{ fontFamily: 'var(--font-mono)' }}>)</span>
          {block.repeat_count && block.repeat_count > 1 && (
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>×{block.repeat_count}</span>
          )}
          {variableTime && (
            <select
              value={block.time_signature ?? '4/4'}
              onChange={e => onUpdate(block.id, { time_signature: e.target.value })}
              style={{
                fontSize: 11, fontFamily: 'var(--font-mono)',
                border: '1px solid var(--border)', borderRadius: 3,
                background: 'var(--surface-2)', color: 'var(--text)',
                padding: '1px 4px', cursor: 'pointer',
              }}
            >
              {TIME_SIGNATURES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Chords + notes */}
      <div style={{ padding: '10px 16px 10px 0', minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, minHeight: 28 }}>
          {displayProg.length === 0 && (
            <span style={{ fontStyle: 'italic', color: 'var(--muted)', fontSize: 12 }}>N.C.</span>
          )}
          {displayProg.map((chord, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <button
                onClick={e => {
                  const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                  setPickerRect(rect)
                  setPickerIndex(pickerIndex === i ? null : i)
                }}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '2px 8px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13, fontWeight: 500,
                  cursor: 'pointer',
                  color: isMinorQuality(chord.quality) ? 'var(--minor)' : 'var(--text)',
                  transition: 'background 80ms',
                }}
              >
                {formatChord(chord.root, chord.quality, chord.bass)}
              </button>
              {pickerIndex === i && pickerRect && (
                <ChordPicker
                  value={progression[i]}
                  onChange={c => { updateChord(i, c); setPickerIndex(null) }}
                  onClose={() => setPickerIndex(null)}
                  rect={pickerRect}
                />
              )}
              {hovered && (
                <button
                  onClick={() => removeChord(i)}
                  style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 14, height: 14,
                    borderRadius: '50%',
                    background: 'var(--muted)',
                    color: 'var(--surface)',
                    border: 'none',
                    fontSize: 9, lineHeight: 1,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >×</button>
              )}
            </div>
          ))}
          {hovered && (
            <button
              onClick={addChord}
              style={{
                borderRadius: 'var(--radius-xs)',
                border: '1px dashed var(--border)',
                padding: '2px 8px',
                fontSize: 11.5,
                color: 'var(--muted)',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                transition: 'border-color 80ms, color 80ms',
              }}
            >
              + аккорд
            </button>
          )}
        </div>

        {/* Extra meta */}
        {hasExtra && (
          <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
            {block.bass_notes && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--subtle)', textTransform: 'uppercase' }}>bass</span>
                <span style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>{block.bass_notes}</span>
              </div>
            )}
            {block.note && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--subtle)', textTransform: 'uppercase' }}>note</span>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{block.note}</span>
              </div>
            )}
          </div>
        )}

        {/* Lyrics */}
        <textarea
          value={block.lyrics ?? ''}
          onChange={e => onUpdate(block.id, { lyrics: e.target.value || null })}
          placeholder="Текст (необязательно)..."
          rows={1}
          style={{
            marginTop: 6,
            width: '100%', resize: 'vertical',
            background: 'var(--surface-2)',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--radius-xs)',
            padding: '4px 8px',
            fontSize: 12,
            color: 'var(--text-2)',
            fontFamily: 'var(--font-ui)',
            outline: 'none',
            display: block.lyrics ? 'block' : hovered ? 'block' : 'none',
          }}
        />
      </div>

      {/* Actions: duplicate / delete */}
      <div style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
        {hovered && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              onClick={() => onDuplicate(block.id)}
              title="Дублировать блок"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', fontSize: 12, lineHeight: 1, padding: '2px 3px',
                transition: 'color 100ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            >⊕</button>
            <button
              onClick={() => onDelete(block.id)}
              title="Удалить блок"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', fontSize: 14, lineHeight: 1, padding: '2px 3px',
                transition: 'color 100ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--minor)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            >×</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function SongEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [song, setSong] = useState<Song | null>(null)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [bands, setBands] = useState<Band[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [transpose, setTranspose] = useState(0)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load ──
  useEffect(() => {
    if (!id) return
    const songId = id
    async function load() {
      const [songRes, blocksRes, bandsRes] = await Promise.all([
        supabase.from('songs').select('*').eq('id', songId).single(),
        supabase.from('blocks').select('*').eq('song_id', songId).order('position'),
        supabase.from('bands').select('*').order('name'),
      ])
      if (songRes.data) setSong(songRes.data as Song)
      if (blocksRes.data) setBlocks(blocksRes.data as Block[])
      if (bandsRes.data) setBands(bandsRes.data)
      setLoading(false)
    }
    load()
  }, [id])

  // ── Save meta (debounced) ──
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
    const { data } = await supabase
      .from('blocks')
      .insert({ song_id: id, position: blocks.length, type: 'verse', bars: 8 })
      .select().single()
    if (data) setBlocks(prev => [...prev, data as Block])
  }

  async function updateBlock(blockId: string, patch: Partial<Block>) {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, ...patch } : b))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('blocks').update(patch as any).eq('id', blockId)
  }

  async function deleteBlock(blockId: string) {
    setBlocks(prev => prev.filter(b => b.id !== blockId))
    await supabase.from('blocks').delete().eq('id', blockId)
  }

  async function duplicateBlock(blockId: string) {
    if (!id) return
    const idx = blocks.findIndex(b => b.id === blockId)
    if (idx === -1) return
    const src = blocks[idx]
    // Shift all blocks after insertion point up by 1
    const afterIdx = blocks.slice(idx + 1)
    await Promise.all(afterIdx.map(b =>
      supabase.from('blocks').update({ position: b.position + 1 }).eq('id', b.id)
    ))
    const { data } = await supabase.from('blocks').insert({
      song_id: id,
      position: src.position + 1,
      type: src.type,
      custom_label: src.custom_label,
      bars: src.bars,
      repeat_count: src.repeat_count,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progression: src.progression as any,
      lyrics: src.lyrics,
      bass_notes: src.bass_notes,
      note: src.note,
      time_signature: src.time_signature,
    }).select().single()
    if (data) {
      setBlocks(prev => {
        const next = prev.map(b => b.position > src.position ? { ...b, position: b.position + 1 } : b)
        next.splice(idx + 1, 0, data as Block)
        return next
      })
    }
  }

  // ── Drag-and-drop ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = blocks.findIndex(b => b.id === active.id)
    const newIdx = blocks.findIndex(b => b.id === over.id)
    const reordered = arrayMove(blocks, oldIdx, newIdx).map((b, i) => ({ ...b, position: i }))
    setBlocks(reordered)
    await Promise.all(reordered.map(b =>
      supabase.from('blocks').update({ position: b.position }).eq('id', b.id)
    ))
  }

  // ── Apply transpose ──
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
      : b))
    setTranspose(0)
  }

  // ── Delete song ──
  async function deleteSong() {
    if (!song) return
    if (!confirm(`Удалить «${song.name}»? Это нельзя отменить.`)) return
    await supabase.from('songs').delete().eq('id', song.id)
    navigate('/')
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontSize: 13 }}>
      Загрузка...
    </div>
  )
  if (!song) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontSize: 13 }}>
      Песня не найдена.
    </div>
  )

  const isVariableTime = song.time_signature === VARIABLE_TIME
  const keyDisplay = song.key_root
    ? `${transposeNote(song.key_root, transpose)}${song.key_quality === 'm' ? 'm' : ''}`
    : '—'
  const keyTone = getKeyTone(song.key_quality)
  const totalBars = blocks.reduce((acc, b) => acc + (b.bars ?? 0), 0)
  const blocksWithBass = blocks.filter(b => b.bass_notes)
  const blocksWithNote = blocks.filter(b => b.note)
  const blocksWithLyrics = blocks.filter(b => b.lyrics)

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
          to="/"
          style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none', transition: 'color 120ms' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
        >
          Songs
        </Link>
        <span style={{ color: 'var(--faint)', fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{song.name}</span>

        <div style={{ flex: 1 }} />

        {saving && <span style={{ fontSize: 12, color: 'var(--subtle)' }}>Сохраняю...</span>}

        {/* Transpose controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setTranspose(t => t - 1)}
            style={{
              width: 26, height: 26,
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >−</button>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600,
            color: transpose !== 0 ? 'var(--accent)' : 'var(--text)',
            minWidth: 48, textAlign: 'center',
          }}>
            {transpose === 0 ? keyDisplay : (transpose > 0 ? `+${transpose}` : transpose)}
          </span>
          <button
            onClick={() => setTranspose(t => t + 1)}
            style={{
              width: 26, height: 26,
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >+</button>
          {transpose !== 0 && (
            <>
              <button
                onClick={applyTranspose}
                style={{
                  fontSize: 12, padding: '3px 10px',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--accent)',
                  background: 'var(--accent-bg)',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                }}
              >Применить → {keyDisplay}</button>
              <button
                onClick={() => setTranspose(0)}
                style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
              >Сброс</button>
            </>
          )}
        </div>

        {/* Concert button */}
        <button
          onClick={() => navigate(`/songs/${song.id}/concert`)}
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

      {/* ── Editor body ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 300px', overflow: 'hidden' }}>

        {/* Left column */}
        <div style={{ overflowY: 'auto', padding: '32px 48px 80px' }}>

          {/* Song title */}
          <input
            value={song.name}
            onChange={e => updateMeta({ name: e.target.value })}
            placeholder="Название песни"
            style={{
              display: 'block',
              width: '100%',
              fontSize: 30, fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--text)',
              border: 'none', outline: 'none',
              background: 'transparent',
              marginBottom: 4,
              fontFamily: 'var(--font-ui)',
            }}
          />

          {/* Subtitle: original artist */}
          <input
            value={song.original_artist ?? ''}
            onChange={e => updateMeta({ original_artist: e.target.value || null })}
            placeholder="originally by..."
            style={{
              display: 'block', width: '100%',
              fontSize: 13.5, color: 'var(--muted)',
              border: 'none', outline: 'none',
              background: 'transparent',
              marginBottom: 20,
              fontFamily: 'var(--font-ui)',
            }}
          />

          {/* Meta chips row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 32 }}>
            {/* Key */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--surface-2)',
              border: '1px solid var(--hairline)',
              borderRadius: 999,
              padding: '3px 10px',
            }}>
              <span style={{ fontSize: 11, color: 'var(--subtle)' }}>key</span>
              <span className="key-chip" data-tone={keyTone} style={{ padding: '0 6px', border: 'none' }}>
                {song.key_root ? `${song.key_root}${song.key_quality === 'm' ? 'm' : ''}` : '—'}
              </span>
              <select
                value={song.key_root ?? ''}
                onChange={e => updateMeta({ key_root: e.target.value || null })}
                style={{
                  border: 'none', background: 'transparent',
                  fontSize: 11, color: 'var(--muted)', cursor: 'pointer',
                  outline: 'none', appearance: 'none', width: 16,
                }}
              >
                <option value="">—</option>
                {ROOTS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                value={song.key_quality ?? 'maj'}
                onChange={e => updateMeta({ key_quality: e.target.value as KeyQuality })}
                style={{
                  border: 'none', background: 'transparent',
                  fontSize: 11, color: 'var(--muted)', cursor: 'pointer',
                  outline: 'none', appearance: 'none',
                }}
              >
                {KEY_QUALITIES.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
              </select>
            </div>

            {/* BPM */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--surface-2)',
              border: '1px solid var(--hairline)',
              borderRadius: 999,
              padding: '3px 10px',
            }}>
              <span style={{ fontSize: 11, color: 'var(--subtle)' }}>bpm</span>
              <input
                type="number" min={20} max={300}
                value={song.bpm ?? ''}
                onChange={e => updateMeta({ bpm: e.target.value ? Number(e.target.value) : null })}
                placeholder="—"
                style={{
                  width: 40,
                  fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 500,
                  border: 'none', background: 'transparent',
                  color: 'var(--text)', outline: 'none',
                  textAlign: 'center',
                }}
              />
            </div>

            {/* Time */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--surface-2)',
              border: '1px solid var(--hairline)',
              borderRadius: 999,
              padding: '3px 10px',
            }}>
              <span style={{ fontSize: 11, color: 'var(--subtle)' }}>time</span>
              <select
                value={song.time_signature ?? '4/4'}
                onChange={e => updateMeta({ time_signature: e.target.value })}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 500,
                  border: 'none', background: 'transparent',
                  color: 'var(--text)', outline: 'none', cursor: 'pointer',
                }}
              >
                {TIME_SIGNATURES.map(t => <option key={t} value={t}>{t}</option>)}
                <option value={VARIABLE_TIME}>var.</option>
              </select>
            </div>

            {/* Status */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--surface-2)',
              border: '1px solid var(--hairline)',
              borderRadius: 999,
              padding: '3px 10px',
            }}>
              <span style={{ fontSize: 11, color: 'var(--subtle)' }}>status</span>
              <select
                value={song.status}
                onChange={e => updateMeta({ status: e.target.value as SongStatus })}
                style={{
                  fontSize: 12.5,
                  border: 'none', background: 'transparent',
                  color: 'var(--text)', outline: 'none', cursor: 'pointer',
                }}
              >
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Band */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--surface-2)',
              border: '1px solid var(--hairline)',
              borderRadius: 999,
              padding: '3px 10px',
            }}>
              <span style={{ fontSize: 11, color: 'var(--subtle)' }}>группа</span>
              <select
                value={song.band_id ?? ''}
                onChange={e => updateMeta({ band_id: e.target.value || null })}
                style={{
                  fontSize: 12.5,
                  border: 'none', background: 'transparent',
                  color: 'var(--text)', outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="">—</option>
                {bands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          {/* Section: Form · Roadmap */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{
              fontSize: 10.5, fontFamily: 'var(--font-mono)',
              fontWeight: 600, letterSpacing: '0.08em',
              color: 'var(--subtle)', textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}>
              Form · Roadmap
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
            <span style={{
              fontSize: 11, fontFamily: 'var(--font-mono)',
              color: 'var(--muted)', whiteSpace: 'nowrap',
            }}>
              {blocks.length} секций · {totalBars} тактов
            </span>
          </div>

          {/* Roadmap */}
          <div style={{
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            marginBottom: 24,
            fontSize: 12.5,
          }}>
            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '20px auto auto 1fr auto',
              background: 'var(--surface-2)', borderBottom: '1px solid var(--hairline)',
              padding: '7px 12px 7px 6px',
            }}>
              <div />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: 6 }}>Секция</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: 12 }}>Такты</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Аккорды / заметки</div>
              <div />
            </div>

            {/* Sortable blocks */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                {blocks.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                    Нет блоков
                  </div>
                ) : (
                  blocks.map(block => (
                    <BlockRow
                      key={block.id}
                      block={block}
                      transpose={transpose}
                      variableTime={isVariableTime}
                      onUpdate={updateBlock}
                      onDelete={deleteBlock}
                      onDuplicate={duplicateBlock}
                    />
                  ))
                )}
              </SortableContext>
            </DndContext>

            {/* Add block */}
            <div style={{ borderTop: '1px dashed var(--hairline)' }}>
              <button
                onClick={addBlock}
                style={{
                  display: 'block', width: '100%',
                  padding: '10px 20px',
                  background: 'transparent', border: 'none',
                  color: 'var(--muted)',
                  fontFamily: 'var(--font-mono)', fontSize: 12,
                  textAlign: 'left', cursor: 'pointer',
                  transition: 'color 100ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
              >
                + Добавить блок
              </button>
            </div>
          </div>

          {/* Lyrics section */}
          {blocksWithLyrics.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--subtle)', textTransform: 'uppercase' }}>
                  Lyrics
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', marginBottom: 24 }}>
                {blocksWithLyrics.map(block => (
                  <>
                    <span key={`lbl-${block.id}`} className="type-badge" data-t={block.type} style={{ alignSelf: 'start', marginTop: 2 }}>
                      {block.type}
                    </span>
                    <span key={`txt-${block.id}`} style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {block.lyrics}
                    </span>
                  </>
                ))}
              </div>
            </>
          )}

          {/* Danger zone */}
          <div style={{ paddingTop: 16, borderTop: '1px solid var(--hairline)' }}>
            <button
              onClick={deleteSong}
              style={{ fontSize: 12.5, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 100ms' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--minor)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            >
              Удалить песню
            </button>
          </div>
        </div>

        {/* ── Right rail ── */}
        <div style={{
          borderLeft: '1px solid var(--hairline)',
          background: 'var(--surface-2)',
          overflowY: 'auto',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}>

          {/* Quick info */}
          <section>
            <h4 style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--subtle)', textTransform: 'uppercase', margin: '0 0 10px' }}>
              Быстро
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', fontSize: 12.5 }}>
              <span style={{ color: 'var(--subtle)' }}>Тон.</span>
              <span className="key-chip" data-tone={keyTone}>{song.key_root ? `${song.key_root}${song.key_quality === 'm' ? 'm' : ''}` : '—'}</span>
              <span style={{ color: 'var(--subtle)' }}>BPM</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{song.bpm ?? '—'}</span>
              <span style={{ color: 'var(--subtle)' }}>Размер</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{song.time_signature ?? '—'}</span>
              {song.tuning && <>
                <span style={{ color: 'var(--subtle)' }}>Строй</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{song.tuning}</span>
              </>}
            </div>
          </section>

          {/* Bass plan */}
          {blocksWithBass.length > 0 && (
            <section>
              <h4 style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--subtle)', textTransform: 'uppercase', margin: '0 0 10px' }}>
                Bass plan
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px' }}>
                {blocksWithBass.map(block => (
                  <>
                    <span key={`bl-${block.id}`} className="type-badge" data-t={block.type}>{block.type}</span>
                    <span key={`bt-${block.id}`} style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', alignSelf: 'center' }}>{block.bass_notes}</span>
                  </>
                ))}
              </div>
            </section>
          )}

          {/* Cues / transitions */}
          {blocksWithNote.length > 0 && (
            <section>
              <h4 style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--subtle)', textTransform: 'uppercase', margin: '0 0 10px' }}>
                Cues / transitions
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px' }}>
                {blocksWithNote.map(block => (
                  <>
                    <span key={`nl-${block.id}`} className="type-badge" data-t={block.type}>{block.type}</span>
                    <span key={`nt-${block.id}`} style={{ fontSize: 12, color: 'var(--text-2)', alignSelf: 'center' }}>{block.note}</span>
                  </>
                ))}
              </div>
            </section>
          )}

          {/* Cheatsheet */}
          <section>
            <h4 style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--subtle)', textTransform: 'uppercase', margin: '0 0 10px' }}>
              Cheatsheet
            </h4>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)', lineHeight: 1.8, whiteSpace: 'pre' }}>
              {`(N)    — N тактов\n×N     — повтор N раз\nN.C.   — no chord\ntacet  — баса нет\nhits   — акценты\nbreak  — все стопаются\nrit.   — замедление\nferm.  — fermata`}
            </div>
          </section>

          {/* Notes field */}
          <section>
            <h4 style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--subtle)', textTransform: 'uppercase', margin: '0 0 10px' }}>
              Заметки
            </h4>
            <textarea
              value={song.notes ?? ''}
              onChange={e => updateMeta({ notes: e.target.value || null })}
              placeholder="Любые заметки о песне..."
              rows={4}
              style={{
                width: '100%', resize: 'vertical',
                border: '1px solid var(--hairline)',
                borderRadius: 'var(--radius-xs)',
                background: 'var(--surface)',
                color: 'var(--text-2)',
                padding: '8px 10px',
                fontSize: 12.5, lineHeight: 1.5,
                fontFamily: 'var(--font-ui)',
                outline: 'none',
              }}
            />
          </section>
        </div>
      </div>
    </div>
  )
}
