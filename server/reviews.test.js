import test from 'node:test'
import assert from 'node:assert/strict'
import { coverIdFromUrl, paragraphs, slugify, validateReview } from './reviews.js'

test('slugify builds the permanent link from title and year', () => {
  assert.equal(slugify('The Odyssey', 'August 2026'), 'odyssey-2026')
  assert.equal(slugify('A Room with a View', 'March 1985'), 'room-with-a-view-1985')
  assert.equal(slugify('The Remains of the Day', ''), 'remains-of-the-day')
})

test('slugify strips punctuation and accents', () => {
  assert.equal(slugify('Amélie', 'June 2001'), 'amelie-2001')
  assert.equal(slugify("Howl's Moving Castle", '2004'), 'howl-s-moving-castle-2004')
})

test('slugify never returns an empty slug', () => {
  assert.equal(slugify('!!!', ''), 'review')
})

test('a review needs a title and a score in range', () => {
  const { errors } = validateReview({ title: '', score: 44, kind: 'Opera' })
  assert.ok(errors.title)
  assert.ok(errors.score)
  assert.ok(errors.kind)
})

test('the score must be a whole number', () => {
  assert.ok(validateReview({ title: 'A', score: 7.5 }).errors.score)
  assert.ok(validateReview({ title: 'A', score: 0 }).errors.score)
  assert.ok(validateReview({ title: 'A', score: 11 }).errors.score)
  assert.equal(validateReview({ title: 'A', score: 10 }).errors.score, undefined)
})

test('a partial update does not demand the required fields', () => {
  const { values, errors } = validateReview({ published: false }, { partial: true })
  assert.deepEqual(errors, {})
  assert.equal(values.published, false)
})

test('deleting a review finds the uploaded cover it should take with it', () => {
  const id = 'a'.repeat(24)
  assert.equal(coverIdFromUrl(`/api/covers/${id}`), id)
})

test('an outside cover URL is never mistaken for one of ours to delete', () => {
  assert.equal(coverIdFromUrl(''), null)
  assert.equal(coverIdFromUrl(null), null)
  assert.equal(coverIdFromUrl(undefined), null)
  assert.equal(coverIdFromUrl('https://example.com/cover.jpg'), null)
  // A full URL that merely ends in our path shape is not a local upload.
  assert.equal(coverIdFromUrl(`https://evil.test/api/covers/${'b'.repeat(24)}`), null)
  // Neither is a malformed or traversing id.
  assert.equal(coverIdFromUrl('/api/covers/'), null)
  assert.equal(coverIdFromUrl('/api/covers/not-hex-at-all-nope-nope'), null)
  assert.equal(coverIdFromUrl('/api/covers/../../etc/passwd'), null)
})

test('paragraphs split on blank lines', () => {
  assert.deepEqual(paragraphs('one\n\ntwo\n\n\nthree'), ['one', 'two', 'three'])
  assert.deepEqual(paragraphs(''), [])
})
