// Downloads the four font families the design uses and writes a local
// @font-face sheet, so the site has no runtime dependency on Google Fonts.
// Re-run only when the type stack changes; the output is committed.
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const OUT_DIR = path.join(process.cwd(), 'web', 'public', 'fonts')
const CSS_OUT = path.join(process.cwd(), 'web', 'src', 'styles', 'fonts.css')

const URL_SRC =
  'https://fonts.googleapis.com/css2' +
  '?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400' +
  '&family=Lora:ital,wght@0,400;0,500;1,400' +
  '&family=Caveat:wght@400;500;600' +
  '&family=Mrs+Saint+Delafield' +
  '&display=swap'

// A family of English-language reviews needs latin; latin-ext covers the
// accented titles she is likely to write (Amélie, Les Misérables).
const KEEP = new Set(['latin', 'latin-ext'])
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const res = await fetch(URL_SRC, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`Google Fonts returned ${res.status}`)
  const css = await res.text()

  // Each @font-face is preceded by a /* subset */ comment.
  const blocks = css.split('/*').slice(1)
  const out = [
    '/* Self-hosted from Google Fonts by scripts/fetch-fonts.mjs — do not edit by hand. */',
    '',
  ]
  let count = 0
  const written = new Set()

  for (const raw of blocks) {
    const subset = raw.slice(0, raw.indexOf('*/')).trim()
    if (!KEEP.has(subset)) continue

    const block = raw.slice(raw.indexOf('*/') + 2)
    const family = block.match(/font-family:\s*'([^']+)'/)?.[1]
    const weight = block.match(/font-weight:\s*(\d+)/)?.[1] || '400'
    const style = block.match(/font-style:\s*(\w+)/)?.[1] || 'normal'
    const href = block.match(/url\((https:[^)]+\.woff2)\)/)?.[1]
    const range = block.match(/unicode-range:\s*([^;]+);/)?.[1]
    if (!family || !href) continue

    const bin = await fetch(href, { headers: { 'User-Agent': UA } })
    if (!bin.ok) throw new Error(`${family} ${weight}: ${bin.status}`)
    const bytes = Buffer.from(await bin.arrayBuffer())

    // Google serves one variable-font file for every weight of a family, so
    // naming by weight would write the same bytes several times over. Name by
    // content instead and let the @font-face rules share a file.
    const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 8)
    const name = `${slug(family)}-${subset}-${digest}.woff2`
    if (!written.has(name)) {
      await writeFile(path.join(OUT_DIR, name), bytes)
      written.add(name)
      count++
    }

    out.push(
      '@font-face {',
      `  font-family: '${family}';`,
      `  font-style: ${style};`,
      `  font-weight: ${weight};`,
      '  font-display: swap;',
      `  src: url('/fonts/${name}') format('woff2');`,
      ...(range ? [`  unicode-range: ${range};`] : []),
      '}',
      ''
    )
  }

  await writeFile(CSS_OUT, out.join('\n'))
  console.log(`[fonts] ${count} files → web/public/fonts, sheet → web/src/styles/fonts.css`)
}

main().catch((err) => {
  console.error('[fonts] failed:', err.message)
  process.exit(1)
})
