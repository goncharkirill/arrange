export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Database = {
  public: {
    Tables: {
      bands: {
        Row: {
          id: string
          name: string
          color: string
        }
        Insert: {
          id?: string
          name: string
          color: string
        }
        Update: {
          id?: string
          name?: string
          color?: string
        }
        Relationships: []
      }
      songs: {
        Row: {
          id: string
          name: string
          original_artist: string | null
          band_id: string | null
          key_root: string | null
          key_quality: string | null
          bpm: number | null
          time_signature: string | null
          duration_seconds: number | null
          tuning: string | null
          status: string
          youtube_url: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          original_artist?: string | null
          band_id?: string | null
          key_root?: string | null
          key_quality?: string | null
          bpm?: number | null
          time_signature?: string | null
          duration_seconds?: number | null
          tuning?: string | null
          status?: string
          youtube_url?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          original_artist?: string | null
          band_id?: string | null
          key_root?: string | null
          key_quality?: string | null
          bpm?: number | null
          time_signature?: string | null
          duration_seconds?: number | null
          tuning?: string | null
          status?: string
          youtube_url?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          id: string
          song_id: string
          position: number
          type: string
          custom_label: string | null
          bars: number | null
          repeat_count: number | null
          progression: Json | null
          lyrics: string | null
          bass_notes: string | null
          note: string | null
          time_signature: string | null
        }
        Insert: {
          id?: string
          song_id: string
          position: number
          type: string
          custom_label?: string | null
          bars?: number | null
          repeat_count?: number | null
          progression?: Json | null
          lyrics?: string | null
          bass_notes?: string | null
          note?: string | null
          time_signature?: string | null
        }
        Update: {
          id?: string
          song_id?: string
          position?: number
          type?: string
          custom_label?: string | null
          bars?: number | null
          repeat_count?: number | null
          progression?: Json | null
          lyrics?: string | null
          bass_notes?: string | null
          note?: string | null
          time_signature?: string | null
        }
        Relationships: []
      }
      setlists: {
        Row: {
          id: string
          name: string
          date: string | null
          venue: string | null
          band_id: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          name: string
          date?: string | null
          venue?: string | null
          band_id?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          name?: string
          date?: string | null
          venue?: string | null
          band_id?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      setlist_songs: {
        Row: {
          id: string
          setlist_id: string
          song_id: string
          position: number
          custom_key_root: string | null
          custom_key_quality: string | null
          transition_notes: string | null
        }
        Insert: {
          id?: string
          setlist_id: string
          song_id: string
          position: number
          custom_key_root?: string | null
          custom_key_quality?: string | null
          transition_notes?: string | null
        }
        Update: {
          id?: string
          setlist_id?: string
          song_id?: string
          position?: number
          custom_key_root?: string | null
          custom_key_quality?: string | null
          transition_notes?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type SongStatus = 'idea' | 'learning' | 'polishing' | 'setlist' | 'archive'
export type KeyQuality = 'maj' | 'm'
export type BlockType = 'intro' | 'verse' | 'pre-chorus' | 'chorus' | 'bridge' | 'solo' | 'outro' | 'break' | 'tag'

export interface ChordVoicing {
  root: string
  quality: string
  bass?: string | null
}

export type Band = Database['public']['Tables']['bands']['Row']

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
  time_signature: string | null
}

export type Setlist = Database['public']['Tables']['setlists']['Row']
export type SetlistSong = Database['public']['Tables']['setlist_songs']['Row']
