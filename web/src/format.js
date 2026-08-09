/** Blank lines separate paragraphs — the raw text is stored, the split
 *  happens here, mirroring the server's own helper. */
export function paragraphs(body) {
  return String(body || '')
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function countLabel(n) {
  if (n === 0) return 'none yet'
  if (n === 1) return 'one so far'
  return `${n} so far`
}

export function noteDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}
