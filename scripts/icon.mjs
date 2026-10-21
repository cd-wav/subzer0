// Generates the subzer0 icon without any image libraries.
//
//   node scripts/icon.mjs
//
// Writes assets/subzer0.png (512px) and assets/subzer0.ico (multi-size).
// The mark is a slashed zero: a light ring cut by an accent diagonal, inside a
// rounded near-black square. Slashed zero = "subzer0".

import { deflateSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'assets')

/* ------------------------------------------------------------------ raster */

const BG = [11, 11, 14]
const RING = [242, 243, 247]
const SLASH = [123, 134, 255]

function insideRounded(x, y, size, radius) {
  const r = radius
  if (x < r && y < r) return (x - r) ** 2 + (y - r) ** 2 <= r * r
  if (x > size - r && y < r) return (x - (size - r)) ** 2 + (y - r) ** 2 <= r * r
  if (x < r && y > size - r) return (x - r) ** 2 + (y - (size - r)) ** 2 <= r * r
  if (x > size - r && y > size - r) return (x - (size - r)) ** 2 + (y - (size - r)) ** 2 <= r * r
  return x >= 0 && y >= 0 && x <= size && y <= size
}

/** RGBA buffer for one square icon, supersampled for smooth edges. */
function render(size) {
  const SS = 4
  const N = size * SS
  const out = Buffer.alloc(size * size * 4)

  const c = size / 2
  const outer = size * 0.315
  const inner = size * 0.245
  const slash = size * 0.039
  const radius = size * 0.235
  // 45° diagonal, top-right to bottom-left
  const nx = Math.SQRT1_2
  const ny = Math.SQRT1_2

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS
          const py = y + (sy + 0.5) / SS
          const dx = px - c
          const dy = py - c
          const dist = Math.hypot(dx, dy)

          let cr = 0
          let cg = 0
          let cb = 0
          let ca = 0

          if (insideRounded(px, py, size, radius)) {
            cr = BG[0]
            cg = BG[1]
            cb = BG[2]
            ca = 1
          }
          if (ca && dist <= outer && dist >= inner) {
            cr = RING[0]
            cg = RING[1]
            cb = RING[2]
          }
          if (ca) {
            const along = Math.abs(dx * nx + dy * ny)
            if (along <= slash && dist <= outer + size * 0.005) {
              cr = SLASH[0]
              cg = SLASH[1]
              cb = SLASH[2]
            }
          }

          r += cr * ca
          g += cg * ca
          b += cb * ca
          a += ca
        }
      }

      const samples = SS * SS
      const alpha = Math.round((a / samples) * 255)
      const index = (y * size + x) * 4
      out[index] = alpha ? Math.round(r / a) : 0
      out[index + 1] = alpha ? Math.round(g / a) : 0
      out[index + 2] = alpha ? Math.round(b / a) : 0
      out[index + 3] = alpha
    }
  }

  return out
}

/* --------------------------------------------------------------------- png */

const CRC = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let value = n
    for (let k = 0; k < 8; k++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[n] = value >>> 0
  }
  return table
})()

function crc32(buffer) {
  let value = 0xffffffff
  for (const byte of buffer) value = CRC[(value ^ byte) & 0xff] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, checksum])
}

function png(size, rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // RGBA
  header[10] = 0
  header[11] = 0
  header[12] = 0

  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* --------------------------------------------------------------------- ico */

function ico(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  const directory = Buffer.alloc(16 * images.length)
  let offset = 6 + directory.length

  images.forEach((image, index) => {
    const at = index * 16
    directory[at] = image.size >= 256 ? 0 : image.size
    directory[at + 1] = image.size >= 256 ? 0 : image.size
    directory[at + 2] = 0
    directory[at + 3] = 0
    directory.writeUInt16LE(1, at + 4) // planes
    directory.writeUInt16LE(32, at + 6) // bpp
    directory.writeUInt32LE(image.data.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += image.data.length
  })

  return Buffer.concat([header, directory, ...images.map((image) => image.data)])
}

/* -------------------------------------------------------------------- main */

const SIZES = [256, 128, 64, 48, 32, 24, 16]

await mkdir(OUT, { recursive: true })

const large = 512
await writeFile(path.join(OUT, 'subzer0.png'), png(large, render(large)))

const images = SIZES.map((size) => ({ size, data: png(size, render(size)) }))
await writeFile(path.join(OUT, 'subzer0.ico'), ico(images))

console.log(`icon: ${path.join(OUT, 'subzer0.png')} (${large}px)`)
console.log(`icon: ${path.join(OUT, 'subzer0.ico')} (${SIZES.join(', ')})`)
