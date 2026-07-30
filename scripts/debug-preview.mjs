// Debug helper: renders frame 0 of each pose scaled 4x with anchor markers.
// Output: scripts/preview.png (inspect visually, then delete or ignore).
import fs from 'node:fs'
import zlib from 'node:zlib'
import { createDugong, withEyeOpen, renderFrame, C, FW, FH } from '../draw-pet.mjs'

const S = 4
const S2 = 8
const { mask, flipper } = createDugong()
const eyeOpen = withEyeOpen(mask)

// pose name -> render opts for frame that best represents the pose
const POSES = {
  idle: { dy: 0 },
  swim_down: { dy: -1, flukeDY: 3, flipDY: 0 },
  eating: { dy: 2, pitchK: 0.05, headDropK: 0.18 },
  surfacing: { dy: -1, liftK: 0.14, flukeDY: 2 },
}

const names = Object.keys(POSES)
const W = FW * names.length
const grid = Array.from({ length: FH }, () => new Array(W).fill(C.clear))
names.forEach((n, i) => renderFrame(grid, eyeOpen, flipper, i * FW, POSES[n]))

// single-pose zoomed view of idle frame (mask pre-outline + features as drawn)
const zgrid = Array.from({ length: FH }, () => new Array(FW).fill(C.clear))
renderFrame(zgrid, eyeOpen, flipper, 0, { dy: 0 })

// anchor markers (red) on both views
const RED = [255, 0, 0, 255]
const anchors = { blowhole: [154, 19], mouth: [165, 38], eye: [144, 24], tailTip: [19, 32], bellyCenter: [106, 40] }
for (const [x, y] of Object.values(anchors)) {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      grid[y + dy][x + dx] = RED
      zgrid[y + dy][x + dx] = RED
    }
}

// scale up
const SW = W * S
const SH = FH * S
const raw = Buffer.alloc((SW * 4 + 1) * SH)
for (let y = 0; y < SH; y++) {
  raw[y * (SW * 4 + 1)] = 0
  for (let x = 0; x < SW; x++) {
    const [r, g, b, a] = grid[Math.floor(y / S)][Math.floor(x / S)]
    const idx = y * (SW * 4 + 1) + 1 + x * 4
    raw[idx] = r; raw[idx + 1] = g; raw[idx + 2] = b; raw[idx + 3] = a
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (b) => ~b.reduce((c, x) => crcTable[(c ^ x) & 0xff] ^ (c >>> 8), -1) >>> 0
const chunk = (ty, d) => {
  const l = Buffer.alloc(4); l.writeUInt32BE(d.length)
  const body = Buffer.concat([Buffer.from(ty), d])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([l, body, crc])
}
const writePng = (path, grid2, s) => {
  const w = grid2[0].length * s
  const h = grid2.length * s
  const r2 = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    r2[y * (w * 4 + 1)] = 0
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = grid2[Math.floor(y / s)][Math.floor(x / s)]
      const idx = y * (w * 4 + 1) + 1 + x * 4
      r2[idx] = r; r2[idx + 1] = g; r2[idx + 2] = b; r2[idx + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6
  fs.writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(r2, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]))
  console.log('wrote', path, w, 'x', h)
}
writePng('scripts/preview.png', grid, S)
const crop = zgrid.slice(8, 62).map((row) => row.slice(0, 188))
writePng('scripts/preview_zoom.png', crop, S2)
for (const [name, opts] of Object.entries(POSES)) {
  const g = Array.from({ length: FH }, () => new Array(FW).fill(C.clear))
  renderFrame(g, eyeOpen, flipper, 0, opts)
  for (const [x, y] of Object.values(anchors)) {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) g[y + dy][x + dx] = RED
  }
  writePng(`scripts/pose_${name}.png`, g, 2)
}
