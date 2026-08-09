// Walks the "Done when" list from the backend spec against a real browser.
//
// Not part of CI — it needs a browser and a seeded database. Run it by hand
// against a local server, or against the live site after a deploy:
//
//   npm i --no-save playwright
//   BASE_URL=https://teetareviews.com TEST_EMAIL=… TEST_PASSWORD=… \
//     node scripts/acceptance.mjs
//
// It writes reviews, so point it at production only when that is acceptable.
import { chromium } from 'playwright'

const OUT = process.env.SHOT_DIR || '/tmp'
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const pass = []
const fail = []
const check = (ok, label) => (ok ? pass : fail).push(label)

// CHROMIUM_PATH lets a machine with a preinstalled browser skip the download.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
)
const teeta = await browser.newContext({ viewport: { width: 1024, height: 1366 } }) // iPad
const page = await teeta.newPage()

// 1. She signs in.
await page.goto(`${BASE}/desk`, { waitUntil: 'networkidle' })
await page.fill('input[type=email]', process.env.TEST_EMAIL || 'teeta@example.com')
await page.fill('input[type=password]', process.env.TEST_PASSWORD || 'localdevpassword')
await page.click('button[type=submit]')
await page.waitForTimeout(2000)
check(await page.locator('text=A new review').first().isVisible(), 'she reaches her desk')

// 2. She writes a review and publishes it.
const title = 'Middlemarch'
await page.fill('input[placeholder="What did you read or watch?"]', title)
await page.selectOption('select', 'Book')
await page.fill('input[placeholder="Author, director, whoever"]', 'George Eliot')
await page.fill('input[placeholder="It was okay."]', 'Worth every one of its nine hundred pages.')
await page.fill('textarea', 'I put this off for forty years.\n\nI should not have.')
await page.fill('input[placeholder="August 2026"]', 'August 2026')
await page.locator('input[type=range]').fill('10')
await page.click('button:has-text("Seal it and publish")')
await page.waitForTimeout(2500)
check(page.url().includes('/review/middlemarch-2026'), `slug is the permanent link (${page.url().split('/').pop()})`)
check(await page.locator(`h1:has-text("${title}")`).isVisible(), 'the new review opens')
await page.screenshot({ path: `${OUT}/e2e-published.png`, fullPage: true })

// 3. It is on the homepage.
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
check(await page.locator(`h1:has-text("${title}")`).isVisible(), 'it is the newest on the homepage')
check(await page.locator('text=also lately').isVisible(), '"also lately" shows the others')
await page.screenshot({ path: `${OUT}/e2e-home.png`, fullPage: true })

// 4. A visitor on another device — separate context, no cookies.
const visitor = await browser.newContext({ viewport: { width: 1180, height: 900 } })
const guest = await visitor.newPage()
await guest.goto(`${BASE}/shelf`, { waitUntil: 'networkidle' })
await guest.waitForTimeout(1200)
check(await guest.locator(`text=${title}`).first().isVisible(), 'a visitor sees it')

await guest.fill('input[placeholder="Search a title…"]', 'middle')
await guest.waitForTimeout(600)
check(await guest.locator('.shelf-row').count() === 1, 'search narrows the shelf')

await guest.fill('input[placeholder="Search a title…"]', '')
// .shelf-row is itself a <button> whose text contains the kind, so the
// segmented control has to be addressed by its own class.
await guest.locator('.seg-opt', { hasText: /^Film$/ }).click()
await guest.waitForTimeout(600)
const films = await guest.locator('.shelf-row').count()
check(films === 1 && (await guest.locator('text=The Odyssey').first().isVisible()), 'filtering to Film works')

await guest.locator('.seg-opt', { hasText: /^All$/ }).click()
await guest.locator('button.btn-quiet', { hasText: 'sorted' }).click()
await guest.waitForTimeout(600)
const firstScore = await guest.locator('.shelf-score').first().innerText()
check(firstScore.trim() === '10', `sorting by score puts the 10 first (got ${firstScore.trim()})`)
await guest.screenshot({ path: `${OUT}/e2e-shelf.png`, fullPage: true })

// 5. No credential in the page source.
const html = await guest.content()
check(!/localdevpassword|passphrase/i.test(html), 'no password or passphrase in the page source')

// 6. A draft is invisible to a visitor.
await page.goto(`${BASE}/desk`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await page.fill('input[placeholder="What did you read or watch?"]', 'A Secret Draft')
await page.fill('input[placeholder="August 2026"]', 'August 2026')
await page.click('button:has-text("Keep it to myself for now")')
await page.waitForTimeout(2000)
await guest.goto(`${BASE}/review/secret-draft-2026`, { waitUntil: 'networkidle' })
await guest.waitForTimeout(1200)
check(!(await guest.locator('h1:has-text("A Secret Draft")').isVisible()), 'a draft is hidden from visitors')
check(await page.locator('text=A Secret Draft').first().isVisible(), 'but she can see her own draft')

// 7. Signing out hides her desk.
await page.click('button:has-text("Sign out")')
await page.waitForTimeout(2000)
await page.goto(`${BASE}/desk`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
check(await page.locator('text=Only Teeta writes here').isVisible(), 'signing out hides her desk')

console.log('\nPASS:')
pass.forEach((p) => console.log('  ✓', p))
if (fail.length) {
  console.log('\nFAIL:')
  fail.forEach((f) => console.log('  ✗', f))
}
console.log(`\n${pass.length} passed, ${fail.length} failed`)
await browser.close()
process.exit(fail.length ? 1 : 0)
