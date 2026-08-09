// The masthead, the navigation and the footer — the frame every screen sits
// inside. The brand mark is the design's own SVG, kept vector.

export function BrandMark() {
  return (
    <svg width="52" height="52" viewBox="0 0 64 64" className="brand-mark" aria-hidden="true">
      <circle cx="32" cy="32" r="30.2" fill="none" stroke="#b68235" strokeWidth=".7" opacity=".8" />
      <circle
        cx="32"
        cy="32"
        r="28.2"
        fill="none"
        stroke="#b68235"
        strokeWidth="3.4"
        strokeDasharray="1 4.35"
        opacity=".75"
      />
      <circle cx="32" cy="32" r="25.6" fill="none" stroke="#b68235" strokeWidth="1.3" />
      <circle cx="32" cy="32" r="23.2" fill="none" stroke="#b68235" strokeWidth=".55" opacity=".55" />
      <text
        x="32"
        y="39.5"
        textAnchor="middle"
        fontFamily="Cormorant Garamond, serif"
        fontSize="27"
        fill="#201f1d"
      >
        T
      </text>
      <g stroke="#b68235" strokeWidth=".7" fill="none" strokeLinecap="round" opacity=".9">
        <path d="M13.5 36.5 C15.5 41.5 19 44.5 23 45.5" />
        <path d="M15.2 38.8 C16.9 38 18.6 38.2 19.7 39.3" />
        <path d="M17.8 41.8 C19.5 41.1 21.2 41.4 22.2 42.6" />
        <path d="M50.5 36.5 C48.5 41.5 45 44.5 41 45.5" />
        <path d="M48.8 38.8 C47.1 38 45.4 38.2 44.3 39.3" />
        <path d="M46.2 41.8 C44.5 41.1 42.8 41.4 41.8 42.6" />
        <path d="M32 15.5 v3.6" />
        <path d="M29.6 17.8 l2.4 2.6 2.4 -2.6" />
      </g>
    </svg>
  )
}

const TABS = [
  { route: 'home', label: 'Latest' },
  { route: 'archive', label: 'The Shelf' },
  { route: 'about', label: 'About Teeta' },
]

export function Header({ route, go }) {
  return (
    <header className="header">
      <button type="button" className="brand" onClick={() => go('home')}>
        <span className="brand-row">
          <span className="masthead">Teeta Reviews</span>
          <BrandMark />
        </span>
        <span className="tagline">Books, films and whatever else, marked out of ten</span>
      </button>

      <nav className="nav">
        {TABS.map((tab) => (
          <button
            key={tab.route}
            type="button"
            className="nav-link"
            aria-current={route === tab.route ? 'page' : undefined}
            onClick={() => go(tab.route)}
          >
            {tab.label}
          </button>
        ))}
        <button
          type="button"
          className="footer-link"
          style={{ fontSize: 15, padding: '8px 15px' }}
          onClick={() => go('contact')}
        >
          Write to Teeta
        </button>
      </nav>
    </header>
  )
}

export function Footer({ signedIn, unread, go, onSignOut }) {
  return (
    <footer className="footer">
      <span className="kicker">teetareviews.com</span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 20, flexWrap: 'wrap' }}>
        {signedIn ? (
          <>
            <button type="button" className="footer-link" onClick={() => go('write')}>
              A new review
            </button>
            <button type="button" className="footer-link" onClick={() => go('notes')}>
              Notes{unread ? ` · ${unread}` : ''}
            </button>
            <button type="button" className="btn-quiet" onClick={onSignOut}>
              Sign out
            </button>
          </>
        ) : (
          <button type="button" className="footer-link" onClick={() => go('write')}>
            Sign in
          </button>
        )}
        <span className="hand" style={{ fontSize: 20 }}>
          kept for the kids and the grandkids
        </span>
      </span>
    </footer>
  )
}
