// 小金(幼年金鲹 Gnathanodon speciosus)精灵表生成器。
// 规格照 docs/xiaojin_art_prompt.md:48×32、≤10 色、无抗锯齿、朝右、墨蓝描边 #243642。
// idle / swim / talk 各 4 帧,8fps。输出 public/assets/npc/xiaojin/。
//
// **一定要画幼年版**:幼年金鲹是鲜黄配竖黑条,成年是银白、条纹消失。
// 条纹就是它辨识度的全部 —— 画成没条纹的黄鱼,童童就认不出这是小金了。
//
// 尺寸不是按真实比例来的(那样只有 10px 宽,看不清也做不了动画),
// 这条在 art prompt 里已经写明并由爸爸确认过。
import fs from 'node:fs'
import zlib from 'node:zlib'

const FW = 48
const FH = 32
const OUT_DIR = 'public/assets/npc/xiaojin'

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255]
const C = {
  ink: hex('#243642'),
  gold: hex('#F2C33C'),
  goldDark: hex('#C7961F'),
  goldLite: hex('#FBE79A'),
  bar: hex('#3A3128'),      // 竖条纹
  fin: hex('#F7DE93'),      // 半透明感的淡黄鳍
  finEdge: hex('#D9B85C'),
  eyeWhite: hex('#FFFFFF'),
  eye: hex('#1A1210'),
}

const ANCHORS = { eye: [31, 13] }

const key = (x, y) => x + ',' + y
const put = (m, x, y, col) => { if (x >= 0 && x < FW && y >= 0 && y < FH) m.set(key(x, y), col) }

function ellipse(m, cx, cy, rx, ry, col) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x - cx) / rx
      const ny = (y - cy) / ry
      if (nx * nx + ny * ny <= 1) put(m, x, y, col)
    }
  }
}

function build() {
  const mask = new Map()
  const parts = { tail: new Map(), jaw: new Map(), pect: new Map() }

  // 1) 身体:侧扁的卵圆形
  ellipse(mask, 21, 15, 12, 8, C.gold)
  // 背腹压深、中段提亮,给一点圆身子的体积
  for (const [k, col] of [...mask]) {
    const [x, y] = k.split(',').map(Number)
    if (col !== C.gold) continue
    if (y <= 9 || y >= 21) mask.set(k, C.goldDark)
    else if (y >= 12 && y <= 14 && x >= 14 && x <= 26) mask.set(k, C.goldLite)
  }

  // 2) 竖条纹:幼年金鲹的标志。**5–11 条**,这里画 6 条,间距均匀才像小老虎鱼
  for (const bx of [11, 15, 19, 23, 27, 31]) {
    for (let y = 6; y <= 24; y++) {
      for (const x of [bx, bx + 1]) {
        if (mask.has(key(x, y))) mask.set(key(x, y), C.bar)
      }
    }
  }

  // 3) 背鳍 / 臀鳍。**要窄要矮**:第一版从头铺到尾、高 4px,整条鱼的轮廓被撑成一个
  // 圆角方块,背上像顶了顶帽子。鳍是从背线上长出来的一小片,不是一层壳
  for (let x = 15; x <= 25; x++) {
    const h = Math.round(2.6 * Math.sin(((x - 15) / 10) * Math.PI))
    for (let k = 1; k <= h; k++) put(mask, x, 7 - k, k === h ? C.finEdge : C.fin)
  }
  for (let x = 17; x <= 25; x++) {
    const h = Math.round(2 * Math.sin(((x - 17) / 8) * Math.PI))
    for (let k = 1; k <= h; k++) put(mask, x, 23 + k, k === h ? C.finEdge : C.fin)
  }

  // 4) 头与嘴。金鲹的嘴前突可伸缩 —— 说话(复读)时靠 jaw 这一块上下动
  ellipse(mask, 29, 15, 5, 6, C.gold)
  for (const [x, y] of [[32, 12], [33, 13], [32, 13]]) put(mask, x, y, C.goldLite)
  // 嘴:一道短线 + 前突的下颌
  for (const [x, y] of [[33, 16], [34, 16], [32, 17]]) put(parts.jaw, x, y, C.goldDark)
  // 眼睛(ANCHORS.eye):2×2 白 + 1 点黑瞳,小了就看不出是脸
  put(mask, 30, 12, C.eyeWhite)
  put(mask, 31, 12, C.eyeWhite)
  put(mask, 30, 13, C.eyeWhite)
  put(mask, 31, 13, C.eye)

  // 5) 胸鳍:身体中段一小片
  ellipse(parts.pect, 25, 19, 3, 2, C.fin)

  // 6) 尾:分叉的燕尾
  for (let i = 0; i <= 8; i++) {
    const x = 10 - i
    const spread = Math.round(i * 0.8)
    for (let y = 15 - spread; y <= 15 + spread; y++) {
      // 中间掏空成叉:离得越远,中间的缺口越大
      if (i >= 4 && Math.abs(y - 15) < spread - 2) continue
      put(parts.tail, x, y, i >= 6 ? C.finEdge : C.fin)
    }
  }

  return { mask, parts }
}

// idle 原地打转张望;swim 快速摆尾;talk 嘴一开一合(动作**故意夸张** —— 复读是它的角色功能)
const SHEETS = {
  idle: {
    frames: 4,
    opts: (i) => ({ dy: [0, -1, 0, 1][i], partDY: { tail: [1, 0, -1, 0][i], pect: [0, -1, 0, 1][i], jaw: [0, -1, 0, 1][i] } }),
  },
  swim: {
    frames: 4,
    opts: (i) => ({ dy: [0, -1, 0, 1][i], partDY: { tail: [3, 0, -3, 0][i], pect: [1, 0, -1, 0][i], jaw: [0, -1, 0, 1][i] }, partDX: { tail: [1, 0, 1, 0][i] } }),
  },
  talk: {
    frames: 4,
    opts: (i) => ({ dy: [0, 0, -1, 0][i], partDY: { jaw: [0, 1, 2, 1][i], tail: [0, 1, 0, -1][i] }, partDX: { jaw: [0, 1, 1, 0][i] } }),
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
console.log('调色板 ' + palette.size + ' 色(上限 10);眼睛锚点 ' + ANCHORS.eye.join(','))
