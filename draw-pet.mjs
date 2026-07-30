// Xiao Aixin (dugong) pixel sprite generator.
// Same approach as draw-dolly.mjs: hand-coded pixel masks rendered to raw PNG.
// No AI model, no dependencies. Frame: 192x64, facing right, <=16 colors.
// Anchors must land near: blowhole(154,19) mouth(165,38) eye(144,24)
//                         tailTip(19,32) bellyCenter(106,40)
import fs from 'node:fs'
import zlib from 'node:zlib'

const FW = 192
const FH = 64
const CX = 96 // horizontal pivot for pitch/shear transforms

const C = {
  clear: [0, 0, 0, 0],
  ink: [36, 54, 66, 255],      // outline #243642
  body: [140, 163, 176, 255],  // #8CA3B0
  belly: [195, 211, 217, 255], // #C3D3D9
  eye: [0, 0, 0, 255],
  white: [255, 255, 255, 255],
}

// ---- silhouette curves -------------------------------------------------
// Control points for the top edge U(x) and bottom edge L(x) of the body,
// x from 38 (tail stock) to 178 (snout tip). Linear interpolation.
const U_PTS = [
  [38, 27], [55, 23], [70, 20], [90, 15], [105, 13.5], [120, 13],
  [135, 14], [145, 15], [152, 16.5], [158, 18], [164, 20], [169, 23],
  [173, 26], [176, 29], [178, 32],
]
const L_PTS = [
  [38, 37], [55, 42], [70, 46], [90, 50], [105, 51.5], [120, 52],
  [135, 50.5], [145, 48.5], [152, 47], [158, 45.5], [164, 44.5],
  [169, 43.5], [173, 42], [176, 39], [178, 36],
]

function lerpPts(pts, x) {
  if (x <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1]
      const [x1, y1] = pts[i]
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
    }
  }
  return pts[pts.length - 1][1]
}
const U = (x) => lerpPts(U_PTS, x)
const L = (x) => lerpPts(L_PTS, x)

// ---- base mask ---------------------------------------------------------
// mask: Map "x,y" -> color. Flipper pixels kept separate so they can be
// nudged independently per frame.
function createDugong() {
  const mask = new Map()
  const flipper = new Map()

  // Main body: plump fusiform, belly is a modest lower band only.
  for (let x = 38; x <= 178; x++) {
    const u = Math.round(U(x))
    const l = Math.round(L(x))
    const band = Math.max(2, Math.round((l - u) * 0.33))
    for (let y = u; y <= l; y++) {
      mask.set(`${x},${y}`, y > l - band ? C.belly : C.body)
    }
  }

  // Fluked tail: horizontal, notched. Ellipse wing centered (28,32),
  // half-width 18, half-height 11, center notch carved at the left tip.
  for (let x = 10; x <= 44; x++) {
    const t = (x - 28) / 18
    const f = 11 * Math.sqrt(Math.max(0, 1 - t * t))
    if (f < 0.5) continue
    const notch = x < 20 ? Math.round((20 - x) * 0.35) : 0
    for (let y = 32 - Math.round(f); y <= 32 + Math.round(f); y++) {
      if (Math.abs(y - 32) <= notch) continue // fluke notch
      mask.set(`${x},${y}`, C.body)
    }
  }

  // Paddle flipper hanging below the body, angled back-left.
  const flipperSpans = {
    46: [132, 140], 47: [131, 140], 48: [130, 139], 49: [129, 138],
    50: [128, 137], 51: [127, 135], 52: [126, 134], 53: [125, 132],
    54: [124, 131], 55: [123, 129], 56: [122, 127], 57: [121, 124],
    58: [120, 122],
  }
  for (const y in flipperSpans) {
    const [x0, x1] = flipperSpans[y]
    for (let x = x0; x <= x1; x++) flipper.set(`${x},${y}`, C.body)
  }

  // Blowhole: small slit on top of the head, near anchor (154,19).
  for (const [x, y] of [[152, 18], [153, 18], [154, 18], [155, 18], [153, 19], [154, 19]]) {
    mask.set(`${x},${y}`, C.ink)
  }

  // Mouth: short slit on the downward face of the muzzle, near (165,38).
  for (let x = 158; x <= 168; x++) {
    const y = Math.round(L(x) - 4 - (x - 158) * 0.12)
    mask.set(`${x},${y}`, C.ink)
  }

  // Sensory bristles: tiny ink hairs sticking out of the muzzle tip.
  for (const [x, y] of [[173, 43], [174, 42], [175, 41], [176, 40], [177, 38], [178, 37]]) {
    mask.set(`${x},${y}`, C.ink)
  }

  return { mask, flipper }
}

function withEyeOpen(mask) {
  const m = new Map(mask)
  m.set('143,23', C.eye)
  m.set('144,23', C.eye)
  m.set('143,24', C.eye)
  m.set('144,24', C.eye)
  m.set('143,23', C.white) // highlight
  return m
}

function withEyeClosed(mask) {
  const m = new Map(mask)
  m.set('143,24', C.ink)
  m.set('144,24', C.ink)
  return m
}

// ---- frame renderer ----------------------------------------------------
// opts:
//   dy        whole-body vertical offset
//   pitchK    forward tilt: y += (x-CX)*pitchK  (head down when positive)
//   liftK     head-up pitch: y += (CX-x)*liftK  (surfacing)
//   flukeDY   tail fluke offset, fades out toward x=72 (up/down paddling)
//   headDropK extra drop for x>138, grows toward the snout (grazing)
//   flipDY    flipper-only offset
function renderFrame(grid, mask, flipper, ox, opts = {}) {
  const { dy = 0, pitchK = 0, liftK = 0, flukeDY = 0, headDropK = 0, flipDY = 0 } = opts
  const pxs = new Map()

  const place = (x, y, col, extraDY) => {
    let dyy = dy + extraDY
    dyy += Math.round((x - CX) * pitchK)
    dyy += Math.round((CX - x) * liftK)
    if (flukeDY) {
      const t = Math.max(0, Math.min(1, (72 - x) / 30))
      dyy += Math.round(flukeDY * t)
    }
    if (headDropK && x > 138) dyy += Math.round((x - 138) * headDropK)
    pxs.set(`${x + ox},${y + dyy}`, col)
  }

  for (const [k, col] of mask) {
    const [x, y] = k.split(',').map(Number)
    place(x, y, col, 0)
  }
  for (const [k, col] of flipper) {
    const [x, y] = k.split(',').map(Number)
    place(x, y, col, flipDY)
  }

  for (const [k, col] of pxs) {
    const [x, y] = k.split(',').map(Number)
    if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) grid[y][x] = col
  }

  // 1px ink outline wherever a filled pixel touches transparency.
  for (const [k] of pxs) {
    const [x, y] = k.split(',').map(Number)
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox2 = -1; ox2 <= 1; ox2++) {
        const nx = x + ox2
        const ny = y + oy
        if (pxs.has(`${nx},${ny}`)) continue
        if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length) {
          if (grid[ny][nx] === C.clear) grid[ny][nx] = C.ink
        }
      }
    }
  }
}

// ---- png writer (same as draw-dolly.mjs) --------------------------------
function writePng(path, framesFn, numFrames) {
  const W = FW * numFrames
  const H = FH
  const grid = Array.from({ length: H }, () => new Array(W).fill(C.clear))
  for (let i = 0; i < numFrames; i++) framesFn(grid, i, i * FW)

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
  ihdr[9] = 6 // 8bit RGBA
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

// ---- build the 5 sprite sheets ------------------------------------------
const { mask, flipper } = createDugong()
const eyeOpen = withEyeOpen(mask)
const eyeClosed = withEyeClosed(mask)

const DIR = 'public/assets/pet/pixel'
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true })

// idle: 4 frames, gentle bob, tail barely drifts
writePng(`${DIR}/idle.png`, (g, i, ox) => {
  const dy = [0, -1, 0, 1][i]
  const flukeDY = [0, -1, 0, 1][i]
  renderFrame(g, eyeOpen, flipper, ox, { dy, flukeDY })
}, 4)

// swim: 6 frames, tail paddles UP and DOWN (sirenian style, not side-to-side)
writePng(`${DIR}/swim.png`, (g, i, ox) => {
  const flukeDY = [-3, -1, 1, 3, 1, -1][i]
  const dy = [1, 0, 0, -1, 0, 0][i]
  const flipDY = [0, 1, 1, 0, -1, -1][i]
  renderFrame(g, eyeOpen, flipper, ox, { dy, flukeDY, flipDY })
}, 6)

// eating: 4 frames, body tips forward, head drops to graze the seabed
writePng(`${DIR}/eating.png`, (g, i, ox) => {
  const headDropK = [0.06, 0.12, 0.18, 0.12][i]
  const dy = [0, 1, 2, 1][i]
  renderFrame(g, eyeOpen, flipper, ox, { dy, pitchK: 0.05, headDropK })
}, 4)

// surfacing: 4 frames, pitched nose-up, rising toward the surface
writePng(`${DIR}/surfacing.png`, (g, i, ox) => {
  const dy = [3, 1, -1, -3][i]
  const flukeDY = [-2, 0, 2, 0][i]
  renderFrame(g, eyeOpen, flipper, ox, { dy, liftK: 0.14, flukeDY })
}, 4)

// sleeping: 2 frames, eyes closed, slow drift
writePng(`${DIR}/sleeping.png`, (g, i, ox) => {
  const dy = [0, 1][i]
  renderFrame(g, eyeClosed, flipper, ox, { dy })
}, 2)

console.log('Pet sprites generated in public/assets/pet/pixel/')

export { createDugong, withEyeOpen, withEyeClosed, renderFrame, writePng, C, FW, FH }
