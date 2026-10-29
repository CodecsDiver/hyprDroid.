#!/usr/bin/env node
/**
 * End-to-end test of the single HTML file, opened straight from disk (file://) like a person would:
 *
 *   npm run build && PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/e2e/smoke.mjs [dist/index.html] [out-dir]
 *
 * With your private copy (npm run build:private) pass private/signal-home.html as the first argument to include the
 * Time Capsule, sticker and room-song checks.
 *
 * Not part of `npm test` (Playwright and Chromium are not project dependencies).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const FILE = resolve(process.argv[2] ?? 'dist/index.html')
const OUT = process.argv[3] ?? 'e2e-output'
const PRIVATE = /signal-home\.html$/.test(FILE)
const URL = pathToFileURL(FILE).href
mkdirSync(OUT, { recursive: true })

/** A small valid PNG (a colour gradient), made without any image library. */
function makePng(size = 96) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body)); return Buffer.concat([len, body, sum]) }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const i = y * (size * 3 + 1) + 1 + x * 3; raw[i] = (x * 255) / size; raw[i + 1] = (y * 255) / size; raw[i + 2] = 180 }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${ok || !detail ? '' : `  → ${detail}`}`)
}

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] })
const context = await browser.newContext({ viewport: { width: 1100, height: 780 }, serviceWorkers: 'block' })
// Requests the browser itself refuses (the Time Capsule's policy blocks the originals' fonts and CDN scripts) never reach the network.
const outside = new Set()
context.on('request', (request) => {
  if (!/^(file|data|blob|about):/.test(request.url())) outside.add(request)
})
context.on('requestfailed', (request) => {
  if (/csp/i.test(request.failure()?.errorText ?? '')) outside.delete(request)
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => { if (!/serviceWorker/.test(e.message)) errors.push(`pageerror: ${e.message}`) })
page.on('console', (m) => { if (m.type() === 'error' && !/GL Driver|Failed to load resource|Refused to|Not allowed to load local resource|serviceWorker/.test(m.text())) errors.push(m.text()) })

const waitForHouse = () => page.getByRole('button', { name: /Go to/ }).waitFor({ timeout: 20000 })
const pick = async (name) => {
  await page.getByRole('button', { name: new RegExp(`I.m ${name}`) }).click()
  await waitForHouse()
}
async function openObject(label) {
  await page.getByRole('button', { name: /Go to/ }).click()
  await page.getByRole('button', { name: new RegExp(`^${label}`) }).first().click()
}
const closeDialog = () => page.getByRole('button', { name: 'Close', exact: true }).first().click()
const appears = (text, timeout = 12000) => page.getByText(text).first().waitFor({ timeout }).then(() => true, () => false)
async function switchTo(name) {
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('dialog', { name: 'Settings' }).waitFor()
  await page.getByRole('button', { name: 'Switch person' }).click()
  await pick(name)
}

try {
  console.log('\n1. Opening the file')
  const opened = Date.now()
  await page.goto(URL)
  await page.getByRole('button', { name: /I.m Daniel/ }).waitFor({ timeout: 90000 })
  console.log(`     (ready after ${((Date.now() - opened) / 1000).toFixed(1)} s${PRIVATE ? ', including first-run loading of your private content' : ''})`)
  check('asks who is here (there is no sign-in)', await page.getByRole('button', { name: /I.m Daniel/ }).isVisible() && await page.getByRole('button', { name: /I.m Vee/ }).isVisible())
  check('says plainly that nothing leaves the browser', await page.getByText(/only in this browser/).isVisible())
  await pick('Daniel')
  check('3D canvas is created', (await page.locator('canvas').count()) === 1)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/01-home.png` })

  console.log('\n2. Two people, one page')
  await openObject('Rose')
  await page.getByRole('dialog', { name: /Love Ping/ }).waitFor()
  await page.getByLabel('Add a message').fill('Thinking of you')
  await page.getByRole('button', { name: /Kiss/ }).first().click()
  check('Daniel sees his own ping in his history', await appears(/You sent/, 8000))
  await closeDialog()
  await page.waitForTimeout(1500)
  await switchTo('Vee')
  check('the ping was waiting for Vee when she opened the page', await appears(/Daniel sent you a kiss/, 15000))
  await page.screenshot({ path: `${OUT}/02-vee-receives.png` })

  console.log('\n3. Consent')
  await switchTo('Daniel')
  await openObject('Mischief box')
  await page.getByRole('dialog', { name: /Mischief/ }).getByRole('button', { name: 'Send', exact: true }).first().click()
  check('mischief is refused while Vee has not opted in', await appears(/not opted in/i, 12000))
  await closeDialog()

  console.log('\n4. Staying in this browser')
  await openObject('Date jar')
  await page.getByLabel('Idea', { exact: true }).fill('Moonlit picnic')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  check('Daniel adds a date idea', await appears(/Moonlit picnic/, 8000))
  await closeDialog()
  await page.waitForTimeout(600)
  await page.reload()
  check('after closing and reopening, nobody is assumed to be here', await page.getByRole('button', { name: /I.m Vee/ }).waitFor({ timeout: 15000 }).then(() => true, () => false))
  await pick('Vee')
  await openObject('Date jar')
  check('the idea survived the reload (kept in the browser)', await appears(/Moonlit picnic/, 8000))
  await closeDialog()

  const storedKeys = await page.evaluate(() => Object.keys(localStorage))
  console.log(`     (localStorage keys: ${storedKeys.join(', ') || 'none'})`)
  check('no cookies are set', (await context.cookies()).length === 0)

  console.log('\n5. Keepsakes')
  // -- calendar
  await switchTo('Daniel')
  await openObject('Calendar')
  await page.getByLabel('What is it?').fill('Our anniversary')
  const first = new Date(Date.now() - 400 * 86_400_000)
  await page.getByLabel('Date', { exact: true }).fill(first.toISOString().slice(0, 10))
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  check('the calendar shows days together once an anniversary is added', await appears(/days together/, 8000))
  await page.getByLabel('What is it?').fill('Beach trip')
  await page.getByLabel('Kind').selectOption('countdown')
  await page.getByLabel('Date', { exact: true }).fill(new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10))
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  check('a countdown counts the days', await appears(/in (9|10|11) days/, 8000))
  await page.screenshot({ path: `${OUT}/03-calendar.png` })
  await closeDialog()

  // -- question of the day: secret until both have answered
  await openObject('Question board')
  await page.getByLabel('Your answer').fill('Your laugh at 2am')
  await page.getByRole('button', { name: 'Save my answer' }).click()
  check('Daniel answers and is told to wait for Vee', await appears(/Waiting for Vee/, 8000))
  await closeDialog()
  await switchTo('Vee')
  await openObject('Question board')
  await page.getByText(/Daniel has answered/).first().waitFor({ timeout: 8000 })
  check('Vee is told Daniel answered but cannot read it yet', (await page.getByText('Your laugh at 2am').count()) === 0)
  await page.getByLabel('Your answer').fill('The way you hum')
  await page.getByRole('button', { name: 'Save my answer' }).click()
  check('after Vee answers, she sees both answers', await appears('Your laugh at 2am', 8000) && await appears('The way you hum', 8000))
  await page.screenshot({ path: `${OUT}/04-question.png` })
  await closeDialog()

  // -- sealed note
  await switchTo('Daniel')
  await openObject('Letter desk')
  await page.getByRole('tab', { name: /Hide a note/ }).click()
  await page.getByLabel('Your note').fill('Open this on our day')
  await page.getByLabel('Keep it sealed until (optional)').fill(new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10))
  await page.getByRole('button', { name: 'Hide note' }).click()
  await closeDialog()
  await switchTo('Vee')
  await openObject('Letter desk')
  await page.getByRole('tab', { name: /Waiting/ }).click()
  check('a sealed note shows as sealed to the person it is for', await appears(/Sealed until/, 8000))
  check('it has no Open button and its text is nowhere on the page', (await page.getByRole('button', { name: 'Open', exact: true }).count()) === 0 && (await page.getByText('Open this on our day').count()) === 0)
  await closeDialog()

  // -- postcards
  await switchTo('Daniel')
  await openObject('Postbox')
  await page.getByLabel('A few words (optional)').fill('See you soon')
  await page.getByRole('button', { name: 'Make the postcard' }).click()
  const code = await page.getByLabel('Send this whole code:').inputValue()
  check('Daniel makes a postcard code', code.startsWith('SH1.'))
  await page.getByLabel('Paste the code or link here').fill(code)
  await page.getByRole('button', { name: 'Open it' }).click()
  check('he cannot open a postcard he wrote himself', await appears(/wrote this postcard yourself/, 8000))
  await closeDialog()
  await switchTo('Vee')
  await openObject('Postbox')
  await page.getByLabel('Paste the code or link here').fill(code)
  await page.getByRole('button', { name: 'Open it' }).click()
  check('Vee opens it and it is delivered', await appears(/Delivered from Daniel to Vee/, 8000))
  check('it arrives as a normal message', await appears(/See you soon|Daniel sent you/, 10000))
  await page.getByLabel('Paste the code or link here').fill(code)
  await page.getByRole('button', { name: 'Open it' }).click()
  check('opening the same postcard again is harmless', await appears(/Delivered from Daniel to Vee/, 8000))
  await page.getByLabel('Paste the code or link here').fill('SH1.garbage')
  await page.getByRole('button', { name: 'Open it' }).click()
  check('a damaged code is refused politely', await appears(/damaged|does not look like|not in a format/, 8000))
  await page.screenshot({ path: `${OUT}/05-postbox.png` })
  await closeDialog()

  // -- photo wall
  await openObject('Memory shelf')
  await page.getByRole('button', { name: /Add memory/ }).click()
  await page.getByText('📷 Photo').click()
  await page.getByLabel('Title').fill('Our first photo')
  writeFileSync(`${OUT}/photo.png`, makePng())
  await page.locator('#m-photo').setInputFiles(`${OUT}/photo.png`)
  await page.getByRole('button', { name: 'Save to the vault' }).click()
  check('a shared photo is saved to the vault', await appears(/Our first photo/, 10000))
  await closeDialog()
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `${OUT}/06-photo-wall.png` })

  // -- garden history
  await openObject('Garden window')
  await page.getByRole('button', { name: /Feeling cuddly/ }).click()
  await page.getByText(/Mood history/).click()
  check('the garden shows a mood history grid', await page.getByRole('table').isVisible() && (await page.getByRole('img', { name: /cuddly|Feeling|Cuddly/i }).count()) >= 1)
  await closeDialog()

  console.log('\n6. Backup and erasing')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('dialog', { name: 'Settings' }).waitFor()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save a backup' }).click()])
  const backupPath = `${OUT}/backup.json`
  await download.saveAs(backupPath)
  check('a backup file is saved', /signal-home-backup-\d{4}-\d{2}-\d{2}\.json/.test(download.suggestedFilename()))
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: /Erase everything/ }).click()
  await page.getByRole('button', { name: /I.m Vee/ }).waitFor({ timeout: 15000 })
  await pick('Vee')
  await openObject('Date jar')
  await page.waitForTimeout(800)
  check('after erasing, the date idea is gone', (await page.getByText(/Moonlit picnic/).count()) === 0)
  await closeDialog()
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('dialog', { name: 'Settings' }).waitFor()
  page.once('dialog', (d) => d.accept())
  await page.locator('input[type=file][accept*=json]').setInputFiles(backupPath)
  await page.getByRole('button', { name: /I.m Vee/ }).waitFor({ timeout: 20000 })
  await pick('Vee')
  await openObject('Date jar')
  check('restoring the backup brings the date idea back', await appears(/Moonlit picnic/, 10000))
  await closeDialog()
  await openObject('Calendar')
  check('and the calendar entries', await appears(/Beach trip/, 8000))
  await closeDialog()
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('dialog', { name: 'Settings' }).waitFor()
  await page.locator('input[type=file][accept*=json]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"other"}') })
  check('a file that is not a backup is refused and nothing is lost', await appears(/not a Signal Home backup/, 8000))
  await closeDialog()

  if (PRIVATE) {
    console.log('\n7. Your private copy')
    await openObject('Time capsule')
    await page.getByRole('heading', { name: /Signal Home \(original\)/ }).waitFor({ timeout: 20000 })
    check('both originals are in the Time Capsule', (await page.getByRole('button', { name: 'Open the original' }).count()) === 2)
    for (const [index, { title, pattern }] of [{ title: /Signal Home \(original\)/, pattern: /Home|Signals|Go to page/i }, { title: /Love Universe \(original\)/, pattern: /Our Little Love Universe/ }].entries()) {
      if (index > 0) {
        await page.getByRole('button', { name: /Back to the capsule/ }).click()
        await page.getByRole('heading', { name: title }).waitFor()
      }
      await page.locator('li', { has: page.getByRole('heading', { name: title }) }).getByRole('button', { name: 'Open the original' }).click()
      await page.getByText(/Verified: identical/).waitFor({ timeout: 30000 })
      const inner = page.frameLocator('iframe[title*="archived original"]').frameLocator('iframe')
      await inner.locator('body').waitFor({ timeout: 20000 })
      await page.waitForTimeout(2500)
      const text = await inner.locator('body').innerText().catch(() => '')
      check(`original ${index + 1}: verified and renders in the sandbox`, pattern.test(text), text.slice(0, 80))
      if (index === 0) await page.screenshot({ path: `${OUT}/06-capsule.png` })
    }
    check('viewer frame is sandboxed WITHOUT same-origin', (await page.locator('iframe[title*="archived original"]').getAttribute('sandbox')) === 'allow-scripts')
    await closeDialog()
    await closeDialog()
    await openObject('Heart')
    await page.getByRole('dialog', { name: /Love Universe/ }).waitFor()
    await page.waitForTimeout(1500)
    check('the Love Universe has its original wording', await page.getByText('A tiny universe for us').isVisible())
    await page.screenshot({ path: `${OUT}/07-love-universe.png` })
    await page.keyboard.press('Escape')
    await openObject('Guitar')
    await page.waitForTimeout(800)
    check('the room song is in the music library', await appears(/Room song/, 8000))
    await page.getByRole('button', { name: 'Heart Room song' }).click()
    await switchTo('Daniel')
    await openObject('Guitar')
    await page.getByRole('button', { name: 'Heart Room song' }).click()
    check('a song hearted by both becomes an Our Song', await appears(/Our song/, 8000))
    await page.screenshot({ path: `${OUT}/08-music.png` })
    await closeDialog()
  }

  console.log('\n8. Entrance album (the one thing allowed to reach the internet)')
  const reached = new Set([...outside].map((r) => new globalThis.URL(r.url()).hostname))
  check('before a link is saved, nothing has reached the internet', reached.size === 0, [...reached].join(','))
  await context.route('https://w.soundcloud.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stub</title>' }))
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('dialog', { name: 'Settings' }).waitFor()
  await page.getByLabel('SoundCloud link').fill('https://evil.example/x/y')
  check('a link that is not SoundCloud is refused', await appears(/not a soundcloud.com link/, 5000) && await page.getByRole('button', { name: 'Save link' }).isDisabled())
  await page.getByLabel('SoundCloud link').fill('soundcloud.com/test-artist/sets/test-album')
  await page.getByRole('button', { name: 'Save link' }).click()
  await switchTo('Vee')
  const frame = page.locator('iframe[title^="Entrance album"]')
  await frame.waitFor({ state: 'attached', timeout: 8000 })
  const src = (await frame.getAttribute('src')) ?? ''
  check('coming in starts SoundCloud’s player with your album and autoplay', src.startsWith('https://w.soundcloud.com/player/?') && src.includes('test-album') && src.includes('auto_play=true'), src)
  check('there is a button to pause it', await page.getByRole('button', { name: 'Pause the entrance album' }).isVisible())
  const hosts = new Set([...outside].map((r) => new globalThis.URL(r.url()).hostname))
  check('the only site contacted is w.soundcloud.com', hosts.size === 1 && hosts.has('w.soundcloud.com'), [...hosts].join(','))
  await page.screenshot({ path: `${OUT}/09-entrance.png` })

  console.log('\n9. Honesty checks')
  check('no uncaught errors', errors.length === 0, errors.slice(0, 3).join(' | '))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
