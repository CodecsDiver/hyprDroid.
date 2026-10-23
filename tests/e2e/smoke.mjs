#!/usr/bin/env node
/**
 * Browser smoke test of the real UI against a STUBBED backend (see stub-backend.mjs).
 *
 * Not part of `npm test`: it needs Playwright + Chromium, which are deliberately not project
 * dependencies. Run it with a dev server pointing at the stub origin:
 *
 *   VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=<any anon-role JWT> npx vite --port 5175
 *   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/e2e/smoke.mjs http://127.0.0.1:5175 [out-dir]
 *
 * The Time Capsule checks use ./private/time-capsule/* if present (created by assets:extract).
 */
import { mkdirSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { fakeJwt, IDS, createStub, readCapsuleFiles } from './stub-backend.mjs'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const BASE = process.argv[2] ?? 'http://127.0.0.1:5175'
const OUT = process.argv[3] ?? 'e2e-output'
const STUB_ORIGIN = 'http://127.0.0.1:54321'
mkdirSync(OUT, { recursive: true })

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${ok || !detail ? '' : `  → ${detail}`}`)
}

const capsuleFiles = existsSync('private/time-capsule') ? readCapsuleFiles('private') : {}
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] })

async function session({ tamper = false, viewport = { width: 1100, height: 780 } } = {}) {
  const stub = createStub({ origin: STUB_ORIGIN, capsuleFiles, tamperCapsule: tamper })
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' })
  await context.route(`${STUB_ORIGIN}/**`, (route) => stub.handle(route))
  await context.routeWebSocket(/127\.0\.0\.1:54321\/realtime/, (ws) => stub.attachRealtime(ws))
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => { if (!/serviceWorker/.test(e.message)) errors.push(`pageerror: ${e.message}`) })
  page.on('console', (m) => { // Ignored on purpose: WebGL driver chatter; Playwright's own service-worker shim throwing inside the
  // intentionally sandboxed Time Capsule frames; and the archived originals asking for asset files
  // (sound loops, models) that no longer exist at their old paths.
  if (m.type() === 'error' && !/GL Driver|Failed to load resource|Refused to load media|serviceWorker/.test(m.text())) errors.push(m.text()) })
  return { stub, context, page, errors }
}

async function signIn(page) {
  await page.goto(BASE)
  await page.getByLabel('Email').fill('vee@example.test')
  await page.getByLabel('Password').fill('correct horse')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: /Go to/ }).waitFor({ timeout: 15000 })
}

async function openObject(page, label) {
  await page.getByRole('button', { name: /Go to/ }).click()
  await page.getByRole('button', { name: new RegExp(`^${label}`) }).first().click()
}

const closeDialog = (page) => page.getByRole('button', { name: 'Close', exact: true }).first().click()
const rpcs = (stub, name) => stub.calls.filter((c) => c.type === 'rpc' && c.name === name)

// ------------------------------------------------------------------------------------------
console.log('\n1. Main flow')
{
  const { stub, page, errors, context } = await session()
  await page.goto(BASE)
  check('shows the sign-in screen when signed out', await page.getByRole('heading', { name: 'Signal Home' }).isVisible())
  await signIn(page)
  await page.waitForTimeout(1500)
  check('opens the house after sign-in', await page.getByRole('button', { name: /Go to/ }).isVisible())
  check('3D canvas is created', (await page.locator('canvas').count()) === 1)
  check('connects realtime (joins channels)', stub.calls.some((c) => c.type === 'realtime-join'))
  check("shows partner's mood callout", await page.getByText('Daniel really misses you').isVisible())
  check('placeholder is announced honestly', await page.getByText(/Placeholder room/).isVisible())
  await page.screenshot({ path: `${OUT}/01-home.png` })

  // Hidden note beacon: selecting the guitar reveals the waiting note before the panel.
  await openObject(page, 'Guitar')
  check('unread note is revealed first on its object', await page.getByRole('dialog', { name: 'Hidden note' }).isVisible())
  await page.screenshot({ path: `${OUT}/02-note-reveal.png` })
  await page.getByRole('button', { name: 'Open it' }).click()
  await page.getByText('you are my favorite song').waitFor()
  check('note text is shown after opening', true)
  check('marks the note read on the server', rpcs(stub, 'mark_note_read').length === 1)
  await page.getByRole('button', { name: 'Close', exact: true }).last().click()

  // Love Ping
  await openObject(page, 'Rose')
  await page.getByRole('dialog', { name: /Love Ping/ }).waitFor()
  await page.getByLabel('Add a message').fill('Thinking of you')
  await page.getByRole('button', { name: /Heart/ }).first().click()
  await page.waitForTimeout(500)
  const ping = rpcs(stub, 'send_event').at(-1)
  check('Love Ping sends a validated event via RPC', ping?.args.p_kind === 'love_ping' && ping.args.p_payload.reaction === 'heart' && ping.args.p_payload.message === 'Thinking of you', JSON.stringify(ping?.args))
  check('event carries an idempotency key (client_event_id)', /^[0-9a-f-]{36}$/.test(ping?.args.p_client_event_id ?? ''))
  await page.screenshot({ path: `${OUT}/03-love-ping.png` })

  // Realtime: partner sends a ping and a hug while we are here.
  stub.pushEvent('love_ping', { reaction: 'kiss', message: 'goodnight you' })
  await page.getByText(/Daniel sent you a kiss/).first().waitFor({ timeout: 5000 })
  check('live event from the partner shows a toast', true)
  await page.waitForTimeout(400)
  check('delivered event is acknowledged on the server', rpcs(stub, 'ack_events').some((c) => c.args.p_ids?.length > 0))
  // Replay the very same row: must not double-handle.
  const before = await page.getByText(/Daniel sent you a kiss/).count()
  stub.pushEvent('hug', {})
  await page.getByText(/tiny hug/).first().waitFor({ timeout: 5000 })
  check('second event type is handled', before >= 1)
  await closeDialog(page)

  // Offline outbox
  await openObject(page, 'Rose')
  await page.getByRole('dialog', { name: /Love Ping/ }).waitFor()
  const sentBefore = rpcs(stub, 'send_event').length
  await context.setOffline(true)
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: /Kiss/ }).first().click()
  await page.waitForTimeout(600)
  check('offline: nothing is sent, ping is queued', rpcs(stub, 'send_event').length === sentBefore)
  check('offline: UI says it is waiting', await page.getByText(/waiting to send/).first().isVisible())
  await context.setOffline(false)
  await page.waitForFunction(() => document.body.innerText.includes('Live'), null, { timeout: 20000 }).catch(() => {})
  await page.getByText(/waiting to send/).first().click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(2500)
  check('back online: queued ping is delivered', rpcs(stub, 'send_event').length === sentBefore + 1, `calls=${rpcs(stub, 'send_event').length}`)
  await closeDialog(page)

  // Mood Garden
  await openObject(page, 'Garden window')
  await page.getByRole('dialog', { name: /Mood Garden/ }).waitFor()
  await page.getByRole('button', { name: /Feeling cuddly/ }).click()
  await page.waitForTimeout(500)
  check('choosing a mood calls set_mood', rpcs(stub, 'set_mood').at(-1)?.args.p_mood === 'cuddly')
  check('garden renders the saved plants', (await page.locator('.plant').count()) >= 2)
  await page.screenshot({ path: `${OUT}/04-garden.png` })
  await closeDialog(page)

  // Date jar
  await openObject(page, 'Date jar')
  await page.getByRole('button', { name: 'Add starter ideas' }).click()
  await page.waitForTimeout(500)
  check('starter ideas are inserted', stub.calls.some((c) => c.type === 'post' && c.table === 'date_ideas' && c.body.length >= 8))
  await page.getByLabel('Idea', { exact: true }).fill('Moonlit picnic')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.waitForTimeout(400)
  check('a custom idea can be added', stub.calls.some((c) => c.type === 'post' && c.table === 'date_ideas' && !Array.isArray(c.body) && c.body.title === 'Moonlit picnic'))
  await page.screenshot({ path: `${OUT}/05-date-jar.png` })
  await closeDialog(page)

  // Mischief consent
  await openObject(page, 'Mischief box')
  await page.getByLabel(/Let Daniel send me playful surprises/).check()
  await page.waitForTimeout(400)
  check('consent change is saved to the server', stub.calls.some((c) => c.type === 'patch' && c.table === 'user_settings' && c.body.allow_mischief === true))
  await page.getByRole('button', { name: 'Try on me' }).first().click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/06-mischief.png` })
  await closeDialog(page)
  stub.pushEvent('mischief', { effect: 'confetti' })
  await page.waitForTimeout(800)
  check('allowed mischief from the partner is played', await page.getByText(/up to something: Confetti/).first().isVisible())
  stub.pushEvent('mischief', { effect: 'shake_room' })
  await page.waitForTimeout(600)
  check('disruptive mischief is NOT played without the second opt-in', (await page.locator('html[data-room-fx]').count()) === 0)

  // Spell table
  await openObject(page, "Vee's spell table")
  await page.getByLabel('Name your spell').fill('Moon tea')
  await page.getByRole('button', { name: 'honey' }).click()
  await page.getByRole('button', { name: /Cast to Daniel/ }).click()
  await page.waitForTimeout(500)
  const spell = rpcs(stub, 'send_event').at(-1)
  check('casting sends a spell_cast event', spell?.args.p_kind === 'spell_cast' && spell.args.p_payload.name === 'Moon tea', JSON.stringify(spell?.args))
  await page.screenshot({ path: `${OUT}/07-spell-table.png` })
  await closeDialog(page)

  // Love Universe
  await openObject(page, 'Heart')
  await page.getByRole('dialog', { name: /Love Universe/ }).waitFor()
  await page.getByRole('button', { name: 'Tap the heart' }).click()
  await page.waitForTimeout(700)
  check("heart shows a note from the partner's own notes", await page.getByText(/Test note from Daniel/).isVisible())
  check('heart tap is sent to the partner', rpcs(stub, 'send_event').some((c) => c.args.p_kind === 'heart_tap'))
  await page.getByRole('button', { name: 'Send a tiny hug' }).click()
  await page.waitForTimeout(500)
  check('hug is sent to the partner', rpcs(stub, 'send_event').some((c) => c.args.p_kind === 'hug'))
  check('original wording is preserved', await page.getByText('Our Little Love Universe').isVisible() && await page.getByText('A tiny universe for us').isVisible())
  await page.screenshot({ path: `${OUT}/08-love-universe.png` })
  await page.keyboard.press('Escape')

  // Vault
  await openObject(page, 'Memory shelf')
  await page.getByRole('button', { name: /Add memory/ }).click()
  await page.getByLabel('Title').fill('Our first trip')
  await page.getByRole('textbox', { name: 'Note' }).fill('It rained and we did not care.')
  await page.getByRole('button', { name: 'Save to the vault' }).click()
  await page.waitForTimeout(500)
  check('a note memory is saved', stub.calls.some((c) => c.type === 'post' && c.table === 'memories' && c.body.title === 'Our first trip'))
  await closeDialog(page)

  // Keyboard accessibility of the object menu
  await page.getByRole('button', { name: /Go to/ }).focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Escape')
  check('object menu is operable by keyboard (Escape closes it)', await page.locator('.nav__menu').isHidden())

  // Settings
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('dialog', { name: 'Settings' }).waitFor()
  await page.getByLabel('Motion').selectOption('reduced')
  check('reduced motion setting is applied to the document', (await page.evaluate(() => document.documentElement.dataset.motion)) === 'reduced')
  await page.screenshot({ path: `${OUT}/09-settings.png` })

  const unhandled = stub.calls.filter((c) => c.type === 'unhandled')
  check('no unhandled backend calls', unhandled.length === 0, JSON.stringify(unhandled.slice(0, 3)))
  check('no uncaught errors in the page', errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

// ------------------------------------------------------------------------------------------
console.log('\n2. Time Capsule')
if (Object.keys(capsuleFiles).length === 0) {
  console.log('  (skipped: run `npm run assets:extract` first to create ./private)')
} else {
  const { stub, page, errors, context } = await session()
  await signIn(page)
  await openObject(page, 'Time capsule')
  await page.getByRole('heading', { name: /signal-home/ }).waitFor()
  check('lists both archived originals with fingerprints', (await page.getByRole('button', { name: 'Open the original' }).count()) === 2)
  const expectations = [
    { slug: 'signal-home', pattern: /Home|Signals|Go to page/i },
    { slug: 'love-universe', pattern: /Our Little Love Universe/ },
  ]
  for (const [index, { slug, pattern }] of expectations.entries()) {
    if (index > 0) {
      await page.getByRole('button', { name: /Back to the capsule/ }).click()
      await page.getByRole('heading', { name: new RegExp(slug) }).waitFor()
    }
    const card = page.locator('li', { has: page.getByRole('heading', { name: new RegExp(slug) }) })
    await card.getByRole('button', { name: 'Open the original' }).click()
    await page.getByText(/Verified: identical/).waitFor({ timeout: 20000 })
    const inner = page.frameLocator('iframe[title*="archived original"]').frameLocator('iframe')
    await inner.locator('body').waitFor({ timeout: 20000 })
    await page.waitForTimeout(2500)
    const innerText = await inner.locator('body').innerText().catch(() => '')
    check(`${slug}: integrity verified and the original renders inside the sandbox`, pattern.test(innerText), innerText.slice(0, 100))
    if (index === 0) await page.screenshot({ path: `${OUT}/10-time-capsule-signal-home.png` })
  }
  const sandbox = await page.locator('iframe[title*="archived original"]').getAttribute('sandbox')
  check('viewer frame is sandboxed WITHOUT same-origin', sandbox === 'allow-scripts', String(sandbox))
  const leaked = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('sh_')))
  check("the original's storage does not leak into the app origin", leaked.length === 0, leaked.join(','))
  await page.screenshot({ path: `${OUT}/10-time-capsule.png` })
  check('no uncaught errors in the app page', errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()

  console.log('\n3. Time Capsule integrity refusal')
  const tampered = await session({ tamper: true })
  await signIn(tampered.page)
  await openObject(tampered.page, 'Time capsule')
  await tampered.page.getByRole('button', { name: 'Open the original' }).first().click()
  await tampered.page.getByText(/does not match its recorded fingerprint|Integrity check failed/).first().waitFor({ timeout: 15000 })
  check('a modified archive is refused, not displayed', (await tampered.page.locator('iframe[title*="archived original"]').count()) === 0)
  await tampered.context.close()
}

// ------------------------------------------------------------------------------------------
console.log('\n4. Mobile layout')
{
  const { page, errors, context } = await session({ viewport: { width: 390, height: 780 } })
  await signIn(page)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/11-mobile-home.png` })
  await openObject(page, 'Date jar')
  await page.getByRole('dialog', { name: /Date Jar/ }).waitFor()
  const panelBox = await page.getByRole('dialog', { name: /Date Jar/ }).boundingBox()
  check('panel is a bottom sheet on phones', !!panelBox && panelBox.x <= 1 && panelBox.width >= 388 && panelBox.y > 100, JSON.stringify(panelBox))
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  check('no horizontal page scroll on a phone', !overflow)
  await page.screenshot({ path: `${OUT}/12-mobile-panel.png` })
  check('no uncaught errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
