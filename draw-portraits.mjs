// 邻居的对话框头像。48×48,透明底,和各自的精灵共用同一套颜色。
//
// **为什么单开一个文件**:五位的生成器彼此结构不一(draw-dolly.mjs 的画布尺寸
// 和 npc.json 里的精灵规格对不上,小丑鱼一家压根没有生成器),挨个改风险大而且
// 改完还是五套写法。头像是一类独立的素材,放一处、一条命令出齐。
// **例外:阿玳的头像在 draw-ada.mjs 里**,因为它和她的精灵共用同一份调色板;
// 那张先做的,已经定稿,不动它。改阿玳的头像去 draw-ada.mjs 找。
//
// 画之前先读一遍阿玳那一轮踩出来的规矩(详见 ROADMAP「追加(2026-09-11)」):
//   ① **一律侧面、一律朝左。** 物种特征多半是侧面特征(喙、吻、鳍);朝左是让
//      他们看向左边的台词区 —— 星露谷的头像在右、人物看向画面内。
//   ② **最前端不许贴到画框那一列。** 1px 墨色描边画不出画框会全堆在最后一列,
//      量出来前缘平好几行,看着是钝头,其实轮廓是对的。一律留 2px。
//   ③ **「尖」还是「钩」,看最远点落在头的中线上还是中线以下。** 这条对阿玳(要钩)
//      和绿绿(要钝)是反着用的 —— 两只龟站在同一片海里,靠这个分得开。
//   ④ **48px 上散点读成脏,不是鳞片/斑点。** 要花纹就用连起来的线或大色块。
//   ⑤ 每张 ≤16 色(宪法二十一·5 放宽后的上限是 32,这里仍然克制)。
import fs from 'node:fs'
import zlib from 'node:zlib'

const PW = 48
const PH = 48
const OUT = 'public/assets/npc'

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255]
const CLEAR = [0, 0, 0, 0]

// ---- 画布 -----------------------------------------------------------------
function canvas() {
  const g = Array.from({ length: PH }, () => new Array(PW).fill(CLEAR))
  const inb = (x, y) => x >= 0 && x < PW && y >= 0 && y < PH
  const put = (x, y, col) => { if (inb(x, y)) g[y][x] = col }
  // band:铺(会撑出新形状) / shade:只在已有像素上改色(不撑破轮廓)
  const band = (rows, col) => { for (const [y, x0, x1] of rows) for (let x = x0; x <= x1; x++) put(x, y, col) }
  const shade = (rows, col) => {
    for (const [y, x0, x1] of rows) for (let x = x0; x <= x1; x++) if (inb(x, y) && g[y][x] !== CLEAR) put(x, y, col)
  }
  const dot = (pts, col) => { for (const [x, y] of pts) if (inb(x, y) && g[y][x] !== CLEAR) put(x, y, col) }
  // 描边:silhouette 外一圈墨色,和所有精灵同一道工序
  const outline = (ink) => {
    const solid = []
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) if (g[y][x] !== CLEAR) solid.push([x, y])
    for (const [x, y] of solid) {
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (inb(x + ox, y + oy) && g[y + oy][x + ox] === CLEAR) g[y + oy][x + ox] = ink
      }
    }
  }
  return { g, put, band, shade, dot, outline }
}

// 椭球穹顶,用来画龟壳/贝壳。极坐标算半径,teeth>0 时半径按角度加一道锯齿
function dome(c, { cx, cy, ax, ay, teeth = 0, tooth = 0, paint }) {
  for (let y = 0; y < PH; y++) {
    for (let x = 0; x < PW; x++) {
      const dx = (x - cx) / ax
      const dy = (y - cy) / ay
      const d = Math.hypot(dx, dy)
      let edge = 1
      let saw = 1
      if (teeth) {
        const t = (Math.atan2(dy, dx) * teeth) / (2 * Math.PI)
        saw = Math.abs(t - Math.round(t)) * 2
        edge = 1 - tooth * (1 - saw)
      }
      if (d > edge) continue
      const col = paint(x, y, d / edge, saw)
      if (col) c.put(x, y, col)
    }
  }
}

// ---- 五位邻居 --------------------------------------------------------------

// Dolly(旋转海豚)。物种特征是**又长又细的吻**和背/侧/腹三段分色。
// 性格「快、跳、坐不住」—— 眼睛睁大,嘴角那条线往上扬
function dolly() {
  const C = {
    ink: hex('#243642'), back: hex('#50646e'), flank: hex('#8ca0aa'),
    belly: hex('#dce6eb'), eye: hex('#000000'), white: hex('#ffffff'),
  }
  const c = canvas()
  // 身体:额隆(圆鼓的前额)在左上,身子往右下铺满
  c.band([
    [7, 31, 41], [8, 28, 47], [9, 25, 47], [10, 23, 47], [11, 21, 47],
    [12, 20, 47], [13, 19, 47], [14, 18, 47], [15, 17, 47], [16, 16, 47],
    [17, 16, 47], [18, 15, 47], [19, 15, 47], [20, 15, 47], [21, 15, 47],
    [22, 15, 47], [23, 16, 47], [24, 17, 47], [25, 18, 47], [26, 20, 47],
    [27, 22, 47], [28, 24, 47], [29, 26, 47], [30, 28, 47],
  ], C.flank)
  // 吻:又长又细,尖端在 (4,26)。海豚的吻是直的不是钩的,所以最远点就落在它自己的中线上
  c.band([
    [23, 12, 20], [24, 8, 20], [25, 5, 20], [26, 4, 20], [27, 5, 20], [28, 9, 22],
  ], C.flank)
  // 背鳍:右上角一把镰刀
  c.band([[2, 36, 40], [3, 34, 42], [4, 33, 44], [5, 32, 47], [6, 32, 47]], C.back)
  // 胸鳍 + 躯干下半。**右边一路铺到画框** —— 上一版停在 x=45,
  // 右缘切出一条笔直的竖边,读出来像她躲在一堵墙后面
  c.band([
    [31, 24, 47], [32, 22, 47], [33, 20, 47], [34, 18, 47], [35, 16, 47],
    [36, 15, 47], [37, 14, 47], [38, 14, 47], [39, 14, 47], [40, 15, 47],
    [41, 17, 47], [42, 19, 47], [43, 22, 47], [44, 25, 47], [45, 29, 47],
    [46, 33, 47], [47, 38, 47],
  ], C.flank)

  // 三段分色。海豚的背深、腹白,中间一条浅灰 —— 旋转海豚这条三段特别分明
  c.shade([
    [7, 31, 47], [8, 28, 47], [9, 25, 47], [10, 23, 47], [11, 21, 47],
    [12, 20, 47], [13, 19, 47], [14, 20, 47], [15, 22, 47], [16, 25, 47],
    [17, 29, 47], [18, 33, 47], [19, 38, 47],
  ], C.back)
  c.shade([
    [30, 28, 47], [31, 26, 47], [32, 24, 47], [33, 22, 47], [34, 20, 47],
    [35, 18, 47], [36, 16, 47], [37, 15, 47], [38, 14, 47], [39, 14, 47],
    [40, 15, 47], [41, 17, 47], [42, 19, 47], [43, 22, 47], [44, 25, 47],
    [45, 29, 47], [46, 33, 47], [47, 38, 47],
  ], C.belly)

  // 眼。海豚的眼小、圆、位置靠吻根后上方
  c.shade([[19, 20, 23], [20, 19, 23], [21, 19, 23], [22, 20, 23]], C.eye)
  c.dot([[20, 20]], C.white)
  // 嘴缝:从吻尖一路往后,末端**往上扬** —— 海豚那张笑脸全靠这一扬
  c.dot([[5, 27], [6, 27], [7, 27], [8, 27], [9, 27], [10, 27], [11, 27],
    [12, 27], [13, 27], [14, 26], [15, 26], [16, 26], [17, 25], [18, 25]], C.ink)
  c.outline(C.ink)
  return c.g
}

// 绿绿(绿海龟)。**这张的任务是「和阿玳分得开」** —— 两只龟站在同一片海里,
// 童童要能一眼认出谁是谁。四条差别,条条和阿玳反着来:
//   · 喙圆钝 —— 最远点落在头的中线上(阿玳落在中线**以下**,那才是钩)
//   · 壳光滑连片 —— 大块平接的甲片,不咬锯齿、不做叠瓦台阶(阿玳两样都有)
//   · 通体橄榄绿、花纹低对比(阿玳是琥珀/棕/黑高对比的玳瑁纹)
//   · 额鳞**一对**(阿玳两对)
function lvlv() {
  const C = {
    ink: hex('#243642'), shell: hex('#6f8c4a'), shellHi: hex('#a3bc6e'),
    shellDark: hex('#4c6533'), shellDeep: hex('#3b4f28'),
    skin: hex('#b9a87a'), skinLight: hex('#d2c094'), skinShade: hex('#8a7a55'),
    belly: hex('#efe2be'), eye: hex('#1a1210'), white: hex('#ffffff'),
  }
  const c = canvas()
  // 壳:光滑穹顶,**teeth=0** —— 一颗锯齿都不给。
  // 甲片靠几道**连起来的**接缝分出来(上一版用虚点,48px 上读成噪点)
  dome(c, {
    cx: 30, cy: 56, ax: 33, ay: 31,
    paint: (x, y, d) => {
      // 接缝:一条沿穹顶走的环缝 + 几道竖缝,分出大块平接的甲片
      const ang = Math.atan2((y - 56) / 31, (x - 30) / 33)
      const t = ((ang * 5) / Math.PI) % 1
      if (Math.abs(d - 0.62) < 0.035) return C.shellDeep
      if (Math.abs(t - Math.round(t)) < 0.035 && d > 0.3) return C.shellDeep
      if (d > 0.9) return C.shellDark
      if (d < 0.45) return C.shellHi
      return C.shell
    },
  })
  // 花纹:低对比的橄榄色块,每片甲上一块。不是阿玳那种高对比大斑
  c.shade([[40, 7, 13], [41, 6, 14], [42, 7, 13],
    [36, 20, 27], [37, 19, 28], [38, 20, 26],
    [42, 33, 39], [43, 32, 40], [44, 33, 38]], C.shellDark)

  // 前鳍:左下角一片桨,带两道鳍骨
  c.band([[33, 5, 10], [34, 3, 12], [35, 1, 14], [36, 0, 15], [37, 0, 16],
    [38, 0, 16], [39, 0, 15], [40, 1, 14], [41, 2, 13], [42, 4, 12]], C.skin)
  c.dot([[5, 35], [7, 36], [9, 37], [11, 38], [4, 39], [6, 40]], C.skinShade)
  // 脖子
  c.band([[22, 22, 31], [23, 21, 32], [24, 21, 33], [25, 21, 34], [26, 22, 35],
    [27, 22, 35], [28, 23, 36], [29, 23, 36]], C.skin)
  // 头:圆钝的蛋,比阿玳那颗小一圈也圆一圈。
  // 前缘最远点在 y15–16,而头占 y9–24、中线 16.5 —— **正落在中线上,所以是钝不是钩**
  c.band([
    [9, 17, 27], [10, 14, 30], [11, 12, 31], [12, 11, 32], [13, 10, 33],
    [14, 9, 33], [15, 9, 33], [16, 9, 33], [17, 10, 33], [18, 11, 32],
    [19, 12, 31], [20, 13, 30], [21, 15, 29], [22, 18, 28], [23, 21, 27],
  ], C.skin)
  // 喙:圆钝的一小块角质,前缘一道浅边把它勾出来
  c.shade([[13, 10, 13], [14, 9, 13], [15, 9, 13], [16, 9, 13], [17, 10, 13]], C.belly)
  c.dot([[10, 13], [9, 14], [9, 15], [9, 16], [10, 17]], C.skinShade)
  // 额鳞**一对**(玳瑁是两对):吻背上一块,就一块
  c.shade([[11, 14, 20]], C.skinShade)
  // 眼
  c.shade([[12, 16, 19], [13, 15, 20], [14, 15, 20], [15, 16, 19]], C.eye)
  c.dot([[16, 13]], C.white)
  c.shade([[11, 21, 27], [12, 22, 28]], C.skinLight)
  // 嘴缝:圆钝的喙配一条几乎平的缝,**不往下钩**
  c.dot([[10, 16], [11, 16], [12, 16], [13, 16], [14, 16], [15, 16]], C.skinShade)
  // 颈皮的横纹:两道连起来的线
  c.shade([[25, 24, 33], [28, 26, 35]], C.skinShade)
  c.outline(C.ink)
  return c.g
}

// 小金(幼年金鲹)。辨识度全在**鲜黄底 + 粗竖黑条**。
// 上一版画了四条细的,读成一只蜜蜂 —— 真幼年金鲹是**少而粗**的几道。
// 性格「黏人、模仿」:眼睛画大,嘴微张像正要跟着说
function xiaojin() {
  const C = {
    ink: hex('#243642'), body: hex('#f2c33c'), bar: hex('#3a3128'),
    hi: hex('#fbe79a'), pale: hex('#f7de93'), gold: hex('#d9b85c'),
    deep: hex('#c7961f'), eye: hex('#1a1210'), white: hex('#ffffff'),
  }
  const c = canvas()
  // 身子:头大、身子往后收的卵形。头占画面左半 —— 头像看的是脸不是全身
  // 前段高、后段收 —— 鱼是纺锤不是球。上一版前后一样高,加上竖条读成蜜蜂
  c.band([
    [11, 18, 30], [12, 15, 35], [13, 12, 39], [14, 10, 42], [15, 8, 44],
    [16, 7, 45], [17, 6, 46], [18, 5, 46], [19, 5, 47], [20, 4, 47],
    [21, 4, 47], [22, 4, 47], [23, 4, 47], [24, 5, 47], [25, 5, 46],
    [26, 6, 46], [27, 8, 45], [28, 10, 44], [29, 13, 43], [30, 16, 41],
    [31, 20, 39], [32, 25, 37], [33, 30, 35],
  ], C.body)
  // 背鳍 / 臀鳍
  c.band([[6, 24, 33], [7, 22, 36], [8, 21, 38], [9, 20, 40], [10, 19, 41]], C.deep)
  c.band([[34, 24, 34], [35, 26, 32]], C.deep)
  // 受光/背光:上亮下暗,鱼身的体积全靠这两条
  c.shade([[12, 18, 36], [13, 15, 40], [14, 13, 42], [15, 12, 38]], C.hi)
  c.shade([[28, 12, 44], [29, 14, 44], [30, 17, 42], [31, 20, 40]], C.gold)
  // **三道粗竖条**。少而粗才是幼年金鲹;四道细的读成蜜蜂
  for (const bx of [20, 29, 38]) {
    for (let y = 8; y <= 36; y++) {
      c.shade([[y, bx + Math.round((y - 22) * 0.12), bx + 3 + Math.round((y - 22) * 0.12)]], C.bar)
    }
  }
  // 眼:大。这是「黏人」的全部表情
  c.shade([[17, 7, 13], [18, 6, 14], [19, 6, 14], [20, 6, 14], [21, 7, 13]], C.pale)
  c.shade([[18, 8, 12], [19, 7, 13], [20, 7, 13], [21, 8, 12]], C.eye)
  c.dot([[9, 19]], C.white)
  // 嘴:微张
  c.dot([[4, 23], [5, 23], [4, 24], [5, 25], [6, 25]], C.ink)
  c.outline(C.ink)
  return c.g
}

// 砗磲奶奶(巨砗磲)。**她没有头**,所以头像画的是那张波浪嘴和中间那层珠光外套膜 ——
// 那层珠光是这个角色唯一的记忆点(S3-2 记过)。
//
// **照她自己的精灵来画。** 我另起炉灶试过三版:等距粗竖条 → 竹篮;波浪外缘 + 粗肋 → 一块烤饼。
// 她的精灵其实已经解决过这个问题 —— 光滑的穹顶轮廓 + 从铰合点散开的**细 1px 射线**
// + 中间一条波浪外套膜带。头像只是把那套放大,不该另发明一套。
function giantClam() {
  const C = {
    ink: hex('#243642'), shell: hex('#e3d3b0'), shellMid: hex('#bfa98a'),
    shellHi: hex('#f6eeda'), shellShade: hex('#9a855f'), mantle: hex('#1d4e63'),
    blue: hex('#2e6fb0'), cyan: hex('#7be3d2'), purple: hex('#7a5aa8'),
    teal: hex('#2fa89e'), green: hex('#8fae60'),
  }
  const c = canvas()
  const CX = 24
  const HINGE = [24, 1]        // 铰合部在顶上,射线从这儿散开
  const wave = (x) => 2.2 * Math.sin(((x - 24) / 9) * Math.PI)

  for (let x = 0; x < PW; x++) {
    const k = Math.sqrt(Math.max(0, 1 - ((x - CX) / 24.2) ** 2))
    if (k <= 0) continue
    const top = Math.round(24 - 22.5 * k)
    const bot = Math.round(24 + 21 * k)
    // 两片壳的唇。**反相**:上唇往下咬时下唇往上让,缝一宽一窄。
    // 基准隔 6、振幅 2.2 → 缝在 1.6..10.4 之间,**永远不合拢** ——
    // 合拢过就会把外套膜切成一颗颗菱形,读成壳上镶了几块蓝玻璃(前几版都栽在这儿)
    const lipTop = Math.round(24 - 3 + wave(x))
    const lipBot = Math.round(24 + 3 - wave(x))

    for (let y = top; y <= lipTop; y++) {
      const t = (y - top) / Math.max(1, lipTop - top)
      c.put(x, y, t < 0.3 ? C.shellHi : t > 0.88 ? C.shellMid : C.shell)
    }
    // 下壳比上壳暗一档(背光面),精灵那边也是这么分的
    for (let y = lipBot; y <= bot; y++) {
      const t = (y - lipBot) / Math.max(1, bot - lipBot)
      c.put(x, y, t < 0.12 ? C.shellShade : t > 0.55 ? C.shellMid : C.shell)
    }
    // 外套膜:按「离缝中线多远」分三层,不撒点 —— 撒点在 48px 上读成噪点
    const mid = (lipTop + lipBot) / 2
    for (let y = lipTop + 1; y < lipBot; y++) {
      const r = Math.abs(y - mid) / Math.max(0.6, (lipBot - lipTop) / 2)
      c.put(x, y, r > 0.72 ? C.mantle : r > 0.4 ? C.blue : C.teal)
    }
  }

  // 放射射线:**1px 细线**,从铰合点按角度散开。粗到 2px 就成了木板条
  for (let y = 0; y < PH; y++) {
    for (let x = 0; x < PW; x++) {
      const cur = c.g[y][x]
      if (cur !== C.shell && cur !== C.shellHi) continue
      const a = Math.atan2(y - HINGE[1], x - HINGE[0])
      const f = ((a * 11) / Math.PI) % 1
      if (Math.abs(f - Math.round(f)) < 0.07) c.put(x, y, C.shellMid)
    }
  }
  // 缝中线上一条连起来的高光带,珠光靠它才闪
  for (let x = 2; x <= 45; x++) c.dot([[x, 24]], C.cyan)
  for (let x = 7; x <= 41; x += 7) c.dot([[x, 23], [x + 2, 25]], C.purple)
  // 壳上附生的一点绿藻 —— 她是这片海最年长的,壳上长东西才对
  c.dot([[31, 10], [32, 10], [33, 11], [13, 34], [14, 35]], C.green)
  c.outline(C.ink)
  return c.g
}

// 小丑鱼一家(红海双带小丑鱼)。**是「一家」不是「一只」** —— 三条,一大两小。
// 性格「很吵」,三张嘴都张着。
// 上一版白带画到 5px 宽,整条鱼被切成三段,读成斑马;真小丑鱼的带比身子窄得多
function clownfishFamily() {
  const C = {
    ink: hex('#243642'), deep: hex('#141923'), body: hex('#872d19'),
    mid: hex('#c34b23'), bright: hex('#e66e32'), white: hex('#f0f5fa'),
    grey: hex('#becdd7'), eyeHi: hex('#ffffff'),
  }
  const c = canvas()
  // 一条鱼。朝左,两道窄白带。**每条先铺一圈自己的深色边**,
  // 否则三条叠在一起会被统一描边糊成一团(上一版就是)
  const fish = (cx, cy, rx, ry, base) => {
    // **一条鱼不是一个椭圆。** 只画椭圆的话三条读出来是「三颗橙色药丸」(上一版就是)。
    // 身子 + 尾鳍 + 背鳍 + 臀鳍,四样凑齐才有鱼的剪影
    const inFish = (x, y) => {
      const u = (x - cx) / rx
      const v = (y - cy) / ry
      if (u * u + v * v <= 1) return true
      // 尾鳍:身后一把叉,越往后越张开
      if (u > 0.86 && u < 1.5) {
        const spread = 0.25 + (u - 0.86) * 2.2
        if (Math.abs(v) < spread && Math.abs(v) > (u - 0.86) * 0.5) return true
      }
      // 背鳍 / 臀鳍:身子上下各一道低矮的弧
      if (u > -0.45 && u < 0.55) {
        const h = 1 + 0.3 * Math.cos(u * 2.4)
        if (v < 0 && v > -h) return true
        if (v > 0 && v < h * 0.82) return true
      }
      return false
    }
    // 自己那一圈边**只要 1px**。按「归一化半径落在某个区间」去铺的话,
    // 椭圆长轴方向会胖出好几格 —— 三条鱼各顶一圈厚黑边,读出来是三个黑团
    for (let y = cy - ry * 2 - 2; y <= cy + ry * 2 + 2; y++) {
      for (let x = cx - rx - 2; x <= cx + rx * 2 + 2; x++) {
        if (inFish(x, y)) continue
        if (inFish(x - 1, y) || inFish(x + 1, y) || inFish(x, y - 1) || inFish(x, y + 1)) c.put(x, y, C.ink)
      }
    }
    for (let y = cy - ry * 2 - 2; y <= cy + ry * 2 + 2; y++) {
      for (let x = cx - rx - 2; x <= cx + rx * 2 + 2; x++) {
        if (!inFish(x, y)) continue
        const u = (x - cx) / rx
        const v = (y - cy) / ry
        const t = (u + 1) / 2                     // 0 在吻端,1 在尾根
        let col = base
        if (u * u + v * v > 1) col = C.body       // 鳍比身子暗一档
        else if (v < -0.72) col = C.deep          // 背线只压最上面一线
        else if (v > 0.5) col = C.body            // 腹侧压一档
        if (u * u + v * v <= 1 && v > -0.55 && v < 0.35 && t > 0.08 && t < 0.9) col = C.bright
        // 双带:窄。两侧各镶一道深边 —— 不镶就成了斑马
        const d1 = Math.abs(t - 0.3)
        const d2 = Math.abs(t - 0.62)
        if (d1 < 0.036 || d2 < 0.036) col = C.white
        else if (d1 < 0.066 || d2 < 0.066) col = C.deep
        c.put(x, y, col)
      }
    }
    // 眼:浅眼圈 + 黑瞳 + 一点高光。没有眼圈的话小丑鱼的脸是一片橙。
    // 眼圈画成方块会像贴了张邮票,所以磨掉四角
    const ex = cx - Math.round(rx * 0.58)
    for (const [dx, dy] of [[0, -2], [1, -2], [-1, -1], [0, -1], [1, -1], [2, -1],
      [-1, 0], [0, 0], [1, 0], [2, 0], [0, 1], [1, 1]]) c.put(ex + dx, cy + dy, C.grey)
    for (const [dx, dy] of [[0, -1], [1, -1], [0, 0], [1, 0]]) c.put(ex + dx, cy + dy, C.deep)
    c.put(ex, cy - 1, C.eyeHi)
    // 张着的嘴
    c.put(cx - rx + 1, cy + 2, C.deep)
    c.put(cx - rx + 2, cy + 3, C.deep)
  }

  // 后面两条先画,前面那条压上去 —— 前后关系靠遮挡
  // 摆成三角:大的在左中,两条小的一上一右下。**加了尾鳍之后要给身后留地方**,
  // 上一版三条挤成一团,尾巴互相插进对方身子里
  fish(30, 11, 8, 5, C.mid)
  fish(34, 40, 6, 4, C.mid)
  fish(16, 27, 11, 7, C.mid)
  c.outline(C.ink)
  return c.g
}


// ---- PNG 输出(和各生成器同一套手写 writer,不装依赖) ------------------------
const crcT = Array.from({ length: 256 }, (_, n) => { let x = n; for (let k = 0; k < 8; k++) x = x & 1 ? 0xedb88320 ^ (x >>> 1) : x >>> 1; return x >>> 0 })
const crc32 = (b) => ~b.reduce((x, v) => crcT[(x ^ v) & 0xff] ^ (x >>> 8), -1) >>> 0
const chunk = (ty, d) => {
  const l = Buffer.alloc(4); l.writeUInt32BE(d.length)
  const body = Buffer.concat([Buffer.from(ty), d])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([l, body, crc])
}
function writePng(path, grid) {
  const h = grid.length
  const w = grid[0].length
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = grid[y][x]
      const i = y * (w * 4 + 1) + 1 + x * 4
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  fs.writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]))
}

const ALL = { dolly, lvlv, xiaojin, giant_clam: giantClam, clownfish_family: clownfishFamily }
for (const [id, build] of Object.entries(ALL)) {
  const dir = `${OUT}/${id}`
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const grid = build()
  writePng(`${dir}/portrait.png`, grid)
  const colors = new Set()
  for (const row of grid) for (const px of row) if (px[3]) colors.add(px.join(','))
  console.log(`wrote ${dir}/portrait.png ${PW}x${PH} ${colors.size}色`)
}
