import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { query } from './db.js'

const scrypt = promisify(crypto.scrypt)

// scrypt rather than bcrypt or argon2: it is a memory-hard KDF of the same
// class, it ships inside Node, and it needs no native compilation — which
// keeps the Railway image build from depending on a toolchain that can break
// on a base-image bump. N=2^16 costs roughly 100ms per hash here, which is the
// right order for a login nobody brute-forces at volume.
// maxmem must clear 128 * N * r (64 MB here) or Node refuses the parameters;
// it is an execution ceiling, not part of the stored hash.
const SCRYPT = { N: 65536, r: 8, p: 1, keylen: 64, maxmem: 160 * 1024 * 1024 }
const COOKIE = 'teeta_session'
const SESSION_DAYS = 30

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const key = await scrypt(password, salt, SCRYPT.keylen, SCRYPT)
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, N, r, p, salt, expected] = parts
  const expectedBuf = Buffer.from(expected, 'base64')
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expectedBuf.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  })
  return crypto.timingSafeEqual(actual, expectedBuf)
}

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

export async function findUserByEmail(email) {
  const { rows } = await query(
    'SELECT id, email, password_hash FROM users WHERE lower(email) = lower($1)',
    [email]
  )
  return rows[0] || null
}
