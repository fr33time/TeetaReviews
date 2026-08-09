import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Locally, copy .env.example to .env; on Railway it ' +
      'comes from the Postgres plugin.'
  )
}

// Railway terminates TLS on its own network with a certificate the Node CA
// bundle does not carry, so verification is relaxed there and only there.
// Locally we connect over a plain socket with no TLS at all.
const isRailway = /\brailway\b/.test(process.env.DATABASE_URL)

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRailway ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
})

pool.on('error', (err) => {
  console.error('[db] idle client error', err)
})

export function query(text, params) {
  return pool.query(text, params)
}

/** Runs fn inside a transaction, rolling back if it throws. */
export async function transaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
