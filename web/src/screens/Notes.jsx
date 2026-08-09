import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { noteDate } from '../format.js'

/** Where the "Write to Teeta" notes land. Private to her. */
export default function Notes({ onCountChange }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    api
      .listMessages()
      .then((data) => live && setMessages(data.messages))
      .catch((err) => live && setError(err.message))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [])

  // Derive the badge from what is on screen rather than reporting it from
  // inside a state updater, which StrictMode may run twice.
  useEffect(() => {
    onCountChange?.(messages.filter((m) => !m.read).length)
  }, [messages, onCountChange])

  async function toggle(note) {
    const read = !note.read
    setMessages((all) => all.map((m) => (m.id === note.id ? { ...m, read } : m)))
    try {
      await api.markMessage(note.id, read)
    } catch {
      setMessages((all) => all.map((m) => (m.id === note.id ? { ...m, read: !read } : m)))
    }
  }

  return (
    <section className="screen column" aria-label="Notes">
      <div className="rule-row" style={{ marginBottom: 24 }}>
        <h2 className="h-display" style={{ margin: 0 }}>
          Notes
        </h2>
        <div className="rule" />
        <span className="hand" style={{ fontSize: 23 }}>
          {loading ? 'looking…' : `${messages.length || 'none'} so far`}
        </span>
      </div>

      {error && <div className="err">{error}</div>}

      {!loading && !error && messages.length === 0 && (
        <div className="hand" style={{ fontSize: 24, padding: '20px 0' }}>
          Nobody has written yet.
        </div>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        {messages.map((m) => (
          <article key={m.id} className="note-card" data-unread={String(!m.read)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 21 }}>
                {m.subject || 'A note'}
              </span>
              <span className="kicker">{noteDate(m.created_at)}</span>
            </div>
            <div className="review-creator" style={{ fontSize: 13 }}>
              {m.name || 'someone'}
              {m.email && ` · ${m.email}`}
            </div>
            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{m.body}</p>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn-quiet" onClick={() => toggle(m)}>
                {m.read ? 'Mark unread' : 'Mark read'}
              </button>
              {m.email && (
                <a
                  className="btn-quiet"
                  style={{ textDecoration: 'none' }}
                  href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject || 'your note'}`)}`}
                >
                  Write back
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
