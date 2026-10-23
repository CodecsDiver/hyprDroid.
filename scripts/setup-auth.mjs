#!/usr/bin/env node
/**
 * Creates the two accounts and the secrets the server needs. Nothing is sent anywhere: it only prints
 * three values for you to paste into your host's environment variables (Netlify: Site configuration →
 * Environment variables). Passwords are stored only as salted PBKDF2 hashes.
 *
 *   npm run setup:auth
 */
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { pbkdf2Sync, randomBytes } from 'node:crypto'

const ITERATIONS = 310_000
// Interactive in a terminal (passwords are not echoed). Piped input is also accepted, one answer per line, for automation.
const piped = process.stdin.isTTY ? null : readFileSync(0, 'utf8').split(/\r?\n/)
const rl = piped ? null : createInterface({ input: process.stdin, output: process.stdout, terminal: true })
const ask = (question) => {
  if (piped) {
    process.stdout.write(question)
    process.stdout.write('\n')
    return Promise.resolve(piped.shift() ?? '')
  }
  return new Promise((resolve) => rl.question(question, resolve))
}

/** Reads a line without echoing it. */
function askHidden(question) {
  if (piped) return ask(question)
  return new Promise((resolve) => {
    const output = rl.output
    const original = rl._writeToOutput
    rl._writeToOutput = (text) => {
      if (text.startsWith(question)) output.write(text)
    }
    rl.question(question, (answer) => {
      rl._writeToOutput = original
      output.write('\n')
      resolve(answer)
    })
  })
}

const hash = (password) => {
  const salt = randomBytes(16)
  return `pbkdf2$sha256$${ITERATIONS}$${salt.toString('base64')}$${pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256').toString('base64')}`
}

async function person(label) {
  for (;;) {
    const name = (await ask(`${label} name (shown in the app): `)).trim()
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32)
    if (!id || name.length > 40) {
      console.log('  Use 1–40 characters, with at least one letter or digit.')
      continue
    }
    const password = await askHidden(`${name}'s password (12+ characters): `)
    if (password.length < 12) {
      console.log('  Too short. Use at least 12 characters (a few random words is fine).')
      continue
    }
    if (password !== (await askHidden('  Type it again: '))) {
      console.log('  They did not match.')
      continue
    }
    return { id, name, hash: hash(password) }
  }
}

console.log('\nSignal Home setup: two people, one password each.\n')
const first = await person('First person\'s')
let second = await person('Second person\'s')
while (second.id === first.id) {
  console.log('  The two names must differ.')
  second = await person('Second person\'s')
}
rl?.close()

const secret = randomBytes(32).toString('hex')
const adminToken = randomBytes(32).toString('hex')
console.log(`
Set these three environment variables on your host, then deploy again.
Keep them private: anyone with SIGNAL_SESSION_SECRET could sign in as either of you.

SIGNAL_USERS=${JSON.stringify([first, second])}

SIGNAL_SESSION_SECRET=${secret}

SIGNAL_ADMIN_TOKEN=${adminToken}

SIGNAL_ADMIN_TOKEN is only for 'npm run assets:upload' (it lets that script put your original files in). You can delete the variable afterwards.
`)
