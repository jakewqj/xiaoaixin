// Verifies dolly sprite sheets: dimensions, per-frame pixel counts, palette.
import fs from 'node:fs'
import zlib from 'node:zlib'

const readPng = (path) => {
  const b = fs.readFileSync(path)
  const w = b.readUInt32BE(16)
  const h = b.readUInt32BE(20)
  let off = 8
  const idat = []
  while (off < b.length) {
    const len = b.readUInt32BE(off)
    const type = b.toString('ascii', off + 4, off + 8)
    if (type === 'IDAT') idat.push(b.subarray(off + 8, off + 8 + len))
    off += 12 + len
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = w * 4 + 1
  const px = Buffer.alloc(w * h * 4)
  let prev = Buffer.alloc(w * 4)
  for (let y = 0; y < h; y++) {
    const f = raw[y * stride]
    const row = raw.subarray(y * stride + 1, (y + 1) * stride)
    const out = Buffer.alloc(w * 4)
    for (let i = 0; i < w * 4; i++) {
      const a = i >= 4 ? out[i - 4] : 0
      const c = prev[i]
      const bb = i >= 4 ? prev[i - 4] : 0
      let v = row[i]
      if (f === 1) v = (v + a) & 255
      else if (f === 2) v = (v + c) & 255
      else if (f === 3) v = (v + ((a + c) >> 1)) & 255
      else if (f === 4) {
        const p = a + c - bb
        const pa = Math.abs(p - a), pb = Math.abs(p - c), pc = Math.abs(p - bb)
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? c : bb)) & 255
      }
      out[i] = v
    }
    out.copy(px, y * w * 4)
    prev = out
  }
  return { w, h, px }
}

const FW = 112
const FH = 48
const sheets = { idle: 4, happy: 6, talk: 4 }
let ok = true
for (const [name, frames] of Object.entries(sheets)) {
  const { w, h, px } = readPng(`public/assets/npc/dolly/${name}.png`)
  const dimOk = w === FW * frames && h === FH
  if (!dimOk) ok = false
  console.log(`${name}.png ${w}x${h} ${dimOk ? 'OK' : `BAD (expect ${FW * frames}x${FH})`}`)
  const counts = []
  for (let f = 0; f < frames; f++) {
    let n = 0
    for (let y = 0; y < h; y++)
      for (let x = f * FW; x < (f + 1) * FW; x++)
        if (px[(y * w + x) * 4 + 3] > 0) n++
    counts.push(n)
    if (n < 200) ok = false
  }
  console.log(`  non-transparent px per frame: ${counts.join(', ')}`)
  const colors = new Set()
  for (let i = 0; i < px.length; i += 4)
    if (px[i + 3] > 0) colors.add(`${px[i]},${px[i + 1]},${px[i + 2]}`)
  console.log(`  colors: ${colors.size} -> ${[...colors].join(' | ')}`)
  if (colors.size > 16) ok = false
}
console.log(ok ? 'ALL OK' : 'PROBLEMS FOUND')
