// Validation and slug rules for reviews, kept apart from the HTTP layer so
// they are testable without a server.

export const KINDS = ['Book', 'Film', 'Television', 'Other']

/**
 * A stable, permanent link derived from title and year — `odyssey-2026`.
 * The slug never changes once written, so an edited title does not break a
 * link someone in the family has already shared.
 */
export function slugify(title, displayDate = '') {
  const base = String(title)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    // Drop a leading article so "The Odyssey" reads as odyssey-2026.
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

  const year = String(displayDate).match(/\b(19|20)\d{2}\b/)?.[0]
  const stem = base || 'review'
  return year ? `${stem}-${year}` : stem
}

/**
 * The id of an uploaded cover, given the `cover_url` stored on a review, or
 * null when the review points somewhere else (an outside URL, or nothing).
 * Deleting a review has to take its uploaded image with it, and the review
 * only ever remembers the image by its URL.
 */
export function coverIdFromUrl(url) {
  const id = String(url || '').match(/^\/api\/covers\/([0-9a-f]{24})$/)?.[1]
  return id || null
}

const MAX = { title: 200, creator: 200, verdict: 300, quote: 500, body: 40_000, display_date: 60 }

/**
 * Returns { values, errors }. Errors are keyed by field so the form can say
 * what went wrong beside the offending input rather than failing silently.
 * `partial` skips required-field checks, for PATCH.
 */
export function validateReview(input, { partial = false } = {}) {
  const errors = {}
  const values = {}
  const has = (k) => Object.prototype.hasOwnProperty.call(input, k)
  const str = (k) => (input[k] === null || input[k] === undefined ? '' : String(input[k]).trim())

  if (!partial || has('title')) {
    const title = str('title')
    if (!title) errors.title = 'It needs a title first.'
    else if (title.length > MAX.title) errors.title = `Keep the title under ${MAX.title} characters.`
    else values.title = title
  }

  if (!partial || has('kind')) {
    const kind = str('kind') || 'Book'
    if (!KINDS.includes(kind)) errors.kind = `Choose one of: ${KINDS.join(', ')}.`
    else values.kind = kind
  }

  if (!partial || has('score')) {
    const score = Number(input.score)
    if (!Number.isInteger(score) || score < 1 || score > 10) {
      errors.score = 'The score is a whole number from 1 to 10.'
    } else {
      values.score = score
    }
  }

  for (const field of ['creator', 'verdict', 'quote', 'body', 'display_date', 'cover_url']) {
    if (!has(field)) continue
    const value = str(field)
    const limit = MAX[field]
    if (limit && value.length > limit) {
      errors[field] = `That is longer than ${limit} characters.`
    } else {
      values[field] = value
    }
  }

  if (has('published')) values.published = Boolean(input.published)

  return { values, errors }
}

/** Blank lines separate paragraphs; the raw text is what gets stored. */
export function paragraphs(body) {
  return String(body || '')
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}
