import fs from 'node:fs'
import zlib from 'node:zlib'

const DEBUG = process.argv.includes('--debug')

// 1. Specs
const FW = 88 
const FH = 52
const CX = Math.floor(FW / 2)
const OUT_DIR = 'public/assets/npc/ada' 
const DEBUG_DIR = 'scripts'

// 2. Palette
const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
  255,
]
const C = {
  clear: [0, 0, 0, 0],
  ink: hex('#243642'),
  shellAmber: hex('#D38A44'),
  shellBrown: hex('#884C27'), 
  shellDark: hex('#4A2A1A'),
  seam: hex('#5E341C'),
  bodySkin: hex('#C7A179'),
  belly: hex('#F2DFB8'),
  eye: hex('#000000'),
  white: hex('#FFFFFF'),
}

const ANCHORS = { eye: [70, 21] }

// 4. Shape (hawksbill turtle, facing right)
// Row spans: each row y lists [x0, x1] filled runs. Shell spans exclude the
// shell edge (x<8) so flippers can sit behind it without being cut off.
const setPx = (mask, x, y, col) => mask.set(String(x) + ',' + String(y), col)
const fillSpans = (map, rows, col) => {
  for (const [y, x0, x1] of rows) for (let x = x0; x <= x1; x++) setPx(map, x, y, col)
}

// Shell body (tortoiseshell fill added later).
const SHELL = [
  [12, 30, 44],
  [13, 24, 52],
  [14, 20, 57],
  [15, 17, 60],
  [16, 14, 63],
  [17, 13, 64],
  [18, 11, 66],
  [19, 10, 67],
  [20, 10, 68],
  [21, 9, 69],
  [22, 9, 69],
  [23, 9, 70],
  [24, 9, 70],
  [25, 9, 70],
  [26, 9, 70],
  [27, 10, 69],
  [28, 10, 69],
  [29, 11, 68],
  [30, 11, 67],
  [31, 12, 66],
  [32, 13, 64],
]

// Marginal scutes: amber rim, two rows thick along the shell edge.
const SCALLOP = [
  [13, 21, 23],
  [15, 15, 16],
  [17, 12, 12],
  [19, 9, 9],
  [19, 68, 69],
  [17, 65, 67],
  [15, 61, 63],
  [13, 53, 55],
]

const MARGINAL = [
  [11, 33, 40],
  [12, 27, 29],
  [12, 45, 48],
  [13, 21, 23],
  [13, 53, 55],
  [14, 18, 19],
  [14, 58, 60],
  [15, 15, 16],
  [15, 61, 63],
  [16, 12, 13],
  [16, 64, 66],
  [17, 12, 12],
  [17, 65, 67],
  [18, 10, 10],
  [18, 67, 68],
  [19, 9, 9],
  [19, 68, 69],
  [20, 9, 9],
  [20, 69, 70],
  [21, 70, 71],
  [22, 70, 71],
  [23, 71, 72],
  [24, 71, 72],
  [25, 71, 72],
  [26, 71, 71],
  [27, 70, 71],
  [28, 70, 70],
  [29, 69, 70],
  [30, 68, 69],
  [31, 65, 67],
]

// Amber marginal band under the carapace, above the plastron.
const UNDER_RIM = [
  [32, 14, 63],
  [33, 15, 63],
]

// Plastron (belly plate) with a stepped front edge.
const PLASTRON = [
  [34, 17, 62],
  [35, 18, 62],
  [36, 19, 61],
  [37, 21, 59],
]

// Neck, head and pointed down-curved beak (hawksbill).
const HEAD = [
  [20, 61, 66],
  [19, 62, 69],
  [18, 63, 72],
  [17, 64, 74],
  [16, 65, 77],
  [17, 65, 78],
  [18, 66, 79],
  [19, 65, 80],
  [20, 64, 81],
  [21, 63, 82],
  [22, 63, 83],
  [23, 63, 83],
  [24, 64, 82],
  [25, 64, 81],
  [26, 64, 80],
  [27, 65, 78],
  [28, 66, 75],
  [29, 67, 72],
  [30, 66, 69],
  [31, 64, 67],
]
const BEAK = [
  [22, 84, 85],
  [23, 84, 86],
  [24, 83, 87],
  [25, 82, 87],
  [26, 81, 87],
  [27, 79, 86],
  [28, 76, 85],
]

// Front flipper: long tapered blade sweeping down-forward.
const FLIPPER_F = [
  [32, 57, 64],
  [33, 56, 66],
  [34, 54, 67],
  [35, 52, 67],
  [36, 51, 68],
  [37, 49, 69],
  [38, 48, 70],
  [39, 47, 70],
  [40, 46, 70],
  [41, 46, 71],
  [42, 46, 71],
  [43, 47, 71],
  [44, 48, 71],
  [45, 50, 70],
  [46, 53, 69],
  [47, 57, 66],
  [48, 61, 63],
]

// Rear flipper: small paddle trailing behind the shell.
const FLIPPER_B = [
  [30, 5, 12],
  [31, 4, 13],
  [32, 3, 13],
  [33, 2, 12],
  [34, 2, 11],
  [35, 3, 10],
  [36, 4, 9],
  [37, 6, 8],
]

// Scute seams (drawn before the blotches so they stay crisp underneath).
// Vertebral column along the keel.
const SEAM_VERTEBRAL = [[22, 15], [22, 27], [22, 39], [22, 51], [22, 63]]
// Costal columns, sloping outward toward the rear.
const SEAM_COSTAL_L = [[19, 19], [18, 23], [17, 27], [16, 31], [15, 35], [15, 39]]
const SEAM_COSTAL_R = [[61, 19], [59, 23], [58, 27], [57, 31], [56, 35]]
// Gaps between the 5 vertebral scutes.
const SEAM_VER_MID = [[17, 23], [17, 34], [17, 46], [17, 58]]
const SEAM_VER_UPPER = [[15, 29], [15, 41], [15, 52]]

// Tortoiseshell blotches: big amber/brown/dark streaks radiating from each
// vertebral scute center. [x, y, dx, dy, len, color]
const BLOTCHES = [
  [20, 16, -1, -1, 4, 'shellBrown'],
  [20, 16, 1, -1, 3, 'shellDark'],
  [28, 14, -1, -1, 3, 'shellDark'],
  [28, 14, 1, -1, 4, 'shellBrown'],
  [36, 14, -1, -1, 3, 'shellBrown'],
  [36, 14, 1, -1, 3, 'shellDark'],
  [44, 14, -1, -1, 4, 'shellDark'],
  [44, 14, 1, -1, 3, 'shellBrown'],
  [52, 14, -1, -1, 3, 'shellBrown'],
  [52, 14, 1, -1, 4, 'shellDark'],
  [60, 15, -1, -1, 3, 'shellDark'],
  [60, 15, 1, -1, 3, 'shellBrown'],
  [18, 22, -1, 0, 3, 'shellBrown'],
  [18, 26, -1, 1, 3, 'shellDark'],
  [25, 24, -1, 0, 4, 'shellDark'],
  [25, 28, -1, 1, 3, 'shellBrown'],
  [33, 23, 1, 0, 3, 'shellBrown'],
  [33, 27, -1, 1, 4, 'shellDark'],
  [41, 24, 1, 0, 4, 'shellBrown'],
  [41, 28, -1, 1, 3, 'shellBrown'],
  [49, 23, -1, 0, 3, 'shellDark'],
  [49, 27, 1, 1, 4, 'shellBrown'],
  [57, 24, 1, 0, 3, 'shellDark'],
  [57, 28, -1, 1, 3, 'shellBrown'],
  [64, 22, 1, 0, 3, 'shellDark'],
  [64, 26, 1, 1, 3, 'shellBrown'],
  [22, 30, -1, 1, 3, 'shellDark'],
  [31, 30, 1, 1, 3, 'shellBrown'],
  [40, 30, -1, 1, 4, 'shellDark'],
  [48, 30, 1, 1, 3, 'shellDark'],
  [56, 30, -1, 1, 3, 'shellBrown'],
]

function createCharacter() {
  const mask = new Map()
  const parts = { flipperF: new Map(), flipperB: new Map() }

  // 1) Base fills: amber carapace, dark rim lines, plastron, head, flippers.
  fillSpans(mask, SHELL, C.shellAmber)
  fillSpans(mask, MARGINAL, C.shellBrown)
  fillSpans(mask, UNDER_RIM, C.shellBrown)
  fillSpans(mask, PLASTRON, C.belly)
  fillSpans(mask, HEAD, C.bodySkin)
  fillSpans(mask, BEAK, C.bodySkin)
  fillSpans(parts.flipperF, FLIPPER_F, C.bodySkin)
  fillSpans(parts.flipperB, FLIPPER_B, C.bodySkin)

  // 2) Plastron plate divisions.
  for (const [x, y] of [[31, 35], [32, 35], [33, 35], [45, 35], [46, 35], [47, 35], [57, 35], [58, 35]]) {
    setPx(mask, x, y, C.seam)
  }

  // 3) Scute seams on the carapace.
  for (const [x, y] of [...SEAM_VERTEBRAL, ...SEAM_COSTAL_L, ...SEAM_COSTAL_R, ...SEAM_VER_MID, ...SEAM_VER_UPPER]) {
    setPx(mask, x, y, C.seam)
  }

  // 4) Tortoiseshell blotches: wedge fans radiating from each vertebral
  // scute center (arms widen vertically near the tip).
  for (const [x, y, dx, dy, len, col] of BLOTCHES) {
    for (let i = 1; i <= len; i++) {
      const px = x + dx * i
      const py = y + dy * i
      if (mask.has(`${px},${py}`)) mask.set(`${px},${py}`, C[col])
      if (i >= 2) {
        for (const oy of [-1, 1]) {
          const key = `${px},${py + oy}`
          if (mask.get(key) === C.shellAmber) mask.set(key, C[col])
        }
      }
    }
  }

  // 5) Face: eye at ANCHORS.eye, brow scale, mouth slit, nostril, head plates.
  setPx(mask, 69, 21, C.white)
  setPx(mask, 70, 21, C.eye)
  setPx(mask, 69, 22, C.eye)
  setPx(mask, 70, 22, C.eye)
  setPx(mask, 69, 19, C.shellBrown) // brow
  setPx(mask, 70, 19, C.shellBrown)
  setPx(mask, 71, 20, C.shellBrown)
  setPx(mask, 72, 20, C.shellBrown)
  setPx(mask, 82, 22, C.ink) // nostril
  // Mouth: dark slit along the beak lower edge, curves down with the hook.
  for (const [x, y] of [[76, 25], [77, 25], [78, 26], [79, 26], [80, 26], [81, 27], [82, 27], [83, 27], [84, 27]]) {
    setPx(mask, x, y, C.shellDark)
  }
  // Prefrontal scales (two pairs, hawksbill) on top of the head.
  for (const [x, y] of [[74, 18], [75, 18], [77, 19], [78, 19], [72, 18], [73, 19]]) {
    if (mask.has(`${x},${y}`)) setPx(mask, x, y, C.shellBrown)
  }
  // Skin speckles on neck and lower jaw.
  for (const [x, y] of [[64, 22], [65, 24], [63, 26], [66, 28], [68, 25], [70, 28], [67, 26]]) {
    if (mask.has(`${x},${y}`)) setPx(mask, x, y, C.seam)
  }

  // 6) Flipper details: leading-edge streaks and claws on the front blade.
  for (const [x, y] of [[51, 37], [50, 38], [49, 39], [48, 40], [48, 41], [47, 42], [47, 43], [48, 44]]) {
    parts.flipperF.set(`${x},${y}`, C.shellBrown)
  }
  for (const [x, y] of [[62, 36], [63, 37], [64, 38], [65, 39]]) {
    parts.flipperF.set(`${x},${y}`, C.seam)
  }
  parts.flipperF.set('62,47', C.ink)
  parts.flipperF.set('63,48', C.ink)

  return { mask, parts }
}
// 5. Animations 
const SHEETS = {
  idle: { frames: 4, opts: (i) => ({ dy: [0, -1, 0, 1][i], partDY: { flipperF: [0, -1, 0, 1][i], flipperB: [0, -1, 0, 1][i] } }) },
  swim: { frames: 6, opts: (i) => ({ dy: [0, -1, 0, 1, 0, 0][i], partDY: { flipperF: [1, -2, -4, -2, 1, 2][i], flipperB: [-1, 0, 1, 0, -1, 0][i] } }) },
  talk: { frames: 4, opts: (i) => ({ dy: 0, headDropK: [0, -0.05, 0, 0.05][i] }) }, 
}

const HEAD_X = 61

function renderFrame(grid, mask, parts, ox, opts = {}) {
  const { dy = 0, pitchK = 0, liftK = 0, tailDY = 0, headDropK = 0, partDY = {} } = opts
  const pxs = new Map()
  const place = (x, y, col, extra) => {
    let d = dy + extra + Math.round((x - CX) * pitchK) + Math.round((CX - x) * liftK)
    if (tailDY) d += Math.round(tailDY * Math.max(0, Math.min(1, (CX - 24 - x) / 30)))
    if (headDropK && x > HEAD_X) d += Math.round((x - HEAD_X) * headDropK)
    pxs.set(`${x + ox},${y + d}`, col)
  }
  for (const [k, col] of mask) {
    if (col === C.clear) continue;
    const [x, y] = k.split(',').map(Number)
    place(x, y, col, 0)
  }
  for (const [name, part] of Object.entries(parts)) {
    for (const [k, col] of part) {
      if (col === C.clear) continue;
      const [x, y] = k.split(',').map(Number)
      place(x, y, col, partDY[name] ?? 0)
    }
  }
  for (const [k, col] of pxs) {
    const [x, y] = k.split(',').map(Number)
    if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) grid[y][x] = col
  }
  for (const [k] of pxs) {
    const [x, y] = k.split(',').map(Number)
    for (let oy = -1; oy <= 1; oy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx
        const ny = y + oy
        if (pxs.has(`${nx},${ny}`)) continue
        if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length) {
          if (grid[ny][nx] === C.clear) grid[ny][nx] = C.ink
        }
      }
    }
  }
}

function makeGrid(w, h) {
  return Array.from({ length: h }, () => new Array(w).fill(C.clear))
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

function writePng(path, grid) {
  const H = grid.length
  const W = grid[0].length
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

function scaleGrid(grid, s) {
  return grid.map((row) => row.flatMap((px) => new Array(s).fill(px)))
    .flatMap((row) => new Array(s).fill(row))
}

function markAnchors(grid, color = [255, 0, 0, 255]) {
  for (const [x, y] of Object.values(ANCHORS)) {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (grid[y + dy] && grid[y + dy][x + dx]) grid[y + dy][x + dx] = color
  }
}

const { mask, parts } = createCharacter()
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

for (const [name, sheet] of Object.entries(SHEETS)) {
  const grid = makeGrid(FW * sheet.frames, FH)
  for (let i = 0; i < sheet.frames; i++) renderFrame(grid, mask, parts, i * FW, sheet.opts(i))
  writePng(`${OUT_DIR}/${name}.png`, grid)
  console.log(`wrote ${OUT_DIR}/${name}.png ${FW * sheet.frames}x${FH}`)
}

if (DEBUG) {
  if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true })
  for (const [name, sheet] of Object.entries(SHEETS)) {
    const grid = makeGrid(FW, FH)
    renderFrame(grid, mask, parts, 0, sheet.opts(0))
    markAnchors(grid)
    writePng(`${DEBUG_DIR}/pose_${name}.png`, scaleGrid(grid, 2))
    console.log(`wrote ${DEBUG_DIR}/pose_${name}.png (2x, with anchors)`)
  }
}
