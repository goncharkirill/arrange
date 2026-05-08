export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      bands: {
        Row: Band
        Insert: Omit<Band, 'id'> & { id?: string }
        Update: Partial<Band>
        Relationships: []
      }
      songs: {
        Row: Song
        Insert: Omit<Song, 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Song>
        Relationships: []
      }
      blocks: {
        Row: Block
        Insert: Omit<Block, 'id'> & { id?: string }
        Update: Partial<Block>
        Relationships: []
      }
      setlists: {
        Row: Setlist
        Insert: Omit<Setlist, 'id'> & { id?: string }
        Update: Partial<Setlist>
        Relationships: []
      }
      setlist_songs: {
        Row: SetlistSong
        Insert: Omit<SetlistSong, 'id'> & { id?: string }
        Update: Partial<SetlistSong>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export interface Band {
  id: string
  name: string
  color: string
}

export type SongStatus = 'idea' | 'learning' | 'polishing' | 'setlist' | 'archive'

export type KeyQuality = 'maj' | 'm' | '7' | 'm7' | 'maj7' | 'dim' | 'aug' | 'sus2' | 'sus4'

export interface Song {
  id: string
  name: string
  original_artist: string | null
  band_id: string | null
  key_root: string | null
  key_quality: KeyQuality | null
  bpm: number | null
  time_signature: string | null
  duration_seconds: number | null
  tuning: string | null
  status: SongStatus
  youtube_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type BlockType = 'intro' | 'verse' | 'pre-chorus' | 'chorus' | 'bridge' | 'solo' | 'outro' | 'break' | 'tag'

export interface ChordVoicing {
  root: string
  quality: string
  bass?: string | null
}

export interface Block {
  id: string
  song_id: string
  position: number
  type: BlockType
  custom_label: string | null
  bars: number | null
  repeat_count: number | null
  progression: ChordVoicing[] | null
  lyrics: string | null
  bass_notes: string | null
  note: string | null
}

export interface Setlist {
  id: string
  name: string
  date: string | null
  venue: string | null
  band_id: string | null
  notes: string | null
}

export interface SetlistSong {
  id: string
  setlist_id: string
  song_id: string
  position: number
  custom_key_root: string | null
  custom_key_quality: string | null
  transition_notes: string | null
}
