import { countLabel } from '../format.js'

const FILTERS = ['All', 'Book', 'Film', 'Television']

export default function Shelf({ reviews, query, setQuery, filter, setFilter, sort, setSort, open }) {
  return (
    <section className="screen" aria-label="The Shelf">
      <div className="rule-row" style={{ margin: '38px 0 22px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 400, fontSize: 40, margin: 0 }}>
          The Shelf
        </h2>
        <div className="rule" />
        <span className="hand" style={{ fontSize: 23 }}>
          {countLabel(reviews.length)}
        </span>
      </div>

      <div className="shelf-controls">
        <input
          className="input"
          style={{ minWidth: 230, width: 'auto' }}
          placeholder="Search a title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search the shelf"
        />

        <div className="seg" role="group" aria-label="Filter by kind">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className="seg-opt"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn-quiet"
          style={{ color: 'var(--color-accent-700)', borderBottomColor: 'var(--color-accent)' }}
          onClick={() => setSort(sort === 'newest' ? 'score' : 'newest')}
        >
          {sort === 'newest' ? 'sorted newest first' : 'sorted by her score'}
        </button>
      </div>

      <div style={{ borderTop: '1px solid var(--color-divider)' }}>
        {reviews.map((r) => (
          <button key={r.id} type="button" className="shelf-row" onClick={() => open(r.id)}>
            <span className="shelf-score">{r.score}</span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <span className="shelf-title">
                {r.title}
                {!r.published && <span className="kicker"> · draft</span>}
              </span>
              {r.creator && (
                <span className="review-creator" style={{ fontSize: 13 }}>
                  {r.creator}
                </span>
              )}
            </span>
            <span className="kicker shelf-meta" style={{ letterSpacing: '0.18em', textAlign: 'right' }}>
              {[r.kind, r.display_date].filter(Boolean).join(' · ')}
            </span>
          </button>
        ))}
      </div>

      {reviews.length === 0 && (
        <div className="hand" style={{ fontSize: 24, padding: '34px 8px' }}>
          Nothing on the shelf by that name.
        </div>
      )}
    </section>
  )
}
