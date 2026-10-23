#!/usr/bin/env node
/**
 * Two-browser end-to-end test against the REAL server (no stubs): it builds nothing itself, so run
 * `npm run build && npm run build:standalone` first. It starts dist-server/standalone.mjs on a free port with a
 * throwaway data folder, signs in as Vee and as Daniel in two separate browser contexts, and exercises the
 * things that make this a shared app: live delivery, offline queueing, two-way sync, consent, and the Time Capsule.
 *
 * Not part of `npm test` (Playwright and Chromium are not project dependencies):
 *   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/e2e/smoke.mjs [out-dir]
 *
 * The Time Capsule checks run only if ./private exists (created by `npm run assets:extract`).
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const OUT = process.argv[2] ?? 'e2e-output'
mkdirSync(OUT, { recursive: true })

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${ok || !detail ? '' : `  → ${detail}`}`)
}

// ---------------------------------------------------------------- the real server
const dataDir = mkdtempSync(join(tmpdir(), 'signal-home-e2e-'))
const port = 20000 + Math.floor(Math.random() * 20000)
const BASE = `http://127.0.0.1:${port}`
const env = { ...process.env, PORT: String(port), DATA_DIR: dataDir }
for (const name of ['SIGNAL_USERS', 'SIGNAL_SESSION_SECRET', 'SIGNAL_ADMIN_TOKEN', 'NODE_ENV']) delete env[name]
const server = spawn('node', ['dist-server/standalone.mjs'], { env, stdio: ['ignore', 'pipe', 'pipe'] })
server.stderr.on('data', (chunk) => process.stderr.write(chunk))
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('server did not start')), 15000)
  server.stdout.on('data', (chunk) => {
    if (String(chunk).includes('Signal Home on')) { clearTimeout(timer); resolve() }
  })
})
const devSecret = readFileSync(join(dataDir, 'dev-secret'), 'utf8').trim()
const adminToken = `dev-admin-token-${devSecret}`.slice(0, 64).padEnd(32, '0')

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] })

async function person(name, { viewport = { width: 1100, height: 780 } } = {}) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' })
  const page = await context.newPage()
  const errors = []
  // Ignored on purpose: Playwright's own service-worker shim throwing inside the intentionally sandboxed Time Capsule frames.
  page.on('pageerror', (e) => { if (!/serviceWorker/.test(e.message)) errors.push(`pageerror: ${e.message}`) })
  page.on('console', (m) => {
    // Ignored on purpose: WebGL driver chatter, and the archived originals asking for asset files that no longer exist.
    if (m.type() === 'error' && !/GL Driver|Failed to load resource|Refused to load media|serviceWorker/.test(m.text())) errors.push(m.text())
  })
  return { name, context, page, errors }
}

async function signIn(who, password = 'dev') {
  await who.page.goto(BASE)
  await who.page.getByLabel('Name').fill(who.name)
  await who.page.getByLabel('Password').fill(password)
  await who.page.getByRole('button', { name: 'Sign in', exact: true }).click()
}
const waitForHouse = (who) => who.page.getByRole('button', { name: /Go to/ }).waitFor({ timeout: 20000 })

async function openObject(page, label) {
  await page.getByRole('button', { name: /Go to/ }).click()
  await page.getByRole('button', { name: new RegExp(`^${label}`) }).first().click()
}
const closeDialog = (page) => page.getByRole('button', { name: 'Close', exact: true }).first().click()
const appears = async (page, text, timeout = 12000) => page.getByText(text).first().waitFor({ timeout }).then(() => true, () => false)

try {
  // ------------------------------------------------------------------------------------------
  console.log('\n1. Sign-in')
  const vee = await person('vee')
  const daniel = await person('daniel')
  await vee.page.goto(BASE)
  check('shows the sign-in screen when signed out', await vee.page.getByRole('heading', { name: 'Signal Home' }).isVisible())
  await signIn(vee, 'wrong password')
  check('a wrong password is refused with a friendly message', await appears(vee.page, /do not match/, 8000))
  const cookies = await vee.context.cookies()
  check('no session cookie is set by a failed sign-in', !cookies.some((c) => c.name === 'sh_session'))
  await signIn(vee)
  await waitForHouse(vee)
  const cookie = (await vee.context.cookies()).find((c) => c.name === 'sh_session')
  check('session cookie is HttpOnly and SameSite=Strict', !!cookie && cookie.httpOnly && cookie.sameSite === 'Strict', JSON.stringify(cookie))
  check('the token is not readable from page scripts', !(await vee.page.evaluate(() => document.cookie)).includes('sh_session'))
  check('3D canvas is created', (await vee.page.locator('canvas').count()) === 1)
  await signIn(daniel)
  await waitForHouse(daniel)
  await vee.page.waitForTimeout(1200)
  await vee.page.screenshot({ path: `${OUT}/01-home.png` })
  const reloaded = await vee.context.newPage()
  await reloaded.goto(BASE)
  check('a reload stays signed in (cookie session)', await reloaded.getByRole('button', { name: /Go to/ }).waitFor({ timeout: 15000 }).then(() => true, () => false))
  await reloaded.close()

  // ------------------------------------------------------------------------------------------
  console.log('\n2. Live delivery between two people')
  await openObject(daniel.page, 'Rose')
  await daniel.page.getByRole('dialog', { name: /Love Ping/ }).waitFor()
  await daniel.page.getByLabel('Add a message').fill('Thinking of you')
  await daniel.page.getByRole('button', { name: /Kiss/ }).first().click()
  check('Vee receives Daniel\'s ping live, without reloading', await appears(vee.page, /Daniel sent you a kiss/))
  check('Daniel\'s own history shows what he sent', await appears(daniel.page, /You sent/, 8000))
  await daniel.page.screenshot({ path: `${OUT}/02-love-ping.png` })
  await closeDialog(daniel.page)

  await vee.page.reload()
  await waitForHouse(vee)
  await vee.page.waitForTimeout(3500)
  check('a delivered ping is not replayed after a reload (it was acknowledged)', (await vee.page.getByText(/Daniel sent you a kiss/).count()) === 0)

  // ------------------------------------------------------------------------------------------
  console.log('\n3. Offline delivery')
  await vee.context.setOffline(true)
  await vee.page.waitForTimeout(500)
  await openObject(daniel.page, 'Rose')
  await daniel.page.getByRole('dialog', { name: /Love Ping/ }).waitFor()
  await daniel.page.getByRole('button', { name: /Hug/ }).first().click().catch(() => {})
  await daniel.page.getByRole('button', { name: /Heart/ }).first().click()
  await closeDialog(daniel.page)
  await vee.page.waitForTimeout(2500)
  check('while Vee is offline nothing reaches her', (await vee.page.getByText(/Daniel sent you/).count()) === 0)
  await vee.context.setOffline(false)
  check('when Vee comes back online the missed ping is waiting for her', await appears(vee.page, /Daniel sent you a heart|Daniel sent you/, 20000))

  await daniel.context.setOffline(true)
  await daniel.page.waitForTimeout(500)
  await openObject(daniel.page, 'Rose')
  await daniel.page.getByRole('dialog', { name: /Love Ping/ }).waitFor()
  await daniel.page.getByRole('button', { name: /Kiss/ }).first().click()
  check('offline: Daniel\'s ping is queued and the UI says so', await appears(daniel.page, /waiting to send/, 5000))
  await daniel.context.setOffline(false)
  check('back online: the queued ping is delivered', await appears(vee.page, /Daniel sent you a kiss/, 25000))
  await closeDialog(daniel.page)

  // ------------------------------------------------------------------------------------------
  console.log('\n4. Shared data stays in sync')
  await openObject(vee.page, 'Date jar')
  await vee.page.getByRole('dialog', { name: /Date Jar/ }).waitFor()
  await openObject(daniel.page, 'Date jar')
  await daniel.page.getByLabel('Idea', { exact: true }).fill('Moonlit picnic')
  await daniel.page.getByRole('button', { name: 'Add', exact: true }).click()
  check('an idea Daniel adds appears on Vee\'s open Date Jar without a reload', await appears(vee.page, /Moonlit picnic/))
  await vee.page.screenshot({ path: `${OUT}/03-date-jar.png` })
  await closeDialog(vee.page)
  await closeDialog(daniel.page)

  await openObject(daniel.page, 'Garden window')
  await daniel.page.getByRole('dialog', { name: /Mood Garden/ }).waitFor()
  await daniel.page.getByRole('button', { name: /Feeling cuddly/ }).click()
  await daniel.page.waitForTimeout(800)
  await openObject(vee.page, 'Garden window')
  await vee.page.getByRole('dialog', { name: /Mood Garden/ }).waitFor()
  check('Vee\'s garden shows the plants (both people\'s)', (await vee.page.locator('.plant').count()) >= 1)
  await vee.page.screenshot({ path: `${OUT}/04-garden.png` })
  await closeDialog(vee.page)
  await closeDialog(daniel.page)

  // ------------------------------------------------------------------------------------------
  console.log('\n5. Consent')
  await openObject(daniel.page, 'Mischief box')
  await daniel.page.getByRole('dialog', { name: /Mischief/ }).waitFor()
  await daniel.page.getByRole('dialog', { name: /Mischief/ }).getByRole('button', { name: 'Send', exact: true }).first().click()
  const refused = await appears(daniel.page, /not opted in/i, 12000)
  await daniel.page.screenshot({ path: `${OUT}/05-mischief-refused.png` })
  check('mischief is refused while Vee has not opted in', refused)
  await closeDialog(daniel.page)
  await openObject(vee.page, 'Mischief box')
  await vee.page.getByLabel(/Let Daniel send me playful surprises/).check()
  await vee.page.waitForTimeout(800)
  await vee.page.reload()
  await waitForHouse(vee)
  await openObject(vee.page, 'Mischief box')
  check('Vee\'s consent choice survives a reload (saved on the server)', await vee.page.getByLabel(/Let Daniel send me playful surprises/).isChecked())
  await closeDialog(vee.page)

  // ------------------------------------------------------------------------------------------
  console.log('\n6. Time Capsule')
  if (!existsSync('private/manifest.json')) {
    console.log('  (skipped: run `npm run assets:extract` first to create ./private)')
  } else {
    const upload = spawnSync('node', ['scripts/upload-private-assets.mjs', '--url', BASE, '--author', 'daniel'], { env: { ...process.env, SIGNAL_ADMIN_TOKEN: adminToken }, encoding: 'utf8' })
    check('the upload script loads the originals through the API', upload.status === 0 && /capsule signal-home/.test(upload.stdout), upload.stdout + upload.stderr)
    const again = spawnSync('node', ['scripts/upload-private-assets.mjs', '--url', BASE, '--author', 'daniel'], { env: { ...process.env, SIGNAL_ADMIN_TOKEN: adminToken }, encoding: 'utf8' })
    check('running it again changes nothing', again.status === 0 && /skip +capsule signal-home/.test(again.stdout) && /added +0 love notes/.test(again.stdout), again.stdout + again.stderr)

    await vee.page.reload()
    await waitForHouse(vee)
    await openObject(vee.page, 'Time capsule')
    await vee.page.getByRole('heading', { name: /Signal Home \(original\)/ }).waitFor({ timeout: 15000 })
    check('lists both archived originals', (await vee.page.getByRole('button', { name: 'Open the original' }).count()) === 2)
    for (const [index, { slug, title, pattern }] of [{ slug: 'signal-home', title: /Signal Home \(original\)/, pattern: /Home|Signals|Go to page/i }, { slug: 'love-universe', title: /Love Universe \(original\)/, pattern: /Our Little Love Universe/ }].entries()) {
      if (index > 0) {
        await vee.page.getByRole('button', { name: /Back to the capsule/ }).click()
        await vee.page.getByRole('heading', { name: title }).waitFor()
      }
      const card = vee.page.locator('li', { has: vee.page.getByRole('heading', { name: title }) })
      await card.getByRole('button', { name: 'Open the original' }).click()
      await vee.page.getByText(/Verified: identical/).waitFor({ timeout: 30000 })
      const inner = vee.page.frameLocator('iframe[title*="archived original"]').frameLocator('iframe')
      await inner.locator('body').waitFor({ timeout: 20000 })
      await vee.page.waitForTimeout(2500)
      const text = await inner.locator('body').innerText().catch(() => '')
      check(`${slug}: integrity verified and the original renders inside the sandbox`, pattern.test(text), text.slice(0, 100))
      if (index === 0) await vee.page.screenshot({ path: `${OUT}/05-time-capsule.png` })
    }
    const sandbox = await vee.page.locator('iframe[title*="archived original"]').getAttribute('sandbox')
    check('viewer frame is sandboxed WITHOUT same-origin', sandbox === 'allow-scripts', String(sandbox))
    await closeDialog(vee.page) // back to the list
    await closeDialog(vee.page) // close the panel

    const raw = await vee.context.request.get(`${BASE}/api/capsule`)
    const items = await raw.json()
    const file = await vee.context.request.get(`${BASE}/api/files/${items[0].fileId}`, { headers: { range: 'bytes=0-99' } })
    check('capsule files are served as inert downloads, never as pages', file.headers()['content-type'] === 'application/octet-stream' && /attachment/.test(file.headers()['content-disposition'] ?? '') && /sandbox/.test(file.headers()['content-security-policy'] ?? ''))
    const anonymous = await (await browser.newContext()).request.get(`${BASE}/api/files/${items[0].fileId}`)
    check('without signing in, private files are not served', anonymous.status() === 401)

    await openObject(vee.page, 'Heart')
    await vee.page.getByRole('dialog', { name: /Love Universe/ }).waitFor()
    await vee.page.getByRole('button', { name: 'Tap the heart' }).click()
    await vee.page.waitForTimeout(800)
    check('the Love Universe has the original wording and loaded stickers', await vee.page.getByText('A tiny universe for us').isVisible())
    await vee.page.screenshot({ path: `${OUT}/06-love-universe.png` })
    await vee.page.keyboard.press('Escape')
  }

  // ------------------------------------------------------------------------------------------
  console.log('\n7. Sign-out and mobile')
  await vee.page.getByRole('button', { name: 'Settings' }).click()
  await vee.page.getByRole('dialog', { name: 'Settings' }).waitFor()
  await vee.page.getByRole('button', { name: 'Sign out' }).click().catch(() => {})
  vee.page.once('dialog', (d) => d.accept())
  await vee.page.getByRole('button', { name: 'Sign out' }).click().catch(() => {})
  check('signing out returns to the sign-in screen', await vee.page.getByLabel('Password').waitFor({ timeout: 10000 }).then(() => true, () => false))
  const afterOut = await vee.context.request.get(`${BASE}/api/auth/me`)
  check('the session is really gone on the server side of the cookie', afterOut.status() === 401)

  const phone = await person('vee', { viewport: { width: 390, height: 780 } })
  await signIn(phone)
  await waitForHouse(phone)
  await phone.page.waitForTimeout(1000)
  await openObject(phone.page, 'Date jar')
  await phone.page.getByRole('dialog', { name: /Date Jar/ }).waitFor()
  const box = await phone.page.getByRole('dialog', { name: /Date Jar/ }).boundingBox()
  check('panel is a bottom sheet on phones', !!box && box.x <= 1 && box.width >= 388 && box.y > 100, JSON.stringify(box))
  check('no horizontal page scroll on a phone', !(await phone.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)))
  await phone.page.screenshot({ path: `${OUT}/07-mobile.png` })

  for (const who of [vee, daniel, phone]) check(`no uncaught errors in ${who.name}'s page`, who.errors.length === 0, who.errors.slice(0, 3).join(' | '))
} finally {
  await browser.close()
  server.kill()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
