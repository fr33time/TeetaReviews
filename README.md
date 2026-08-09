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
  auth.js         the session cookie, and looking a user up
  credentials.js  password hashing and normalization (pure, unit-tested)
  admin.js        creating and resetting the one login
  set-password.js reset it by hand, without a dashboard variable
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

**Deleting a review is permanent, and it takes its cover with it.** There is no
trash to empty later. The confirmation lives in the shelf row itself rather than
in a browser dialog, so a mis-tap on the iPad costs a glance instead of a
review — and there is no pop-up to dismiss. Because a cover is uploaded for one
review and nothing else links to it, the image row is deleted alongside, unless
another review still points at the same URL. Otherwise the bulkiest rows in the
database would accumulate with nothing referencing them.

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
                              # (the server does the login part at boot too)
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
| `npm run set-password <email>` | set or reset the login's password |
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

### 5. Deploy

Every deploy applies migrations and then settles the login, both at boot. If
`ADMIN_EMAIL` and `ADMIN_PASSWORD` are both set, the user is created — or their
password replaced — before the service starts listening. There is no manual
step to forget, and the deploy log says which happened:

```
[login] Login created for teeta@example.com. Now delete ADMIN_PASSWORD from the environment.
```

Both values are trimmed first. A variable box keeps whatever was pasted into
it, and a trailing newline hashed into a password makes that password
impossible to type.

`npm run seed` does the same thing plus the first review, if you would rather
run it by hand.

### 6. Remove the password variable

Delete `ADMIN_PASSWORD` from Railway variables and redeploy. It has done its
job; the hash is in the database. Leaving it set means a plaintext password
sits in the dashboard forever.

Boot then reports the steady state, which is not a problem:

```
[login] ADMIN_EMAIL / ADMIN_PASSWORD not set — the login is already in the database.
```

### 6b. When the password will not work

Check the deploy log for a `[login]` line first — it distinguishes the two
cases that look identical from the sign-in screen.

| Log line | What it means |
| --- | --- |
| `There is no login in the database…` | nobody has been created; set both variables and redeploy |
| `Login created for …` / `Login updated for …` | the credential is in place; the password is genuinely wrong |
| `ADMIN_EMAIL / ADMIN_PASSWORD not set — the login is already in the database.` | normal, post step 6 |

To reset the password without putting it in a dashboard variable, run this in
the Railway service shell. It prompts, and hides what is typed:

```bash
npm run set-password teeta@example.com
```

Ten wrong guesses in fifteen minutes returns `Too many attempts.` rather than
`That is not it.` — that is the rate limiter, and it clears itself. Successful
sign-ins do not count against it.

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
- [ ] Signing out hides her desk, and the shelf offers no delete to a visitor
- [ ] She deletes a review from the shelf, the row goes, and it stays gone after a reload
- [ ] The data survives a redeploy
- [ ] No password or key appears in the page source
- [ ] A pull request that breaks a test cannot be merged
- [ ] Daily backups are on and a restore has been tried once
