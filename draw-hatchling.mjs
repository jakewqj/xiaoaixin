// 刚出壳的小海龟(绿海龟幼崽)精灵表生成器。ROADMAP 4-5「海龟孵化夜」用。
// 16×10 一帧、2 帧(前鳍往前伸 / 往后拨)、无抗锯齿、朝右、墨蓝描边 #243642。
// 输出 public/assets/world/hatchling.png(32×10)。
//
// 出处:fact_turtle_hatching(NOAA / Nova Southeastern University,爸爸 2026-09-30 核对)。
// 绿海龟幼崽的样子:背甲深色、腹面浅色、**前鳍长得和身子差不多长** —— 刚出壳就要靠它
// 一路划进外海,这是和成年龟(阿玳 / 绿绿)一眼分得开的地方,不能画成缩小版的绿绿。
//
// 侧视,和阿玳、绿绿同一个视角。它在画面里只有十几个像素,**轮廓就是全部**:
// 圆鼓的背 + 身子底下一条长前鳍 + 前头一颗分开的小圆头,三样都得在剪影上读得出来。
//
// **前鳍永远不上背。** 第一版 14×9 让前鳍一帧往上划,放大一看鳍尖和背甲顶连成一个尖角 ——
// 读出来是**鲨鱼背鳍**(宪法二:不要惊吓元素)。现在两帧都在身子底下:往前下方伸 / 往后拨。
// 头第一版贴着背甲长,整只读成一条鱼;要和背甲之间隔出一道缝(只靠一截脖子连着)
import fs from 'node:fs'
import zlib from 'node:zlib'

const FW = 16
const FH = 10
const OUT = 'public/assets/world/hatchling.png'

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255]
const C = {
  ink: hex('#243642'),
  shell: hex('#3D4A45'), // 背甲:深灰绿
  shellHi: hex('#5E6E63'), // 背甲顶上一道高光,不然在夜里是一坨黑
  belly: hex('#D9D2BC'), // 腹面浅色
  skin: hex('#4F5C55'), // 头和鳍
  eye: hex('#101418'),
}

function frame(up) {
  const g = Array.from({ length: FH }, () => new Array(FW).fill(null))
  const put = (x, y, col) => { if (x >= 0 && x < FW && y >= 0 && y < FH) g[y][x] = col }

  // 背甲:半个圆顶(上半个椭圆),圆鼓的背是「这是龟」的第一信号。顶上一道高光
  // 从第 3 行起画:椭圆最上面那一行只剩正中一格,描边之后是一根尖刺
  for (let y = 3; y <= 6; y++) {
    for (let x = 2; x <= 10; x++) {
      const nx = (x - 6) / 4.6
      const ny = (y - 6) / 4
      if (nx * nx + ny * ny <= 1) put(x, y, C.shell)
    }
  }
  for (const x of [5, 6, 7]) put(x, 3, C.shellHi)
  // 腹面一条浅色
  for (let x = 3; x <= 10; x++) put(x, 7, C.belly)
  // 脖子一截 + 分开的小圆头
  put(11, 6, C.skin)
  for (const [x, y] of [[12, 4], [13, 4], [12, 5], [13, 5], [14, 5], [12, 6], [13, 6]]) put(x, y, C.skin)
  put(13, 4, C.eye)
  // 后鳍:短短一截
  put(1, 7, C.skin)
  put(2, 7, C.skin)
  // 前鳍:长,两帧都在身子底下 —— 往前下方伸(够水)/ 往后拨(推水)
  const fin = up
    ? [[10, 8], [11, 8], [12, 9], [13, 9]]
    : [[9, 8], [8, 8], [7, 9], [6, 9], [5, 9]]
  for (const [x, y] of fin) put(x, y, C.skin)

  // 描边:已填像素挨着的透明格描 1px 墨蓝(四邻接,和其它精灵同一种描法)
  const filled = g.map((row) => row.map((p) => p !== null))
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      if (filled[y][x]) continue
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(
        ([dx, dy]) => filled[y + dy]?.[x + dx] === true,
      )
      if (near) g[y][x] = C.ink
    }
  }
  return g
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

const frames = [frame(true), frame(false)]
const sheet = Array.from({ length: FH }, (_, y) => [...frames[0][y], ...frames[1][y]])
writePng(OUT, sheet)
const palette = new Set(sheet.flat().filter(Boolean).map((p) => p.join(',')))
console.log(`${OUT}  ${FW * 2}x${FH}  2 帧,调色板 ${palette.size} 色`)
