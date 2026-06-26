import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

function rgba(r, g, b, a) {
  return [r, g, b, a]
}

function makePng(size) {
  const w = size
  const h = size
  const scale = size / 256
  const stroke = 17 * scale
  const samples = 4

  const segments = [
    [[72, 48], [164, 48]],
    [[164, 48], [204, 88]],
    [[204, 88], [204, 208]],
    [[204, 208], [72, 208]],
    [[72, 208], [72, 48]],
    [[164, 48], [164, 88]],
    [[164, 88], [204, 88]],
    [[104, 128], [168, 128]],
    [[104, 164], [152, 164]]
  ].map(([a, b]) => [
    [a[0] * scale, a[1] * scale],
    [b[0] * scale, b[1] * scale]
  ])

  function distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
    const x = ax + t * dx
    const y = ay + t * dy
    return Math.hypot(px - x, py - y)
  }

  function coverage(px, py) {
    let min = Infinity
    for (const [[ax, ay], [bx, by]] of segments) {
      min = Math.min(min, distToSegment(px, py, ax, ay, bx, by))
    }
    const edge = stroke / 2
    if (min <= edge - 0.5) return 1
    if (min >= edge + 0.5) return 0
    return edge + 0.5 - min
  }

  const stride = 1 + w * 4
  const raw = Buffer.alloc(stride * h)
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0
    for (let x = 0; x < w; x++) {
      let alpha = 0
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          alpha += coverage(x + (sx + 0.5) / samples, y + (sy + 0.5) / samples)
        }
      }
      alpha = Math.round((alpha / (samples * samples)) * 255)
      const px = rgba(23, 25, 28, alpha)
      const off = y * stride + 1 + x * 4
      raw[off] = px[0]
      raw[off + 1] = px[1]
      raw[off + 2] = px[2]
      raw[off + 3] = px[3]
    }
  }
  const compressed = deflateSync(raw)

  function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length, 0)
    const typeBuf = Buffer.from(type, 'ascii')
    const crcInput = Buffer.concat([typeBuf, data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(crcInput) >>> 0, 0)
    return Buffer.concat([len, typeBuf, data, crc])
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return c ^ 0xffffffff
}

mkdirSync('resources', { recursive: true })
const png = makePng(256)
writeFileSync('resources/icon.png', png)

const dir = Buffer.alloc(6)
dir.writeUInt16LE(0, 0)
dir.writeUInt16LE(1, 2)
dir.writeUInt16LE(1, 4)
const entry = Buffer.alloc(16)
entry[0] = 0
entry[1] = 0
entry[2] = 0
entry[3] = 0
entry.writeUInt16LE(1, 4)
entry.writeUInt16LE(32, 6)
entry.writeUInt32LE(png.length, 8)
entry.writeUInt32LE(22, 12)
writeFileSync('resources/icon.ico', Buffer.concat([dir, entry, png]))

console.log('icons generated: resources/icon.png, resources/icon.ico')
