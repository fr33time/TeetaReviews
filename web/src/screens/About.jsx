export default function About() {
  return (
    <section className="screen column" aria-label="About Teeta">
      <h2 className="h-display" style={{ marginBottom: 20 }}>
        About Teeta
      </h2>
      <p style={{ fontSize: 16.5, lineHeight: 1.82, textAlign: 'justify' }}>
        Four kids, eleven grandchildren, and a reading habit that has outlasted all of them put
        together. She reads more than anyone we know and takes some pride in saying so. What she does
        not read, she watches.
      </p>
      <p style={{ fontSize: 16.5, lineHeight: 1.82, textAlign: 'justify' }}>
        These are her opinions, written down so we stop losing them. A ten means she would start it
        over tomorrow. A one means she finished it anyway, out of principle.
      </p>
      <div style={{ height: 1, background: 'var(--color-divider)', margin: '32px 0' }} />
      <div className="hand" style={{ fontSize: 24 }}>
        Send me a paragraph in her own words and I&rsquo;ll set this in her voice instead.
      </div>
    </section>
  )
}
