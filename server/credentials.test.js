import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DUMMY_HASH,
  describePasswordProblem,
  hashPassword,
  normalizeConfiguredPassword,
  normalizeEmail,
  verifyPassword,
} from './credentials.js'

test('a hashed password verifies against itself', async () => {
  const hash = await hashPassword('the-word-is-odyssey')
  assert.equal(await verifyPassword('the-word-is-odyssey', hash), true)
})

test('a wrong password does not verify', async () => {
  const hash = await hashPassword('the-word-is-odyssey')
  assert.equal(await verifyPassword('the-word-is-ithaca', hash), false)
})

test('whitespace is part of a password, so it must survive hashing intact', async () => {
  const hash = await hashPassword('two words')
  assert.equal(await verifyPassword('two words', hash), true)
  assert.equal(await verifyPassword('two words ', hash), false)
})

test('the dummy hash is well formed and matches nothing', async () => {
  assert.equal(await verifyPassword('', DUMMY_HASH), false)
  assert.equal(await verifyPassword('anything at all', DUMMY_HASH), false)
})

test('a malformed stored hash is rejected rather than thrown over', async () => {
  for (const stored of [null, undefined, '', 'not-a-hash', 'scrypt$65536$8$1$AAAA', 'scrypt$65536$8$1$AAAA$']) {
    assert.equal(await verifyPassword('anything', stored), false, `for ${JSON.stringify(stored)}`)
  }
})

test('an address is matched without regard to case or stray whitespace', () => {
  assert.equal(normalizeEmail('  Teeta@Example.COM \n'), 'teeta@example.com')
  assert.equal(normalizeEmail('teeta@example.com'), 'teeta@example.com')
  assert.equal(normalizeEmail(undefined), '')
})

// The bug this fixes: a password pasted into a dashboard variable box keeps
// its trailing newline, that newline is hashed, and the password as typed can
// then never match.
test('a password read from a variable is trimmed before it is hashed', async () => {
  const configured = normalizeConfiguredPassword('grandmother-1948\n')
  assert.equal(configured, 'grandmother-1948')

  const hash = await hashPassword(configured)
  assert.equal(await verifyPassword('grandmother-1948', hash), true)
})

test('a password that is too short is described rather than silently accepted', () => {
  assert.equal(describePasswordProblem(''), 'it is empty')
  assert.match(describePasswordProblem('short'), /5 characters/)
  assert.equal(describePasswordProblem('long-enough'), null)
})
