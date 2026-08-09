import { useState } from 'react'
import { api } from '../api.js'

/**
 * The design's passphrase screen, kept intact — the candle, the monogram, the
 * "Say the word" line — but backed by a real credential. She signs in from an
 * iPad, so the fields are large and the browser is allowed to remember them.
 */
export default function SignIn({ onSignedIn }) {
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
      onSignedIn()
    } catch (err) {
      setNote(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="screen column-tight" aria-label="Sign in">
      <div className="glow" style={{ width: 70, height: 70, margin: '0 auto 26px' }}>
        <div className="monogram" style={{ width: 70, height: 70, fontSize: 26 }}>
          T
        </div>
      </div>

      <h2 className="h-display" style={{ fontSize: 38, marginBottom: 10 }}>
        Only Teeta writes here
      </h2>
      <div className="hand" style={{ fontSize: 23, marginBottom: 30 }}>
        Say the word and the page will open.
      </div>

      <form onSubmit={submit} style={{ display: 'grid', gap: 18, textAlign: 'left' }}>
        <label className="field">
          <span className="label">Your email</span>
          <input
            className="input"
            style={{ fontSize: 19, padding: '14px 12px' }}
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
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 22,
              letterSpacing: '0.14em',
              padding: '14px 12px',
            }}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <div className="hand" style={{ fontSize: 20, minHeight: 28 }} role="status">
          {note}
        </div>

        <button type="submit" className="btn" style={{ padding: '13px 26px' }} disabled={busy}>
          {busy ? 'One moment…' : 'Open the page'}
        </button>
      </form>
    </section>
  )
}
