import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const table = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  table[n] = c >>> 0
}

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const margin = Math.round(size * 0.14)
  const gap = Math.max(2, Math.round(size * 0.035))
  const colors = [
    [255, 212, 59],
    [255, 135, 135],
    [116, 192, 252],
    [177, 151, 252],
  ]
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1)
    raw[row] = 0
    for (let x = 0; x < size; x++) {
      const i = row + 1 + x * 4
      const inside = x >= margin && y >= margin && x < size - margin && y < size - margin
      let r = 28
      let g = 126
      let b = 214
      if (inside) {
        const gw = size - margin * 2
        const gh = size - margin * 2
        const gx = x - margin
        const gy = y - margin
        const midX = gw / 2
        const midY = gh / 2
        const onGap =
          Math.abs(gx - midX) < gap / 2 ||
          Math.abs(gy - midY) < gap / 2 ||
          gx < gap ||
          gy < gap ||
          gx > gw - gap ||
          gy > gh - gap
        if (onGap) {
          r = g = b = 255
        } else {
          const col = gx < midX ? 0 : 1
          const line = gy < midY ? 0 : 1
          const color = colors[line * 2 + col]
          r = color[0]
          g = color[1]
          b = color[2]
        }
      }
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
      raw[i + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(new URL('../public/icons/', import.meta.url), { recursive: true })
writeFileSync(new URL('../public/icons/icon-192.png', import.meta.url), png(192))
writeFileSync(new URL('../public/icons/icon-512.png', import.meta.url), png(512))
