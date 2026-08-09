import crypto from 'node:crypto'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { query } from './db.js'
import {
  DUMMY_HASH,
  endSession,
  findUserByEmail,
  requireAuth,
  startSession,
  verifyPassword,
} from './auth.js'
import { slugify, validateReview } from './reviews.js'

export const api = express.Router()

const REVIEW_COLUMNS = `
  id, title, kind, creator, score, verdict, body, quote,
  cover_url, display_date, published, created_at, updated_at
`

// Only failures count against the budget, so signing in and out on the iPad
// never spends it. Five was tight enough that a couple of typos looked like a
// password that had stopped working.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
})

const messageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'That is a lot of notes at once. Try again later.' },
})

/* ── session ─────────────────────────────────────────────────────────── */

api.get('/me', (req, res) => {
  res.json({ signedIn: Boolean(req.user) })
})

api.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim()
    const password = String(req.body?.password || '')
    if (!email || !password) {
      return res.status(400).json({ error: 'Both the email and the password are needed.' })
    }

    const user = await findUserByEmail(email)
    // Verify against a dummy hash when the user is missing so a wrong email
    // and a wrong password take the same time to answer.
    const stored = user?.password_hash || DUMMY_HASH
    const ok = await verifyPassword(password, stored)

    if (!user || !ok) return res.status(401).json({ error: 'That is not it. Try again.' })

    startSession(res, user)
    res.json({ signedIn: true })
  } catch (err) {
    next(err)
  }
})

api.post('/logout', (req, res) => {
  endSession(res)
  res.json({ signedIn: false })
})

/* ── reviews ─────────────────────────────────────────────────────────── */

api.get('/reviews', async (req, res, next) => {
  try {
    const params = []
    const where = []

    // Drafts are hers alone; a signed-out visitor never sees one.
    if (!req.user) where.push('published = TRUE')

    if (req.query.kind && req.query.kind !== 'All') {
      params.push(req.query.kind)
      where.push(`kind = $${params.length}`)
    }

    if (req.query.q) {
      params.push(`%${String(req.query.q).trim()}%`)
      where.push(`(title ILIKE $${params.length} OR creator ILIKE $${params.length})`)
    }

    const order = req.query.sort === 'score' ? 'score DESC, created_at DESC' : 'created_at DESC'
    const sql = `
      SELECT ${REVIEW_COLUMNS} FROM reviews
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ${order}
    `
    const { rows } = await query(sql, params)
    res.json({ reviews: rows })
  } catch (err) {
    next(err)
  }
})

api.get('/reviews/:id', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT ${REVIEW_COLUMNS} FROM reviews WHERE id = $1`, [
      req.params.id,
    ])
    const review = rows[0]
    if (!review || (!review.published && !req.user)) {
      return res.status(404).json({ error: 'No review by that name.' })
    }
    res.json({ review })
  } catch (err) {
    next(err)
  }
})

api.post('/reviews', requireAuth, async (req, res, next) => {
  try {
    const { values, errors } = validateReview(req.body || {})
    if (Object.keys(errors).length) return res.status(422).json({ errors })

    const id = slugify(values.title, values.display_date)
    const { rows: clash } = await query('SELECT 1 FROM reviews WHERE id = $1', [id])
    if (clash.length) {
      return res.status(409).json({
        errors: { title: 'There is already a review at that link. Change the title or the date.' },
      })
    }

    const { rows } = await query(
      `INSERT INTO reviews (id, title, kind, creator, score, verdict, body, quote,
                            cover_url, display_date, published)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING ${REVIEW_COLUMNS}`,
      [
        id,
        values.title,
        values.kind || 'Book',
        values.creator || '',
        values.score,
        values.verdict || '',
        values.body || '',
        values.quote || '',
        values.cover_url || '',
        values.display_date || defaultDisplayDate(),
        values.published ?? true,
      ]
    )
    res.status(201).json({ review: rows[0] })
  } catch (err) {
    next(err)
  }
})

api.patch('/reviews/:id', requireAuth, async (req, res, next) => {
  try {
    const { values, errors } = validateReview(req.body || {}, { partial: true })
    if (Object.keys(errors).length) return res.status(422).json({ errors })

    const fields = Object.keys(values)
    if (!fields.length) return res.status(400).json({ error: 'Nothing to change.' })

    const assignments = fields.map((f, i) => `${f} = $${i + 2}`)
    const { rows } = await query(
      `UPDATE reviews SET ${assignments.join(', ')}, updated_at = now()
       WHERE id = $1 RETURNING ${REVIEW_COLUMNS}`,
      [req.params.id, ...fields.map((f) => values[f])]
    )
    if (!rows.length) return res.status(404).json({ error: 'No review by that name.' })
    res.json({ review: rows[0] })
  } catch (err) {
    next(err)
  }
})

api.delete('/reviews/:id', requireAuth, async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM reviews WHERE id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ error: 'No review by that name.' })
    res.json({ deleted: true })
  } catch (err) {
    next(err)
  }
})

/* ── cover images ────────────────────────────────────────────────────── */

// Magic-byte signatures. The spec asks for the type to be sniffed rather than
// trusted from an extension or a client-supplied header.
const SIGNATURES = [
  { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/png',
    test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: 'image/webp',
    test: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP',
  },
]

function sniff(buffer) {
  if (!buffer || buffer.length < 12) return null
  return SIGNATURES.find((s) => s.test(buffer))?.mime || null
}

api.post(
  '/uploads',
  requireAuth,
  express.raw({ type: ['image/*', 'application/octet-stream'], limit: '8mb' }),
  async (req, res, next) => {
    try {
      const bytes = req.body
      if (!Buffer.isBuffer(bytes) || !bytes.length) {
        return res.status(400).json({ error: 'No image arrived.' })
      }

      const mime = sniff(bytes)
      if (!mime) {
        return res.status(415).json({ error: 'That file is not a JPEG, PNG or WebP.' })
      }

      // The browser resizes to ~900px before sending, so anything still large
      // here did not come from the form.
      if (bytes.length > 2 * 1024 * 1024) {
        return res.status(413).json({ error: 'That image is too large. Try a smaller one.' })
      }

      const id = crypto.randomBytes(12).toString('hex')
      await query('INSERT INTO covers (id, bytes, mime) VALUES ($1, $2, $3)', [id, bytes, mime])
      res.status(201).json({ url: `/api/covers/${id}` })
    } catch (err) {
      next(err)
    }
  }
)

api.get('/covers/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT bytes, mime FROM covers WHERE id = $1', [req.params.id])
    if (!rows.length) return res.status(404).end()
    // Content-addressed by a random id and never overwritten, so it can be
    // cached hard.
    res.set('Content-Type', rows[0].mime)
    res.set('Cache-Control', 'public, max-age=31536000, immutable')
    res.send(rows[0].bytes)
  } catch (err) {
    next(err)
  }
})

/* ── notes from the family ───────────────────────────────────────────── */

api.post('/messages', messageLimiter, async (req, res, next) => {
  try {
    // Honeypot: a real person never fills a field they cannot see.
    if (String(req.body?.website || '').trim()) return res.json({ sent: true })

    const body = String(req.body?.body || '').trim()
    if (!body) return res.status(422).json({ errors: { body: 'Write something first.' } })
    if (body.length > 10_000) {
      return res.status(422).json({ errors: { body: 'That is longer than 10,000 characters.' } })
    }

    await query(
      'INSERT INTO messages (name, email, subject, body) VALUES ($1, $2, $3, $4)',
      [
        String(req.body?.name || '').trim().slice(0, 200),
        String(req.body?.email || '').trim().slice(0, 200),
        String(req.body?.subject || '').trim().slice(0, 300),
        body,
      ]
    )
    res.status(201).json({ sent: true })
  } catch (err) {
    next(err)
  }
})

// Notes are never exposed publicly — only on her desk.
api.get('/messages', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, name, email, subject, body, read, created_at FROM messages ORDER BY created_at DESC LIMIT 200'
    )
    res.json({ messages: rows, unread: rows.filter((m) => !m.read).length })
  } catch (err) {
    next(err)
  }
})

api.patch('/messages/:id', requireAuth, async (req, res, next) => {
  try {
    const { rowCount } = await query('UPDATE messages SET read = $2 WHERE id = $1', [
      Number(req.params.id),
      Boolean(req.body?.read),
    ])
    if (!rowCount) return res.status(404).json({ error: 'No note by that number.' })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

function defaultDisplayDate() {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
