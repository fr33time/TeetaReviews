// Thin wrapper over fetch. Every call is same-origin and carries the session
// cookie; validation errors come back as { errors: { field: message } } and
// are thrown as ApiError so a form can pin them beside the right input.

export class ApiError extends Error {
  constructor(message, { status, errors, reason } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors || null
    // For a 401: 'absent' | 'expired' | 'invalid'. Lets the desk offer a way
    // back in rather than a dead end.
    this.reason = reason || null
  }
}

async function request(path, { method = 'GET', body, raw, headers = {} } = {}) {
  const init = { method, credentials: 'same-origin', headers: { ...headers } }

  if (raw) {
    init.body = raw
    init.headers['Content-Type'] = raw.type || 'application/octet-stream'
  } else if (body !== undefined) {
    init.body = JSON.stringify(body)
    init.headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`/api${path}`, init)
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // A proxy or a cold container can answer with HTML; treat it as an outage.
    throw new ApiError('The site is having a moment. Try again.', { status: res.status })
  }

  if (!res.ok) {
    throw new ApiError(data?.error || 'That did not work.', {
      status: res.status,
      errors: data?.errors,
      reason: data?.reason,
    })
  }
  return data
}

export const api = {
  me: () => request('/me'),
  login: (email, password) => request('/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/logout', { method: 'POST' }),

  listReviews: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.kind && params.kind !== 'All') qs.set('kind', params.kind)
    if (params.sort) qs.set('sort', params.sort)
    if (params.q) qs.set('q', params.q)
    const suffix = qs.toString()
    return request(`/reviews${suffix ? `?${suffix}` : ''}`)
  },
  createReview: (review) => request('/reviews', { method: 'POST', body: review }),
  updateReview: (id, patch) => request(`/reviews/${id}`, { method: 'PATCH', body: patch }),
  deleteReview: (id) => request(`/reviews/${id}`, { method: 'DELETE' }),

  uploadCover: (blob) => request('/uploads', { method: 'POST', raw: blob }),

  sendMessage: (note) => request('/messages', { method: 'POST', body: note }),
  listMessages: () => request('/messages'),
  markMessage: (id, read) => request(`/messages/${id}`, { method: 'PATCH', body: { read } }),
}

/**
 * Shrinks a picked image in the browser before it is uploaded. Teeta's iPad
 * hands over a photo of several megabytes; this sends roughly a hundred
 * kilobytes instead, and means the server needs no image toolchain. The
 * server still sniffs the bytes and enforces its own ceiling — this is a
 * courtesy, not the check.
 */
export async function shrinkImage(file, maxEdge = 900) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const blob = await new Promise((resolve) => {
    // WebP where the browser has it, JPEG everywhere else.
    canvas.toBlob((b) => resolve(b), 'image/webp', 0.86)
  })
  if (blob) return blob

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.86))
}
