// Applies every .sql file in migrations/ exactly once, in filename order.
// Runs on release, so a deploy always meets a schema it understands.
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { pool, transaction } from './db.js'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations')

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
  const { rows } = await pool.query('SELECT name FROM schema_migrations')
  const done = new Set(rows.map((r) => r.name))

  for (const file of files) {
    if (done.has(file)) continue
    const sql = await readFile(path.join(dir, file), 'utf8')
    await transaction(async (client) => {
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
    })
    console.log(`[migrate] applied ${file}`)
  }
}

// Allow `npm run migrate` as well as import from the server bootstrap.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[migrate] failed', err)
      process.exit(1)
    })
}
