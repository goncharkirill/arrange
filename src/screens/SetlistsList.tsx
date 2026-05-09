import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Setlist } from '@/types/db'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export function SetlistsList() {
  const navigate = useNavigate()
  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSetlists() {
      const { data, error } = await supabase
        .from('setlists')
        .select('*')
        .order('date', { ascending: false })

      if (error) {
        setError(error.message)
      } else {
        setSetlists((data ?? []) as Setlist[])
      }
      setLoading(false)
    }
    fetchSetlists()
  }, [])

  async function handleNew() {
    const { data, error } = await supabase
      .from('setlists')
      .insert({ name: 'Новый сетлист' })
      .select()
      .single()

    if (error) {
      setError(error.message)
    } else if (data) {
      navigate(`/setlists/${data.id}`)
    }
  }

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
          Setlists
        </span>
        <div style={{ flex: 1 }} />
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
          + Новый
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {error && (
          <div style={{ marginBottom: 16, color: 'var(--minor)', fontSize: 13 }}>{error}</div>
        )}

        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            Загрузка...
          </div>
        ) : setlists.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            Сетлистов нет. Нажми «+ Новый».
          </div>
        ) : (
          <div style={{
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            background: 'var(--surface)',
          }}>
            {setlists.map((setlist, i) => (
              <button
                key={setlist.id}
                onClick={() => navigate(`/setlists/${setlist.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '12px 20px',
                  border: 'none',
                  borderBottom: i < setlists.length - 1 ? '1px solid var(--hairline)' : 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 80ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Date square */}
                {setlist.date ? (
                  <div style={{
                    width: 36, height: 36,
                    borderRadius: 8,
                    background: 'var(--accent-bg)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', lineHeight: 1, fontFamily: 'var(--font-mono)' }}>
                      {new Date(setlist.date + 'T00:00:00').getDate()}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--accent)', textTransform: 'uppercase', lineHeight: 1 }}>
                      {new Date(setlist.date + 'T00:00:00').toLocaleDateString('ru-RU', { month: 'short' })}
                    </span>
                  </div>
                ) : (
                  <div style={{
                    width: 36, height: 36,
                    borderRadius: 8,
                    background: 'var(--surface-3)',
                    flexShrink: 0,
                  }} />
                )}

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: 'var(--text)', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {setlist.name}
                  </div>
                  {setlist.venue && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {setlist.venue}
                    </div>
                  )}
                </div>

                {setlist.date && (
                  <div style={{ flexShrink: 0, fontSize: 12, color: 'var(--subtle)' }}>
                    {formatDate(setlist.date)}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
