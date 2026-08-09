import { paragraphs } from '../format.js'

function Snippet(review) {
  return (review.verdict || paragraphs(review.body)[0] || '').slice(0, 110)
}

export default function Reading({ review, others, isDetail, go, open }) {
  if (!review) {
    return (
      <section className="screen" style={{ margin: '60px 0' }}>
        <div className="hand" style={{ fontSize: 26 }}>
          Nothing on the shelf yet.
        </div>
      </section>
    )
  }

  const paras = paragraphs(review.body)

  return (
    <section className="screen" aria-label="Review">
      <div className="rule-row review-head">
        <button type="button" className="back-link" onClick={() => (isDetail ? go('archive') : go('home'))}>
          {isDetail ? '← back to the shelf' : 'the newest one'}
        </button>
        <div className="rule" />
        <div className="kicker">{review.display_date}</div>
      </div>

      <article className="article">
        <div style={{ minWidth: 0 }}>
          <div className="kicker" style={{ fontSize: 12, marginBottom: 12 }}>
            {review.kind}
            {!review.published && ' · draft'}
          </div>
          <h1 className="review-title">{review.title}</h1>
          {review.creator && <div className="review-creator">{review.creator}</div>}

          {review.verdict && <div className="verdict">{review.verdict}</div>}

          <div className="prose">
            {paras.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {review.quote?.trim() && <blockquote className="pull-quote">{review.quote}</blockquote>}

          <div className="signature">
            <span className="signature-name">Teeta</span>
            <span className="glow" style={{ width: 42, height: 42 }}>
              <span className="monogram" style={{ width: 42, height: 42, fontSize: 16 }}>
                T
              </span>
            </span>
          </div>
        </div>

        <aside className="aside">
          <div className="glow" style={{ width: 130, height: 130 }}>
            <div className="score-dial">
              <span>{review.score}</span>
            </div>
          </div>
          <div className="kicker" style={{ letterSpacing: '0.22em' }}>
            out of ten
          </div>
          {review.cover_url && (
            <div
              className="cover plate"
              role="img"
              aria-label={`Cover of ${review.title}`}
              style={{ backgroundImage: `url(${review.cover_url})` }}
            />
          )}
        </aside>
      </article>

      {others.length > 0 && (
        <div style={{ marginTop: 56 }}>
          <div className="rule-row" style={{ marginBottom: 20 }}>
            <div className="hand" style={{ fontSize: 27 }}>
              also lately
            </div>
            <div className="rule" />
          </div>
          <div className="grid">
            {others.map((r) => (
              <button key={r.id} type="button" className="grid-card" onClick={() => open(r.id)}>
                <span
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <span className="kicker" style={{ letterSpacing: '0.18em' }}>
                    {r.kind}
                  </span>
                  <span className="grid-card-score">{r.score}</span>
                </span>
                <span className="grid-card-title">{r.title}</span>
                {r.creator && (
                  <span className="review-creator" style={{ fontSize: 13 }}>
                    {r.creator}
                  </span>
                )}
                <span className="grid-card-snippet">{Snippet(r)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
