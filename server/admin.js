// Creating and resetting the one login this site has.
//
// This used to live only in `npm run seed`, a manual step between deploying
// and being able to sign in. Skipping it — or running it against a different
// DATABASE_URL than the one the service uses — left an empty `users` table,
// and an empty `users` table looks exactly like a wrong password from the
// sign-in screen. So the same work now also happens at boot.
import { query } from './db.js'
import {
  countUsers,
  describePasswordProblem,
  hashPassword,
  normalizeConfiguredPassword,
  normalizeEmail,
} from './auth.js'

/**
 * Creates the user or replaces their password. Idempotent.
 * @returns {Promise<{email: string, created: boolean}>}
 */
export async function setUserPassword(email, password) {
  const address = normalizeEmail(email)
  if (!address) throw new Error('An email address is required.')
  if (!address.includes('@')) throw new Error(`"${address}" is not an email address.`)

  const problem = describePasswordProblem(password)
  if (problem) throw new Error(`That password will not do — ${problem}.`)

  const { rowCount: existed } = await query('SELECT 1 FROM users WHERE lower(email) = $1', [
    address,
  ])
  const hash = await hashPassword(password)
  await query(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [address, hash]
  )
  return { email: address, created: !existed }
}

/**
 * Applies ADMIN_EMAIL / ADMIN_PASSWORD when both are set.
 *
 * Both are trimmed first. A trailing space or newline on ADMIN_PASSWORD is
 * invisible in a dashboard but gets folded into the hash, which makes the
 * password nobody can see permanently un-typeable.
 *
 * @param {{strict?: boolean}} options — strict throws; otherwise a bad value is
 *   reported and the caller carries on. Boot uses the forgiving form: a site
 *   that cannot be written to should still be readable.
 * @returns {Promise<{status: 'created'|'updated'|'skipped'|'error', message: string}>}
 */
export async function ensureAdminUser({ strict = false } = {}) {
  const email = normalizeEmail(process.env.ADMIN_EMAIL)
  const password = normalizeConfiguredPassword(process.env.ADMIN_PASSWORD)

  if (!email && !password) {
    // Not an error — this is the steady state once the password variable has
    // been removed, as it should be. It is only worth a word if there is also
    // nobody to sign in as.
    const users = await countUsers()
    return users
      ? { status: 'skipped', message: 'ADMIN_EMAIL / ADMIN_PASSWORD not set — the login is already in the database.' }
      : {
          status: 'error',
          message:
            'There is no login in the database and no ADMIN_EMAIL / ADMIN_PASSWORD to make one from. ' +
            'Set both variables and redeploy, or run `node server/set-password.js <email>`.',
        }
  }

  if (!email || !password) {
    const missing = email ? 'ADMIN_PASSWORD' : 'ADMIN_EMAIL'
    const message = `${missing} is missing, so the login could not be set. Set both or neither.`
    if (strict) throw new Error(message)
    return { status: 'error', message }
  }

  try {
    const { created } = await setUserPassword(email, password)
    return {
      status: created ? 'created' : 'updated',
      message: `Login ${created ? 'created' : 'updated'} for ${email}. Now delete ADMIN_PASSWORD from the environment.`,
    }
  } catch (err) {
    if (strict) throw err
    return { status: 'error', message: err.message }
  }
}

/** Boot-time wrapper: logs what happened and never rejects. */
export async function ensureAdminUserAtBoot() {
  try {
    const { status, message } = await ensureAdminUser()
    if (status === 'error') console.error(`[login] ${message}`)
    else console.log(`[login] ${message}`)
  } catch (err) {
    console.error('[login] could not check the login', err)
  }
}
