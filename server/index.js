import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import { readSession } from './auth.js'
import { api } from './api.js'
import { migrate } from './migrate.js'
import { ensureAdminUserAtBoot } from './admin.js'
import { pool } from './db.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'web', 'dist')
const isProd = process.env.NODE_ENV === 'production'

const app = express()

// Railway terminates TLS at its edge, so the client IP the rate limiter keys
// on arrives in X-Forwarded-For. Trusting exactly one hop keeps a client from
// spoofing the header itself.
app.set('trust proxy', 1)

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // The design's inline styles are part of the port; fonts are served
        // from this origin, so nothing external is reachable.
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
    // Cover images are served from this origin to this origin.
    crossOriginResourcePolicy: { policy: 'same-origin' },
  })
)
app.use(compression())
app.use(cookieParser())

/**
 * CSRF: the session cookie is sameSite=lax, which already stops a cross-site
 * form POST from carrying it. This is the belt to that suspenders — every
 * state-changing request must declare an Origin this server actually answers
 * to. A cross-origin page cannot forge the header.
 */
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()

  const origin = req.get('Origin')
  if (!origin) return next() // curl and same-origin form posts send none

  let host
  try {
    host = new URL(origin).host
  } catch {
    return res.status(403).json({ error: 'Bad origin.' })
  }
  if (host !== req.get('Host')) return res.status(403).json({ error: 'Cross-site request refused.' })
  next()
})

// The upload route parses its own raw body, so JSON parsing must not claim it.
app.use(express.json({ limit: '256kb' }))
app.use(readSession)

// Railway polls this to decide whether a deploy is healthy. It checks the
// database too — a container that cannot reach Postgres is not serving.
app.get('/healthz', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ ok: true })
  } catch {
    res.status(503).json({ ok: false })
  }
})

app.use('/api', api)
app.use('/api', (_req, res) => res.status(404).json({ error: 'No such endpoint.' }))

// Fonts are immutable and fingerprinted by name; the rest of the build is
// hashed by Vite. index.html must never be cached or a deploy goes unseen.
app.use(
  express.static(dist, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache')
      else res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    },
  })
)

// Client-side routing: anything not matched above is the app shell.
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))

app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'That was too large to send.' })
  }
  console.error('[error]', err)
  res.status(500).json({ error: 'Something went wrong on our end.' })
})

const port = Number(process.env.PORT) || 3000

// The login is settled at boot rather than by a separate manual step, so a
// deploy can never come up with a schema it understands and no one able to
// sign in. It reports rather than throws: a database that cannot be written
// to should still be readable.
migrate()
  .then(() => ensureAdminUserAtBoot())
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`[teeta] listening on ${port}`)
    })
  })
  .catch((err) => {
    console.error('[teeta] failed to start', err)
    process.exit(1)
  })
