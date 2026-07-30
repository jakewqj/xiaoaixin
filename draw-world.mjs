// Stardew 风海洋世界图层素材生成器 v2 —— 以 95% 细节复刻参考图为目标:
// wiki/graphic/stardew参考/Gemini_Generated_Stardew Village dugong.png
// 对照参考图的要点:水体整片明亮青绿(不沉暗)、前景珊瑚大而成簇(单个海扇
// 占画面高 20%+)、灰绿大岩台、金沙+中央深色洼地、描边气泡、
// HUD 是深棕木底+金棕边+奶白字的像素面板。
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

// 确定性伪随机:同一份代码永远长同一个样
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
// 参考图的天空是饱和的亮蓝,远海面是发光的 turquoise,带成排的浪痕和白闪
{
  const W = 96
  const H = 86
  const g = grid(W, H)
  const skyBands = [
    [0, [108, 185, 233]],
    [12, [132, 200, 239]],
    [24, [159, 215, 244]],
    [36, [192, 232, 248]],
    [44, [216, 243, 251]],
  ]
  for (let y = 0; y < 46; y++) {
    for (let x = 0; x < W; x++) {
      let idx = 0
      for (let b = 0; b < skyBands.length; b++) if (y >= skyBands[b][0]) idx = b
      let col = skyBands[idx][1]
      const next = skyBands[idx + 1]
      if (next && y === next[0] - 1 && (x + y) % 2 === 0) col = next[1]
      set(g, x, y, [...col, 255])
    }
  }
  for (let x = 0; x < W; x++) set(g, x, 46, [138, 219, 216, 255]) // 海平线
  for (let y = 47; y < H; y++) {
    const t = (y - 47) / (H - 48)
    const col = [
      Math.round(62 + (44 - 62) * t),
      Math.round(195 + (165 - 195) * t),
      Math.round(206 + (184 - 206) * t),
    ]
    for (let x = 0; x < W; x++) set(g, x, y, [...col, 255])
  }
  // 成排的浪痕(比水色深一号的断续横线)+ 白色闪光
  for (const [row, seed] of [[52, 11], [58, 12], [66, 13], [75, 14]]) {
    for (let i = 0; i < 4; i++) {
      const x = Math.floor(hash(row, seed, i) * W)
      const len = 4 + Math.floor(hash(seed, i, row) * 5)
      for (let k = 0; k < len; k++) set(g, (x + k) % W, row, [40, 150, 160, 255])
    }
  }
  for (const [row, seed] of [[49, 1], [54, 2], [60, 3], [68, 4], [78, 5]]) {
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(hash(row, seed, i) * W)
      const len = 2 + Math.floor(hash(seed, i, row) * 3)
      for (let k = 0; k < len; k++) set(g, (x + k) % W, row, [232, 252, 250, 255])
    }
  }
  savePng(`${DIR}/sky.png`, g)
}

// ---- 白云(纯白蓬松,底部一线淡青) ----------------------------------------
function cloud(w, h, blobs) {
  const g = grid(w, h)
  for (const [cx, cy, rx, ry] of blobs) fillEllipse(g, cx, cy, rx, ry, [255, 255, 255, 255])
  for (let x = 0; x < w; x++) {
    for (let y = h - 1; y >= 0; y--) {
      if (g[y][x]) {
        set(g, x, y, [214, 240, 250, 255])
        break
      }
    }
  }
  return g
}
savePng(`${DIR}/cloud_big.png`, cloud(44, 15, [[11, 10, 10, 4.5], [24, 7, 12, 6], [36, 10, 7, 4]]))
savePng(`${DIR}/cloud_small.png`, cloud(26, 10, [[8, 6, 7, 3.5], [18, 5, 7, 4]]))

// ---- z:1 海平线上的棕榈小岛(大小两座) ------------------------------------
function island(W, H, mounds, palms) {
  const g = grid(W, H)
  const A = 245
  for (let x = 3; x < W - 3; x++) {
    const edge = Math.abs(x - W / 2) / (W / 2 - 3)
    const top = H - 4 + Math.round(edge * 3)
    for (let y = top; y < H; y++) set(g, x, y, [236, 214, 148, A])
  }
  for (const [cx, cy, rx, ry] of mounds) {
    fillEllipse(g, cx, cy, rx, ry, [42, 120, 58, A])
    fillEllipse(g, cx - rx * 0.25, cy - ry * 0.4, rx * 0.62, ry * 0.55, [76, 175, 80, A])
    fillEllipse(g, cx - rx * 0.35, cy - ry * 0.55, rx * 0.3, ry * 0.3, [118, 205, 110, A])
  }
  for (const [bx, by, lean, size] of palms) {
    thickLine(g, bx, by, bx + lean * 3, by - size, [122, 82, 48, A], 2)
    const tx = bx + lean * 3
    const ty = by - size
    for (const [dx, dy] of [[-7, -1], [-5, -5], [0, -7], [5, -5], [7, -1], [-3, 2], [3, 2]]) {
      thickLine(g, tx, ty, tx + dx, ty + dy, [52, 145, 70, A], 2)
      thickLine(g, tx, ty, tx + Math.round(dx * 0.55), ty + Math.round(dy * 0.55), [96, 190, 106, A], 1)
    }
  }
  return g
}
savePng(`${DIR}/island_big.png`, island(78, 34, [[20, 27, 13, 7], [42, 25, 16, 9], [63, 28, 11, 6]], [[28, 24, -1, 12], [48, 22, 1, 14]]))
savePng(`${DIR}/island_small.png`, island(44, 22, [[15, 17, 10, 5], [30, 18, 9, 5]], [[22, 15, 1, 9]]))

// ---- z:2 水面线泡沫(96x12 tile, repeat-x, CSS 横向漂移) ------------------
{
  const W = 96
  const H = 12
  const g = grid(W, H)
  for (let x = 0; x < W; x++) {
    const crest = Math.round(1.5 + 1.5 * Math.sin((x / 24) * Math.PI * 2))
    for (let y = crest; y < H; y++) {
      let col
      if (y <= crest + 1) col = [248, 255, 254, 255]
      else if (y <= crest + 2) col = [216, 248, 244, 235]
      else if (y <= 6) col = [216, 248, 244, 130]
      else col = [190, 238, 234, 60]
      set(g, x, y, col)
    }
  }
  savePng(`${DIR}/surface.png`, g)
}

// ---- z:3 水下远景剪影(240x120 tile) --------------------------------------
// 参考图的中层:深青色的礁岭 + 枝状珊瑚 + 阔叶植物剪影,清晰但不抢戏
{
  const W = 240
  const H = 120
  const g = grid(W, H)
  const S = [16, 74, 76, 185]

  // 两段礁岭(圆丘),珊瑚长在岭上
  fillEllipse(g, 60, H + 14, 55, 30, S)
  fillEllipse(g, 195, H + 10, 48, 34, S)

  function branch(x, y, ang, len, depth) {
    if (depth <= 0 || len < 3) return
    const x1 = x + Math.round(Math.cos(ang) * len)
    const y1 = y - Math.round(Math.sin(ang) * len)
    thickLine(g, x, y, x1, y1, S, depth)
    branch(x1, y1, ang + 0.5, len * 0.68, depth - 1)
    branch(x1, y1, ang - 0.4, len * 0.62, depth - 1)
  }
  branch(38, H - 12, Math.PI / 2, 20, 3)
  branch(84, H - 16, Math.PI / 2 - 0.2, 16, 3)
  branch(178, H - 14, Math.PI / 2 + 0.2, 18, 3)
  branch(222, H - 8, Math.PI / 2, 14, 2)

  // 阔叶海草剪影
  for (const [bx, h, phase] of [[14, 70, 0], [120, 92, 2], [148, 58, 4], [238, 74, 1]]) {
    for (let i = 0; i < h; i++) {
      const y = H - 1 - i
      const x = bx + Math.round(4 * Math.sin(i * 0.1 + phase))
      const w = Math.max(3, Math.round(7 * (1 - (i / h) * 0.55)))
      for (let k = 0; k < w; k++) set(g, x + k - (w >> 1), y, S)
      if (i % 14 === 7 && i < h - 10) {
        const side = i % 28 === 7 ? 1 : -1
        fillEllipse(g, x + side * 6, y - 1, 5, 2.6, S)
      }
    }
  }
  savePng(`${DIR}/far.png`, g)
}

// ---- z:4 前景装饰(按参考图比例放大:海扇占画面高 20%,海带 37%) ------------
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
  for (let r = 0; r < Math.ceil(h / 3.2); r++) {
    const yline = 3 + r * 3.4
    for (let x = 1; x < w - 1; x++) {
      const y = Math.round(yline + 1.4 * Math.sin(x * 0.7 + r * 2.1))
      if (g[y]?.[x]) set(g, x, y, dark)
      // 脑纹偶尔加宽一像素,更像沟回
      if (g[y + 1]?.[x] && (x + r) % 5 === 0) set(g, x, y + 1, dark)
    }
  }
  for (let x = 2; x < w - 2; x++) {
    for (let y = 1; y < Math.round(h * 0.3); y++) {
      if (g[y]?.[x] === base && (x + y * 2) % 3 === 0) set(g, x, y, hi)
    }
  }
  outline(g, edge)
  return g
}
savePng(`${DIR}/coral_brain_pink.png`, brainCoral(48, 30,
  [240, 140, 160, 255], [194, 86, 112, 255], [252, 195, 206, 255], [142, 58, 80, 255]))
savePng(`${DIR}/coral_brain_orange.png`, brainCoral(40, 26,
  [238, 152, 88, 255], [188, 96, 40, 255], [250, 198, 140, 255], [130, 64, 26, 255]))

// 枝状珊瑚(鹿角):可调大小和配色
function staghorn(W, H, base, tip, edge, stems) {
  const g = grid(W, H)
  function branch(x, y, ang, len, depth) {
    if (depth <= 0 || len < 3) return
    const x1 = x + Math.round(Math.cos(ang) * len)
    const y1 = y - Math.round(Math.sin(ang) * len)
    thickLine(g, x, y, x1, y1, depth >= 2 ? base : tip, Math.min(depth, 3))
    branch(x1, y1, ang + 0.55, len * 0.62, depth - 1)
    branch(x1, y1, ang - 0.35, len * 0.66, depth - 1)
  }
  for (const [x, ang, len, depth] of stems) branch(x, H - 1, ang, len, depth)
  outline(g, edge)
  return g
}
savePng(`${DIR}/coral_branch_pink.png`, staghorn(40, 36,
  [242, 122, 112, 255], [252, 182, 172, 255], [152, 52, 56, 255],
  [[19, Math.PI / 2, 15, 3], [8, Math.PI / 2 + 0.55, 11, 2], [32, Math.PI / 2 - 0.5, 11, 2]]))
savePng(`${DIR}/coral_branch_red.png`, staghorn(44, 40,
  [224, 66, 52, 255], [244, 128, 96, 255], [128, 30, 24, 255],
  [[21, Math.PI / 2, 17, 3], [9, Math.PI / 2 + 0.6, 12, 3], [35, Math.PI / 2 - 0.55, 13, 2]]))

// 管状海绵丛:高矮不一的空心管,可调配色
function tubes(W, H, cols, heights, tubeW = 5) {
  const [body, hi, hole, edge] = cols
  const g = grid(W, H)
  heights.forEach((hgt, i) => {
    const x0 = 1 + i * (tubeW + 1)
    for (let y = H - hgt; y < H; y++) {
      for (let x = x0; x < x0 + tubeW; x++) {
        set(g, x, y, x === x0 ? hi : x === x0 + tubeW - 1 ? [body[0] * 0.75 | 0, body[1] * 0.75 | 0, body[2] * 0.75 | 0, 255] : body)
      }
    }
    for (let x = x0 + 1; x < x0 + tubeW - 1; x++) set(g, x, H - hgt, hole)
    set(g, x0 + 1, H - hgt + 1, hole)
  })
  outline(g, edge)
  return g
}
savePng(`${DIR}/coral_tube.png`, tubes(32, 40,
  [[218, 90, 60, 255], [242, 142, 100, 255], [118, 40, 24, 255], [128, 46, 28, 255]],
  [24, 34, 28, 18], 6))
savePng(`${DIR}/tubes_purple.png`, tubes(40, 44,
  [[156, 96, 196, 255], [196, 152, 226, 255], [78, 40, 110, 255], [92, 52, 128, 255]],
  [26, 38, 32, 40, 22], 6))

// 海扇:实心扇面 + 浅色放射肋 + 深色弧线网格(参考图里是一整片织物一样的扇面)
{
  const W = 52
  const H = 54
  const g = grid(W, H)
  const main = [150, 96, 188, 255]
  const lite = [192, 148, 222, 255]
  const dark = [116, 66, 152, 255]
  const edge = [88, 48, 122, 255]
  const ox = 26
  const oy = 49
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - ox
      const dy = oy - y
      if (dy < 0) continue
      const r = Math.sqrt(dx * dx + dy * dy)
      const ang = (Math.atan2(dx, dy) * 180) / Math.PI // 0 = 正上
      if (r < 5 || r > 43 || Math.abs(ang) > 56) continue
      // 外缘做扇贝状的起伏
      const rim = 43 - 2.2 * Math.abs(Math.sin(((ang + 56) / 14) * Math.PI))
      if (r > rim) continue
      let col = main
      if (((ang + 56) % 14) < 2.2) col = lite // 放射肋
      if (r % 10 < 1.4) col = dark // 横向弧线
      // 网格里掏些小孔,像织物的镂空
      if (((Math.round(ang / 7) + Math.round(r / 5)) % 3 === 0) && r % 10 > 4 && r % 10 < 6.5 && ((ang + 56) % 14) > 5 && ((ang + 56) % 14) < 9) continue
      set(g, x, y, col)
    }
  }
  thickLine(g, ox, H - 1, ox, oy - 4, edge, 3)
  outline(g, edge)
  savePng(`${DIR}/fan_purple.png`, g)
}

// 疙瘩状绿珊瑚:一堆圆丘,缝隙压深,顶上提亮
{
  const W = 40
  const H = 22
  const g = grid(W, H)
  const base = [112, 182, 72, 255]
  const blobs = [[8, 14, 7], [18, 10, 8.5], [29, 14, 7], [13, 17, 6], [24, 17, 6.5], [34, 17, 5]]
  for (const [cx, cy, r] of blobs) fillEllipse(g, cx, cy, r, r * 0.85, base)
  for (const [cx, cy, r] of blobs) {
    for (let a = 0; a < Math.PI * 2; a += 0.25) {
      const x = Math.round(cx + Math.cos(a) * r)
      const y = Math.round(cy + Math.sin(a) * r * 0.85)
      if (g[y]?.[x] === base && g[y + 1]?.[x] === base && y > cy) set(g, x, y, [66, 126, 44, 255])
    }
    fillEllipse(g, cx - 1, cy - r * 0.5, r * 0.42, r * 0.3, [162, 216, 112, 255])
  }
  outline(g, [42, 92, 30, 255])
  savePng(`${DIR}/coral_green.png`, g)
}

// 灰绿大岩台/小岩石:参考图两侧的礁岩,顶上长苔和草簇
function rock(W, H, mounds, tufts) {
  const g = grid(W, H)
  for (const [cx, cy, rx, ry] of mounds) fillEllipse(g, cx, cy, rx, ry, [164, 170, 156, 255])
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!g[y][x]) continue
      const t = y / H
      if (t > 0.7) set(g, x, y, [120, 126, 112, 255])
      else if (t > 0.55 && (x + y) % 2 === 0) set(g, x, y, [120, 126, 112, 255])
      else if (t < 0.3 && (x + y) % 2 === 0) set(g, x, y, [196, 202, 184, 255])
    }
  }
  // 苔绿斑
  for (let i = 0; i < W / 4; i++) {
    const x = Math.floor(hash(i, W) * W)
    for (let y = 0; y < H; y++) {
      if (g[y]?.[x]) {
        if (hash(x, i) > 0.35) {
          set(g, x, y, [96, 152, 80, 255])
          set(g, x + 1, y, [96, 152, 80, 255])
          set(g, x, y + 1, [80, 134, 66, 255])
        }
        break
      }
    }
  }
  // 顶上的草簇
  for (const tx of tufts) {
    let topY = 0
    for (let y = 0; y < H; y++) {
      if (g[y]?.[tx]) {
        topY = y
        break
      }
    }
    for (const [dx, dy] of [[-3, -6], [-1, -8], [1, -8], [3, -6], [0, -9]]) {
      thickLine(g, tx, topY, tx + dx, topY + dy, [92, 168, 74, 255], 1)
    }
  }
  outline(g, [66, 70, 62, 255])
  return g
}
savePng(`${DIR}/rock_big.png`, rock(110, 42,
  [[30, 38, 28, 28], [62, 40, 34, 32], [92, 38, 22, 24]], [18, 52, 84]))
savePng(`${DIR}/rock_small.png`, rock(56, 26, [[18, 24, 16, 17], [38, 26, 18, 19]], [26]))

// 海带:一条波浪宽叶(参考图里能到画面 1/3 高),左缘亮线,间隔出侧叶
{
  const W = 26
  const H = 100
  const g = grid(W, H)
  const kelp = [56, 124, 52, 255]
  const lite = [96, 172, 74, 255]
  for (let i = 0; i < 94; i++) {
    const y = H - 1 - i
    const x = 12 + Math.round(6 * Math.sin(i * 0.09))
    const w = i > 80 ? 3 : i > 50 ? 4 : 5
    for (let k = 0; k < w; k++) set(g, x + k - (w >> 1), y, k === 0 ? lite : kelp)
    if (i % 13 === 6 && i < 84) {
      const side = i % 26 === 6 ? 1 : -1
      fillEllipse(g, x + side * 6, y - 1, 5, 2.4, kelp)
      set(g, x + side * 4, y - 1, lite)
      set(g, x + side * 5, y - 2, lite)
    }
  }
  outline(g, [32, 76, 32, 255])
  savePng(`${DIR}/kelp.png`, g)
}

// 高海草丛:从根部散开的长叶
{
  const W = 26
  const H = 48
  const g = grid(W, H)
  const dark = [92, 166, 68, 255]
  const lite = [142, 206, 96, 255]
  const spreads = [-10, -6, -2, 2, 6, 10]
  spreads.forEach((spread, i) => {
    const col = i % 2 === 0 ? dark : lite
    for (let t = 0; t < 44; t++) {
      const y = H - 1 - t
      const x = 13 + spread * Math.pow(t / 44, 1.6)
      set(g, Math.round(x), y, col)
      if (t < 20) set(g, Math.round(x) + (spread > 0 ? -1 : 1), y, col)
    }
  })
  outline(g, [44, 98, 38, 255])
  savePng(`${DIR}/seagrass_tall.png`, g)
}

// ---- z:5 金沙海底(96x40 tile)+ 中央洼地 + 散落物 -------------------------
{
  const W = 96
  const H = 40
  const g = grid(W, H)
  for (let x = 0; x < W; x++) {
    const edge = Math.round(1 + Math.sin((x / 16) * Math.PI) * 0.9 + Math.sin(x * 0.41) * 0.6)
    for (let y = Math.max(0, edge); y < H; y++) {
      let col = [235, 200, 115]
      if (y <= edge + 1) col = [246, 224, 154]
      else if (y >= H - 2) col = [190, 146, 74]
      else if (y >= H - 8) col = [212, 168, 90]
      const r = hash(x, y)
      if (r > 0.93) col = [216, 176, 96]
      else if (r < 0.05) col = [247, 226, 158]
      set(g, x, y, [...col, 255])
    }
  }
  savePng(`${DIR}/sand.png`, g)
}

// 小爱心投在沙地上的影子(参考图沙地中间那块深色就是它——白天的影子,
// 跟着她游动移动,由 App 按她的 x 坐标摆放)。半透明深色,边缘抖动淡出
{
  const W = 120
  const H = 16
  const g = grid(W, H)
  const cx = W / 2
  const cy = H / 2
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x - cx) / (W / 2 - 2)
      const ny = (y - cy) / (H / 2 - 2)
      const d = nx * nx + ny * ny
      if (d <= 1) {
        if (d > 0.7 && (x + y) % 2 === 0) continue
        set(g, x, y, [16, 40, 38, d < 0.42 ? 112 : 72])
      }
    }
  }
  savePng(`${DIR}/shadow.png`, g)
}

// 小贝壳(扇形,粉/白)
function shell(base, ridge, edge) {
  const g = grid(10, 8)
  for (let y = 1; y < 7; y++) {
    const w = y < 3 ? y + 1 : 8 - y + 2
    for (let x = 5 - w + 1; x <= 4 + w - 1; x++) set(g, x, y, base)
  }
  for (const x of [2, 4, 6]) set(g, x, 2, ridge)
  set(g, 4, 6, ridge)
  outline(g, edge)
  return g
}
savePng(`${DIR}/shell_pink.png`, shell([246, 172, 152, 255], [216, 128, 108, 255], [152, 84, 70, 255]))
savePng(`${DIR}/shell_white.png`, shell([246, 240, 226, 255], [210, 198, 176, 255], [150, 138, 116, 255]))

// 海星(橙红)
{
  const g = grid(12, 11)
  const c = [234, 122, 76, 255]
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
  const g = grid(14, 7)
  fillEllipse(g, 4, 4, 3.5, 2.4, [150, 154, 144, 255])
  fillEllipse(g, 10, 4.5, 3, 2, [128, 132, 122, 255])
  set(g, 3, 3, [180, 184, 172, 255])
  set(g, 9, 3, [158, 162, 150, 255])
  outline(g, [88, 92, 84, 255])
  savePng(`${DIR}/stones.png`, g)
}

// 蓝宝石(参考图沙地上那颗亮蓝色的小石头)
{
  const g = grid(10, 9)
  const c = [92, 168, 232, 255]
  for (let y = 1; y < 8; y++) {
    const w = y < 4 ? y : 8 - y
    for (let x = 5 - w; x <= 4 + w; x++) set(g, x, y, c)
  }
  set(g, 3, 2, [186, 226, 250, 255])
  set(g, 4, 3, [186, 226, 250, 255])
  set(g, 5, 5, [56, 118, 188, 255])
  set(g, 6, 5, [56, 118, 188, 255])
  outline(g, [40, 84, 140, 255])
  savePng(`${DIR}/gem_blue.png`, g)
}

// 小灰蓝鱼(参考图沙地上路过的小鱼)
{
  const g = grid(14, 8)
  fillEllipse(g, 7, 4, 4.5, 2.6, [96, 128, 152, 255])
  thickLine(g, 2, 4, 0, 2, [96, 128, 152, 255], 2)
  thickLine(g, 2, 4, 0, 6, [96, 128, 152, 255], 2)
  fillEllipse(g, 8, 3, 2, 1, [140, 170, 190, 255])
  set(g, 10, 3, [24, 32, 40, 255])
  outline(g, [48, 66, 82, 255])
  savePng(`${DIR}/fish_small.png`, g)
}

// ---- z:7 描边气泡(参考图那种白圈+高光的泡泡,三个尺寸) --------------------
function bubble(d) {
  const g = grid(d, d)
  const r = (d - 1) / 2
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      const dist = Math.sqrt((x - r) ** 2 + (y - r) ** 2)
      if (dist <= r && dist > r - 1.3) set(g, x, y, [214, 245, 248, 235])
      else if (dist <= r - 1.3) set(g, x, y, [255, 255, 255, 30])
    }
  }
  // 左上高光弧
  const hx = Math.round(r * 0.55)
  const hy = Math.round(r * 0.55)
  set(g, hx, hy, [255, 255, 255, 255])
  set(g, hx + 1, hy, [255, 255, 255, 255])
  set(g, hx, hy + 1, [255, 255, 255, 255])
  if (d > 8) set(g, hx + 2, hy - 1, [255, 255, 255, 200])
  return g
}
savePng(`${DIR}/bubble_big.png`, bubble(14))
savePng(`${DIR}/bubble_mid.png`, bubble(10))
savePng(`${DIR}/bubble_small.png`, bubble(6))

// ---- z:8 HUD 像素面板与图标(参考图:深棕木底 + 金棕边 + 奶白字) -----------
const UI = `${DIR}/ui`
if (!fs.existsSync(UI)) fs.mkdirSync(UI, { recursive: true })

// border-image 用的九宫格面板:外圈深棕描边 → 金棕边(带高光/阴影) → 深棕内芯。
// 切片 6px,CSS 里 border-width 也是 6px,1:1 不缩放
{
  const S = 24
  const g = grid(S, S)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.min(x, y, S - 1 - x, S - 1 - y)
      let col
      if (d === 0) col = [62, 38, 20, 255]
      else if (d === 1) col = [232, 190, 110, 255] // 金边高光
      else if (d <= 3) col = [198, 148, 74, 255] // 金棕边
      else if (d === 4) col = [116, 70, 34, 255] // 内侧阴影
      else col = [122, 76, 40, 255] // 木底
      // 木底加一点横向纹理
      if (d > 4 && y % 3 === 0 && (x + y) % 7 < 3) col = [112, 68, 34, 255]
      set(g, x, y, col)
    }
  }
  savePng(`${UI}/panel.png`, g)
}

// 道具格:26x26,金棕边 + 更深的凹陷内芯;active 版换红框(该换气时的呼吸灯)
function slot(borderCol, borderHi) {
  const S = 26
  const g = grid(S, S)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.min(x, y, S - 1 - x, S - 1 - y)
      let col
      if (d === 0) col = [62, 38, 20, 255]
      else if (d === 1) col = borderHi
      else if (d === 2) col = borderCol
      else if (d === 3) col = [92, 56, 28, 255]
      else col = [140, 94, 52, 255] // 内芯浅木
      if (d > 3 && y < 6) col = [120, 78, 42, 255] // 顶部内阴影
      set(g, x, y, col)
    }
  }
  return g
}
savePng(`${UI}/slot.png`, slot([198, 148, 74, 255], [232, 190, 110, 255]))
savePng(`${UI}/slot_red.png`, slot([214, 70, 40, 255], [244, 130, 84, 255]))

// 16x16 像素图标 ×9(动作/道具)+ 10x10 ×4(状态栏)。
// 都画在透明底上,由组件放进 slot 里
function icon16() {
  return grid(16, 16)
}

{
  // 贝壳
  const g = icon16()
  for (let y = 4; y < 13; y++) {
    const w = y < 8 ? y - 3 : 13 - y + 2
    for (let x = 8 - w; x <= 7 + w; x++) set(g, x, y, [244, 170, 150, 255])
  }
  for (const x of [4, 7, 10]) {
    thickLine(g, x, 5, 7, 12, [214, 126, 108, 255], 1)
  }
  outline(g, [150, 84, 70, 255])
  savePng(`${UI}/icon_shell.png`, g)
}
{
  // 礼物盒
  const g = icon16()
  for (let y = 6; y < 14; y++) for (let x = 2; x < 14; x++) set(g, x, y, [214, 70, 60, 255])
  for (let y = 6; y < 14; y++) for (const x of [7, 8]) set(g, x, y, [244, 202, 88, 255])
  for (let x = 2; x < 14; x++) set(g, x, 8, x === 7 || x === 8 ? [244, 202, 88, 255] : [186, 52, 44, 255])
  fillEllipse(g, 5.5, 4, 2, 1.5, [244, 202, 88, 255])
  fillEllipse(g, 10.5, 4, 2, 1.5, [244, 202, 88, 255])
  outline(g, [120, 32, 26, 255])
  savePng(`${UI}/icon_gift.png`, g)
}
{
  // 背包
  const g = icon16()
  for (let y = 5; y < 14; y++) for (let x = 3; x < 13; x++) set(g, x, y, [164, 108, 58, 255])
  for (let y = 2; y < 6; y++) for (let x = 5; x < 11; x++) set(g, x, y, [140, 90, 48, 255])
  for (let y = 8; y < 12; y++) for (let x = 6; x < 10; x++) set(g, x, y, [206, 150, 88, 255])
  set(g, 7, 9, [120, 76, 38, 255])
  set(g, 8, 9, [120, 76, 38, 255])
  outline(g, [96, 58, 28, 255])
  savePng(`${UI}/icon_backpack.png`, g)
}
{
  // 图鉴(蓝皮书)
  const g = icon16()
  for (let y = 3; y < 14; y++) for (let x = 3; x < 13; x++) set(g, x, y, [72, 118, 196, 255])
  for (let y = 3; y < 14; y++) set(g, 4, y, [50, 88, 156, 255])
  for (let y = 4; y < 13; y++) for (let x = 12; x < 14; x++) set(g, x, y, [240, 232, 212, 255])
  thickLine(g, 6, 6, 10, 6, [200, 220, 250, 255], 1)
  thickLine(g, 6, 9, 10, 9, [200, 220, 250, 255], 1)
  outline(g, [30, 56, 108, 255])
  savePng(`${UI}/icon_book.png`, g)
}
{
  // 喂海草(新芽)
  const g = icon16()
  fillEllipse(g, 8, 13, 4, 2, [164, 118, 66, 255])
  thickLine(g, 8, 12, 8, 6, [76, 154, 60, 255], 2)
  fillEllipse(g, 5, 6, 2.6, 1.8, [110, 190, 78, 255])
  fillEllipse(g, 11, 5, 2.6, 1.8, [110, 190, 78, 255])
  outline(g, [46, 96, 38, 255])
  savePng(`${UI}/icon_sprout.png`, g)
}
{
  // 种海草(三片长叶)
  const g = icon16()
  const dark = [82, 156, 62, 255]
  const lite = [130, 200, 88, 255]
  thickLine(g, 8, 14, 4, 3, dark, 2)
  thickLine(g, 8, 14, 8, 2, lite, 2)
  thickLine(g, 8, 14, 12, 4, dark, 2)
  outline(g, [44, 92, 36, 255])
  savePng(`${UI}/icon_seagrass.png`, g)
}
{
  // 换一片海(地图)
  const g = icon16()
  for (let y = 3; y < 13; y++) for (let x = 2; x < 14; x++) set(g, x, y, [232, 214, 168, 255])
  for (let y = 3; y < 13; y++) set(g, 6, y, [214, 192, 140, 255])
  for (let y = 3; y < 13; y++) set(g, 10, y, [214, 192, 140, 255])
  thickLine(g, 4, 10, 7, 6, [214, 80, 60, 255], 1)
  thickLine(g, 7, 6, 11, 8, [214, 80, 60, 255], 1)
  fillEllipse(g, 11.5, 7.5, 1.4, 1.4, [70, 130, 200, 255])
  outline(g, [140, 116, 72, 255])
  savePng(`${UI}/icon_map.png`, g)
}
{
  // 相册(相机)
  const g = icon16()
  for (let y = 5; y < 13; y++) for (let x = 2; x < 14; x++) set(g, x, y, [110, 118, 128, 255])
  for (let y = 3; y < 5; y++) for (let x = 5; x < 9; x++) set(g, x, y, [110, 118, 128, 255])
  fillEllipse(g, 8, 9, 3, 3, [52, 58, 66, 255])
  fillEllipse(g, 8, 9, 1.6, 1.6, [120, 190, 220, 255])
  set(g, 12, 6, [220, 90, 70, 255])
  outline(g, [44, 48, 56, 255])
  savePng(`${UI}/icon_camera.png`, g)
}
{
  // 换气(泡泡)
  const g = icon16()
  const ring = [190, 235, 245, 255]
  for (const [cx, cy, r] of [[6, 9, 4], [11.5, 4.5, 2.5]]) {
    for (let a = 0; a < Math.PI * 2; a += 0.12) {
      set(g, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), ring)
    }
    set(g, Math.round(cx - r * 0.4), Math.round(cy - r * 0.4), [255, 255, 255, 255])
  }
  outline(g, [110, 170, 190, 255])
  savePng(`${UI}/icon_bubble.png`, g)
}
// 10x10 状态栏小图标:月亮 / 潮汐 / 体长(尺) / 体重(秤砣)
{
  const g = grid(10, 10)
  // 月牙:在大圆内、又不在往左上偏移的小圆内的部分才是月亮
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const inBig = (x - 5) ** 2 / 16 + (y - 5) ** 2 / 16 <= 1
      const inCut = (x - 3.4) ** 2 / 9.6 + (y - 4.2) ** 2 / 11.6 <= 1
      if (inBig && !inCut) set(g, x, y, [244, 214, 120, 255])
    }
  }
  outline(g, [176, 142, 62, 255])
  savePng(`${UI}/icon_moon.png`, g)
}
{
  // 实心的双层浪:上层白顶青身,下层只有青身,10px 下也读得出"浪"
  const g = grid(10, 10)
  const c = [110, 205, 228, 255]
  for (let x = 0; x < 10; x++) {
    const crest = 3 + Math.round(Math.sin((x / 9) * Math.PI * 2) * 1.6)
    set(g, x, crest, [240, 252, 254, 255])
    set(g, x, crest + 1, c)
    set(g, x, crest + 2, c)
    const crest2 = 7 + Math.round(Math.sin((x / 9) * Math.PI * 2 + 1.2) * 1.2)
    set(g, x, crest2, c)
    set(g, x, crest2 + 1, [70, 160, 190, 255])
  }
  savePng(`${UI}/icon_wave.png`, g)
}
{
  // 横放的黄尺子,带刻度
  const g = grid(10, 10)
  for (let y = 3; y <= 6; y++) for (let x = 0; x < 10; x++) set(g, x, y, [236, 200, 96, 255])
  for (const x of [1, 3, 5, 7]) {
    set(g, x, 3, [150, 116, 44, 255])
    set(g, x, 4, [150, 116, 44, 255])
  }
  outline(g, [150, 116, 44, 255])
  savePng(`${UI}/icon_ruler.png`, g)
}
{
  const g = grid(10, 10)
  for (let y = 4; y < 9; y++) {
    const w = 2 + Math.round((y - 4) * 0.8)
    for (let x = 5 - w; x <= 4 + w; x++) set(g, x, y, [148, 150, 160, 255])
  }
  for (let a = 0; a < Math.PI * 2; a += 0.3) {
    set(g, Math.round(4.5 + Math.cos(a) * 2), Math.round(2.5 + Math.sin(a) * 1.6), [148, 150, 160, 255])
  }
  outline(g, [84, 86, 96, 255])
  savePng(`${UI}/icon_weight.png`, g)
}

console.log('World layer art v2 generated in ' + DIR + '/')
