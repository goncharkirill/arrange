/**
 * Import songs from /tmp/songs-import/Archive/*.md into Supabase
 * Run: npx tsx scripts/import-songs.ts
 */

import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

// ─── Credentials ──────────────────────────────────────────────────────────────

// Try worktree .env.local first, then fall back to main repo path
const worktreeEnvPath = '/Users/kirillgonchar/Projects/arrange/.claude/worktrees/suspicious-dhawan-e554c8/.env.local'
const mainEnvPath = '/Users/kirillgonchar/Projects/arrange/.env.local'
const envPath = (() => {
  try { readFileSync(worktreeEnvPath); return worktreeEnvPath } catch { return mainEnvPath }
})()
const env = readFileSync(envPath, 'utf8')
const url = env.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim()
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim()

if (!url || !key) {
  console.error('Could not read Supabase credentials from .env.local')
  process.exit(1)
}

const supabase = createClient(url, key)

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChordVoicing {
  root: string
  quality: string
  bass?: string | null
}

interface ParsedBlock {
  type: string
  custom_label: string | null
  repeat_count: number | null
  bars: number | null
  progression: ChordVoicing[][]
  note: string | null
}

interface ParsedSong {
  name: string
  blocks: ParsedBlock[]
}

// ─── Chord helpers ────────────────────────────────────────────────────────────

function mapGerman(s: string): string {
  return s
    .replace(/\bHm\b/g, 'Bm')
    .replace(/\bH([^a-zA-Z]|$)/g, 'B$1')
}

function parseChordToken(token: string): ChordVoicing | null {
  token = mapGerman(token.replace(/\*\*/g, '').trim())
  if (!token || /^[a-z]/.test(token)) return null

  let bass: string | null = null
  const slashIdx = token.indexOf('/')
  if (slashIdx > 0) {
    bass = mapGerman(token.slice(slashIdx + 1))
    token = token.slice(0, slashIdx)
  }

  const rootMatch = token.match(/^([A-G][#b]?)/)
  if (!rootMatch) return null
  const root = rootMatch[1]
  const qualStr = token.slice(root.length)

  let quality = 'maj'
  if (qualStr === 'm' || qualStr === 'min') quality = 'm'
  else if (qualStr === '7') quality = '7'
  else if (qualStr === 'maj7') quality = 'maj7'
  else if (qualStr === 'm7') quality = 'm7'
  else if (qualStr === 'sus2') quality = 'sus2'
  else if (qualStr === 'sus4') quality = 'sus4'
  else if (qualStr === 'dim') quality = 'dim'
  else if (qualStr === 'aug') quality = 'aug'
  else if (qualStr.length > 0) quality = qualStr

  return { root, quality, bass }
}

interface ParsedLine {
  chords: ChordVoicing[]
  repeat: number
  noteText: string | null
}

function parseChordLine(line: string): ParsedLine {
  line = line.replace(/\*\*/g, '').trim()

  // Strip trailing parenthetical notes FIRST like "(начало пычки)", "(double-stops)", "(b-a-g)"
  line = line.replace(/\([^)]*\)/g, '').trim()

  // Extract xN repeat at end
  let repeat = 1
  const repeatMatch = line.match(/\s+x(\d+)\s*$/i)
  if (repeatMatch) {
    repeat = parseInt(repeatMatch[1])
    line = line.slice(0, repeatMatch.index).trim()
  }

  const tokens = line.split(/\s+/).filter(Boolean)
  const chords: ChordVoicing[] = []
  const textParts: string[] = []

  for (const token of tokens) {
    const chord = parseChordToken(token)
    if (chord) chords.push(chord)
    else textParts.push(token)
  }

  const noteText = chords.length === 0 && textParts.length > 0 ? textParts.join(' ') : null
  return { chords, repeat, noteText }
}

// ─── Section type mapping ─────────────────────────────────────────────────────

function mapSectionType(name: string): string {
  const n = name.toLowerCase().trim()
  if (n === 'intro') return 'intro'
  if (n === 'verse' || n === 'куплет') return 'verse'
  if (n.includes('pre-chorus') || n.includes('pre chorus') || n.includes('pre-ch') || n === 'pre-chorus') return 'pre-chorus'
  if (n === 'chorus' || n === 'приспів') return 'chorus'
  if (n.includes('bridge')) return 'bridge'
  if (n.includes('solo')) return 'solo'
  if (n === 'outro') return 'outro'
  if (n === 'break') return 'break'
  if (n === 'tag') return 'tag'
  if (n === 'half-time') return 'verse'
  return 'verse'
}

// Known section keyword stems (checked before chord parsing)
const SECTION_STEMS = [
  'intro', 'verse', 'chorus', 'bridge', 'solo', 'outro', 'break', 'tag',
  'pre-chorus', 'half-time', 'куплет', 'приспів', 'vocal', 'piano', 'riff', 'пауза',
]

// Detect if a cleaned line is a section header (single or two-word phrase without chords)
function isSectionHeader(raw: string): boolean {
  // Strip bold markers
  const clean = raw.replace(/\*\*/g, '').replace(/\*/g, '').trim()
  if (!clean) return false

  const tokens = clean.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false

  // Check for repeated xN pattern — definitely a chord line
  if (/\bx\d+\b/i.test(clean)) return false

  // Check known section keywords FIRST (before chord parsing, since "Chorus" starts with C)
  const firstWord = tokens[0].toLowerCase()
  if (SECTION_STEMS.some(s => firstWord === s || firstWord.startsWith(s))) return true

  // Too long to be a header
  if (tokens.length > 4) return false

  // Now check if any tokens look like chords — if so, it's a chord line
  const chordCount = tokens.filter(t => parseChordToken(t) !== null).length
  if (chordCount > 0) return false

  // Capital letter, no digits, short — probably a sub-label like "A", "B", "C"
  if (/^[A-Z]$/.test(tokens[0]) && tokens.length === 1) return true

  return false
}

// ─── Markdown parser ──────────────────────────────────────────────────────────

function parseSongMd(content: string): ParsedSong {
  const lines = content.split('\n').map(l => l.trimEnd())

  // First non-empty line is title
  let name = 'Untitled'
  let startIdx = 0
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim()
    if (l.startsWith('#')) {
      name = l.replace(/^#+\s*/, '').trim()
      startIdx = i + 1
      break
    }
  }

  // Parse sections
  const blocks: ParsedBlock[] = []

  // Current section state
  let currentSection: string | null = null
  let currentLabel: string | null = null
  let contentLines: string[] = []
  let pendingNote: string | null = null

  function flushBlock() {
    if (currentSection === null) return

    // Parse content lines into rows
    const chordRows: ChordVoicing[][] = []
    const noteTexts: string[] = []
    let blockRepeat: number | null = null

    if (pendingNote) {
      noteTexts.push(pendingNote)
      pendingNote = null
    }

    for (const line of contentLines) {
      const stripped = line.replace(/\*\*/g, '').replace(/\*/g, '').trim()
      if (!stripped) continue

      // Check if it's a pure italic/note line (starts with *, is parenthetical text, etc.)
      if (/^\*[^*]/.test(line.trim()) || /^\*$/.test(line.trim())) {
        // italic text → note
        const noteContent = line.trim().replace(/^\*+/, '').replace(/\*+$/, '').trim()
        if (noteContent) noteTexts.push(noteContent)
        continue
      }

      const parsed = parseChordLine(stripped)

      if (parsed.chords.length > 0) {
        // Expand x2 repeat: add the same row N times
        for (let r = 0; r < parsed.repeat; r++) {
          chordRows.push([...parsed.chords])
        }
      } else if (parsed.noteText) {
        noteTexts.push(parsed.noteText)
      }
    }

    // Deduplicate: if all rows are identical, use repeat_count
    if (chordRows.length > 1) {
      const first = JSON.stringify(chordRows[0])
      if (chordRows.every(r => JSON.stringify(r) === first)) {
        blockRepeat = chordRows.length
        chordRows.splice(1) // keep only first
      }
    }

    blocks.push({
      type: mapSectionType(currentSection),
      custom_label: currentLabel,
      repeat_count: blockRepeat,
      bars: null,
      progression: chordRows,
      note: noteTexts.length > 0 ? noteTexts.join(' | ') : null,
    })

    contentLines = []
    pendingNote = null
  }

  for (let i = startIdx; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()
    if (!trimmed) continue

    // Strip bold for detection
    const cleaned = trimmed.replace(/\*\*/g, '').replace(/\*/g, '').trim()

    // Check for sub-label inside verse: bold single uppercase letter like **A**, **B**, **C**
    const subLabelMatch = trimmed.match(/^\*\*([A-Z])\*\*$/)
    if (subLabelMatch) {
      flushBlock()
      // Keep the same parent section type but with a label
      currentSection = currentSection ?? 'verse'
      currentLabel = subLabelMatch[1]
      contentLines = []
      continue
    }

    // Detect section headers
    if (isSectionHeader(cleaned)) {
      flushBlock()
      currentSection = cleaned
      currentLabel = null
      contentLines = []
      continue
    }

    // Content line
    if (currentSection !== null) {
      contentLines.push(raw)
    } else {
      // Lines before any section header — treat as an unnamed intro
      currentSection = 'intro'
      currentLabel = null
      contentLines.push(raw)
    }
  }

  flushBlock()

  return { name, blocks }
}

// ─── Import ───────────────────────────────────────────────────────────────────

async function importSong(filePath: string) {
  const content = readFileSync(filePath, 'utf8')
  const parsed = parseSongMd(content)

  console.log(`\nImporting: ${parsed.name} (${parsed.blocks.length} blocks)`)

  // Insert song
  const { data: song, error: songErr } = await supabase
    .from('songs')
    .insert({ name: parsed.name, status: 'learning' })
    .select()
    .single()

  if (songErr || !song) {
    console.error(`  ERROR inserting song: ${songErr?.message}`)
    return
  }

  console.log(`  Song ID: ${song.id}`)

  // Insert blocks
  for (let i = 0; i < parsed.blocks.length; i++) {
    const b = parsed.blocks[i]
    const { error: blockErr } = await supabase.from('blocks').insert({
      song_id: song.id,
      position: i,
      type: b.type,
      custom_label: b.custom_label,
      repeat_count: b.repeat_count,
      bars: b.bars,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progression: b.progression as any,
      note: b.note,
    })

    if (blockErr) {
      console.error(`  ERROR inserting block ${i} (${b.type}): ${blockErr.message}`)
    } else {
      const progSummary = b.progression.map(row =>
        row.map(c => `${c.root}${c.quality === 'maj' ? '' : c.quality}`).join(' ')
      ).join(' | ')
      console.log(`  Block ${i}: ${b.type}${b.custom_label ? ` [${b.custom_label}]` : ''} — ${progSummary || 'N.C.'}${b.note ? ` (note: ${b.note})` : ''}`)
    }
  }
}

async function main() {
  const dir = '/tmp/songs-import/Archive'
  const files = readdirSync(dir).filter(f => f.endsWith('.md'))

  console.log(`Found ${files.length} songs to import`)

  for (const file of files) {
    await importSong(join(dir, file))
  }

  console.log('\nDone!')
}

main().catch(err => { console.error(err); process.exit(1) })
