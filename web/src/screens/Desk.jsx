import { useCallback, useEffect, useState } from 'react'
import { api, shrinkImage } from '../api.js'
import ReAuth from '../components/ReAuth.jsx'

const KINDS = ['Book', 'Film', 'Television', 'Other']

const blank = () => ({
  title: '',
  kind: 'Book',
  creator: '',
  score: 8,
  verdict: '',
  body: '',
  quote: '',
  display_date: '',
  cover_url: '',
})

/**
 * An unsaved review lives only in this tab, so it is also kept in the browser
 * as it is typed. A lapsed session, a closed lid or a stray reload used to
 * take the whole evening's writing with it.
 */
const keyFor = (editing) => (editing ? `teeta.draft.${editing.id}` : 'teeta.draft.new')

function readStored(key) {
  try {
    const raw = window.localStorage.getItem(key)
    const stored = raw ? JSON.parse(raw) : null
    // Only worth restoring if there is something in it.
    if (stored && (stored.title?.trim() || stored.body?.trim())) return stored
    return null
  } catch {
    // Private browsing, or a storage quota. Never a reason to fail the page.
    return null
  }
}

function writeStored(key, draft) {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft))
  } catch {
    /* nothing to do — the draft simply is not backed up */
  }
}

function clearStored(key) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* as above */
  }
}

function startingDraft(editing) {
  const base = editing ? { ...blank(), ...editing } : blank()
  const stored = readStored(keyFor(editing))
  return stored ? { ...base, ...stored } : base
}

export default function Desk({ editing, onSaved, onCancel, onDeleted }) {
  const [draft, setDraft] = useState(() => startingDraft(editing))
  const [errors, setErrors] = useState({})
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  // Set when a save came back 401. Holds which button was pressed, so the same
  // save can be retried once she is back in.
  const [reauth, setReauth] = useState(null)

  const storageKey = keyFor(editing)

  useEffect(() => {
    setDraft(startingDraft(editing))
    setErrors({})
    setNote('')
    setReauth(null)
  }, [editing])

  useEffect(() => {
    writeStored(storageKey, draft)
  }, [storageKey, draft])

  const set = (key) => (e) => {
    const value = key === 'score' ? Number(e.target.value) : e.target.value
    setDraft((d) => ({ ...d, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setNote('')
  }

  async function pickCover(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setNote('')
    try {
      const blob = await shrinkImage(file)
      const { url } = await api.uploadCover(blob)
      setDraft((d) => ({ ...d, cover_url: url }))
    } catch (err) {
      setNote(err.message || 'That picture would not go up.')
    } finally {
      setUploading(false)
    }
  }

  const save = useCallback(
    async (published) => {
      setBusy(true)
      setErrors({})
      setNote('')
      try {
        const payload = { ...draft, published }
        const saved = editing
          ? await api.updateReview(editing.id, payload)
          : await api.createReview(payload)
        // Only now is it somewhere other than this browser.
        clearStored(storageKey)
        setReauth(null)
        onSaved(saved.review, published)
      } catch (err) {
        // The session lapsed mid-write. Offer the way back in right here
        // rather than sending her to the sign-in screen, which would take the
        // review with it.
        if (err.status === 401) {
          setReauth({ published, message: err.message })
          return
        }
        setErrors(err.errors || {})
        if (!err.errors) setNote(err.message)
      } finally {
        setBusy(false)
      }
    },
    [draft, editing, onSaved, storageKey]
  )

  function attemptSave(published) {
    if (busy) return
    save(published)
  }

  function abandon() {
    clearStored(storageKey)
    onCancel()
  }

  async function remove() {
    if (!editing) return
    if (!window.confirm(`Delete “${editing.title}”? This cannot be undone.`)) return
    setBusy(true)
    try {
      await api.deleteReview(editing.id)
      clearStored(storageKey)
      onDeleted()
    } catch (err) {
      setNote(err.message)
      setBusy(false)
    }
  }

  return (
    <section className="screen" style={{ maxWidth: '68ch', margin: '46px auto 0' }} aria-label="Write">
      <h2 className="h-display">{editing ? 'Edit this review' : 'A new review'}</h2>
      <div className="hand" style={{ fontSize: 23, marginBottom: 32 }}>
        Fill in as much or as little as you like, Teeta.
      </div>

      <div style={{ display: 'grid', gap: 24 }}>
        <label className="field">
          <span className="label">Title</span>
          <input
            className={`input${errors.title ? ' input-bad' : ''}`}
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 28,
              padding: '8px 0',
              border: 0,
              borderBottom: '1px solid var(--color-divider)',
              borderRadius: 0,
            }}
            value={draft.title}
            onChange={set('title')}
            placeholder="What did you read or watch?"
          />
          {errors.title && <span className="err">{errors.title}</span>}
        </label>

        <div className="two-up" style={{ display: 'grid', gridTemplateColumns: '160px minmax(0, 1fr)', gap: 20 }}>
          <label className="field">
            <span className="label">Kind</span>
            <select className="input" value={draft.kind} onChange={set('kind')}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Who made it</span>
            <input
              className="input"
              value={draft.creator}
              onChange={set('creator')}
              placeholder="Author, director, whoever"
            />
          </label>
        </div>

        <div className="desk-score">
          <div className="glow" style={{ width: 78, height: 78 }}>
            <div className="desk-dial">
              <span>{draft.score}</span>
            </div>
          </div>
          <div style={{ flex: 1, display: 'grid', gap: 10 }}>
            <span className="label">Your score, out of ten</span>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={draft.score}
              onChange={set('score')}
              style={{ width: '100%', accentColor: 'var(--color-accent)', height: 26 }}
              aria-label="Score out of ten"
            />
            {errors.score && <span className="err">{errors.score}</span>}
          </div>
        </div>

        <label className="field">
          <span className="label">The short version</span>
          <input
            className="input"
            style={{ fontFamily: 'var(--font-hand)', fontSize: 26, color: 'var(--color-neutral-800)' }}
            value={draft.verdict}
            onChange={set('verdict')}
            placeholder="It was okay."
          />
        </label>

        <label className="field">
          <span className="label">What you thought</span>
          <textarea
            className="input"
            rows={12}
            value={draft.body}
            onChange={set('body')}
            placeholder="What you liked, what you didn't, and anything else. Leave a blank line between paragraphs."
          />
        </label>

        <div className="two-up" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 190px', gap: 20 }}>
          <label className="field">
            <span className="label">A favorite line (optional)</span>
            <input
              className="input"
              style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic', fontSize: 19 }}
              value={draft.quote}
              onChange={set('quote')}
              placeholder="Something worth keeping"
            />
          </label>
          <label className="field">
            <span className="label">When</span>
            <input
              className="input"
              value={draft.display_date}
              onChange={set('display_date')}
              placeholder="August 2026"
            />
          </label>
        </div>

        <label className="field">
          <span className="label">Cover or poster (optional)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <input
              type="file"
              accept="image/*"
              onChange={pickCover}
              style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-neutral-700)' }}
            />
            {uploading && (
              <span className="hand" style={{ fontSize: 20 }}>
                tucking it in…
              </span>
            )}
            {draft.cover_url && !uploading && (
              <>
                <div
                  className="plate"
                  style={{
                    width: 74,
                    aspectRatio: '2 / 3',
                    backgroundImage: `url(${draft.cover_url})`,
                  }}
                />
                <button
                  type="button"
                  className="btn-quiet"
                  onClick={() => setDraft((d) => ({ ...d, cover_url: '' }))}
                >
                  Remove
                </button>
              </>
            )}
          </div>
        </label>

        {reauth && (
          <ReAuth
            message={reauth.message}
            onSignedIn={() => save(reauth.published)}
            onCancel={() => setReauth(null)}
          />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 6, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={() => attemptSave(true)} disabled={busy}>
            {editing ? 'Save it' : 'Seal it and publish'}
          </button>
          <button type="button" className="btn-quiet" onClick={() => attemptSave(false)} disabled={busy}>
            Keep it to myself for now
          </button>
          <button type="button" className="btn-quiet" onClick={abandon}>
            Never mind
          </button>
          {editing && (
            <button
              type="button"
              className="btn-quiet"
              style={{ color: '#9a3412' }}
              onClick={remove}
              disabled={busy}
            >
              Delete
            </button>
          )}
          <span className="hand" style={{ fontSize: 21 }} role="status">
            {note}
          </span>
        </div>
      </div>
    </section>
  )
}
