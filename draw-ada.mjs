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
// ---- 头像(星露谷式对话框右边那格立绘)---------------------------------
// **视角是侧面。** 正面画过两版都翻了:玳瑁最要紧的物种特征是那张向下钩的鹰嘴
// (docs/ada_art_prompt.md 第一条),而钩是个**侧面**特征 —— 正面看它只是一块
// 从脸上凸出来的楔形,48px 里读出来是「一撮胡子」,整张脸随之滑成一只树懒。
//
// 朝左,不是朝右。§十三「朝向一律朝右」管的是**精灵表**(代码要按朝向镜像它);
// 头像是一张固定图,没有镜像逻辑。朝左是让她面向左边的台词区 ——
// 星露谷的头像在右、人物看向画面内,视线把人带回字上,朝右会把人带出框。
//
// **三件让它别读成猛禽的事**(v3–v5 连翻三版,每版都是栽在这三条上的某一条):
//   · 不画眉脊。海龟的眼是圆的、软的;眼上压一道深色横脊,立刻变成鹰
//   · 头别占满框。头一大就没脖子,壳退成背景板 —— 而**壳才是「这是只龟」的第一信号**
//   · 钩往下坠,不往前伸。往前伸是鸟喙,往下坠盖住下颌才是玳瑁
//
// 48px 里要立住的四个物种特征(少一个就不是玳瑁):
//   ① 鹰嘴 —— 上颌尖端探到嘴缝**以下**,这一钩就是 Hawksbill 的名字
//   ② 叠瓦壳 —— 壳缘锯齿,和绿绿的光滑连片分得开
//   ③ 玳瑁纹 —— 琥珀/棕/黑大块高对比斑纹
//   ④ 额鳞 —— 吻背上一列盾片
// 背景留透明:纸色由 DialoguePanel 的 .sv-plate 给,换框不用重画图(宪法五)。
const PW = 48
const PH = 48

// 头像多用 4 个色(受光/背光/壳高光/角质喙),连同精灵的 8 色一共 12 色,
// 仍在宪法二十一·5 放宽后的 32 色内
const P = {
  ...C,
  skinShade: hex('#A8845F'),
  skinLight: hex('#DDBB94'),
  shellHi: hex('#E8A85C'),
  horn: hex('#EFD9A6'),
}

// 头:圆钝的蛋,含下颌。只占画面左上角三分之一 —— 剩下的留给壳
const P_HEAD = [
  [8, 13, 23], [9, 11, 25], [10, 9, 27], [11, 8, 28], [12, 7, 28],
  [13, 6, 29], [14, 5, 29], [15, 5, 29], [16, 5, 29], [17, 5, 29],
  [18, 6, 28], [19, 7, 28], [20, 9, 27], [21, 12, 27], [22, 16, 26],
]

// 上颌:从吻背伸出一小截,尖端**坠到**头部轮廓以下(y18–19)。
// 那两行就是钩本身 —— 它咬进剪影里,不靠颜色也认得出
const P_BEAK = [
  [12, 4, 6], [13, 3, 5], [14, 2, 4], [15, 1, 4], [16, 1, 4],
  [17, 1, 4], [18, 1, 5], [19, 2, 5], [20, 3, 5],
]

// 脖子:短、粗。海龟的头几乎是坐在壳上的,拉出一条长脖子就成了蛇颈龙
const P_NECK = [
  [20, 22, 30], [21, 22, 31], [22, 22, 32], [23, 23, 33], [24, 23, 34],
  [25, 24, 35], [26, 24, 36], [27, 25, 37], [28, 25, 37],
]

// 前鳍:左下角一大片桨,和壳一起把画面下半部撑起来
const P_FLIPPER = [
  [32, 4, 10], [33, 2, 12], [34, 1, 13], [35, 0, 14], [36, 0, 15],
  [37, 0, 15], [38, 0, 16], [39, 0, 16], [40, 0, 15], [41, 0, 15],
  [42, 0, 14], [43, 0, 13], [44, 0, 12], [45, 0, 11], [46, 0, 10], [47, 0, 9],
]

// 背甲是个椭球穹顶,不是横过画面的一条带子(早先那版读出来是木栅栏)。
// 用极坐标画:半径按角度加一道锯齿,叠瓦缘就直接长在轮廓上,不用事后去啃。
const P_DOME = { cx: 30, cy: 56, ax: 33, ay: 31, teeth: 16, tooth: 0.08 }
// 归一化半径:<1 在壳内。saw 是这一角度在「一枚缘盾」里的位置(0=齿缝)
function domeAt(x, y) {
  const dx = (x - P_DOME.cx) / P_DOME.ax
  const dy = (y - P_DOME.cy) / P_DOME.ay
  const d = Math.hypot(dx, dy)
  const t = (Math.atan2(dy, dx) * P_DOME.teeth) / (2 * Math.PI)
  const saw = Math.abs(t - Math.round(t)) * 2
  const edge = 1 - P_DOME.tooth * (1 - saw)
  // 盾片格:环号(椎盾/肋盾/缘盾)+ 扇区号,fr/fs 是这一像素在格子里的相对位置。
  // 花纹按「一枚盾片」为单位画 —— 满屏甩斜线读出来是划痕,不是玳瑁纹
  const ring = d < 0.5 ? 0 : d < 0.78 ? 1 : 2
  const r0 = ring === 0 ? 0 : ring === 1 ? 0.5 : 0.78
  const r1 = ring === 0 ? 0.5 : ring === 1 ? 0.78 : edge
  const sect = Math.floor(t)
  return { d, saw, edge, ring, sect, fr: (d - r0) / Math.max(0.01, r1 - r0), fs: t - sect }
}

function createPortrait() {
  const g = makeGrid(PW, PH)
  const inb = (x, y) => x >= 0 && x < PW && y >= 0 && y < PH
  const put = (x, y, col) => { if (inb(x, y)) g[y][x] = col }
  const band = (rows, col) => { for (const [y, x0, x1] of rows) for (let x = x0; x <= x1; x++) put(x, y, col) }
  // 只在已经有东西的地方上色,用来加花纹/阴影而不撑破轮廓
  const shade = (x, y, col) => { if (inb(x, y) && g[y][x] !== P.clear) put(x, y, col) }
  const shadeBand = (rows, col) => { for (const [y, x0, x1] of rows) for (let x = x0; x <= x1; x++) shade(x, y, col) }

  // 1) 背甲。**按盾片一枚一枚上色**,不是在琥珀底上甩斜线 —— 甩斜线那版
  //    读出来是一只裂了的陶罐。每枚盾片:琥珀底 + 一角压一块深斑(玳瑁纹的
  //    实际长相就是「每片各有一团放射状暗斑」),接缝勾深色,缘盾整圈更深。
  for (let y = 0; y < PH; y++) {
    for (let x = 0; x < PW; x++) {
      const { d, edge, ring, sect, fr, fs } = domeAt(x, y)
      if (d > edge) continue
      // 每枚盾片的花色由 (环号, 扇区号) 定死:同一枚永远长同一个样,不掷骰子
      const kind = (((sect % 5) + 5) % 5 + ring * 2) % 5
      let col = ring === 2 ? P.shellBrown : (kind === 2 ? P.shellHi : P.shellAmber)
      if (ring < 2) {
        // 斑:从盾片的一角铺开的楔形。kind 决定铺哪个角、铺多深
        // 斑占半枚盾片左右。铺满就变成一只深棕的龟,琥珀底反而成了点缀 ——
        // 玳瑁纹是「亮底上压暗斑」,不是反过来
        const wedge = kind === 0 ? fs + fr * 0.7 < 0.6
          : kind === 1 ? (1 - fs) + fr * 0.6 < 0.55
            : kind === 3 ? fs + (1 - fr) * 0.8 < 0.5
              : kind === 4 ? fs * 0.8 + fr < 0.38 : false
        if (wedge) col = kind === 0 || kind === 4 ? P.shellDark : P.shellBrown
      }
      if (fs < 0.07 || fs > 0.93 || fr > 0.92) col = P.seam   // 盾片接缝
      put(x, y, col)
    }
  }

  // 2) 由后往前铺身体
  band(P_FLIPPER, P.bodySkin)
  band(P_NECK, P.bodySkin)
  band(P_HEAD, P.bodySkin)
  band(P_BEAK, P.horn)

  // 3) 吻背上的额鳞,一列盾片。缝隙用深色勾出来才数得清
  shadeBand([[11, 7, 12], [12, 6, 11], [13, 6, 10]], P.shellBrown)
  for (const [x, y] of [[9, 11], [7, 12], [12, 11]]) shade(x, y, P.seam)

  // 4) 眼睛:圆、大、只压一层薄眼睑。**上面不画眉脊** —— 那一道深色横脊是
  //    「海龟 → 猛禽」的开关,前几版就是这么翻的
  for (let x = 13; x <= 19; x++) for (let y = 9; y <= 15; y++) shade(x, y, P.skinLight)
  // 瞳孔磨掉四角:5x5 的实心方块在 48px 上读出来是「受惊」,不是「慢、讲故事的人」
  shadeBand([[10, 15, 17], [11, 14, 18], [12, 14, 18], [13, 14, 18], [14, 15, 17]], P.eye)
  shade(15, 11, P.white)       // 高光:这张脸唯一的活气,别省
  shadeBand([[9, 14, 18]], P.shellDark)   // 薄眼睑,一行就够

  // 5) 嘴缝:从钩尖往后**上扬**,海龟看着像在笑就是靠这条线(精灵那边也是这么走的)。
  //    尖端露在缝以下的那两行 = 上颌盖过下颌 = 鹰嘴
  for (const [x, y] of [[1, 17], [2, 17], [3, 17], [4, 17], [5, 17], [6, 16], [7, 16], [8, 16],
    [9, 16], [10, 15], [11, 15], [12, 15], [13, 15]]) shade(x, y, P.shellDark)
  shade(3, 14, P.ink)          // 鼻孔
  shadeBand([[18, 1, 5], [19, 2, 5], [20, 3, 5]], P.shellBrown)   // 钩的下缘,压出角质厚度
  shadeBand([[18, 8, 16], [19, 10, 18], [20, 13, 20]], P.skinShade)   // 下颌背光

  // 6) 颈部皱褶:海龟的颈皮是一圈圈叠起来的。这几道横纹是「龟」的第二个信号,
  //    仅次于壳 —— 没有它,一段光滑的脖子读出来像蛇
  for (const [y, x0, x1] of [[22, 24, 30], [25, 26, 33], [27, 28, 35]]) {
    for (let x = x0; x <= x1; x++) if ((x - x0) % 3 !== 2) shade(x, y, P.skinShade)
  }

  // 7) 皮肤:光从左上来,后脑和脖子下缘压暗;颊上点几粒鳞
  shadeBand([[21, 24, 27], [23, 30, 33], [24, 31, 34], [26, 32, 36], [28, 33, 37]], P.skinShade)
  shadeBand([[9, 19, 24], [10, 20, 26], [11, 22, 27]], P.skinLight)
  shadeBand([[34, 3, 8], [35, 2, 7], [36, 2, 6]], P.skinLight)   // 前鳍受光的前缘
  // 鳍上的骨线和后缘暗面。少了这些它就是一团没细节的肉色,读不出是桨
  shadeBand([[38, 12, 16], [39, 13, 16], [40, 12, 15], [41, 12, 15],
    [42, 11, 14], [43, 10, 13], [44, 9, 12], [45, 8, 11], [46, 8, 10]], P.skinShade)
  for (const [x, y] of [[6, 36], [7, 37], [8, 38], [9, 39], [5, 41], [6, 42], [7, 43]]) shade(x, y, P.seam)
  shade(1, 36, P.ink)   // 爪
  // 头侧只留两条**连起来的**颌线/颞线。散点会读成脏,不是鳞片 ——
  // 48px 上「一块块角质片」只能靠线,靠不了点
  for (const [x, y] of [[21, 11], [22, 12], [23, 13], [24, 14], [25, 15]]) shade(x, y, P.seam)
  for (const [x, y] of [[16, 17], [17, 18], [18, 18], [19, 19], [20, 19]]) shade(x, y, P.seam)

  // 8) 描边:silhouette 外一圈墨色,和精灵同一道工序
  const solid = []
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) if (g[y][x] !== P.clear) solid.push([x, y])
  for (const [x, y] of solid) {
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const nx = x + ox
      const ny = y + oy
      if (inb(nx, ny) && g[ny][nx] === P.clear) g[ny][nx] = P.ink
    }
  }
  return g
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

const portrait = createPortrait()
writePng(`${OUT_DIR}/portrait.png`, portrait)
console.log(`wrote ${OUT_DIR}/portrait.png ${PW}x${PH}`)

if (DEBUG) {
  if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true })
  writePng(`${DEBUG_DIR}/ada_portrait.png`, scaleGrid(portrait, 6))
  console.log(`wrote ${DEBUG_DIR}/ada_portrait.png (6x)`)
  for (const [name, sheet] of Object.entries(SHEETS)) {
    const grid = makeGrid(FW, FH)
    renderFrame(grid, mask, parts, 0, sheet.opts(0))
    markAnchors(grid)
    writePng(`${DEBUG_DIR}/pose_${name}.png`, scaleGrid(grid, 2))
    console.log(`wrote ${DEBUG_DIR}/pose_${name}.png (2x, with anchors)`)
  }
}
