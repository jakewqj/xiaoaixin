// 绿绿(绿海龟 Chelonia mydas)精灵表生成器。
// 规格照 docs/lvlv_art_prompt.md:96×56、≤14 色、无抗锯齿、朝右、墨蓝描边 #243642。
// idle 4 帧 / swim 6 帧 / talk 4 帧,全部 8fps。输出 public/assets/npc/lvlv/。
//
// **和阿玳(玳瑁)的区别是硬要求,不是风格偏好**:绿海龟的背甲是光滑椭圆、盾片不重叠,
// 花纹是斑驳大理石纹;玳瑁是叠瓦状 + 放射状火焰纹(见 draw-ada.mjs 的 BLOTCHES)。
// 两只龟站在同一片海里,靠这个区别才认得出谁是谁。
//
// 2026-09-08 重画。上一版被指出两个毛病,都是结构问题不是调色问题:
//   ① 前爪错位 —— 鳍根钉在 x=58(壳肚子底下),脖子从 x≈70 出来,中间没有肩,
//      鳍成了一块贴上去的独立形状;swim 帧还整块平移 -5px,越动越脱。
//      现在:鳍**绕肩关节旋转**,根部永远压在甲缘和肩肌底下(图层顺序保证),
//      平移量为零,所以它在任何一帧都不可能和身体裂开。
//   ② 龟壳纹路不清晰 —— 8 团低对比度圆斑随机啃边,读出来是迷彩不是龟壳。
//      现在按真实盾片排布:肋盾缝 + 缘盾带(带盾片刻痕)+ 椎盾脊线,
//      大理石斑长在**每一块肋盾里面**(被缝裁切),所以是花纹不是噪点。
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
  shellLite: hex('#A3BC6E'),  // 椎盾脊线高光
  rim: hex('#3B4F28'),        // 盾片缝与缘盾刻痕
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

// ---------------------------------------------------------------- 背甲几何

const SHELL_REAR = 9      // 壳最后端
const SHELL_FRONT = 71    // 壳最前端(颈口上方)
const SHELL_SPAN = SHELL_FRONT - SHELL_REAR
const SHELL_BASE = 35     // 甲缘基准行
const SHELL_H = 22        // 壳最高处离基准行多少
const PEAK = 0.56         // 最高点略偏前 —— 真实绿海龟背甲后半段拖得长

/**
 * 背甲侧影:给一个 x,回它在这一列的上下缘。
 * 上缘走**超椭圆**,前后两侧各一个指数。试过两个都不行,记下来免得再走一遍:
 *   幂函数 u^0.62 —— 后半段几乎是直线,加上尖顶,整只读成一顶帐篷;
 *   正弦拱 sin(πs) —— 顶上一段是平的,成了带两个肩角的高台。
 * 超椭圆 n=1.6(后)在长坡上全程带曲率、峰是圆的;n=2.1(前)收口更陡,
 * 给脖子上方留一个钝的前缘面。甲缘在后端上收 7px 收成钝尖,前端上收 3px。
 * 上缘压到下缘之下就是壳外,回 null —— 前后两个尖就是这么自然闭合的。
 */
function shellSpan(x) {
  const t = (x - SHELL_REAR) / SHELL_SPAN
  if (t < 0 || t > 1) return null
  const rearSide = t < PEAK
  const halfW = rearSide ? PEAK : 1 - PEAK
  const n = rearSide ? 1.6 : 2.1
  const q = Math.min(1, Math.abs(t - PEAK) / halfW)
  const top = SHELL_BASE - SHELL_H * Math.pow(Math.max(0, 1 - Math.pow(q, n)), 1 / n)
  const rear = t < 0.16 ? (0.16 - t) / 0.16 : 0
  const front = t > 0.80 ? (t - 0.80) / 0.20 : 0
  const bot = SHELL_BASE - 7 * rear * rear - 3 * front * front
  const t0 = Math.round(top)
  const b0 = Math.round(bot)
  if (t0 >= b0) return null
  return { t, top: t0, bot: b0 }
}

// 肋盾缝的位置(沿壳长的比例)。四道缝把侧面切成五块肋盾 —— 绿海龟每侧 4 枚肋盾,
// 侧视还能看到前后各露一点相邻盾片,五块正好。
const SEAMS = [0.26, 0.47, 0.68, 0.86]
const MARGIN_H = 3        // 缘盾带占甲缘上面几行

/** 这个 t 落在第几块肋盾里 */
const panelOf = (t) => SEAMS.filter((s) => s < t).length

// 每块肋盾里的大理石斑。u/v 是在这块盾片里的相对位置,r 是半径。
// **斑被盾片缝裁切** —— 这是它读成花纹而不是迷彩的原因
const PANEL_SPOTS = [
  [0, 0.52, 0.46, 5.5, 'shellDark'],
  [1, 0.40, 0.36, 5.8, 'shellWarm'],
  [1, 0.66, 0.68, 4.2, 'shellDark'],
  [2, 0.44, 0.40, 6.2, 'shellDark'],
  [2, 0.72, 0.70, 4.0, 'shellWarm'],
  [3, 0.46, 0.44, 5.2, 'shellWarm'],
  [3, 0.70, 0.72, 3.4, 'shellDark'],
  [4, 0.48, 0.52, 4.2, 'shellDark'],
]

function buildCarapace() {
  const m = new Map()

  // 1) 底色
  for (let x = SHELL_REAR; x <= SHELL_FRONT; x++) {
    const sp = shellSpan(x)
    if (!sp) continue
    for (let y = sp.top; y <= sp.bot; y++) put(m, x, y, C.shell)
  }

  // 2) 大理石斑:先按盾片算中心,再逐像素判「同一块盾片 + 在缘盾带以上」
  for (const [pi, u, v, r, col] of PANEL_SPOTS) {
    const ta = pi === 0 ? 0 : SEAMS[pi - 1]
    const tb = pi === SEAMS.length ? 1 : SEAMS[pi]
    const cx = SHELL_REAR + (ta + (tb - ta) * u) * SHELL_SPAN
    const spc = shellSpan(Math.round(cx))
    if (!spc) continue
    const cy = spc.top + (spc.bot - MARGIN_H - spc.top) * v
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const sp = shellSpan(x)
        if (!sp || y < sp.top || y > sp.bot - MARGIN_H) continue
        if (panelOf(sp.t) !== pi) continue
        const d = ((x - cx) / r) ** 2 + ((y - cy) / (r * 0.80)) ** 2
        if (d > 1) continue
        // 边缘按噪声啃掉一部分,出来的才是「斑驳」而不是一个圆饼
        if (d > 0.52 && hash(x, y, 3) > 0.42) continue
        m.set(key(x, y), C[col])
      }
    }
  }

  // 3) 椎盾脊线:顶上一行高光,在肋盾缝处断开 —— 断口就是椎盾之间的缝。
  //    **只点当前列的最高一格不行**:上缘一列掉两行时高光就断成点,读出来是一串亮斑;
  //    要把和上一列之间的落差补满,链子才连得起来
  let prevTop = null
  for (let x = SHELL_REAR + 3; x <= SHELL_FRONT - 3; x++) {
    const sp = shellSpan(x)
    if (!sp) { prevTop = null; continue }
    const near = SEAMS.some((s) => Math.abs(SHELL_REAR + s * SHELL_SPAN - x) < 1.2)
    if (!near) {
      const y0 = prevTop === null ? sp.top : Math.min(sp.top, prevTop)
      const y1 = prevTop === null ? sp.top : Math.max(sp.top, prevTop)
      for (let y = y0; y <= y1; y++) if (m.has(key(x, y))) m.set(key(x, y), C.shellLite)
    }
    prevTop = sp.top
  }

  // 4) 肋盾缝:从脊线一路划到缘盾带。往后仰、中段再微微前凸 ——
  //    笔直的竖线读出来是画上去的条纹,带一点弧才像盾片贴在圆弧面上
  for (const ts of SEAMS) {
    const xs = SHELL_REAR + ts * SHELL_SPAN
    for (let v = 0; v <= 1.0001; v += 0.015) {
      const x = Math.round(xs - 2.4 * v * v + 0.8 * Math.sin(Math.PI * v))
      const sp = shellSpan(x)
      if (!sp) continue
      const y = Math.round(sp.top + (sp.bot - MARGIN_H - sp.top) * v)
      if (m.has(key(x, y))) m.set(key(x, y), C.rim)
    }
  }

  // 5) 缘盾带:甲缘上面 3 行换暖棕,顶上压一道缝(肋盾/缘盾的分界),带内刻痕分盾。
  //    刻痕间距**故意不等分**(6/7 交替):等分的话一排下来像散热片,不像盾片。
  //    深刻痕通到底、浅刻痕只划两行,一共 9 道 —— 侧视能看到的缘盾数目量级对得上
  const TICKS = [5, 11, 18, 24, 31, 37, 44, 50, 56]
  for (let x = SHELL_REAR; x <= SHELL_FRONT; x++) {
    const sp = shellSpan(x)
    if (!sp) continue
    const bandTop = Math.max(sp.top, sp.bot - MARGIN_H + 1)
    for (let y = bandTop; y <= sp.bot; y++) {
      if (m.has(key(x, y))) m.set(key(x, y), C.shellWarm)
    }
    const edge = sp.bot - MARGIN_H
    if (edge > sp.top && m.has(key(x, edge))) m.set(key(x, edge), C.rim)
    const ti = TICKS.indexOf(x - SHELL_REAR)
    if (ti >= 0) {
      const deep = ti % 2 === 0
      for (let y = bandTop; y <= (deep ? sp.bot : sp.bot - 1); y++) {
        if (m.has(key(x, y))) m.set(key(x, y), C.rim)
      }
    }
  }

  return m
}

/**
 * 腹甲:甲缘底下露出的一条奶白板。
 * 上一版用椭圆,底下会留一个 1px 的尖,描边一裹就是个吊在肚子上的小疙瘩;
 * 现在逐列给厚度,前厚后薄(腹甲从颈口那边最宽,往尾收),底下一行压深当阴影。
 */
function buildPlastron() {
  const m = new Map()
  const A = 27
  const B = 63
  for (let x = A; x <= B; x++) {
    const u = (x - A) / (B - A)
    const d = Math.round(1 + 2.6 * Math.sin(Math.PI * Math.pow(u, 1.25)))
    for (let y = SHELL_BASE + 1; y <= SHELL_BASE + d; y++) put(m, x, y, C.belly)
    if (d > 1) put(m, x, SHELL_BASE + d, C.bellyShade)
  }
  return m
}

/** 肩:颈根和前鳍根共用的一块身体。压在甲缘和腹甲下面,前鳍就是从这儿长出来的 */
function buildShoulder() {
  const m = new Map()
  ellipse(m, 66, 35, 7.5, 6, C.skin)
  return m
}

/**
 * 头颈。**头要小** —— 海龟的头相对身体是小的,第一版并成一颗大脑袋读出来像陆龟。
 * 喙圆钝**不带钩**(带钩的是玳瑁),下颌带几点锯齿(绿海龟啃海草用),
 * 但只到「几点」为止:多描两笔就成了獠牙。
 * 颈根落在 x≈70,被背甲前缘盖住 —— 所以头上下点动时不会和身体裂开。
 */
function buildHead(mouthOpen) {
  const m = new Map()
  ellipse(m, 70, 29, 5.5, 5, C.skin)        // 颈(根部压在甲缘下)
  ellipse(m, 76, 25, 7, 5.5, C.skin)        // 头
  ellipse(m, 81.5, 26, 3.6, 3.2, C.skin)    // 吻

  // 头顶的大鳞片
  for (const [x, y] of [[73, 21], [76, 20], [79, 22], [71, 24], [82, 24]]) {
    if (m.has(key(x, y))) m.set(key(x, y), C.skinDark)
  }

  // 喙:一道短线压在下颌边缘;张嘴时下颌那道往下挪一格,中间露出口缝
  const jaw = mouthOpen ? 29 : 28
  for (let x = 77; x <= 84; x++) if (m.has(key(x, jaw))) m.set(key(x, jaw), C.mouth)
  if (mouthOpen) {
    for (let x = 78; x <= 83; x++) if (m.has(key(x, 28))) m.set(key(x, 28), C.mouth)
  }
  // 下颌的锯齿:两点,够读出「啃海草的嘴」就收手
  for (const [x, y] of [[79, jaw + 1], [82, jaw + 1]]) {
    if (m.has(key(x, y))) m.set(key(x, y), C.mouth)
  }

  // 眼(ANCHORS.eye = 78,24)。上面压一行深色当眼睑
  for (const x of [77, 78, 79]) if (m.has(key(x, 23))) m.set(key(x, 23), C.skinDark)
  put(m, 77, 24, C.eyeWhite)
  put(m, 78, 24, C.eye)
  put(m, 79, 24, C.eye)
  put(m, 78, 25, C.eye)
  put(m, 79, 25, C.eye)
  return m
}

// ---------------------------------------------------------------- 鳍肢
//
// 鳍**绕关节转**,不平移。根部盘永远埋在甲缘/肩肌底下(靠图层顺序),
// 所以任何一帧都不会出现「鳍和身体错开」——这正是上一版的病根。

const FORE = { px: 67, py: 37, len: 19, w0: 9.4, w1: 2.0, curve: 0.22 }
// 后鳍试了四个位置,记下来免得再试一遍。关节 (17,32):整条埋在壳里,等于没画。
// (21,32) / (23,33) 斜 45–56° 出壳尾:和壳的后尖连成一条连续的楔子,读出来是尾巴不是鳍
// —— 病根是**缘盾带的暖棕 #8A7A3E 和皮肤 #B9A87A 色相太近**,两块贴着就糊成一块,
// 靠调角度救不回来。现在关节挪到腹面后部、角度压到 66° 近乎下探:壳尾那个尖保持干净,
// 鳍从肚子底下单独垂下来,轮廓上有个明确的凹口,才认得出是两样东西。
const BACK = { px: 26, py: 34, len: 12, w0: 7.6, w1: 2.6, curve: 0.16, base: Math.PI - 1.15 }

/** 桨状鳍:从关节按角度铺开,根宽梢窄,梢部再往划水方向多弯一点(桨尖滞后) */
function flipper(cfg, angle, col, dark) {
  const m = new Map()
  const steps = cfg.len * 3
  const at = (t) => {
    const a = angle + cfg.curve * t
    const r = cfg.len * t
    const w = cfg.w1 + (cfg.w0 - cfg.w1) * Math.pow(1 - t, 0.75)
    return { a, w, x: cfg.px + Math.cos(a) * r, y: cfg.py + Math.sin(a) * r }
  }
  for (let i = 0; i <= steps; i++) {
    const p = at(i / steps)
    ellipse(m, Math.round(p.x), Math.round(p.y), p.w / 2, p.w / 2, col)
  }
  // 后缘压一道深色,读出鳍面的厚度。**必须逐步画满**:上一版每 3 步点一下,
  // 垂线一偏就断,出来是一串珠子不是一道边
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    if (t < 0.16) continue
    const p = at(t)
    const x = Math.round(p.x - Math.sin(p.a) * (p.w * 0.30))
    const y = Math.round(p.y + Math.cos(p.a) * (p.w * 0.30))
    if (m.has(key(x, y))) m.set(key(x, y), dark)
  }
  return m
}

const foreFlipper = (a) => flipper(FORE, a, C.skin, C.skinDark)
const backFlipper = (a) => flipper(BACK, BACK.base + a, C.skin, C.skinDark)

// ---------------------------------------------------------------- 帧
//
// idle:原地悬停 + 探一下头(呼应「话痨」)。
// swim:前肢像翅膀一样上下扇 —— 绿海龟靠前肢「飞」,后肢只管方向,不画成四肢一起划。
//       身体在下划(出力)那两帧抬起来,这是它推进的样子。
// talk:头小幅点动 + 喙张合。
const SHEETS = {
  idle: {
    frames: 4,
    opts: (i) => ({
      dy: [0, -1, -1, 0][i],
      fore: [0.42, 0.30, 0.34, 0.50][i],
      back: [0, -0.06, 0, 0.06][i],
      headDX: [0, 1, 1, 0][i],
      headDY: [0, -1, 0, 1][i],
    }),
  },
  swim: {
    frames: 6,
    opts: (i) => ({
      dy: [1, 0, -1, -1, 0, 1][i],
      // 下划到 0.64 就收手:0.76 那一版桨尖的描边压到第 55 行,画布只有 56 行,被切了
      fore: [-0.10, 0.14, 0.42, 0.64, 0.52, 0.18][i],
      back: [0.10, 0.05, -0.02, -0.08, -0.04, 0.04][i],
      headDY: [1, 0, -1, -1, 0, 1][i],
    }),
  },
  talk: {
    frames: 4,
    opts: (i) => ({
      fore: [0.42, 0.44, 0.42, 0.40][i],
      back: [0, 0.02, 0, -0.02][i],
      headDX: [0, 0, 1, 0][i],
      headDY: [0, 1, 0, -1][i],
      mouthOpen: [false, true, true, false][i],
    }),
  },
}

/** 图层顺序(后 → 前)。鳍根、颈根埋在背甲下面就是靠这个顺序保证的 */
function layersOf(built, o) {
  return [
    { m: backFlipper(o.back ?? 0), dx: 0, dy: 0 },
    { m: o.mouthOpen ? built.headOpen : built.head, dx: o.headDX ?? 0, dy: o.headDY ?? 0 },
    { m: built.shoulder, dx: 0, dy: 0 },
    { m: built.plastron, dx: 0, dy: 0 },
    { m: foreFlipper(o.fore ?? 0.42), dx: 0, dy: 0 },
    { m: built.carapace, dx: 0, dy: 0 },
  ]
}

function renderFrame(grid, built, ox, o) {
  const dy = o.dy ?? 0
  const pxs = new Map()
  for (const layer of layersOf(built, o)) {
    for (const [k, col] of layer.m) {
      const [x, y] = k.split(',').map(Number)
      pxs.set(key(x + ox + layer.dx, y + dy + layer.dy), col)
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

const built = {
  carapace: buildCarapace(),
  plastron: buildPlastron(),
  shoulder: buildShoulder(),
  head: buildHead(false),
  headOpen: buildHead(true),
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
const palette = new Set()
let bbox = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }
for (const [name, sheet] of Object.entries(SHEETS)) {
  const grid = Array.from({ length: FH }, () => new Array(FW * sheet.frames).fill(null))
  for (let i = 0; i < sheet.frames; i++) renderFrame(grid, built, i * FW, sheet.opts(i))
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (!grid[y][x]) continue
      palette.add(grid[y][x].join(','))
      const fx = x % FW
      if (fx < bbox.x0) bbox.x0 = fx
      if (fx > bbox.x1) bbox.x1 = fx
      if (y < bbox.y0) bbox.y0 = y
      if (y > bbox.y1) bbox.y1 = y
    }
  }
  writePng(OUT_DIR + '/' + name + '.png', grid)
  console.log(OUT_DIR + '/' + name + '.png  ' + FW * sheet.frames + 'x' + FH + '  ' + sheet.frames + ' 帧')
}
console.log('调色板 ' + palette.size + ' 色(上限 14);眼睛锚点 ' + ANCHORS.eye.join(','))
console.log('内容边界 x ' + bbox.x0 + '..' + bbox.x1 + '  y ' + bbox.y0 + '..' + bbox.y1 + '  (画布 ' + FW + 'x' + FH + ',不许贴边被切)')
