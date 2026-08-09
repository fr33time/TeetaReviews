import crypto from 'node:crypto'
import { query } from './db.js'
import { normalizeEmail } from './credentials.js'

// Hashing lives in credentials.js so it can be tested without a database.
// Re-exported here because this is where the rest of the server looks for it.
export {
  DUMMY_HASH,
  MIN_PASSWORD_LENGTH,
  describePasswordProblem,
  hashPassword,
  normalizeConfiguredPassword,
  normalizeEmail,
  verifyPassword,
} from './credentials.js'

const COOKIE = 'teeta_session'
const SESSION_DAYS = 30

function secret() {
  const value = process.env.SESSION_SECRET
  if (!value || value.length < 16) {
    throw new Error('SESSION_SECRET must be set to at least 16 characters.')
  }
  return value
}

/** A signed, expiring token. Stateless, so a redeploy does not sign her out. */
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${mac}`
}

function unsign(token) {
  const [body, mac] = String(token || '').split('.')
  if (!body || !mac) return null

  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload.exp || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function startSession(res, user) {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  res.cookie(COOKIE, sign({ uid: user.id, exp }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

export function endSession(res) {
  res.clearCookie(COOKIE, { path: '/' })
}

/** Populates req.user when a valid session cookie is present. Never rejects. */
export function readSession(req, _res, next) {
  const payload = unsign(req.cookies?.[COOKIE])
  req.user = payload ? { id: payload.uid } : null
  next()
}

/** Gate for every write endpoint. */
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not signed in.' })
  next()
}

// Matched against the normalized address rather than lower(email) = lower($1),
// so the unique index added in 002 can serve the lookup and so the comparison
// is identical to the one the write path uses.
export async function findUserByEmail(email) {
  const { rows } = await query(
    'SELECT id, email, password_hash FROM users WHERE lower(email) = $1',
    [normalizeEmail(email)]
  )
  return rows[0] || null
}

export async function countUsers() {
  const { rows } = await query('SELECT count(*)::int AS n FROM users')
  return rows[0].n
}
