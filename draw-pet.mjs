// Xiao Aixin (dugong) pixel sprite generator.
// Redesigned 2026-07-30 to match wiki/graphic/stardew参考/Gemini_Generated_
// Stardew Village dugong.png: plumper fusiform body, warm grey-taupe palette
// with banded shading + dither, big muzzle pad with whisker dots, two paddle
// flippers, larger notched fluke. Hand-coded pixel masks rendered to raw PNG.
// No AI model, no dependencies. Frame: 192x64, facing right, <=16 colors.
// Anchors (see pet.json): blowhole(157,14) mouth(170,45) eye(150,22)
//                         tailTip(10,31) bellyCenter(106,44)
import fs from 'node:fs'
import zlib from 'node:zlib'

const FW = 192
const FH = 64
const CX = 96 // horizontal pivot for pitch/shear transforms

const C = {
  clear: [0, 0, 0, 0],
  ink: [74, 59, 51, 255],     // outline #4A3B33 (warm dark)
  back: [133, 115, 102, 255], // #857366 back shading / far flipper
  body: [160, 141, 127, 255], // #A08D7F main coat
  belly: [188, 170, 154, 255],// #BCAA9A underside
  pad: [205, 190, 174, 255],  // #CDBEAE muzzle pad
  dot: [107, 88, 75, 255],    // #6B584B whiskers / mouth crease / nostril
  eye: [36, 28, 22, 255],
  white: [255, 255, 255, 255],
}

// ---- silhouette curves -------------------------------------------------
// Control points for the top edge U(x) and bottom edge L(x) of the body,
// x from 42 (tail stock) to 179 (snout tip). Linear interpolation.
const U_PTS = [
  [42, 26], [52, 21], [64, 17], [78, 13.5], [92, 11.5], [106, 10.5],
  [120, 10], [134, 10.5], [146, 11.5], [155, 13.5], [162, 16],
  [168, 19.5], [173, 24], [176, 29], [178, 34], [179, 38],
]
const L_PTS = [
  [42, 36], [52, 41], [64, 45.5], [78, 48.5], [92, 51], [106, 52.5],
  [120, 53], [134, 52.5], [146, 51.5], [155, 50.5], [162, 49.5],
  [168, 48.5], [173, 47], [176, 44.5], [178, 42], [179, 40],
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

// Banded shading like the reference: dark back, mid flank, light underside,
// with a 1-2px checker dither where bands meet (pixel-art gradient).
function shade(x, y, u, l) {
  const t = (y - u) / Math.max(1, l - u)
  const d = (x + y) % 2 === 0
  if (t < 0.2) return C.back
  if (t < 0.28) return d ? C.back : C.body
  if (t < 0.56) return C.body
  if (t < 0.64) return d ? C.body : C.belly
  return C.belly
}

// ---- base mask ---------------------------------------------------------
// mask: Map "x,y" -> color. Near flipper kept separate so it can be nudged
// independently per frame; the far flipper barely moves and lives in mask.
function createDugong() {
  const mask = new Map()
  const flipper = new Map()

  // Fluked tail: horizontal wing, notched at the left tip, shaded on top.
  for (let x = 6; x <= 46; x++) {
    const t = (x - 26) / 20
    const f = 13 * Math.sqrt(Math.max(0, 1 - t * t))
    if (f < 0.5) continue
    const notch = x < 26 ? Math.round((26 - x) * 0.55) : 0
    const top = 31 - Math.round(f)
    const bot = 31 + Math.round(f)
    for (let y = top; y <= bot; y++) {
      if (Math.abs(y - 31) <= notch) continue // fluke notch
      mask.set(`${x},${y}`, y < 31 - Math.round(f * 0.35) ? C.back : C.body)
    }
  }

  // Far-side flipper: peeks out below the chest ahead of the near one,
  // one shade darker. Set before the trunk so the trunk covers the joint.
  const farSpans = {
    51: [147, 157], 52: [145, 156], 53: [144, 154], 54: [144, 151], 55: [145, 148],
  }
  for (const y in farSpans) {
    const [x0, x1] = farSpans[y]
    for (let x = x0; x <= x1; x++) mask.set(`${x},${y}`, C.back)
  }

  // Main trunk: plump fusiform with banded shading; muzzle pad on the
  // front-lower quarter of the head, whisker dots scattered on the pad.
  for (let x = 42; x <= 179; x++) {
    const u = Math.round(U(x))
    const l = Math.round(L(x))
    for (let y = u; y <= l; y++) {
      const t = (y - u) / Math.max(1, l - u)
      let col = shade(x, y, u, l)
      if (x >= 158 && t > 0.48) {
        // muzzle pad: dithered on its left edge so it melts into the cheek
        col = x < 164 && (x + y) % 2 === 0 ? shade(x, y, u, l) : C.pad
        if (col === C.pad && (x * 31 + y * 17) % 23 === 0) col = C.dot // whisker dots
      } else if (t >= 0.28 && t < 0.56 && (x * 13 + y * 29) % 53 === 0) {
        col = C.back // sparse coat speckles
      }
      mask.set(`${x},${y}`, col)
    }
  }

  // Near paddle flipper hanging below the chest, swept back toward the tail.
  const nearSpans = {
    50: [128, 140], 51: [124, 139], 52: [121, 137], 53: [119, 134],
    54: [117, 131], 55: [116, 128], 56: [115, 125], 57: [114, 122],
    58: [114, 119], 59: [115, 117],
  }
  for (const y in nearSpans) {
    const [x0, x1] = nearSpans[y]
    for (let x = x0; x <= x1; x++) flipper.set(`${x},${y}`, C.body)
  }

  // Nostril slit on top of the snout ridge, near anchor (157,14).
  for (const x of [155, 156, 157, 158]) {
    mask.set(`${x},${Math.round(U(x)) + 1}`, C.dot)
  }

  // Mouth crease: soft line along the underside of the muzzle pad.
  for (let x = 165; x <= 177; x++) {
    mask.set(`${x},${Math.round(L(x)) - 3}`, C.dot)
  }

  // Sensory bristles: a few ticks near the snout's lower front edge.
  for (const [x, y] of [[175, 44], [177, 42], [178, 41]]) {
    mask.set(`${x},${y}`, C.dot)
  }

  return { mask, flipper }
}

function withEyeOpen(mask) {
  const m = new Map(mask)
  for (let x = 148; x <= 151; x++) {
    for (let y = 20; y <= 23; y++) m.set(`${x},${y}`, C.eye)
  }
  m.set('148,20', C.body) // round the corners
  m.set('151,23', C.body)
  m.set('148,23', C.body)
  m.set('149,20', C.white) // highlight
  return m
}

function withEyeClosed(mask) {
  const m = new Map(mask)
  for (const x of [148, 149, 150, 151]) m.set(`${x},22`, C.ink)
  return m
}

// 屏息待换气:在水面等着的时候用。腮帮鼓起(含住一口气,贴着下颌轮廓往外撑一点,
// 不是另长一个东西),嘴巴闭紧(把嘴的缝去掉,换成一条更短更平的闭合线)。
// 不做大幅度动作——她只是安静地漂在水面等你点她
function withCheekPuff(mask, amount) {
  const m = new Map(mask)
  // 抹掉常态那道嘴缝,换成一条短而平的闭合线
  for (let x = 165; x <= 177; x++) {
    const k = `${x},${Math.round(L(x)) - 3}`
    if (m.get(k) === C.dot) m.set(k, C.pad)
  }
  for (let x = 167; x <= 172; x++) {
    m.set(`${x},${Math.round(L(x)) - 4}`, C.dot)
  }
  // 下颌轮廓局部往外撑,弧形凸起在 x=150..168 之间,中心最鼓,两端和原轮廓齐平融合
  for (let x = 150; x <= 168; x++) {
    const t = (x - 159) / 9 // -1..1
    const bulge = amount * Math.max(0, 1 - t * t)
    const base = Math.round(L(x))
    const extra = Math.round(bulge)
    for (let y = base + 1; y <= base + extra; y++) {
      m.set(`${x},${y}`, x >= 160 ? C.pad : C.belly)
    }
  }
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

// ---- build the 6 sprite sheets ------------------------------------------
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

// holding: 3 frames, floating still at the surface with a held breath —
// cheeks puff in and settle, barely any body movement (she's just waiting)
const holdLo = withCheekPuff(eyeOpen, 1)
const holdHi = withCheekPuff(eyeOpen, 3)
writePng(`${DIR}/holding.png`, (g, i, ox) => {
  const mask = [holdLo, holdHi, holdLo][i]
  const dy = [0, -1, 0][i]
  renderFrame(g, mask, flipper, ox, { dy })
}, 3)

console.log('Pet sprites generated in public/assets/pet/pixel/')

// ---- debug preview: 3x single frame on sea-teal background ---------------
if (process.argv.includes('--debug')) {
  const S = 3
  const BG = [37, 111, 112, 255]
  const grid = Array.from({ length: FH }, () => new Array(FW).fill(C.clear))
  renderFrame(grid, eyeOpen, flipper, 0, {})
  const big = grid
    .map((row) => row.flatMap((px) => new Array(S).fill(px === C.clear ? BG : px)))
    .flatMap((row) => new Array(S).fill(row))
  const W = FW * S
  const H = FH * S
  const raw = Buffer.alloc((W * 4 + 1) * H)
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0
    for (let x = 0; x < W; x++) {
      const [r, g, b, a] = big[y][x]
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
    'scripts/pose_idle.png',
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  )
  console.log('debug preview written to scripts/pose_idle.png (3x)')
}

export { createDugong, withEyeOpen, withEyeClosed, renderFrame, writePng, C, FW, FH }
