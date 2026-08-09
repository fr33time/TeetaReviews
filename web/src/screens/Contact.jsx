import { useState } from 'react'
import { api } from '../api.js'

const EMPTY = { name: '', email: '', subject: '', body: '', website: '' }

export default function Contact() {
  const [note, setNote] = useState(EMPTY)
  const [status, setStatus] = useState('')
  const [errors, setErrors] = useState({})
  const [sending, setSending] = useState(false)

  const set = (key) => (e) => {
    setNote((n) => ({ ...n, [key]: e.target.value }))
    setStatus('')
    setErrors({})
  }

  async function send() {
    setSending(true)
    setErrors({})
    try {
      await api.sendMessage(note)
      setNote(EMPTY)
      setStatus('Off it goes.')
    } catch (err) {
      setErrors(err.errors || {})
      setStatus(err.errors ? '' : err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="screen column-narrow" aria-label="Write to Teeta">
      <h2 className="h-display">Write to Teeta</h2>
      <div className="hand" style={{ fontSize: 23, marginBottom: 14 }}>
        Tell her what you thought, or what she should read next.
      </div>
      <p style={{ fontSize: 15.5, lineHeight: 1.8, color: 'var(--color-neutral-700)', margin: '0 0 30px' }}>
        She reads every note on her desk.
      </p>

      <div style={{ display: 'grid', gap: 22 }}>
        <div className="two-up" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <label className="field">
            <span className="label">Your name</span>
            <input
              className="input"
              value={note.name}
              onChange={set('name')}
              placeholder="Which one are you?"
            />
          </label>
          <label className="field">
            <span className="label">Your email</span>
            <input
              className="input"
              type="email"
              value={note.email}
              onChange={set('email')}
              placeholder="So she can write back"
            />
          </label>
        </div>

        <label className="field">
          <span className="label">About</span>
          <input
            className="input"
            style={{ fontFamily: 'var(--font-heading)', fontSize: 22, padding: '9px 10px' }}
            value={note.subject}
            onChange={set('subject')}
            placeholder="A review, a recommendation, or nothing in particular"
          />
        </label>

        <label className="field">
          <span className="label">Your note</span>
          <textarea
            className={`input${errors.body ? ' input-bad' : ''}`}
            rows={10}
            value={note.body}
            onChange={set('body')}
            placeholder="Say hello."
          />
          {errors.body && <span className="err">{errors.body}</span>}
        </label>

        {/* Honeypot — off-screen, never focusable, never filled by a person. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={note.website}
          onChange={set('website')}
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={send} disabled={sending}>
            {sending ? 'Sending…' : 'Send it to Teeta'}
          </button>
          <span className="hand" style={{ fontSize: 21 }} role="status">
            {status}
          </span>
        </div>
      </div>
    </section>
  )
}
