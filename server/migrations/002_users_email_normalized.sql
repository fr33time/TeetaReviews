-- One address, one row, one spelling.
--
-- The unique constraint from 001 is on `email` verbatim and is therefore
-- case-sensitive, while the login lookup matched on lower(email). So
-- 'Teeta@example.com' and 'teeta@example.com' were both legal rows for the
-- same person, and the lookup returned whichever one Postgres handed back
-- first — sometimes an older row carrying an older password. From the sign-in
-- screen that is indistinguishable from "the password is wrong".
--
-- The same applies to whitespace: an address pasted into a dashboard variable
-- box keeps its trailing newline, and 'teeta@example.com\n' is a different
-- row again.
--
-- Collapse them (newest wins), normalize what is left, then make the database
-- refuse a second spelling from here on.

-- btrim() with no second argument strips spaces and nothing else, so the
-- characters actually at fault here — the newline a paste leaves behind, a
-- stray tab — have to be named. This must match what normalizeEmail() does in
-- credentials.js, which uses JavaScript's trim().

-- Newest row per address survives; older duplicates go.
DELETE FROM users a
USING users b
WHERE lower(btrim(a.email, E' \t\r\n\f\v')) = lower(btrim(b.email, E' \t\r\n\f\v'))
  AND (a.created_at, a.id) < (b.created_at, b.id);

UPDATE users
SET email = lower(btrim(email, E' \t\r\n\f\v'))
WHERE email <> lower(btrim(email, E' \t\r\n\f\v'));

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));
