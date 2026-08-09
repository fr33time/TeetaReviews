// Password hashing and credential normalization. Pure — no database, no
// environment — so it is unit-tested directly and `npm test` needs nothing
// running.
import crypto from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(crypto.scrypt)

// scrypt rather than bcrypt or argon2: it is a memory-hard KDF of the same
// class, it ships inside Node, and it needs no native compilation — which
// keeps the Railway image build from depending on a toolchain that can break
// on a base-image bump. N=2^16 costs roughly 100ms per hash here, which is the
// right order for a login nobody brute-forces at volume.
// maxmem must clear 128 * N * r (64 MB here) or Node refuses the parameters;
// it is an execution ceiling, not part of the stored hash.
const SCRYPT = { N: 65536, r: 8, p: 1, keylen: 64, maxmem: 160 * 1024 * 1024 }

export const MIN_PASSWORD_LENGTH = 8

/**
 * The dummy hash a missing user is verified against, so a wrong email and a
 * wrong password take the same time to answer. Well-formed, matches nothing.
 */
export const DUMMY_HASH = 'scrypt$65536$8$1$AAAA$AAAA'

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
  if (!expectedBuf.length) return false

  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expectedBuf.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  })
  return crypto.timingSafeEqual(actual, expectedBuf)
}

/**
 * One spelling of an address, everywhere. Case and surrounding whitespace must
 * never decide whether a login works: the address is typed on an iPad that
 * likes to capitalize, and it is set from a dashboard variable box that keeps
 * whatever was pasted into it — a trailing newline included.
 */
export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase()
}

/**
 * The same treatment for a password that arrives from the environment rather
 * than from a keyboard. A trailing newline on ADMIN_PASSWORD is invisible in a
 * dashboard and gets hashed along with the password, which makes the real
 * password permanently un-typeable. Passwords the user types are never touched
 * — only ones read from a variable.
 */
export function normalizeConfiguredPassword(value) {
  return String(value ?? '').trim()
}

/** @returns {string|null} why this password is unusable, or null if it is fine. */
export function describePasswordProblem(password) {
  if (!password) return 'it is empty'
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `it is ${password.length} characters and the minimum is ${MIN_PASSWORD_LENGTH}`
  }
  return null
}
