// Chromatic scale — sharp notation
const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
// Flat equivalents for enharmonic display
const NOTES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

/** All selectable roots in the UI (mix of sharp/flat for readability) */
export const ROOTS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B']

export const QUALITIES = [
  { value: 'maj',  label: '' },
  { value: 'm',    label: 'm' },
  { value: '7',    label: '7' },
  { value: 'm7',   label: 'm7' },
  { value: 'maj7', label: 'Δ7' },
  { value: 'dim',  label: '°' },
  { value: 'aug',  label: '+' },
  { value: 'sus2', label: 'sus2' },
  { value: 'sus4', label: 'sus4' },
]

/** Normalize any note name to chromatic index 0–11 */
export function noteToIndex(note: string): number {
  const sharp = NOTES_SHARP.indexOf(note)
  if (sharp !== -1) return sharp
  const flat = NOTES_FLAT.indexOf(note)
  if (flat !== -1) return flat
  return 0
}

/** Prefer sharps, but use flat equivalents for Db Eb Gb Ab Bb */
function indexToNote(index: number, preferFlat = false): string {
  const i = ((index % 12) + 12) % 12
  return preferFlat ? NOTES_FLAT[i] : NOTES_SHARP[i]
}

function shouldPreferFlat(note: string): boolean {
  return NOTES_FLAT.includes(note) && !NOTES_SHARP.includes(note)
}

/** Transpose a single note name by `semitones` */
export function transposeNote(note: string, semitones: number): string {
  const idx = noteToIndex(note)
  return indexToNote(idx + semitones, shouldPreferFlat(note))
}

/** Format chord root + quality for display */
export function formatChord(root: string, quality: string, bass?: string | null): string {
  const q = quality === 'maj' ? '' : quality
  const b = bass ? `/${bass}` : ''
  return `${root}${q}${b}`
}

/** Transpose a full chord progression (2D) by semitones */
export function transposeProgression(
  progression: { root: string; quality: string; bass?: string | null }[][],
  semitones: number,
): { root: string; quality: string; bass?: string | null }[][] {
  return progression.map(row =>
    row.map(({ root, quality, bass }) => ({
      root: transposeNote(root, semitones),
      quality,
      bass: bass ? transposeNote(bass, semitones) : bass,
    }))
  )
}

/** Normalize progression from old 1D format (legacy DB data) or new 2D format */
export function normalizeProgression(raw: unknown): { root: string; quality: string; bass?: string | null }[][] {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return []
  // If first element is an array → already 2D
  if (Array.isArray(raw[0])) return raw as { root: string; quality: string; bass?: string | null }[][]
  // Old 1D format → wrap in array to make 2D
  return [raw as { root: string; quality: string; bass?: string | null }[]]
}
