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
  // 下面四个原本只在头像段用。精灵重画之后两边共用一套 —— 同一只龟不该有两套颜色。
  // opaque 一共 13 色,美术需求写的上限是 16(宪法二十一·5 放宽后是 32)
  skinShade: hex('#A8845F'),
  skinLight: hex('#DDBB94'),
  shellHi: hex('#E8A85C'),
  horn: hex('#EFD9A6'),
}

const ANCHORS = { eye: [65, 21] }

// 4. Shape (hawksbill turtle, facing right)
//
// 重画于 2026-09-11,对着 docs/ada_art_prompt.md 逐条改。
// **剪影比例沿用旧版**(壳占七成长度、头压在壳的前上方)—— 那部分本来就对。
// 改的是美术需求点名的三件事:鹰嘴、叠瓦壳缘、大块玳瑁纹。
//
// 过程中翻掉的三版,教训都写在下面对应的位置:
//   · 把壳缩小、头放大 → 读成蜥蜴。头的大小不能碰。
//   · 每枚甲片涂成一个大楔子 + 满高的深竖线 → 读成木桶。
//   · 程序化甩火焰纹,一片三道 → 读成瓦楞纸。
// **88px 宽的壳只放得下 4 枚甲片、8 块斑。这个尺寸上手摆比生成器准。**
const setPx = (mask, x, y, col) => mask.set(String(x) + ',' + String(y), col)
const fillSpans = (map, rows, col) => {
  for (const [y, x0, x1] of rows) for (let x = x0; x <= x1; x++) setPx(map, x, y, col)
}

// ---- 背甲 ----------------------------------------------------------------
const SHELL = [
  [12, 30, 44], [13, 24, 52], [14, 20, 57], [15, 17, 60], [16, 14, 63],
  [17, 13, 64], [18, 11, 66], [19, 10, 67], [20, 10, 68], [21, 9, 69],
  [22, 9, 69], [23, 9, 70], [24, 9, 70], [25, 9, 70], [26, 9, 70],
  [27, 10, 69], [28, 10, 69], [29, 11, 68], [30, 11, 67], [31, 12, 66],
  [32, 13, 64], [33, 15, 63],
]
// 腹甲:侧面看得见的那条奶白边
const PLASTRON = [[34, 17, 62], [35, 18, 62], [36, 19, 61], [37, 21, 59]]

// 肋盾的分界。**只有三道**,把壳分成 4 枚 —— 六道就成桶箍了
const SEAMS = [24, 39, 54]

// 玳瑁纹:手摆的 8 块斑。[起点x, 顶y, 宽, 高, 色]
// 大的四块一枚甲片一块,压在甲片的后上角;小的四块错开摆在下半,免得排成一行
// 玳瑁纹**手写行段,四块形状各不相同**。
// 程序生成的楔子(等宽、等高、同角度)在 88px 上会排成一行小树 —— 试过两版都这样。
// 真玳瑁的花是不规则的:有的一大团,有的碎成两半,有的斜挂在甲片边上
const BLOTCH_DARK = [
  // 第一枚甲片:一大团,偏后
  [18, 13, 18], [19, 12, 19], [20, 12, 20], [21, 13, 20], [22, 14, 19],
  [23, 15, 18], [24, 16, 18], [25, 17, 19], [26, 18, 20],
  // 第二枚:窄长条,斜着挂下来
  [16, 29, 33], [17, 28, 34], [18, 28, 33], [19, 29, 33], [20, 30, 34],
  [21, 31, 35], [22, 32, 35], [23, 33, 36],
  // 第三枚:碎成上下两半
  [17, 45, 50], [18, 44, 50], [19, 45, 49],
  [23, 44, 48], [24, 43, 49], [25, 44, 50], [26, 45, 49],
  // 第四枚:贴着前缘的一块
  [19, 59, 64], [20, 58, 65], [21, 58, 64], [22, 59, 63], [23, 60, 63], [24, 61, 64],
]
const BLOTCH_BROWN = [
  [24, 21, 25], [25, 20, 24], [26, 21, 24],
  [27, 32, 37], [28, 33, 36],
  [20, 52, 56], [21, 52, 55],
  [26, 57, 60], [27, 58, 61],
  [15, 36, 40], [16, 37, 41],
]

// ---- 头 + 鹰嘴 ------------------------------------------------------------
// **这一段是逐行的 x 坐标表,不是凭手感画的行段。** 前面翻了好几版才明白:
// 在 88px 上,「钩」不是靠把轮廓画尖画出来的,靠的是**最靠前的那一点在哪一行**。
//   · 前几版最远点都落在头的中线上 → 读出来是鸟喙、是蜥蜴吻
//   · 有一版前缘从 y22 到 y29 一路平在 x=87 → 8 行高的一堵墙,怎么调色都是钝头
// 现在:头占 y16–31(中线 23.5),最远点 x=87 **只出现在 y28 一行**,在中线以下 4 行。
// 上面从 y19 起缓慢前伸(脸),y24 之后陡然前冲(喙),y29 之后迅速收回(下颌)。
const HEAD_Y0 = 16
// 后缘:钻进壳里那一侧。要和背甲有重叠,不然头会浮在壳外面
const HEAD_BACK = [62, 61, 60, 59, 59, 59, 59, 59, 60, 60, 61, 62, 63, 64, 65, 67]
// 前缘:脸 → 喙 → 下颌收回。峰值 87 只此一行
// **尖端必须留出描边的地盘。** 上一版尖端顶到 x=87(画框最后一列),
// 描边画不出去、全堆在那一列,量出来前缘从 y26 到 y30 平了 5 行 —— 看着像钝头,
// 其实轮廓是对的,是被画框裁的。整个头回撤 2px,尖端落在 85
const HEAD_FRONT = [69, 71, 73, 75, 76, 77, 78, 79, 81, 82, 83, 84, 85, 84, 81, 77]
// 角质喙的起点(蜡膜线):从 (78,21) 往前下方斜下去。这条线以前是角质,以后是脸皮
// 蜡膜线:脸和角质的分界。线**要往后拉够**,角质才铺得满整个喙楔 ——
// 只沿前缘描一条边的话,喙读成脸前面挂了道浅色高光
const BEAK_FROM = { 21: 74, 22: 74, 23: 75, 24: 75, 25: 76, 26: 77, 27: 78, 28: 79, 29: 80, 30: 81 }
// 嘴缝:从嘴角一路往前下,**停在钩根 (83,28)**。画到尖端就没有钩了,那是把嘴画开了
const MOUTH = [[68, 25], [69, 25], [70, 25], [71, 26], [72, 26], [73, 26], [74, 26],
  [75, 27], [76, 27], [77, 27], [78, 27], [79, 28], [80, 28], [81, 28]]

// ---- 鳍 ------------------------------------------------------------------
const FLIPPER_F = [
  [32, 57, 64], [33, 56, 66], [34, 54, 67], [35, 52, 67], [36, 51, 68],
  [37, 49, 69], [38, 48, 70], [39, 47, 70], [40, 46, 70], [41, 46, 71],
  [42, 46, 71], [43, 47, 71], [44, 48, 71], [45, 50, 70], [46, 53, 69],
  [47, 57, 66], [48, 61, 63],
]
const FLIPPER_B = [
  [30, 5, 12], [31, 4, 13], [32, 3, 13], [33, 2, 12],
  [34, 2, 11], [35, 3, 10], [36, 4, 9], [37, 6, 8],
]

function createCharacter() {
  const mask = new Map()
  const parts = { flipperF: new Map(), flipperB: new Map() }
  const has = (x, y) => mask.has(`${x},${y}`)
  const paint = (x, y, col) => { if (has(x, y)) setPx(mask, x, y, col) }

  // 1) 壳的底色,再逐列量出上下缘 —— 花纹要按「这一列在壳的第几分深」上色,
  //    光有行段算不出深度
  fillSpans(mask, SHELL, C.shellAmber)
  const cols = new Map()
  for (const [y, x0, x1] of SHELL) {
    for (let x = x0; x <= x1; x++) {
      const c = cols.get(x) ?? [99, -1]
      cols.set(x, [Math.min(c[0], y), Math.max(c[1], y)])
    }
  }

  // 2) 叠瓦:每枚甲片的前半截比后半截高一格,交界处掉一格 —— 顶缘是一排台阶,
  //    不是一道光滑的弧。这就是 imbricate 在侧影上的样子
  // **只在接缝处抬两格。** 把整枚甲片的前半截都抬高,顶缘会排成一圈均匀的花冠
  // (上一版就是,读出来像顶皇冠);只在交界抬一小段,才是「后面那片压在前面那片下面」
  for (const sx of SEAMS) {
    for (const x of [sx, sx + 1]) {
      const ext = cols.get(x)
      if (!ext) continue
      setPx(mask, x, ext[0] - 1, C.shellAmber)
      cols.set(x, [ext[0] - 1, ext[1]])
    }
  }

  // 3) 锯齿。她朝右,所以后缘在画面左侧:那一段每隔几行往里咬一格。
  //    下缘的后半段同样咬 —— 玳瑁的后缘甲片确实像一排锯齿
  for (const [y, x0] of SHELL.map((r) => [r[0], r[1]])) {
    if (y % 4 >= 2) continue
    mask.delete(`${x0},${y}`)
    mask.delete(`${x0 + 1},${y}`)
  }
  for (let x = 9; x <= 36; x++) {
    if ((36 - x) % 5 >= 2) continue
    const ext = cols.get(x)
    if (ext) mask.delete(`${x},${ext[1]}`)
  }

  // 4) 分层上色:顶上一条椎盾受光,底下一圈缘盾压深,中间留给肋盾。
  //    按 depth 算而不是按固定 y —— 壳是弧的,固定 y 会切歪
  for (const [x, ext] of cols) {
    const [top, bot] = ext
    if (bot <= top) continue
    for (let y = top; y <= bot; y++) {
      if (!has(x, y)) continue
      const depth = (y - top) / (bot - top)
      if (depth < 0.18) paint(x, y, C.shellHi)
      else if (depth > 0.84) paint(x, y, C.shellBrown)
    }
    paint(x, top + Math.round((bot - top) * 0.18), C.shellBrown)   // 椎盾/肋盾的分界
  }

  // 5) 甲片接缝。**只穿肋盾那一段**,满高的深竖线会读成桶箍(上一版就是)
  for (const sx of SEAMS) {
    const ext = cols.get(sx)
    if (!ext) continue
    const [top, bot] = ext
    for (let y = top + Math.round((bot - top) * 0.2); y <= top + Math.round((bot - top) * 0.82); y++) {
      paint(sx, y, C.shellBrown)
    }
  }

  // 6) 玳瑁纹:手摆的楔形斑,上宽下窄、略往前倾 —— 真玳瑁的花就是这种从甲片
  //    后上角甩下来的火焰形。只压在琥珀底和受光条上,不动缘盾和接缝
  for (const [rows, col] of [[BLOTCH_DARK, C.shellDark], [BLOTCH_BROWN, C.shellBrown]]) {
    for (const [y, x0, x1] of rows) {
      for (let x = x0; x <= x1; x++) {
        const cur = mask.get(`${x},${y}`)
        if (cur === C.shellAmber || cur === C.shellHi) setPx(mask, x, y, col)
      }
    }
  }

  // 7) 腹甲、脖子、头、喙。顺序要紧:脖子先铺,头压上去,鹰嘴最后 —— 钩才盖得住下颌
  fillSpans(mask, PLASTRON, C.belly)
  for (let x = 21; x <= 59; x++) paint(x, 37, C.skinShade)   // 腹甲底影,免得整条跳成白带
  for (const x of [31, 32, 45, 46, 57, 58]) paint(x, 35, C.seam)
  for (let i = 0; i < HEAD_FRONT.length; i++) {
    const y = HEAD_Y0 + i
    for (let x = HEAD_BACK[i]; x <= HEAD_FRONT[i]; x++) {
      setPx(mask, x, y, x >= (BEAK_FROM[y] ?? 999) ? C.horn : C.bodySkin)
    }
  }
  fillSpans(parts.flipperF, FLIPPER_F, C.bodySkin)
  fillSpans(parts.flipperB, FLIPPER_B, C.bodySkin)

  // 8) 额鳞。玳瑁眼前有**两对**(绿海龟只有一对),侧面看是吻背上一列盾片。
  //    美术需求说这个细节不用抠太细,所以只勾两道轮廓
  for (let x = 64; x <= 70; x++) paint(x, 18, C.shellBrown)
  for (let x = 70; x <= 75; x++) paint(x, 20, C.shellBrown)
  for (const [x, y] of [[69, 17], [70, 18], [71, 19]]) paint(x, y, C.seam)

  // 9) 眼。圆、大、上眼睑压一行 —— 设定是「慢,长句,讲故事的人」,
  //    不压眼皮读出来是受惊,不是从容。锚点 eye 取瞳孔中心
  for (let x = 61; x <= 68; x++) for (let y = 19; y <= 23; y++) paint(x, y, C.skinLight)
  for (const [y, x0, x1] of [[20, 64, 67], [21, 63, 68], [22, 63, 68], [23, 64, 67]]) {
    for (let x = x0; x <= x1; x++) paint(x, y, C.eye)
  }
  paint(64, 21, C.white)
  for (let x = 63; x <= 68; x++) paint(x, 19, C.shellDark)

  // 10) 嘴缝。**缝以前、以下那一小块角质就是「上颌盖过下颌」** —— 鹰嘴的定义。
  //     加一道蜡膜线(脸和角质的分界),两道线夹出来的那块楔子才读得出是喙
  for (const [x, y] of MOUTH) paint(x, y, C.shellDark)
  for (const [y, x] of Object.entries(BEAK_FROM)) paint(Number(x) - 1, Number(y), C.shellBrown)
  for (const [x, y] of [[79, 24], [80, 25]]) paint(x, y, C.ink)          // 鼻孔
  for (const [x, y] of [[85, 28], [84, 29], [83, 29]]) paint(x, y, C.shellBrown)   // 钩尖前下缘

  // 11) 皮肤的明暗和颈鳞。海龟的颈皮是一圈圈叠起来的,这几道横纹是「龟」的
  //     第二个信号,仅次于壳 —— 少了它,一段光滑的脖子读出来像蛇
  // **只压最底两行,而且不进喙。** 把下半张脸整片压暗读出来是一脸胡子(上一版就是)
  for (let i = HEAD_FRONT.length - 3; i < HEAD_FRONT.length; i++) {
    const y = HEAD_Y0 + i
    for (let x = HEAD_BACK[i]; x <= HEAD_FRONT[i]; x++) {
      if ((BEAK_FROM[y] ?? 999) <= x) continue
      if (mask.get(`${x},${y}`) === C.bodySkin) setPx(mask, x, y, C.skinShade)
    }
  }
  // 颈鳞:两道**连起来的**短横纹。散点会读成脏,不是鳞片 —— 头像那一轮已经栽过一次
  for (let x = 60; x <= 66; x++) paint(x, 27, C.skinShade)
  for (let x = 62; x <= 67; x++) paint(x, 29, C.skinShade)

  // 12) 鳍上的骨线、后缘暗面和爪。少了这些前鳍就是一团没细节的肉色,读不出是桨
  for (const [x, y] of [[55, 34], [57, 35], [59, 36], [61, 37], [63, 38], [65, 39], [67, 40]]) {
    if (parts.flipperF.has(`${x},${y}`)) parts.flipperF.set(`${x},${y}`, C.seam)
  }
  for (const [y, x0, x1] of [[44, 50, 69], [45, 53, 68], [46, 56, 67]]) {
    for (let x = x0; x <= x1; x++) if (parts.flipperF.has(`${x},${y}`)) parts.flipperF.set(`${x},${y}`, C.skinShade)
  }
  parts.flipperF.set('70,40', C.ink)   // 前缘的爪
  parts.flipperF.set('70,41', C.ink)
  for (const [y, x0, x1] of [[35, 4, 9], [36, 5, 8]]) {
    for (let x = x0; x <= x1; x++) if (parts.flipperB.has(`${x},${y}`)) parts.flipperB.set(`${x},${y}`, C.skinShade)
  }

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
const P = C

// 头:圆钝的蛋,含下颌。只占画面左上角三分之一 —— 剩下的留给壳
const P_HEAD = [
  [8, 13, 23], [9, 11, 25], [10, 9, 27], [11, 8, 28], [12, 7, 28],
  [13, 6, 29], [14, 5, 29], [15, 5, 29], [16, 5, 29], [17, 5, 29],
  [18, 6, 28], [19, 7, 28], [20, 9, 27], [21, 12, 27], [22, 16, 26],
]

// 上颌。**和精灵那边犯过同一个错,一起修的**:
//   ① 尖端原来顶到 x=0(画框第一列),描边画不出去,量出来前缘从 y14 到 y19
//      平了 6 行 —— 看着是钝头,其实是被画框裁的。整条喙回撤 3px。
//   ② 最靠前的那一点原来落在头的中线上 → 读成「尖」。现在落在 y19–20,
//      头占 y7–30、中线 18.5,所以在中线**以下** → 才读得出是「钩」。
const P_BEAK = [
  [12, 10, 13], [13, 9, 13], [14, 8, 13], [15, 7, 13], [16, 6, 13],
  [17, 5, 13], [18, 4, 12], [19, 3, 12], [20, 2, 12], [21, 2, 11], [22, 4, 16],
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
  // 缝停在 (4,19),钩尖露在它的前下方 —— 那两行就是「上颌盖过下颌」
  for (const [x, y] of [[4, 19], [5, 19], [6, 18], [7, 18], [8, 18],
    [9, 17], [10, 17], [11, 17], [12, 17], [13, 17]]) shade(x, y, P.shellDark)
  shade(6, 16, P.ink)          // 鼻孔
  shadeBand([[21, 2, 7], [22, 4, 9]], P.shellBrown)   // 钩的下缘,压出角质厚度
  shadeBand([[21, 12, 19], [22, 14, 21], [23, 17, 23]], P.skinShade)   // 下颌背光

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
// 「慢,长句,讲故事的人」—— 动作要比绿绿更迟缓从容。idle 的起伏压到 1px
// (身体几乎不动,只有鳍轻轻摆),swim 的划水行程反而加大:一桨划得远、次数少,
// 才是大型海龟的划法;划得碎会显得灵活敏捷,正是美术需求里不要的那种
const SHEETS = {
  idle: { frames: 4, opts: (i) => ({ dy: [0, 0, -1, 0][i], partDY: { flipperF: [0, -1, -1, 0][i], flipperB: [0, 0, 1, 1][i] } }) },
  swim: { frames: 6, opts: (i) => ({ dy: [0, -1, -1, 0, 1, 0][i], partDY: { flipperF: [2, -2, -6, -4, 1, 3][i], flipperB: [-1, 0, 1, 1, 0, -1][i] } }) },
  talk: { frames: 4, opts: (i) => ({ dy: 0, headDropK: [0, -0.04, 0, 0.04][i] }) },
}

// 点头的支点。**必须落在壳的前缘之外**(壳最远到 x=70):支点再往后,
// headDropK 会连壳的前几列一起剪切,说话时壳的轮廓上会冒出一个 1px 的台阶。
// 露在壳外面的头大致从 x=68 起,支点就放这儿
const HEAD_X = 68

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
