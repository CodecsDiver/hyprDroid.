import { createHash as nodeHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { Sha1, Sha256 } from '@/local/sha'

const bytes = (n: number): Uint8Array => Uint8Array.from({ length: n }, (_, i) => (i * 31 + 7) & 0xff)

describe('browser SHA implementations match Node', () => {
  it.each([0, 1, 3, 55, 56, 57, 63, 64, 65, 119, 120, 128, 1000, 100_000])('%i bytes, one update', (size) => {
    expect(new Sha256().hex).toBeDefined()
    const data = bytes(size)
    const a = new Sha256(); a.update(data)
    const b = new Sha1(); b.update(data)
    expect(a.hex()).toBe(nodeHash('sha256').update(data).digest('hex'))
    expect(b.hex()).toBe(nodeHash('sha1').update(data).digest('hex'))
  })

  it('gives the same answer when fed in awkward pieces (as the file upload does)', () => {
    const data = bytes(200_003)
    const hash = new Sha256()
    for (let i = 0; i < data.length; ) {
      const take = 1 + ((i * 7) % 5000)
      hash.update(data.subarray(i, i + take))
      i += take
    }
    expect(hash.hex()).toBe(nodeHash('sha256').update(data).digest('hex'))
  })
})
