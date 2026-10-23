/** Small incremental SHA-1 and SHA-256 (the Web Crypto API only hashes whole buffers, and the server code hashes chunk by chunk). */

abstract class BlockHash {
  protected readonly buffer = new Uint8Array(64)
  protected filled = 0
  protected length = 0
  protected abstract readonly state: Uint32Array
  protected abstract block(view: DataView): void

  update(bytes: Uint8Array): void {
    this.length += bytes.length
    let offset = 0
    while (offset < bytes.length) {
      const take = Math.min(64 - this.filled, bytes.length - offset)
      this.buffer.set(bytes.subarray(offset, offset + take), this.filled)
      this.filled += take
      offset += take
      if (this.filled === 64) {
        this.block(new DataView(this.buffer.buffer))
        this.filled = 0
      }
    }
  }

  hex(): string {
    const bits = this.length * 8
    const pad = new Uint8Array(((this.filled < 56 ? 56 : 120) - this.filled) + 8)
    pad[0] = 0x80
    const view = new DataView(pad.buffer)
    view.setUint32(pad.length - 8, Math.floor(bits / 2 ** 32))
    view.setUint32(pad.length - 4, bits >>> 0)
    this.update(pad)
    return [...this.state].map((word) => word.toString(16).padStart(8, '0')).join('')
  }
}

const rotl = (x: number, n: number): number => (x << n) | (x >>> (32 - n))
const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n))

export class Sha1 extends BlockHash {
  protected readonly state = new Uint32Array([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0])
  private readonly w = new Uint32Array(80)
  protected block(view: DataView): void {
    const w = this.w
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(i * 4)
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!, 1)
    let [a, b, c, d, e] = this.state as unknown as [number, number, number, number, number]
    for (let i = 0; i < 80; i++) {
      let f: number
      let k: number
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999 }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1 }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc }
      else { f = b ^ c ^ d; k = 0xca62c1d6 }
      const t = (rotl(a, 5) + f + e + k + w[i]!) >>> 0
      e = d; d = c; c = rotl(b, 30) >>> 0; b = a; a = t
    }
    this.state[0] = (this.state[0]! + a) >>> 0
    this.state[1] = (this.state[1]! + b) >>> 0
    this.state[2] = (this.state[2]! + c) >>> 0
    this.state[3] = (this.state[3]! + d) >>> 0
    this.state[4] = (this.state[4]! + e) >>> 0
  }
}

const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

export class Sha256 extends BlockHash {
  protected readonly state = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])
  private readonly w = new Uint32Array(64)
  protected block(view: DataView): void {
    const w = this.w
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3)
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10)
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = this.state as unknown as [number, number, number, number, number, number, number, number]
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K256[i]! + w[i]!) >>> 0
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    const add = [a, b, c, d, e, f, g, h]
    for (let i = 0; i < 8; i++) this.state[i] = (this.state[i]! + add[i]!) >>> 0
  }
}
