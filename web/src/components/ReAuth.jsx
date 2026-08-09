import { useState } from 'react'
import { api } from '../api.js'

/**
 * Signing back in without leaving the page.
 *
 * A session can lapse while she is writing — it expires, or a deploy changes
 * the signing key — and the first sign of it is the publish button failing.
 * Sending her to the sign-in screen at that moment would take the review with
 * it, because a draft that has never been saved lives only in this tab. So the
 * way back in comes to her, and the save is retried on the spot.
 */
export default function ReAuth({ message, onSignedIn, onCancel }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e?.preventDefault()
    if (busy) return
    setBusy(true)
    setNote('')
    try {
      await api.login(email, password)
      await onSignedIn()
    } catch (err) {
      setNote(err.message)
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{
        display: 'grid',
        gap: 14,
        padding: '20px 22px',
        border: '1px solid var(--color-divider)',
        borderRadius: 10,
        background: 'var(--color-neutral-50, rgba(0,0,0,0.02))',
      }}
      aria-label="Sign in again"
    >
      <div className="hand" style={{ fontSize: 21 }} role="status">
        {message}
      </div>

      <label className="field">
        <span className="label">Your email</span>
        <input
          className="input"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className="field">
        <span className="label">The word</span>
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {note && <span className="err">{note}</span>}

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'One moment…' : 'Sign in and publish'}
        </button>
        <button type="button" className="btn-quiet" onClick={onCancel} disabled={busy}>
          Not now
        </button>
      </div>
    </form>
  )
}
