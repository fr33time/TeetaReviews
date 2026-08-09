-- Teeta Reviews — initial schema.
--
-- Cover images live in this database rather than an object store. A resized
-- cover is well under 200 KB and the whole archive is a few dozen megabytes at
-- most, so keeping them here means the nightly database backup captures the
-- images too. With a bucket there would be two systems to restore and only one
-- of them backed up.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS covers (
  id         TEXT PRIMARY KEY,
  bytes      BYTEA NOT NULL,
  mime       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  kind         TEXT NOT NULL,
  creator      TEXT NOT NULL DEFAULT '',
  score        INTEGER NOT NULL,
  verdict      TEXT NOT NULL DEFAULT '',
  body         TEXT NOT NULL DEFAULT '',
  quote        TEXT NOT NULL DEFAULT '',
  cover_url    TEXT NOT NULL DEFAULT '',
  display_date TEXT NOT NULL DEFAULT '',
  published    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- The spec asks for the score range to be enforced by the database and not
  -- only by the form, so a bad API client cannot write a 40 out of ten.
  CONSTRAINT reviews_score_range CHECK (score BETWEEN 1 AND 10),
  CONSTRAINT reviews_kind_allowed CHECK (kind IN ('Book', 'Film', 'Television', 'Other'))
);

-- The two sorts the archive offers.
CREATE INDEX IF NOT EXISTS reviews_created_at_idx ON reviews (created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_score_idx ON reviews (score DESC);

CREATE TABLE IF NOT EXISTS messages (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  subject    TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages (created_at DESC);
