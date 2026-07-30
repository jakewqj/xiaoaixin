// draw-template.mjs - pixel sprite sheet generator template (self-contained, no deps, Node 18+)
// 用法:
//   1. 复制到目标仓库根目录, 改名 draw-<角色>.mjs
//   2. 按 5 处「改这里」注释修改
//   3. node draw-<角色>.mjs          生成全部 sprite sheet 到 OUT_DIR
//      node draw-<角色>.mjs --debug  另输出每套第 0 帧的 2x 调试图(带红色锚点) 到 DEBUG_DIR
import fs from 'node:fs'
import zlib from 'node:zlib'

const DEBUG = process.argv.includes('--debug')

// ==================== 改这里 1/5: 规格 ====================
const FW = 192 // 单帧宽(px)
const FH = 64 // 单帧高(px)
const CX = Math.floor(FW / 2) // 俯仰变换的水平支点, 一般不用动
const OUT_DIR = 'public/assets/CHARACTER/pixel' // 输出目录
const DEBUG_DIR = 'scripts'

// ==================== 改这里 2/5: 调色板 ====================
const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
  255,
]
const C = {
  clear: [0, 0, 0, 0],
  ink: hex('#243642'), // 描边
  body: hex('#8CA3B0'), // 主体
  belly: hex('#C3D3D9'), // 腹部
  eye: hex('#000000'),
  white: hex('#FFFFFF'),
}

// ==================== 改这里 3/5: 锚点 ====================
// 以游戏配置文件(如 pet.json)为准; --debug 图上画红点核对位置
const ANCHORS = { eye: [144, 24], tailTip: [19, 32], belly: [106, 40] }

// ==================== 改这里 4/5: 造型 ====================
// 身体轮廓: 上缘 U(x) / 下缘 L(x) 控制点, 线性插值。示例为一条朝右的鱼。
const U_PTS = [[40, 28], [70, 18], [110, 13], [150, 16], [175, 24], [180, 30]]
const L_PTS = [[40, 38], [70, 48], [110, 53], [150, 50], [175, 42], [180, 36]]

const lerpPts = (pts, x) => {
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

// mask: 身体 + 脸部特征("x,y" -> color)
// parts: 子部件独立 mask(尾巴/鳍等), 每帧可用 partDY 单独偏移
function createCharacter() {
  const mask = new Map()
  const parts = { tail: new Map() }

  // 身体: 腹部为下缘一条窄带
  for (let x = 40; x <= 180; x++) {
    const u = Math.round(lerpPts(U_PTS, x))
    const l = Math.round(lerpPts(L_PTS, x))
    const band = Math.max(2, Math.round((l - u) * 0.33))
    for (let y = u; y <= l; y++) mask.set(`${x},${y}`, y > l - band ? C.belly : C.body)
  }

  // 尾巴: 三角尾鳍(左端)
  for (let x = 12; x <= 42; x++) {
    const f = Math.round((42 - x) * 0.55)
    for (let y = 33 - f; y <= 33 + f; y++) parts.tail.set(`${x},${y}`, C.body)
  }

  // 眼睛(2x2 + 高光), 落在 ANCHORS.eye 附近
  mask.set('143,23', C.white) // 高光
  mask.set('144,23', C.eye)
  mask.set('143,24', C.eye)
  mask.set('144,24', C.eye)

  return { mask, parts }
}

// ==================== 改这里 5/5: 动画 ====================
// 每套: frames 帧数 + opts(i) 返回第 i 帧的变换参数(见 renderFrame 注释)
const SHEETS = {
  idle: { frames: 4, opts: (i) => ({ dy: [0, -1, 0, 1][i], tailDY: [0, -1, 0, 1][i] }) },
  swim: { frames: 6, opts: (i) => ({ dy: [1, 0, 0, -1, 0, 0][i], tailDY: [-3, -1, 1, 3, 1, -1][i] }) },
}

// ==================== 以下通常不用改 ====================
// renderFrame opts:
//   dy        整体垂直偏移
//   pitchK    前倾: y += (x-CX)*pitchK (头朝下)
//   liftK     抬头: y += (CX-x)*liftK
//   tailDY    尾部偏移, 向身体方向 30px 内衰减到 0
//   headDropK x>HEAD_X 额外下垂, 向吻端增大(进食/低头)
//   partDY    { 部件名: 偏移 } 子部件单独偏移
const HEAD_X = Math.round(FW * 0.72)

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
    const [x, y] = k.split(',').map(Number)
    place(x, y, col, 0)
  }
  for (const [name, part] of Object.entries(parts)) {
    for (const [k, col] of part) {
      const [x, y] = k.split(',').map(Number)
      place(x, y, col, partDY[name] ?? 0)
    }
  }
  for (const [k, col] of pxs) {
    const [x, y] = k.split(',').map(Number)
    if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) grid[y][x] = col
  }
  // 1px 描边: 实心像素 8 邻域内的空白处补描边色
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

// ---- main ----
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
