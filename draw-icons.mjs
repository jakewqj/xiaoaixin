// 对话/相册/邻居话题用的 16x16 像素图标生成器。
//
// 起因:这些位置原来直接渲染系统彩色 emoji(🌊 🐬 👋 …),在像素界面里是异物 ——
// 它们有抗锯齿、有渐变、还随系统字体版本变样。这里全部换成程序化手绘像素。
//
// 图标 id 和 content/*.json 里的 emoji 一一对应,映射表在 src/lib/icons.ts。
// 素材是可替换资源(CLAUDE.md 五/十三):组件只按路径引用,以后换童童的手绘稿
// 只需要往 public/assets/world/ui/icons/ 里拖同名 PNG,不改一行代码。
//
// 全部程序化,无 AI、无依赖。输出 public/assets/world/ui/icons/。
// 跑法:node draw-icons.mjs

import fs from 'node:fs'
import zlib from 'node:zlib'

const DIR = 'public/assets/world/ui/icons'
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true })

// ---- 基础工具(和 draw-world.mjs 同一套,刻意保持一致) --------------------
const S = 16
const grid = (w = S, h = S) => Array.from({ length: h }, () => new Array(w).fill(null))

function set(g, x, y, col) {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = col
}

/** 已填像素挨着透明处描 1px 边。像素图标全靠这圈深色边在任何底色上都读得出来 */
function outline(g, col) {
  const marks = []
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[0].length; x++) {
      if (g[y][x]) continue
      let touch = false
      for (let dy = -1; dy <= 1 && !touch; dy++) {
        for (let dx = -1; dx <= 1 && !touch; dx++) {
          if (dx && dy) continue // 只描四邻,斜角不描,免得 16px 上糊成一坨
          const ny = y + dy
          const nx = x + dx
          if (ny >= 0 && ny < g.length && nx >= 0 && nx < g[0].length && g[ny][nx] && g[ny][nx] !== col) {
            touch = true
          }
        }
      }
      if (touch) marks.push([x, y])
    }
  }
  for (const [x, y] of marks) g[y][x] = col
}

function fillEllipse(g, cx, cy, rx, ry, col) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x - cx) / rx
      const ny = (y - cy) / ry
      if (nx * nx + ny * ny <= 1) set(g, x, y, col)
    }
  }
}

function line(g, x0, y0, x1, y1, col) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= steps; i++) {
    set(g, Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), col)
  }
}

function rect(g, x, y, w, h, col) {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) set(g, x + dx, y + dy, col)
}

function savePng(path, g) {
  const H = g.length
  const W = g[0].length
  const raw = Buffer.alloc((W * 4 + 1) * H)
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0
    for (let x = 0; x < W; x++) {
      const px = g[y][x] ?? [0, 0, 0, 0]
      const idx = y * (W * 4 + 1) + 1 + x * 4
      raw[idx] = px[0]
      raw[idx + 1] = px[1]
      raw[idx + 2] = px[2]
      raw[idx + 3] = px[3] ?? 255
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE(crc32(body) >>> 0)
    return Buffer.concat([len, body, crcBuf])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  fs.writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  )
}

let CRC_TABLE = null
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      CRC_TABLE[n] = c
    }
  }
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return c ^ -1
}

// ---- 调色板 ---------------------------------------------------------------
// 取自 CLAUDE.md 四的视觉规范 + wiki/graphic/palette.json 的量化取样值。
// 描边一律用 UI 那套的深棕 #4D2502 —— 这些图标既会摆在奶白内板上,
// 也会摆在木框上,深棕在两种底色上都压得住
const INK = [0x4d, 0x25, 0x02, 255]
const C = {
  waterLit: [0x7f, 0xd1, 0xd8, 255],
  water: [0x38, 0xa8, 0xac, 255],
  waterDeep: [0x1f, 0x7a, 0x7c, 255],
  grass: [0x6f, 0xa8, 0x4b, 255],
  grassLit: [0xa8, 0xcc, 0x72, 255],
  heart: [0xff, 0x8f, 0xa3, 255],
  heartDeep: [0xd9, 0x53, 0x6d, 255],
  red: [0xc5, 0x35, 0x13, 255],
  cream: [0xf4, 0xde, 0xb9, 255],
  sand: [0xe8, 0xdc, 0xc0, 255],
  gold: [0xf5, 0xb1, 0x2a, 255],
  goldDim: [0xc8, 0x7d, 0x2a, 255],
  skin: [0xf0, 0xc0, 0x88, 255],
  skinDim: [0xc8, 0x90, 0x58, 255],
  body: [0xa8, 0x9c, 0x90, 255],
  bodyLit: [0xc9, 0xc0, 0xb6, 255],
  coral: [0xe8, 0x6a, 0x9e, 255],
  coralLit: [0xf5, 0xa0, 0xc4, 255],
  white: [0xff, 0xff, 0xff, 255],
  purple: [0x8e, 0x6a, 0xc8, 255],
  blue: [0x4a, 0x8f, 0xd8, 255],
}

const ICONS = {}
const def = (name, fn) => {
  const g = grid()
  fn(g)
  outline(g, INK)
  ICONS[name] = g
}

// ---- 水与海 ---------------------------------------------------------------

// 海浪:三道错开的波纹,上浅下深。「回海里」按钮和相册用
def('wave', (g) => {
  const rows = [
    [4, C.waterLit],
    [8, C.water],
    [12, C.waterDeep],
  ]
  for (const [y, col] of rows) {
    for (let x = 2; x <= 13; x++) {
      const dy = [0, -1, -1, 0, 1, 1][(x - 2) % 6]
      set(g, x, y + dy, col)
      set(g, x, y + dy + 1, col)
    }
  }
})

// 泡泡:三颗空心描边气泡 + 左上高光。换气相关的话题用。
// 画法照搬 draw-world.mjs 的 bubble():**按到圆心的距离画环**,不是套两个实心椭圆 ——
// 后者在 r≈3 这种小半径上,内外圈只在四个正方向差得开,渲染出来是个十字不是圆
def('bubbles', (g) => {
  const ring = (cx, cy, r) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dist = Math.hypot(x - cx, y - cy)
        if (dist <= r && dist > r - 1.25) set(g, x, y, C.waterLit)
      }
    }
    set(g, Math.round(cx - r * 0.45), Math.round(cy - r * 0.45), C.white)
  }
  ring(5, 10.5, 4)
  ring(11.5, 6, 3)
  ring(12, 12.5, 2)
})

// 月亮:上弦月 + 两颗星。夜里的话题用
def('moon', (g) => {
  fillEllipse(g, 7.5, 8, 5.4, 5.4, C.gold)
  fillEllipse(g, 10.5, 7, 5, 5, null) // 挖掉右边,留出月牙
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const nx = (x - 10.5) / 5
    const ny = (y - 7) / 5
    if (nx * nx + ny * ny <= 1) g[y][x] = null
  }
  set(g, 13, 3, C.cream)
  set(g, 12, 12, C.cream)
})

// ---- 植物 -----------------------------------------------------------------

// 芽:一根茎两片子叶,新芽色。种海草用
def('sprout', (g) => {
  for (let y = 7; y <= 14; y++) set(g, 8, y, C.grass)
  fillEllipse(g, 5, 7, 3, 2.2, C.grassLit)
  fillEllipse(g, 11, 6, 3, 2.2, C.grassLit)
  set(g, 5, 7, C.grass)
  set(g, 11, 6, C.grass)
})

// 草叶丛:三片长叶从同一根散开。海草/植物类话题用
def('herb', (g) => {
  const blade = (x0, x1, col) => {
    for (let i = 0; i <= 9; i++) {
      const t = i / 9
      const x = Math.round(x0 + (x1 - x0) * t)
      const y = 14 - i
      set(g, x, y, col)
      if (i > 2 && i < 8) set(g, x + (x1 > x0 ? -1 : 1), y, col)
    }
  }
  blade(8, 2, C.grass)
  blade(8, 14, C.grass)
  blade(8, 8, C.grassLit)
})

// 珊瑚:三叉枝状,粉色。红海/珊瑚类话题用
def('coral', (g) => {
  for (let y = 8; y <= 14; y++) rect(g, 7, y, 2, 1, C.coral)
  line(g, 7, 9, 3, 5, C.coral)
  line(g, 8, 9, 4, 4, C.coral)
  line(g, 9, 9, 13, 5, C.coral)
  line(g, 8, 8, 12, 4, C.coral)
  line(g, 8, 7, 8, 2, C.coral)
  for (const [x, y] of [[3, 4], [4, 3], [12, 4], [13, 4], [8, 2], [7, 2]]) set(g, x, y, C.coralLit)
})

// 调色板:椭圆板 + 拇指孔 + 四点颜料。手稿替换仪式用
def('palette', (g) => {
  fillEllipse(g, 8, 8.5, 6.4, 5.6, C.sand)
  fillEllipse(g, 10.5, 11, 1.6, 1.4, null)
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const nx = (x - 10.5) / 1.9
    const ny = (y - 11) / 1.7
    if (nx * nx + ny * ny <= 1) g[y][x] = null
  }
  set(g, 5, 5, C.red); set(g, 6, 5, C.red)
  set(g, 9, 4, C.blue); set(g, 10, 4, C.blue)
  set(g, 12, 7, C.grass); set(g, 12, 8, C.grass)
  set(g, 4, 9, C.gold); set(g, 4, 10, C.gold)
})

// ---- 动物 -----------------------------------------------------------------

// 海龟:壳 + 头 + 四鳍。绿色,壳上压深色格
def('turtle', (g) => {
  fillEllipse(g, 8, 8, 4.6, 3.8, C.grass)
  fillEllipse(g, 8, 7.4, 3, 2.4, C.grassLit)
  for (const [x, y] of [[6, 7], [10, 7], [8, 9], [6, 9], [10, 9]]) set(g, x, y, C.grass)
  fillEllipse(g, 13.5, 8, 2, 1.6, C.grassLit) // 头
  set(g, 14, 7, INK) // 眼
  for (const [x, y] of [[4, 5], [4, 11], [11, 5], [11, 11]]) fillEllipse(g, x, y, 1.6, 1.2, C.grass)
})

/** 逐行填一段 [y, x0, x1]。16px 上画生物只能这么来 —— 椭圆堆出来的是对称 blob,
 *  加几个疙瘩也救不回轮廓,前两版的海豚和鲸都被吐槽像潜水艇就是这个原因 */
function spans(g, rows, col) {
  for (const [y, x0, x1] of rows) for (let x = x0; x <= x1; x++) set(g, x, y, col)
}

// 海豚:Dolly 本人(她的 Hello! 选项)。朝右。
// 立住轮廓的三件东西:镰刀背鳍、前伸的尖吻、左端分叉的尾
def('dolphin', (g) => {
  spans(g, [[3, 7, 8], [4, 6, 9], [5, 5, 10]], C.blue) // 背鳍
  spans(g, [
    [6, 4, 12], [7, 3, 14], [8, 2, 15], [9, 2, 14], [10, 3, 12], [11, 4, 9], [12, 5, 7],
  ], C.blue) // 身体 + 吻
  spans(g, [[9, 5, 11], [10, 5, 10]], C.waterLit) // 浅色腹
  spans(g, [[5, 0, 1], [6, 0, 2], [7, 1, 2], [9, 1, 2], [10, 0, 2], [11, 0, 1]], C.blue) // 分叉尾
  set(g, 12, 8, INK) // 眼
})

// 鲸:对应「像鲸鱼」那句台词。比海豚更胖更钝、深蓝、头顶一柱喷水。
// 和海豚放在一起要一眼分得出来,所以刻意不给它背鳍
def('whale', (g) => {
  // 喷水:一团散开的水花 + 一小截水柱。画成竖线会读成天线,得让顶上散开
  spans(g, [[0, 10, 12], [1, 9, 13], [2, 10, 12], [3, 11, 11]], C.waterLit)
  spans(g, [
    [4, 6, 12], [5, 4, 14], [6, 3, 15], [7, 2, 15], [8, 2, 15], [9, 2, 15], [10, 3, 14], [11, 5, 12],
  ], C.waterDeep) // 胖身子,比海豚宽一圈也高一圈
  spans(g, [[9, 5, 13], [10, 5, 12]], C.water) // 浅色腹
  spans(g, [[4, 0, 1], [5, 0, 2], [6, 1, 3], [10, 1, 3], [11, 0, 2], [12, 0, 1]], C.waterDeep) // 大尾鳍
  set(g, 13, 7, INK) // 眼
})

// ---- 表情与手势 -----------------------------------------------------------

// 笑脸:圆脸 + 两眼 + 弧嘴
def('face_smile', (g) => {
  fillEllipse(g, 8, 8, 6, 6, C.gold)
  rect(g, 5, 6, 1, 2, INK)
  rect(g, 10, 6, 1, 2, INK)
  for (const [x, y] of [[5, 10], [6, 11], [7, 11], [8, 11], [9, 11], [10, 10]]) set(g, x, y, INK)
})

// 眼睛:两只带瞳孔的眼。「看」类话题用
def('eyes', (g) => {
  const eye = (cx) => {
    fillEllipse(g, cx, 8, 3.2, 2.4, C.white)
    fillEllipse(g, cx + 0.5, 8, 1.4, 1.4, C.blue)
    set(g, Math.round(cx + 0.5), 8, INK)
  }
  eye(4)
  eye(11.5)
})

// 挥手:手掌 + 四指 + 拇指 + 两道动作线。打招呼用
def('wave_hand', (g) => {
  fillEllipse(g, 7.5, 10.5, 3.6, 3.4, C.skin)
  for (let i = 0; i < 4; i++) rect(g, 5 + i * 2, 4 + (i === 0 || i === 3 ? 1 : 0), 1, 4, C.skin)
  rect(g, 3, 9, 2, 2, C.skin) // 拇指
  rect(g, 6, 13, 4, 1, C.skinDim) // 腕
  line(g, 13, 3, 14, 5, C.waterLit)
  line(g, 11, 2, 11, 4, C.waterLit)
})

// 欢呼(Dolly 的 Yay!):一颗大星 + 四道放射短线。
// 原来画的是两只鼓掌的手,16x16 上读成了一个篮子 —— 手势画不出来就别画手,
// 换一个能一眼读懂的符号,意思(高兴)不变
def('cheer', (g) => {
  const star = [
    [8, 3], [7, 4], [8, 4], [9, 4], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5],
    [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [12, 6],
    [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7],
    [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8],
    [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9],
    [4, 10], [5, 10], [6, 10], [9, 10], [10, 10], [11, 10],
    [3, 11], [4, 11], [11, 11], [12, 11],
  ]
  for (const [x, y] of star) set(g, x, y, C.gold)
  for (const [x, y] of [[7, 5], [8, 5], [7, 6], [8, 6]]) set(g, x, y, C.cream)
  for (const [x, y] of [[1, 3], [14, 3], [0, 8], [15, 8], [2, 13], [13, 13]]) set(g, x, y, C.goldDim)
})

// 花(Dolly 的 Thank you!):五瓣花 + 黄花心 + 一片叶。
// 原来画的是合十的手,读成了一个三角形。道谢用送花表达,比手势好画也好懂
def('flower', (g) => {
  for (const [cx, cy] of [[8, 4.5], [4.5, 7], [11.5, 7], [6, 10.5], [10, 10.5]]) {
    fillEllipse(g, cx, cy, 2.2, 2.2, C.coral)
  }
  fillEllipse(g, 8, 7.5, 1.8, 1.8, C.gold)
  for (let y = 11; y <= 14; y++) set(g, 8, y, C.grass)
  fillEllipse(g, 10.5, 13, 2, 1.2, C.grassLit)
})

// 大 / 小(Dolly 的 Big! 和 Small!):故意做成一对 ——
// 同一条基线上一个撑满、一个缩成一小块,再各配一组朝外/朝内的箭头。
// 单独看是「大」「小」,并排看是对比,这正是那两句台词的关系
function sizeIcon(big) {
  return (g) => {
    const col = big ? C.water : C.waterLit
    if (big) {
      rect(g, 3, 3, 10, 10, col)
      rect(g, 5, 5, 6, 6, C.waterLit)
      for (const [x, y] of [[1, 1], [2, 1], [1, 2], [14, 1], [13, 1], [14, 2],
                            [1, 14], [2, 14], [1, 13], [14, 14], [13, 14], [14, 13]]) set(g, x, y, C.gold)
    } else {
      rect(g, 6, 6, 4, 4, col)
      rect(g, 7, 7, 2, 2, C.cream)
      for (const [x, y] of [[2, 2], [3, 2], [2, 3], [13, 2], [12, 2], [13, 3],
                            [2, 13], [3, 13], [2, 12], [13, 13], [12, 13], [13, 12]]) set(g, x, y, C.gold)
    }
  }
}
def('size_big', sizeIcon(true))
def('size_small', sizeIcon(false))

// ---- 符号 -----------------------------------------------------------------

// 爱心(红):喜欢/情感强调
def('heart', (g) => {
  const shape = [
    [4, 4, 3], [9, 4, 3], [3, 5, 10], [3, 6, 10], [3, 7, 10],
    [4, 8, 8], [5, 9, 6], [6, 10, 4], [7, 11, 2],
  ]
  for (const [x, y, w] of shape) rect(g, x, y, w, 1, C.heartDeep)
  rect(g, 4, 5, 3, 2, C.heart)
})

// 爱心(粉,带闪):熟悉度/心意
def('heart_pink', (g) => {
  const shape = [
    [3, 5, 3], [8, 5, 3], [2, 6, 10], [2, 7, 10],
    [3, 8, 8], [4, 9, 6], [5, 10, 4], [6, 11, 2],
  ]
  for (const [x, y, w] of shape) rect(g, x, y, w, 1, C.heart)
  rect(g, 3, 6, 3, 2, C.coralLit)
  for (const [x, y] of [[13, 3], [12, 4], [14, 4], [13, 5]]) set(g, x, y, C.cream)
})

// 问号:不知道 / 好奇
def('question', (g) => {
  for (const [x, y, w] of [[5, 2, 6], [4, 3, 2], [10, 3, 2], [10, 4, 2], [9, 5, 2], [8, 6, 2], [7, 7, 2]]) {
    rect(g, x, y, w, 1, C.goldDim)
  }
  rect(g, 7, 8, 2, 2, C.goldDim)
  rect(g, 7, 11, 2, 2, C.goldDim)
})

// 四(Dolly 的 Four!):**四颗一样的贝壳,横着排开一眼能数清**。
// 原来画的是四块不同颜色的方块,读成了「调色盘」不是「四个」——
// 要表达数量,同形同色重复排列才对,颜色一变大脑就去分类而不是去数了。
// 这也正好接上宪法十的「数学挂在海草床:数海草」
def('count_four', (g) => {
  for (let i = 0; i < 4; i++) {
    const x = 1 + i * 4
    fillEllipse(g, x + 1.5, 8, 1.6, 2.2, C.coralLit)
    set(g, x + 1, 6, C.coral)
    set(g, x + 2, 6, C.coral)
    set(g, x + 1, 10, C.coral)
    set(g, x + 2, 10, C.coral)
  }
})

// ---- 输出 -----------------------------------------------------------------
const names = Object.keys(ICONS).sort()
for (const name of names) savePng(`${DIR}/${name}.png`, ICONS[name])
console.log(`生成 ${names.length} 个 16x16 图标 → ${DIR}`)
console.log(names.join('  '))
