// Seeds Teeta's user from environment variables and the one review that
// already exists, so nothing written so far is lost. Safe to re-run: it
// updates the password if the user exists and leaves the review alone.
import { fileURLToPath } from 'node:url'
import { pool, query } from './db.js'
import { ensureAdminUser } from './admin.js'
import { migrate } from './migrate.js'

const ODYSSEY = {
  id: 'odyssey-2026',
  title: 'The Odyssey',
  kind: 'Film',
  creator: 'Christopher Nolan',
  score: 6,
  verdict: 'It was okay.',
  display_date: 'August 2026',
  body: [
    'I honestly had a hard time with all the big stars.  I’ve seen them in too many other big movies - some recently.',
    'I wish they’d have brought in new talent. Damon could have been because he was so often disguised and hairy, but others didn’t do it for me. I kept seeing Peter Parker and Prada girl and twilight.',
    'Also, there was too much violence for me. Eating people and chopping up people and stabbing people - I got tired of all that.  I had to avert my eyes a few times.',
    'I had no empathy for any of them, so I didn’t connect.',
    'My favorite characters were the blind guy, the young boy and the old dog!',
    'I know it followed the story and parts were lovely and amazing looking, but story didn’t really do anything for me.',
    'I’m glad I got senior discount. It cost me 7$ and I smuggled in some Skinney Pop.',
    'Okay for during a hot summer day. Won’t ever want to see again.',
  ].join('\n\n'),
}

// The server does this at boot too. Kept here so `npm run seed` remains one
// command that leaves a usable site behind, and so a bad ADMIN_PASSWORD fails
// loudly when it is run by hand.
async function seedUser() {
  const { status, message } = await ensureAdminUser({ strict: true })
  console.log(`[seed] ${message}`)
  if (status === 'error') process.exitCode = 1
}

async function seedReview() {
  const { rowCount } = await query('SELECT 1 FROM reviews WHERE id = $1', [ODYSSEY.id])
  if (rowCount) {
    console.log('[seed] the Odyssey review is already here — left untouched.')
    return
  }
  await query(
    `INSERT INTO reviews (id, title, kind, creator, score, verdict, body, display_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      ODYSSEY.id,
      ODYSSEY.title,
      ODYSSEY.kind,
      ODYSSEY.creator,
      ODYSSEY.score,
      ODYSSEY.verdict,
      ODYSSEY.body,
      ODYSSEY.display_date,
    ]
  )
  console.log('[seed] the Odyssey review is in.')
}

export async function seed() {
  await migrate()
  await seedUser()
  await seedReview()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] failed', err)
      process.exit(1)
    })
}
