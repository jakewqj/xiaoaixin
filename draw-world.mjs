// Stardew 风海洋世界图层素材生成器。
// 参考 wiki/graphic/stardew参考/Gemini_Generated_Stardew Village dugong.png:
// 亮蓝天空+白云、海平线上的棕榈小岛、白沫水面线、青绿水体、深色剪影远景、
// 彩色珊瑚(脑珊瑚/鹿角/管海绵/海扇)、灰岩、海带、金沙海底+贝壳散落物。
// 全部程序化手绘像素,无 AI、无依赖。输出 public/assets/world/。
import fs from 'node:fs'
import zlib from 'node:zlib'

const DIR = 'public/assets/world'
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true })

// ---- 基础工具 -----------------------------------------------------------
const grid = (w, h) => Array.from({ length: h }, () => new Array(w).fill(null))

function set(g, x, y, col) {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = col
}

// 已填像素挨着透明处描 1px 边(和精灵生成器同一种描边思路)
function outline(g, col) {
  const marks = []
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[0].length; x++) {
      if (g[y][x]) continue
      let touch = false
      for (let dy = -1; dy <= 1 && !touch; dy++) {
        for (let dx = -1; dx <= 1 && !touch; dx++) {
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

function thickLine(g, x0, y0, x1, y1, col, thick = 1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps)
    const y = Math.round(y0 + ((y1 - y0) * i) / steps)
    for (let dy = 0; dy < thick; dy++) {
      for (let dx = 0; dx < thick; dx++) set(g, x + dx - (thick >> 1), y + dy - (thick >> 1), col)
    }
  }
}

// 确定性伪随机:同一份代码永远长同一个样,像素画不能每次生成都变
function hash(...ns) {
  let h = 2166136261
  for (const n of ns) {
    h ^= n
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
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
  console.log(`  ${path}  ${W}x${H}`)
}

// ---- z:0 天空 + 海平线上的远海面(96x86 tile, repeat-x) -------------------
// 上半是天空的分层渐变(带抖动过渡),46 行处是海平线,往下到水面线之间
// 是俯瞰角度的远海面,零星几排白色闪光
{
  const W = 96
  const H = 86
  const g = grid(W, H)
  const skyBands = [
    [0, [158, 216, 239]],
    [14, [173, 226, 244]],
    [28, [194, 236, 248]],
    [40, [216, 245, 251]],
  ]
  for (let y = 0; y < 46; y++) {
    for (let x = 0; x < W; x++) {
      let idx = 0
      for (let b = 0; b < skyBands.length; b++) if (y >= skyBands[b][0]) idx = b
      let col = skyBands[idx][1]
      // 波段交界的上一行做棋盘抖动,渐变不生硬
      const next = skyBands[idx + 1]
      if (next && y === next[0] - 1 && (x + y) % 2 === 0) col = next[1]
      set(g, x, y, [...col, 255])
    }
  }
  for (let x = 0; x < W; x++) set(g, x, 46, [126, 203, 214, 255]) // 海平线
  for (let y = 47; y < H; y++) {
    const t = (y - 47) / (H - 48)
    const col = [
      Math.round(79 + (47 - 79) * t),
      Math.round(196 + (169 - 196) * t),
      Math.round(210 + (191 - 210) * t),
    ]
    for (let x = 0; x < W; x++) set(g, x, y, [...col, 255])
  }
  // 远海面的白色闪光(短横线,越近越稀)
  for (const [row, seed] of [[50, 1], [54, 2], [59, 3], [65, 4], [72, 5], [80, 6]]) {
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(hash(row, seed, i) * W)
      const len = 2 + Math.floor(hash(seed, i, row) * 3)
      for (let k = 0; k < len; k++) set(g, (x + k) % W, row, [222, 250, 248, 255])
    }
  }
  savePng(`${DIR}/sky.png`, g)
}

// ---- 白云(两种,无描边,底部一层淡青阴影) ---------------------------------
function cloud(w, h, blobs) {
  const g = grid(w, h)
  for (const [cx, cy, rx, ry] of blobs) fillEllipse(g, cx, cy, rx, ry, [255, 255, 255, 255])
  // 云底阴影:最底下一行有像素的位置往上一格铺淡青
  for (let x = 0; x < w; x++) {
    for (let y = h - 1; y >= 0; y--) {
      if (g[y][x]) {
        set(g, x, y, [216, 240, 248, 255])
        break
      }
    }
  }
  return g
}
savePng(`${DIR}/cloud_big.png`, cloud(36, 13, [[10, 8, 9, 4], [20, 6, 10, 5], [29, 8, 6, 3.5]]))
savePng(`${DIR}/cloud_small.png`, cloud(22, 9, [[7, 5, 6, 3], [15, 4, 6, 3.5]]))

// ---- z:1 海平线上的棕榈小岛(60x24) --------------------------------------
{
  const W = 60
  const H = 24
  const g = grid(W, H)
  const A = 235 // 距离感:整体略透,颜色偏淡
  // 沙滩底座
  for (let x = 4; x < 56; x++) {
    const edge = Math.abs(x - 30) / 26
    const top = 20 + Math.round(edge * 3)
    for (let y = top; y < 24; y++) set(g, x, y, [232, 208, 138, A])
  }
  // 植被丛:几团绿色圆丘
  for (const [cx, cy, rx, ry] of [[16, 18, 9, 5], [30, 16, 11, 6], [45, 18, 8, 5]]) {
    fillEllipse(g, cx, cy, rx, ry, [46, 125, 60, A])
    fillEllipse(g, cx - 2, cy - 2, rx * 0.6, ry * 0.55, [76, 175, 80, A])
  }
  // 两棵棕榈:歪一点的树干 + 放射状叶子
  for (const [bx, lean] of [[24, -1], [38, 1]]) {
    thickLine(g, bx, 16, bx + lean * 2, 6, [122, 82, 48, A], 2)
    const tx = bx + lean * 2
    for (const [dx, dy] of [[-6, -1], [-4, -4], [0, -5], [4, -4], [6, -1]]) {
      thickLine(g, tx, 6, tx + dx, 6 + dy, [62, 155, 79, A], 1)
      thickLine(g, tx, 6, tx + Math.round(dx * 0.6), 6 + Math.round(dy * 0.6) + 1, [96, 185, 106, A], 1)
    }
  }
  savePng(`${DIR}/island.png`, g)
}

// ---- z:2 水面线泡沫(96x12 tile, repeat-x, CSS 横向漂移) ------------------
{
  const W = 96
  const H = 12
  const g = grid(W, H)
  for (let x = 0; x < W; x++) {
    const crest = Math.round(1.5 + 1.5 * Math.sin((x / 24) * Math.PI * 2))
    for (let y = crest; y < H; y++) {
      let col
      if (y <= crest + 1) col = [246, 255, 254, 255]
      else if (y <= crest + 2) col = [214, 246, 242, 230]
      else if (y <= 6) col = [214, 246, 242, 120]
      else col = [190, 235, 232, 55]
      set(g, x, y, col)
    }
  }
  savePng(`${DIR}/surface.png`, g)
}

// ---- z:3 水下远景剪影(240x130 tile, 半透明深色,叠在任何海色渐变上都成立) ----
{
  const W = 240
  const H = 130
  const g = grid(W, H)
  const S = [10, 52, 56, 150]

  // 高矮不一的海草柱:宽飘带 + 椭圆阔叶,剪影要读得出"植物",不能像枯枝
  for (const [bx, h, phase, width] of [
    [22, 105, 0, 8], [58, 70, 2, 7], [96, 118, 4, 9], [148, 82, 1, 7],
    [186, 112, 3, 8], [224, 66, 5, 7],
  ]) {
    for (let i = 0; i < h; i++) {
      const y = H - 1 - i
      const x = bx + Math.round(4 * Math.sin(i * 0.11 + phase))
      const w = Math.max(3, Math.round(width * (1 - (i / h) * 0.55)))
      for (let k = 0; k < w; k++) set(g, x + k - (w >> 1), y, S)
      // 侧面垂下来的阔叶
      if (i % 14 === 7 && i < h - 10) {
        const side = i % 28 === 7 ? 1 : -1
        fillEllipse(g, x + side * 6, y - 1, 5, 2.6, S)
      }
    }
    // 顶端圆一点
    fillEllipse(g, bx + Math.round(4 * Math.sin(h * 0.11 + phase)), H - h, 2.6, 3.2, S)
  }

  // 分叉的枝状珊瑚剪影
  function branch(x, y, ang, len, depth) {
    if (depth <= 0 || len < 3) return
    const x1 = x + Math.round(Math.cos(ang) * len)
    const y1 = y - Math.round(Math.sin(ang) * len)
    thickLine(g, x, y, x1, y1, S, depth)
    branch(x1, y1, ang + 0.5, len * 0.68, depth - 1)
    branch(x1, y1, ang - 0.4, len * 0.62, depth - 1)
  }
  branch(130, H - 1, Math.PI / 2, 22, 3)
  branch(206, H - 1, Math.PI / 2 + 0.2, 17, 2)
  branch(40, H - 1, Math.PI / 2 - 0.15, 14, 2)

  // 一座圆岩剪影
  fillEllipse(g, 172, H + 4, 20, 14, S)
  savePng(`${DIR}/far.png`, g)
}

// ---- z:4 中景装饰精灵 ----------------------------------------------------
// 脑珊瑚:半球 + 横向波浪脑纹 + 顶部高光
function brainCoral(w, h, base, dark, hi, edge) {
  const g = grid(w, h)
  const cx = (w - 1) / 2
  const rx = w / 2 - 1
  for (let x = 1; x < w - 1; x++) {
    const t = (x - cx) / rx
    const top = h - 1 - Math.round((h - 3) * Math.sqrt(Math.max(0, 1 - t * t)))
    for (let y = top; y < h; y++) set(g, x, y, base)
  }
  for (let r = 0; r < Math.ceil(h / 3.5); r++) {
    const yline = 3 + r * 3.5
    for (let x = 1; x < w - 1; x++) {
      const y = Math.round(yline + 1.3 * Math.sin(x * 0.85 + r * 2.1))
      if (g[y]?.[x]) set(g, x, y, dark)
    }
  }
  for (let x = 2; x < w - 2; x++) {
    for (let y = 1; y < 5; y++) {
      if (g[y]?.[x] === base && (x + y * 2) % 3 === 0) set(g, x, y, hi)
    }
  }
  outline(g, edge)
  return g
}
savePng(`${DIR}/coral_brain_pink.png`, brainCoral(30, 20,
  [240, 140, 160, 255], [194, 86, 112, 255], [252, 195, 206, 255], [142, 58, 80, 255]))
savePng(`${DIR}/coral_brain_orange.png`, brainCoral(24, 16,
  [236, 150, 88, 255], [186, 95, 40, 255], [248, 196, 140, 255], [130, 64, 26, 255]))

// 鹿角珊瑚:从基部分出的几根上扬分叉枝
{
  const W = 26
  const H = 24
  const g = grid(W, H)
  const base = [240, 120, 110, 255]
  const tip = [252, 180, 170, 255]
  function branch(x, y, ang, len, depth) {
    if (depth <= 0 || len < 3) return
    const x1 = x + Math.round(Math.cos(ang) * len)
    const y1 = y - Math.round(Math.sin(ang) * len)
    thickLine(g, x, y, x1, y1, depth >= 2 ? base : tip, Math.min(depth, 2))
    branch(x1, y1, ang + 0.55, len * 0.6, depth - 1)
    branch(x1, y1, ang - 0.35, len * 0.66, depth - 1)
  }
  branch(13, H - 1, Math.PI / 2, 11, 3)
  branch(6, H - 1, Math.PI / 2 + 0.55, 8, 2)
  branch(21, H - 1, Math.PI / 2 - 0.5, 8, 2)
  outline(g, [150, 50, 55, 255])
  savePng(`${DIR}/coral_branch_pink.png`, g)
}

// 管海绵:一丛高矮不一的空心圆管
{
  const W = 22
  const H = 22
  const g = grid(W, H)
  const tube = [216, 88, 60, 255]
  const hi = [240, 140, 100, 255]
  const hole = [120, 40, 24, 255]
  for (const [x0, hgt] of [[1, 12], [6, 18], [11, 15], [16, 10]]) {
    for (let y = H - hgt; y < H; y++) {
      for (let x = x0; x < x0 + 4; x++) set(g, x, y, x === x0 ? hi : tube)
    }
    set(g, x0 + 1, H - hgt, hole)
    set(g, x0 + 2, H - hgt, hole)
  }
  outline(g, [130, 46, 28, 255])
  savePng(`${DIR}/coral_tube.png`, g)
}

// 海扇:短柄 + 放射枝 + 几圈横向连线,格子感的扇面
{
  const W = 26
  const H = 26
  const g = grid(W, H)
  const main = [154, 100, 190, 255]
  const lite = [190, 150, 220, 255]
  const ox = 13
  const oy = 21
  thickLine(g, ox, H - 1, ox, oy, [96, 56, 130, 255], 2)
  for (let a = -60; a <= 60; a += 15) {
    const rad = ((a - 90) * Math.PI) / 180
    const x1 = ox + Math.round(Math.cos(rad) * -18)
    const y1 = oy + Math.round(Math.sin(rad) * 18) - 18
    thickLine(g, ox, oy, x1, Math.max(1, y1), Math.abs(a) < 40 ? main : lite, 1)
  }
  for (const r of [8, 13, 17]) {
    for (let a = -55; a <= 55; a += 6) {
      const rad = ((a + 90) * Math.PI) / 180
      set(g, ox + Math.round(Math.cos(rad) * r * -1), oy - Math.round(Math.sin(rad) * r), lite)
    }
  }
  outline(g, [96, 56, 130, 255])
  savePng(`${DIR}/fan_purple.png`, g)
}

// 疙瘩状绿珊瑚:几个圆丘挤在一起,缝隙压深色,顶上提亮
{
  const W = 24
  const H = 14
  const g = grid(W, H)
  const base = [110, 180, 70, 255]
  for (const [cx, cy, r] of [[5, 9, 4.5], [11, 7, 5.5], [18, 9, 4.5], [8, 11, 4], [15, 11, 4]]) {
    fillEllipse(g, cx, cy, r, r * 0.9, base)
  }
  for (const [cx, cy, r] of [[5, 9, 4.5], [11, 7, 5.5], [18, 9, 4.5]]) {
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      const x = Math.round(cx + Math.cos(a) * r)
      const y = Math.round(cy + Math.sin(a) * r * 0.9)
      if (g[y]?.[x] === base && g[y + 1]?.[x] === base && y > cy) set(g, x, y, [66, 124, 44, 255])
    }
    fillEllipse(g, cx - 1, cy - r * 0.55, r * 0.4, r * 0.3, [160, 214, 110, 255])
  }
  outline(g, [40, 90, 30, 255])
  savePng(`${DIR}/coral_green.png`, g)
}

// 灰绿圆岩:顶上有一点苔绿
{
  const W = 40
  const H = 16
  const g = grid(W, H)
  fillEllipse(g, 20, 15, 18, 13, [139, 144, 133, 255])
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!g[y][x]) continue
      if (y > 10) set(g, x, y, [106, 111, 100, 255])
      else if (y < 6 && (x + y) % 2 === 0) set(g, x, y, [168, 173, 158, 255])
    }
  }
  for (const [x, y] of [[10, 4], [11, 4], [17, 2], [18, 2], [19, 3], [27, 4], [28, 5]]) {
    set(g, x, y, [96, 150, 80, 255])
  }
  thickLine(g, 14, 8, 18, 12, [106, 111, 100, 255], 1)
  outline(g, [70, 74, 66, 255])
  savePng(`${DIR}/rock_grey.png`, g)
}

// 海带:一条波浪形的宽叶,左缘亮一线,间隔出小侧叶
{
  const W = 16
  const H = 48
  const g = grid(W, H)
  const kelp = [58, 122, 52, 255]
  const lite = [96, 168, 74, 255]
  for (let i = 0; i < 44; i++) {
    const y = H - 1 - i
    const x = 7 + Math.round(3 * Math.sin(i * 0.18))
    for (let k = -1; k <= 1; k++) set(g, x + k, y, k === -1 ? lite : kelp)
    if (i % 8 === 5) {
      const side = i % 16 === 5 ? 1 : -1
      thickLine(g, x, y, x + side * 5, y - 3, kelp, 1)
      set(g, x + side * 2, y - 1, lite)
    }
  }
  outline(g, [34, 78, 32, 255])
  savePng(`${DIR}/kelp.png`, g)
}

// 高海草丛:从根部散开的几片长叶(比海草床里种的那种高,纯装饰)
{
  const W = 18
  const H = 32
  const g = grid(W, H)
  const dark = [95, 168, 69, 255]
  const lite = [143, 206, 98, 255]
  const spreads = [-7, -4, -1, 1, 4, 7]
  spreads.forEach((spread, i) => {
    const col = i % 2 === 0 ? dark : lite
    for (let t = 0; t < 28; t++) {
      const y = H - 1 - t
      const x = 9 + spread * Math.pow(t / 28, 1.6)
      set(g, Math.round(x), y, col)
      if (t < 12) set(g, Math.round(x) + (spread > 0 ? -1 : 1), y, col)
    }
  })
  outline(g, [46, 100, 40, 255])
  savePng(`${DIR}/seagrass_tall.png`, g)
}

// ---- z:5 金沙海底(96x36 tile, repeat-x)+ 散落物 --------------------------
{
  const W = 96
  const H = 36
  const g = grid(W, H)
  for (let x = 0; x < W; x++) {
    const edge = Math.round(1 + Math.sin((x / 16) * Math.PI) * 0.9 + Math.sin(x * 0.41) * 0.6)
    for (let y = Math.max(0, edge); y < H; y++) {
      let col = [235, 203, 126]
      if (y <= edge + 1) col = [245, 223, 160]
      else if (y >= H - 2) col = [188, 143, 74]
      else if (y >= H - 7) col = [210, 167, 92]
      const r = hash(x, y)
      if (r > 0.93) col = [217, 179, 105]
      else if (r < 0.05) col = [246, 224, 162]
      set(g, x, y, [...col, 255])
    }
  }
  savePng(`${DIR}/sand.png`, g)
}

// 小贝壳(扇形,粉)
{
  const g = grid(9, 7)
  const base = [244, 170, 150, 255]
  for (let y = 1; y < 6; y++) {
    const w = y < 3 ? y + 1 : 7 - y + 2
    for (let x = 4 - w + 1; x <= 4 + w - 1; x++) set(g, x, y + 0, base)
  }
  for (const x of [2, 4, 6]) set(g, x, 2, [214, 126, 108, 255])
  set(g, 4, 5, [214, 126, 108, 255])
  outline(g, [150, 84, 70, 255])
  savePng(`${DIR}/shell_pink.png`, g)
}

// 海星(橙红)
{
  const g = grid(11, 10)
  const c = [232, 120, 74, 255]
  thickLine(g, 5, 4, 5, 0, c, 2)
  thickLine(g, 5, 4, 0, 3, c, 2)
  thickLine(g, 5, 4, 10, 3, c, 2)
  thickLine(g, 5, 5, 2, 9, c, 2)
  thickLine(g, 5, 5, 8, 9, c, 2)
  fillEllipse(g, 5, 4, 2, 2, c)
  set(g, 5, 3, [250, 178, 130, 255])
  outline(g, [156, 66, 34, 255])
  savePng(`${DIR}/starfish.png`, g)
}

// 一对小石子
{
  const g = grid(12, 6)
  fillEllipse(g, 3, 4, 3, 2, [148, 152, 142, 255])
  fillEllipse(g, 9, 4, 2.5, 1.8, [128, 132, 122, 255])
  set(g, 2, 3, [178, 182, 170, 255])
  set(g, 8, 3, [158, 162, 150, 255])
  outline(g, [88, 92, 84, 255])
  savePng(`${DIR}/stones.png`, g)
}

console.log('World layer art generated in ' + DIR + '/')
