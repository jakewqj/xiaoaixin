// 绿绿(绿海龟 Chelonia mydas)精灵表生成器。
// 规格照 docs/lvlv_art_prompt.md:96×56、≤14 色、无抗锯齿、朝右、墨蓝描边 #243642。
// idle 4 帧 / swim 6 帧 / talk 4 帧,全部 8fps。输出 public/assets/npc/lvlv/。
//
// **和阿玳(玳瑁)的区别是硬要求,不是风格偏好**:绿海龟的背甲是光滑椭圆、盾片不重叠,
// 花纹是斑驳大理石纹;玳瑁是叠瓦状 + 放射状火焰纹(见 draw-ada.mjs 的 BLOTCHES)。
// 两只龟站在同一片海里,靠这个区别才认得出谁是谁。
import fs from 'node:fs'
import zlib from 'node:zlib'

const FW = 96
const FH = 56
const OUT_DIR = 'public/assets/npc/lvlv'

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255]
const C = {
  ink: hex('#243642'),
  shell: hex('#6F8C4A'),      // 背甲底色:橄榄绿褐
  shellDark: hex('#4C6533'),  // 大理石纹的深斑
  shellWarm: hex('#8A7A3E'),  // 大理石纹的棕斑(「绿」海龟的壳本来就不是纯绿)
  shellLite: hex('#A3BC6E'),  // 背甲顶上的高光
  rim: hex('#3B4F28'),        // 甲缘
  skin: hex('#B9A87A'),       // 头颈与鳍肢
  skinDark: hex('#8A7A55'),   // 鳞片阴影
  belly: hex('#EFE2BE'),      // 腹甲
  bellyShade: hex('#D2C094'),
  eyeWhite: hex('#FFFFFF'),
  eye: hex('#1A1210'),
  mouth: hex('#6A5B3E'),
}

const ANCHORS = { eye: [78, 24] }

// 确定性伪随机:同一份代码永远长同一个样(和 draw-world.mjs 一个路子)
function hash(...ns) {
  let h = 2166136261
  for (const n of ns) { h ^= n; h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 1000) / 1000
}

const key = (x, y) => x + ',' + y
const put = (m, x, y, col) => { if (x >= 0 && x < FW && y >= 0 && y < FH) m.set(key(x, y), col) }

function ellipse(m, cx, cy, rx, ry, col, opts) {
  const fromY = opts && opts.fromY !== undefined ? opts.fromY : -1e9
  const toY = opts && opts.toY !== undefined ? opts.toY : 1e9
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    if (y < fromY || y > toY) continue
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x - cx) / rx
      const ny = (y - cy) / ry
      if (nx * nx + ny * ny <= 1) put(m, x, y, col)
    }
  }
}

/** 锥形桨状鳍:从根部到梢逐渐变窄,沿着一条直线摆开 */
function blade(m, x0, y0, x1, y1, w0, w1, col) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = x0 + (x1 - x0) * t
    const y = y0 + (y1 - y0) * t
    const w = w0 + (w1 - w0) * t
    ellipse(m, Math.round(x), Math.round(y), w / 2, w / 2, col)
  }
}

function build() {
  const mask = new Map()
  const parts = { flipperF: new Map(), flipperB: new Map(), head: new Map() }

  // 1) 背甲:一个光滑的半椭圆穹顶。**边缘不做扇贝状起伏** —— 那是玳瑁
  const SHELL_CX = 44
  const SHELL_BASE = 35
  ellipse(mask, SHELL_CX, SHELL_BASE, 34, 23, C.shell, { toY: SHELL_BASE })

  // 大理石斑:几块不规则的深/棕斑叠在底色上。边缘按噪声啃掉一部分,
  // 出来的才是「斑驳」而不是一个个圆饼
  const BLOTCH = [
    [24, 22, 9, 'shellDark'], [38, 17, 8, 'shellWarm'], [54, 20, 9, 'shellDark'],
    [66, 25, 7, 'shellWarm'], [30, 30, 8, 'shellWarm'], [48, 31, 7, 'shellDark'],
    [60, 32, 6, 'shellDark'], [18, 30, 6, 'shellDark'],
  ]
  for (const [bx, by, br, col] of BLOTCH) {
    for (let y = by - br; y <= by + br; y++) {
      for (let x = bx - br; x <= bx + br; x++) {
        if (!mask.has(key(x, y))) continue
        const d = ((x - bx) / br) ** 2 + ((y - by) / (br * 0.72)) ** 2
        if (d > 1) continue
        if (d > 0.55 && hash(x, y, 3) > 0.45) continue
        mask.set(key(x, y), C[col])
      }
    }
  }
  // 顶上一道高光
  for (let x = 20; x < 66; x++) {
    const y = SHELL_BASE - Math.round(23 * Math.sqrt(Math.max(0, 1 - ((x - SHELL_CX) / 34) ** 2))) + 2
    if (mask.has(key(x, y)) && (x + y) % 3 !== 0) mask.set(key(x, y), C.shellLite)
  }
  // 甲缘:底下两行压深,读出「壳有厚度」
  for (let x = 0; x < FW; x++) {
    for (const y of [SHELL_BASE - 1, SHELL_BASE]) {
      if (mask.has(key(x, y))) mask.set(key(x, y), C.rim)
    }
  }

  // 2) 腹甲:壳下面一条奶白的板
  ellipse(mask, 44, SHELL_BASE + 1, 28, 5, C.belly, { fromY: SHELL_BASE + 1 })
  for (let x = 20; x < 70; x++) {
    if (mask.get(key(x, SHELL_BASE + 5)) === C.belly) mask.set(key(x, SHELL_BASE + 5), C.bellyShade)
  }

  // 3) 头颈:**头要小**。第一版头 8×7 加一节 7×6 的粗脖子,两个椭圆一并就是一颗
  // 比壳还抢眼的大脑袋,整只读出来像陆龟不像海龟 —— 海龟的头相对身体是小的。
  // 喙圆钝**不带钩**(带钩的是玳瑁),嘴只画一道线:多描两笔就成了獠牙。
  ellipse(parts.head, 76, 25, 6.5, 5.5, C.skin)
  ellipse(parts.head, 70, 28, 5, 4.5, C.skin)
  ellipse(parts.head, 81, 26, 3, 3, C.skin)
  // 喙:一道短线,压在下颌边缘
  for (const [x, y] of [[78, 28], [79, 28], [80, 28], [81, 28], [82, 27]]) put(parts.head, x, y, C.mouth)
  // 头顶的鳞片
  for (const [x, y] of [[74, 21], [77, 21], [72, 23], [79, 23]]) {
    if (parts.head.has(key(x, y))) parts.head.set(key(x, y), C.skinDark)
  }
  // 眼睛(ANCHORS.eye)
  put(parts.head, 77, 24, C.eyeWhite)
  put(parts.head, 78, 24, C.eye)
  put(parts.head, 78, 25, C.eye)
  put(parts.head, 77, 25, C.eye)

  // 4) 前肢:长桨,往前下方划。绿海龟靠前肢「飞」,后肢只管方向
  blade(parts.flipperF, 58, 35, 74, 50, 9, 4, C.skin)
  for (const [x, y] of [[68, 42], [69, 44], [70, 46], [71, 48], [64, 38], [66, 40]]) put(parts.flipperF, x, y, C.skinDark)

  // 5) 后肢:短小的舵,拖在壳后面
  blade(parts.flipperB, 18, 34, 6, 43, 9, 5, C.skin)
  for (const [x, y] of [[12, 39], [10, 41], [14, 37]]) put(parts.flipperB, x, y, C.skinDark)

  return { mask, parts }
}

// 帧:idle 缓慢起伏 + 探一下头(呼应「话痨」);swim 前肢大幅划水;talk 点头
const SHEETS = {
  idle: {
    frames: 4,
    opts: (i) => ({
      dy: [0, -1, 0, 1][i],
      partDY: { flipperF: [0, -1, 0, 1][i], flipperB: [0, -1, 0, 1][i], head: [0, -2, 0, 1][i] },
      partDX: { head: [0, 1, 1, 0][i] },
    }),
  },
  swim: {
    frames: 6,
    opts: (i) => ({
      dy: [0, -1, -1, 0, 1, 1][i],
      partDY: {
        flipperF: [2, -2, -5, -3, 1, 3][i],
        flipperB: [-1, 0, 1, 1, 0, -1][i],
        head: [0, -1, -1, 0, 1, 1][i],
      },
    }),
  },
  talk: {
    frames: 4,
    opts: (i) => ({ partDY: { head: [0, 1, 0, -1][i] }, partDX: { head: [0, 0, 1, 0][i] } }),
  },
}

function renderFrame(grid, mask, parts, ox, opts) {
  const dy = opts.dy ?? 0
  const partDY = opts.partDY ?? {}
  const partDX = opts.partDX ?? {}
  const pxs = new Map()
  const place = (x, y, col, ddx, ddy) => pxs.set(key(x + ox + ddx, y + dy + ddy), col)
  for (const [k, col] of mask) {
    const [x, y] = k.split(',').map(Number)
    place(x, y, col, 0, 0)
  }
  for (const [name, part] of Object.entries(parts)) {
    for (const [k, col] of part) {
      const [x, y] = k.split(',').map(Number)
      place(x, y, col, partDX[name] ?? 0, partDY[name] ?? 0)
    }
  }
  for (const [k, col] of pxs) {
    const [x, y] = k.split(',').map(Number)
    if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) grid[y][x] = col
  }
  // 描边:贴着实心像素往外描一圈墨蓝。和 draw-ada.mjs 同一种做法
  for (const [k] of pxs) {
    const [x, y] = k.split(',').map(Number)
    for (let oy = -1; oy <= 1; oy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx
        const ny = y + oy
        if (pxs.has(key(nx, ny))) continue
        if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length && !grid[ny][nx]) grid[ny][nx] = C.ink
      }
    }
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
function writePng(path, grid) {
  const H = grid.length
  const W = grid[0].length
  const raw = Buffer.alloc((W * 4 + 1) * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = grid[y][x] ?? [0, 0, 0, 0]
      const i = y * (W * 4 + 1) + 1 + x * 4
      raw[i] = p[0]; raw[i + 1] = p[1]; raw[i + 2] = p[2]; raw[i + 3] = p[3]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  fs.writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]))
}

const built = build()
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
const palette = new Set()
for (const [name, sheet] of Object.entries(SHEETS)) {
  const grid = Array.from({ length: FH }, () => new Array(FW * sheet.frames).fill(null))
  for (let i = 0; i < sheet.frames; i++) renderFrame(grid, built.mask, built.parts, i * FW, sheet.opts(i))
  for (const row of grid) for (const p of row) if (p) palette.add(p.join(','))
  writePng(OUT_DIR + '/' + name + '.png', grid)
  console.log(OUT_DIR + '/' + name + '.png  ' + FW * sheet.frames + 'x' + FH + '  ' + sheet.frames + ' 帧')
}
console.log('调色板 ' + palette.size + ' 色(上限 14);眼睛锚点 ' + ANCHORS.eye.join(','))
