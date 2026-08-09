import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api.js'
import { Footer, Header } from './components/Chrome.jsx'
import Reading from './screens/Reading.jsx'
import Shelf from './screens/Shelf.jsx'
import About from './screens/About.jsx'
import Contact from './screens/Contact.jsx'
import SignIn from './screens/SignIn.jsx'
import Desk from './screens/Desk.jsx'
import Notes from './screens/Notes.jsx'

/**
 * Routing is real URLs rather than component state, because the slug is a
 * review's permanent link — the whole point of keeping it stable. A grandchild
 * can send /review/odyssey-2026 to someone and it opens on that review.
 */
const ROUTES = {
  '': 'home',
  shelf: 'archive',
  about: 'about',
  write: 'contact',
  desk: 'write',
  notes: 'notes',
  review: 'review',
}

function parseLocation() {
  const [, head = '', tail = ''] = window.location.pathname.split('/')
  const route = ROUTES[head] ?? 'home'
  return { route, id: route === 'review' ? decodeURIComponent(tail) : null }
}

function pathFor(route, id) {
  if (route === 'review' && id) return `/review/${encodeURIComponent(id)}`
  const head = Object.keys(ROUTES).find((k) => ROUTES[k] === route && k !== 'review')
  return `/${head ?? ''}`
}

export default function App() {
  const [{ route, id }, setLocation] = useState(parseLocation)
  const [reviews, setReviews] = useState([])
  const [signedIn, setSignedIn] = useState(false)
  const [ready, setReady] = useState(false)
  const [unread, setUnread] = useState(0)
  const [editing, setEditing] = useState(null)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('newest')

  const go = useCallback((next, nextId = null) => {
    const path = pathFor(next, nextId)
    if (path !== window.location.pathname) window.history.pushState({}, '', path)
    setLocation({ route: next, id: nextId })
    setEditing(null)
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const onPop = () => setLocation(parseLocation())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const load = useCallback(async () => {
    const [me, list] = await Promise.all([api.me(), api.listReviews()])
    setSignedIn(me.signedIn)
    setReviews(list.reviews)

    // The unread count has to be part of every load, not just the first one —
    // she signs in mid-session, and that is exactly when the letterbox matters.
    if (!me.signedIn) {
      setUnread(0)
    } else {
      try {
        setUnread((await api.listMessages()).unread)
      } catch {
        // A letterbox that cannot be counted is not worth failing a page over.
      }
    }
    return me.signedIn
  }, [])

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setReady(true))
  }, [load])

  // The shelf filters locally: the archive is small enough that a round trip
  // per keystroke would be slower than it is worth.
  const shelf = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = reviews.filter((r) => {
      const okKind = filter === 'All' || r.kind === filter
      const okQuery = !q || `${r.title} ${r.creator || ''}`.toLowerCase().includes(q)
      return okKind && okQuery
    })
    if (sort === 'score') list = [...list].sort((a, b) => b.score - a.score)
    return list
  }, [reviews, query, filter, sort])

  const current = useMemo(() => {
    if (route === 'review') return reviews.find((r) => r.id === id) || null
    return reviews.find((r) => r.published) || reviews[0] || null
  }, [reviews, route, id])

  const others = useMemo(
    () => reviews.filter((r) => r.id !== current?.id && r.published).slice(0, 3),
    [reviews, current]
  )

  const deleteReview = useCallback(
    async (rid) => {
      await api.deleteReview(rid)
      // Drop it locally the moment the server agrees, so the shelf is correct
      // even if the resync behind it does not land. A failed reload is not a
      // failed deletion and must not be reported as one.
      setReviews((list) => list.filter((r) => r.id !== rid))
      await load().catch(() => {})
    },
    [load]
  )

  async function signOut() {
    await api.logout().catch(() => {})
    setSignedIn(false)
    setUnread(0)
    await load().catch(() => {})
    go('home')
  }

  function renderScreen() {
    if (!ready) {
      return (
        <div className="hand" style={{ fontSize: 24, padding: '60px 0' }}>
          one moment…
        </div>
      )
    }

    switch (route) {
      case 'archive':
        return (
          <Shelf
            reviews={shelf}
            query={query}
            setQuery={setQuery}
            filter={filter}
            setFilter={setFilter}
            sort={sort}
            setSort={setSort}
            open={(rid) => go('review', rid)}
            signedIn={signedIn}
            onDelete={deleteReview}
          />
        )
      case 'about':
        return <About />
      case 'contact':
        return <Contact />
      case 'notes':
        return signedIn ? (
          <Notes onCountChange={setUnread} />
        ) : (
          <SignIn onSignedIn={() => load().then(() => go('notes'))} />
        )
      case 'write':
        return signedIn ? (
          <Desk
            editing={editing}
            onSaved={(saved) => {
              load().then(() => go('review', saved.id))
            }}
            onCancel={() => go('home')}
            onDeleted={() => load().then(() => go('archive'))}
          />
        ) : (
          <SignIn onSignedIn={() => load().then(() => go('write'))} />
        )
      case 'review':
      case 'home':
      default:
        return (
          <>
            {signedIn && current && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 14 }}>
                <button
                  type="button"
                  className="btn-quiet"
                  onClick={() => {
                    setEditing(current)
                    window.history.pushState({}, '', pathFor('write'))
                    setLocation({ route: 'write', id: null })
                    window.scrollTo(0, 0)
                  }}
                >
                  Edit this one
                </button>
              </div>
            )}
            <Reading
              review={current}
              others={others}
              isDetail={route === 'review'}
              go={go}
              open={(rid) => go('review', rid)}
            />
          </>
        )
    }
  }

  // The letterbox. Notes arrive on her desk rather than by email, so signing in
  // has to be the moment she finds out one is waiting — a count tucked in the
  // footer is not something anyone looks at.
  const letterbox =
    signedIn && unread > 0 && route !== 'notes' ? (
      <button type="button" className="letterbox" onClick={() => go('notes')}>
        <span className="letterbox-mark" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1">
            <rect x="2.5" y="5" width="19" height="14" rx="1.5" />
            <path d="M2.5 6.5 12 13.5 21.5 6.5" />
          </svg>
        </span>
        <span>
          {unread === 1 ? 'A note is waiting for you' : `${unread} notes are waiting for you`}
        </span>
        <span className="letterbox-go" aria-hidden="true">
          open the letterbox →
        </span>
      </button>
    ) : null

  return (
    <div className="page">
      <div className="wrap">
        <Header route={route} go={go} />
        {letterbox}
        {renderScreen()}
        <Footer signedIn={signedIn} unread={unread} go={go} onSignOut={signOut} />
      </div>
    </div>
  )
}
