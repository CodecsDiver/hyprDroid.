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
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const FILE = resolve(process.argv[2] ?? 'dist/index.html')
const OUT = process.argv[3] ?? 'e2e-output'
const PRIVATE = /signal-home\.html$/.test(FILE)
const URL = pathToFileURL(FILE).href
mkdirSync(OUT, { recursive: true })

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

  console.log('\n5. Erasing')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('dialog', { name: 'Settings' }).waitFor()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: /Erase everything/ }).click()
  await page.getByRole('button', { name: /I.m Vee/ }).waitFor({ timeout: 15000 })
  await pick('Vee')
  await openObject('Date jar')
  await page.waitForTimeout(800)
  check('after erasing, the date idea is gone', (await page.getByText(/Moonlit picnic/).count()) === 0)
  await closeDialog()

  if (PRIVATE) {
    console.log('\n6. Your private copy')
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
    await page.screenshot({ path: `${OUT}/08-music.png` })
  }

  console.log('\n7. Honesty checks')
  check('the page made no request to anything outside itself', outside.size === 0, [...outside].slice(0, 3).map((r) => r.url()).join(' '))
  check('no uncaught errors', errors.length === 0, errors.slice(0, 3).join(' | '))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
