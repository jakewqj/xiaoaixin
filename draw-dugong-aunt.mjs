// Dugong Aunt NPC pixel sprite generator.
// Reuses Xiao Aixin's dugong anatomy from draw-pet.mjs (same species):
// fluked horizontal tail, no dorsal fin, down-curved muzzle, paddle flipper.
// Individual differences only: rounder/heavier body, faint scars/mottling,
// and calmer idle/swim plus a talk animation.
import fs from 'node:fs'
import {
  createDugong,
  withEyeOpen,
  renderFrame,
  writePng,
  C,
  FW,
  FH,
} from './draw-pet.mjs'

const DEBUG = process.argv.includes('--debug')
const DIR = 'public/assets/npc/dugong_aunt'
const DEBUG_DIR = 'scripts/dugong_aunt_debug'

// One extra palette color: pale scar/mottle tone, between body and belly.
// Total opaque colors = 7 (ink, body, belly, eye, white, scar) <= 16.
C.scar = [201, 185, 168, 255] // #C9B9A8 (pale warm, matches the new taupe coat)

// Rounder, heavier silhouette: deepen the lower edge (L) around mid-body
// and relax the top edge slightly. Head/tail zones untouched so anchors
// (blowhole/mouth/eye/tailTip) stay where pet.json expects them.
function roundify(mask) {
  const m = new Map()
  for (const [k, col] of mask) {
    const [x, y] = k.split(',').map(Number)
    if (x < 38 || x > 178) {
      m.set(k, col)
      continue
    }
    const t = Math.max(0, Math.min(1, (x - 60) / 30, (150 - x) / 30))
    const drop = Math.round(3 * t) // belly sags up to 3px amidships
    m.set(`${x},${y + drop}`, col)
  }
  return m
}

// Sparse pale scars/mottling on the back and flank: a few short 1-2px
// strokes, kept subtle (weathered, not battered).
const SCARS = [
  // propeller-ish parallel nicks on the upper back
  [96, 17], [97, 17], [98, 18],
  [104, 16], [105, 16], [106, 17],
  [112, 17], [113, 17],
  // mottled patches on the flank
  [80, 30], [81, 31], [88, 34], [89, 34], [90, 35],
  [124, 33], [125, 34], [131, 30],
  // one small mark near the tail stock
  [52, 30], [53, 31],
]
function withScars(mask) {
  const m = new Map(mask)
  for (const [x, y] of SCARS) {
    const k = `${x},${y}`
    if (m.has(k) && m.get(k) !== C.ink) m.set(k, C.scar)
  }
  return m
}

// Mouth variants for talk: base mask has a closed mouth slit near (165,38).
// openMouth replaces a couple of slit pixels with belly color = slightly
// open downturned mouth.
function withMouthOpen(mask) {
  const m = new Map(mask)
  m.set('167,46', C.belly)
  m.set('168,46', C.belly)
  m.set('169,45', C.belly)
  return m
}

const { mask: baseMask, flipper } = createDugong()
const auntBase = withScars(roundify(baseMask))
const eyeOpen = withEyeOpen(auntBase)
const mouthOpen = withMouthOpen(eyeOpen)

if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true })

// idle: 4 frames @8fps. Calmer than Xiao Aixin: half the bob amplitude,
// tail barely drifts.
writePng(`${DIR}/idle.png`, (g, i, ox) => {
  const dy = [0, -1, 0, 1][i]
  renderFrame(g, eyeOpen, flipper, ox, { dy, flukeDY: dy })
}, 4)

// swim: 6 frames @8fps. Fluke paddles up/down like Xiao Aixin, but the
// body heave is gentler (unhurried cadence).
writePng(`${DIR}/swim.png`, (g, i, ox) => {
  const flukeDY = [-3, -1, 1, 3, 1, -1][i]
  const dy = [0, 0, 0, -1, 0, 0][i]
  const flipDY = [0, 1, 1, 0, -1, -1][i]
  renderFrame(g, eyeOpen, flipper, ox, { dy, flukeDY, flipDY })
}, 6)

// talk: 4 frames @8fps. Slight nod (tiny head drop) + mouth opens/closes.
writePng(`${DIR}/talk.png`, (g, i, ox) => {
  const open = i % 2 === 1
  const headDropK = [0, 0.03, 0.05, 0.03][i]
  renderFrame(g, open ? mouthOpen : eyeOpen, flipper, ox, { headDropK })
}, 4)

console.log('Dugong Aunt sprites generated in ' + DIR)

// ---- debug: single-frame 2x poses with red anchor marks ------------------
if (DEBUG) {
  if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true })
  const ANCHORS = {
    blowhole: [154, 19],
    mouth: [165, 38],
    eye: [144, 24],
    tailTip: [19, 32],
    bellyCenter: [106, 40],
  }
  const poses = {
    idle: (g, ox) => renderFrame(g, eyeOpen, flipper, ox, { dy: 0, flukeDY: 0 }),
    swim: (g, ox) => renderFrame(g, eyeOpen, flipper, ox, { dy: 0, flukeDY: -3, flipDY: 0 }),
    talk: (g, ox) => renderFrame(g, mouthOpen, flipper, ox, { headDropK: 0.05 }),
  }
  const RED = [255, 0, 0, 255]
  for (const [name, fn] of Object.entries(poses)) {
    const grid = Array.from({ length: FH }, () => new Array(FW).fill(C.clear))
    fn(grid, 0)
    // 2x scale then mark anchors as 3x3 red blocks (on the scaled grid)
    const s = 2
    const big = grid
      .map((row) => row.flatMap((px) => new Array(s).fill(px)))
      .flatMap((row) => new Array(s).fill(row))
    for (const [ax, ay] of Object.values(ANCHORS)) {
      for (let dy = -2; dy <= 3; dy++)
        for (let dx = -2; dx <= 3; dx++) {
          const yy = ay * s + dy
          const xx = ax * s + dx
          if (big[yy] && big[yy][xx]) big[yy][xx] = RED
        }
    }
    const path = `${DEBUG_DIR}/pose_${name}.png`
    // reuse writePng machinery via a single-frame closure
    const H = big.length
    const W = big[0].length
    writePngRaw(path, big, W, H)
    console.log(`wrote ${path} (2x, anchors marked)`)
  }
}

// minimal raw writer for pre-scaled debug grids (writePng builds its own grid)
import zlib from 'node:zlib'
function writePngRaw(path, grid, W, H) {
  const raw = Buffer.alloc((W * 4 + 1) * H)
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0
    for (let x = 0; x < W; x++) {
      const [r, g, b, a] = grid[y][x]
      const idx = y * (W * 4 + 1) + 1 + x * 4
      raw[idx] = r
      raw[idx + 1] = g
      raw[idx + 2] = b
      raw[idx + 3] = a
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc32 = (b) => ~b.reduce((c, x) => crcTable[(c ^ x) & 0xff] ^ (c >>> 8), -1) >>> 0
  const chunk = (ty, d) => {
    const l = Buffer.alloc(4)
    l.writeUInt32BE(d.length)
    const body = Buffer.concat([Buffer.from(ty), d])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([l, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  fs.writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  )
}
