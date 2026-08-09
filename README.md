# Teeta Reviews

Books, films and whatever else, marked out of ten. Kept for the kids and the
grandkids.

A single Node service that serves a React front end and a JSON API, backed by
one Postgres database. One person signs in; everyone else reads.

---

## What is here

```
server/           Express API, migrations, seed
  api.js          every /api endpoint
  auth.js         password hashing and the session cookie
  reviews.js      slug rules and validation (pure, unit-tested)
  migrations/     applied in order, once, on every release
web/              the front end
  src/screens/    Latest · The Shelf · About · Write to Teeta · Sign in · her desk · Notes
  src/styles/     the Classical design tokens, plus self-hosted fonts
scripts/          font fetcher (run once; output is committed)
Dockerfile        two stages, no native modules, builds in seconds
railway.json      builder and health check
```

### Deliberate choices

**Cover images live in Postgres, not a bucket.** A resized cover is well under
200 KB. Keeping them in the database means the nightly backup captures the
images too — with object storage there would be two systems to restore and
historically only one of them gets backed up. This is a family archive; losing
it is the one unacceptable failure.

**The browser resizes images before upload.** Teeta's iPad would otherwise send
a four-megabyte photo. The client shrinks it to 900px WebP first, so the server
needs no image toolchain and no native dependency. The server still sniffs the
magic bytes and enforces its own size ceiling — the client-side step is a
courtesy, not the check.

**Passwords use scrypt from Node's standard library** rather than bcrypt or
argon2. Same class of memory-hard KDF, but no native compilation, so the
production image cannot fail to build over a toolchain change.

**No third-party API keys anywhere.** There is no S3, no Cloudinary, no email
vendor. The only secrets are the database URL Railway generates and a session
signing key. If email delivery is wanted later, it should be registered in the
Mazoch MCP first and called through the REST bridge — not wired in here.

---

## Running it locally

You need Node 22 and a Postgres you can write to.

```bash
npm install
cp .env.example .env          # then edit DATABASE_URL and SESSION_SECRET
npm run seed                  # applies migrations, creates the login, adds the Odyssey review
npm run dev                   # API on :3000, UI on :5173
```

Open http://localhost:5173. Sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD`
you put in `.env`.

To run it the way production does — one process serving everything:

```bash
npm run build && npm start    # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | API and UI with reload |
| `npm test` | unit tests for slugs and validation |
| `npm run lint` | ESLint |
| `npm run migrate` | apply pending migrations |
| `npm run seed` | migrate, then create the user and the first review |
| `npm run build` | build the front end into `web/dist` |

There is also a browser walkthrough of the acceptance list below. It is not in
CI, because it needs a browser and a seeded database — run it by hand against
a local server, or against the live site after a deploy. It writes reviews, so
aim it at production only when that is acceptable.

```bash
npm i --no-save playwright
node scripts/acceptance.mjs                       # against localhost:3000
BASE_URL=https://teetareviews.com \
  TEST_EMAIL=… TEST_PASSWORD=… node scripts/acceptance.mjs
```

---

## Deploying to Railway

### 1. Protect `main` first

`main` is production — Railway deploys from it. Do this before the first
deploy, not after.

On GitHub → **Settings → Branches → Add branch ruleset** for `main`:

- Require a pull request before merging, with **1 approval**
- Require status checks to pass → select **`lint, test, build`**
- Require branches to be up to date before merging
- Block force pushes

Without the status-check requirement the CI workflow runs but does not gate,
which is the same as not having it.

### 2. Create the Railway project

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Pick `fr33time/TeetaReviews`
3. Railway reads `railway.json`, sees the `Dockerfile`, and builds

Use a paid plan. The free tier sleeps and does not keep a database.

### 3. Add Postgres

In the project canvas: **New → Database → Add PostgreSQL**.

Then on the **web service** → **Variables** → **Add a Reference** →
`DATABASE_URL` from the Postgres service. Railway wires it in; do not paste a
connection string by hand.

### 4. Set the remaining variables

On the web service → **Variables**:

| Variable | Value |
| --- | --- |
| `SESSION_SECRET` | `openssl rand -base64 48` |
| `NODE_ENV` | `production` |
| `ADMIN_EMAIL` | Teeta's email |
| `ADMIN_PASSWORD` | a real password — **temporary, see step 6** |

`PORT` is injected by Railway. Do not set it.

### 5. Deploy and seed

The first deploy runs migrations automatically at boot. Then create her login —
from the Railway service shell, or locally with the public `DATABASE_URL`:

```bash
npm run seed
```

### 6. Remove the password variable

Delete `ADMIN_PASSWORD` from Railway variables and redeploy. It has done its
job; the hash is in the database. Leaving it set means a plaintext password
sits in the dashboard forever.

### 7. Custom domain

Web service → **Settings → Networking → Custom Domain** → `teetareviews.com`.
Railway shows a CNAME target. At your registrar:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `www` | the target Railway shows |
| ALIAS / ANAME | `@` | the same target |

Root domains need ALIAS/ANAME, which Cloudflare and Namecheap both support.
TLS is issued automatically once DNS resolves.

### 8. Turn on backups

Postgres service → **Settings → Backups** → enable daily. This is the step that
matters most. Everything else can be rebuilt from this repository; the reviews
cannot.

---

## Checks before calling it done

- [ ] Teeta signs in on her iPad, writes a review with a cover, publishes it, and it appears on the homepage
- [ ] A visitor on another device sees it, searches for it, filters to films, sorts by score
- [ ] Signing out hides her desk
- [ ] The data survives a redeploy
- [ ] No password or key appears in the page source
- [ ] A pull request that breaks a test cannot be merged
- [ ] Daily backups are on and a restore has been tried once
