// 砗磲奶奶(巨砗磲 Tridacna maxima)精灵表生成器。
// 规格照 docs/giant_clam_art_prompt.md:64×48、≤12 色、无抗锯齿、正面视角(不分朝向)、
// 墨蓝描边 #243642。idle 2 帧 4fps / talk 4 帧 8fps。输出 public/assets/npc/giant_clam/。
//
// 她**不会动、没有脸**。art prompt 里定的方案是靠外套膜的开合表现「在说话」:
// 上壳抬起来一点,露出的外套膜就多一点。所以外套膜是先画的底层,两片壳盖在它上面 ——
// 抬壳就等于露膜,不用另画一套张嘴的图。
//
// 两个物种特征不能省:**壳缘是波浪状扇贝纹**(不是直边),**外套膜有蓝绿珠光斑纹**
// (共生藻类给的颜色,是这个角色唯一的视觉记忆点)。
import fs from 'node:fs'
import zlib from 'node:zlib'

const FW = 64
const FH = 48
const OUT_DIR = 'public/assets/npc/giant_clam'

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255]
const C = {
  ink: hex('#243642'),
  shell: hex('#E3D3B0'),
  shellShade: hex('#BFA98A'),
  shellDeep: hex('#9A855F'),
  shellLite: hex('#F6EEDA'),
  algae: hex('#8FAE60'),
  mantleTeal: hex('#2FA89E'),
  mantleBlue: hex('#2E6FB0'),
  mantleDeep: hex('#1D4E63'),
  mantleGlow: hex('#7BE3D2'),
  mantleViolet: hex('#7A5AA8'),
}

const key = (x, y) => x + ',' + y
const put = (m, x, y, col) => { if (x >= 0 && x < FW && y >= 0 && y < FH) m.set(key(x, y), col) }

function hash(...ns) {
  let h = 2166136261
  for (const n of ns) { h ^= n; h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 1000) / 1000
}

/**
 * 壳缘的波浪:三角波,周期 8px、幅度 ±3px。
 *
 * **两片壳要用相反的相位。** 同相位的话两条边一起上下、缝宽处处相等,出来是一条
 * 均匀的细带子 —— 第一版就是这样,外套膜细成一条线,而它是这个角色唯一的记忆点。
 * 反相之后牙尖对牙谷:牙尖处几乎咬合,牙谷处露出一大片膜,才是砗磲那张波浪嘴。
 */
const wave = (x) => Math.round(3 * (Math.abs(((x + 4) % 8) / 4 - 1)))

function build() {
  const mask = new Map()
  const parts = { top: new Map() }

  // 1) 外套膜:垫在最底下的一整块,蓝绿珠光。上壳一抬就露出更多
  for (let y = 14; y <= 40; y++) {
    for (let x = 5; x <= 58; x++) {
      const nx = (x - 32) / 27
      const ny = (y - 28) / 14
      if (nx * nx + ny * ny > 1) continue
      // **按位置分层,不是纯撒噪点**。第一版全靠 hash 随机换色,出来是一条彩色碎屑,
      // 像撒了糖针;真正的外套膜是一层肉:上缘亮、往下渐深,再点几处珠光
      const band = (y - 20) + 2 * Math.sin(x * 0.55)
      const r = hash(x, y, 5)
      let col
      if (band < 1) col = C.mantleGlow
      else if (band < 4) col = C.mantleTeal
      else if (band < 8) col = C.mantleBlue
      else col = C.mantleDeep
      if (r > 0.9) col = C.mantleGlow
      else if (r < 0.1) col = C.mantleViolet
      put(mask, x, y, col)
    }
  }
  // 膜上一道道褶皱:顺着开口方向的竖细纹,让它读起来是「肉」不是一块布
  for (let x = 9; x <= 56; x += 4) {
    for (let y = 22; y <= 34; y++) {
      if (mask.has(key(x, y))) mask.set(key(x, y), C.mantleDeep)
    }
  }

  // 2) 下壳:一只碗。上缘走波浪线,下缘是圆底
  for (let x = 2; x <= 61; x++) {
    const top = 31 + wave(x)
    for (let y = top; y <= 46; y++) {
      const nx = (x - 32) / 30
      const ny = (y - 30) / 17
      if (nx * nx + ny * ny > 1) continue
      let col = C.shell
      if (y >= 43) col = C.shellDeep
      else if (y >= 39) col = C.shellShade
      else if (y <= top + 1) col = C.shellLite
      put(mask, x, y, col)
    }
  }

  // 3) 上壳:波浪**反相**,牙尖正对下壳的牙谷
  for (let x = 3; x <= 60; x++) {
    const bottom = 28 - wave(x)
    for (let y = 5; y <= bottom; y++) {
      const nx = (x - 32) / 28
      const ny = (y - 26) / 21
      if (nx * nx + ny * ny > 1) continue
      let col = C.shell
      if (y <= 11) col = C.shellLite
      else if (y >= bottom - 1) col = C.shellShade
      put(parts.top, x, y, col)
    }
  }

  // 4) 壳上的放射肋:从铰合部往外散开。两片壳都要有,不然像两块石头
  for (const rib of [-24, -17, -10, -3, 4, 11, 18, 25]) {
    for (let t = 0; t <= 22; t++) {
      const x = Math.round(32 + (rib / 22) * t)
      const y = 27 - t
      if (parts.top.has(key(x, y))) parts.top.set(key(x, y), C.shellShade)
      const y2 = 30 + Math.round(t * 0.7)
      const x2 = Math.round(32 + (rib / 22) * t * 0.8)
      if (mask.get(key(x2, y2)) === C.shell) mask.set(key(x2, y2), C.shellShade)
    }
  }

  // 5) 壳上长的一点藻和礁屑:她在这儿很久了,壳上有别的东西住着
  for (const [x, y] of [[9, 20], [10, 21], [14, 15], [15, 16], [50, 17], [51, 18], [55, 22], [12, 40], [52, 41]]) {
    if (parts.top.has(key(x, y))) parts.top.set(key(x, y), C.algae)
    else if (mask.has(key(x, y))) mask.set(key(x, y), C.algae)
  }

  return { mask, parts }
}

// idle:两帧,上壳只差 1px —— 「几乎静止」是她的性格,不是省事
// talk:上壳抬高,露出的外套膜更多、珠光更明显
const SHEETS = {
  idle: { frames: 2, opts: (i) => ({ partDY: { top: [0, -1][i] } }) },
  talk: { frames: 4, opts: (i) => ({ partDY: { top: [-1, -3, -4, -2][i] } }) },
}

function renderFrame(grid, mask, parts, ox, opts) {
  const partDY = opts.partDY ?? {}
  const pxs = new Map()
  for (const [k, col] of mask) {
    const [x, y] = k.split(',').map(Number)
    pxs.set(key(x + ox, y), col)
  }
  for (const [name, part] of Object.entries(parts)) {
    for (const [k, col] of part) {
      const [x, y] = k.split(',').map(Number)
      pxs.set(key(x + ox, y + (partDY[name] ?? 0)), col)
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
console.log('调色板 ' + palette.size + ' 色(上限 12)')
