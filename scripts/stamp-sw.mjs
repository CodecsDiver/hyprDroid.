// Gives every web build its own service-worker cache name so installed copies drop old files
// and pick up the new version. Usage: node scripts/stamp-sw.mjs dist-web/sw.js
import { readFileSync, writeFileSync } from 'node:fs'

const target = process.argv[2]
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))
const source = readFileSync(target, 'utf-8')
const marker = /const CACHE_NAME = '[^']*'/
if (!marker.test(source)) throw new Error(`CACHE_NAME not found in ${target}`)
const stamped = source.replace(marker, `const CACHE_NAME = 'pydisc-${version}-${Date.now().toString(36)}'`)
writeFileSync(target, stamped)
console.log(`Stamped ${target}: ${stamped.match(marker)[0]}`)
