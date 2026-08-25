// 世界的纯数据:尺寸常量 + 装饰排布表。
//
// DECOR_VARIANTS / SCATTER 是从 Scene.tsx 原样搬过来的,**数值一个都没改**。
// 这是「同一个地点永远长同一个样」的保证 —— 珊瑚换了位置她会发现(REFACTOR_PLAN §2.5)。
//
// 素材是可替换资源:这里只写文件名,渲染层只按路径 drawImage,不许出现任何
// arc/bezier 画生物的代码(CLAUDE.md 五 / 十三)。

export const WORLD_DIR = '/assets/world'

/** 水面线取整数像素:sky.png 就是按这个高度画的,非整数会引起半像素拉伸 */
export const WATER_LINE = 86

/** 金沙海底的高度(sand.png tile 的高度)。参考图沙地约占画面高 15% */
export const SAND_H = 40

/** 水越浑,水下这层的沙色雾越厚 */
export const MAX_HAZE = 0.34

/**
 * 进食 = 拟砂觅食。儒艮吃海草不是浮在水里啃叶子,是**把吻部插进沙里往前犁**,
 * 连根带叶一起挖,身后留下一道浅沟(GDD 里那条「海牛草皮上的犁痕」)。
 * 所以这一套数描述的是「下潜到海草床 → 低头把吻插进沙 → 往前犁一段」。
 */
export const GRAZE = {
  /** 犁沙那一段的起止,按海草床(第一格)的宽度比例取。犁痕要落在海草中间,不是床沿上 */
  fromRatio: 0.3,
  toRatio: 0.7,
  /** 犁沙时的前进速度(逻辑px/秒)。约等于巡游 90 的一半 —— 她在觅食,不是赶路 */
  speed: 48,
  /** 低头角度(弧度,约 11°)。吻插进沙里,身子还接近平的;再大就成了一头扎进去 */
  pitch: 0.2,
  /** 吻部(mouth 锚点)插到沙面以下多少像素。露一点沟就够,不用把头埋了 */
  dig: 3,
  /**
   * 进入 / 退出犁沙姿势的过渡(ms)。**这条不能省**:bob 的幅度是 ±9px,
   * 不做过渡的话低头那一下会啪地弹一下,比不低头还难看
   */
  easeMs: 420,
} as const

/** 犁痕:她犁过之后留在沙面上的一道浅坑 */
export const FURROW = {
  /** 多久淡干净(ms)。原则 6「变化永远可逆」—— 沙会被水抚平,不留永久痕迹 */
  fadeMs: 60000,
  /** 沟槽压暗色 / 下沿反光色。用 rgba 叠在沙纹上,不挑 sand.png 的具体像素 */
  shade: '36, 54, 66',
  rim: '255, 250, 235',
  shadeAlpha: 0.42,
  rimAlpha: 0.4,
  /** 画沟的步长(px)。1px 一格太碎也太费,4px 一格的起伏正好是像素画的颗粒度 */
  step: 4,
  /** 沟槽本体多高(px)。3px 在 480×270 上正好是「一道浅沟」,再厚就成了一条黑带 */
  depth: 3,
  /**
   * 沟沿起伏的**振幅**(px)。第一版用了两个正弦叠加、幅度 ±2,
   * 结果是把一道沟摊平在 5 行里 —— 逐行量出来每行只差 20/765,看着像沙子噪点不像沟。
   * 一道沟就该是一道沟:振幅压到 ±1,周期放长,读起来才是「缓缓起伏的一条」
   */
  wobble: 1,
  /** 起伏的空间频率(弧度/px)。0.05 → 周期约 126px,一屏见得到两个起伏 */
  wobbleFreq: 0.05,
} as const

/** 沙色雾的颜色 = --color-sand */
export const SAND_COLOR = '232, 220, 192'

/** 没开放的地点在世界边缘露出的那团模糊影子 = bg-ink/20 */
export const LOCKED_HINT_COLOR = 'rgba(36, 54, 66, 0.2)'

export interface Decor {
  file: string
  x: number
  lift?: number
  sway?: boolean
}

// 数组顺序就是叠放顺序(后面的画在前面):岩石垫底,珊瑚层层叠在岩石前,
// 参考图两个下角都是这样挤满的,中间留给小爱心和海草床
export const DECOR_VARIANTS: Decor[][] = [
  [
    // 左角
    { file: 'kelp.png', x: 0, sway: true },
    { file: 'rock_big.png', x: -18 },
    { file: 'tubes_purple.png', x: 4 },
    { file: 'coral_brain_pink.png', x: 32, lift: -2 },
    { file: 'coral_branch_red.png', x: 68, lift: -2 },
    { file: 'seagrass_tall.png', x: 100, sway: true },
    // 中部沙线上的小件,参考图的构图中间也不是全空的
    { file: 'rock_small.png', x: 278 },
    { file: 'coral_green.png', x: 296, lift: -2 },
    // 右角
    { file: 'kelp.png', x: 454, sway: true },
    { file: 'rock_small.png', x: 396 },
    { file: 'fan_purple.png', x: 368 },
    { file: 'coral_green.png', x: 398, lift: -2 },
    { file: 'coral_brain_orange.png', x: 424, lift: -3 },
    { file: 'coral_tube.png', x: 452, lift: -2 },
  ],
  [
    { file: 'kelp.png', x: 4, sway: true },
    { file: 'rock_small.png', x: -12 },
    { file: 'coral_branch_pink.png', x: 8, lift: -2 },
    { file: 'coral_green.png', x: 40, lift: -2 },
    { file: 'seagrass_tall.png', x: 74, sway: true },
    { file: 'kelp.png', x: 428, sway: true },
    { file: 'rock_big.png', x: 392 },
    { file: 'coral_brain_orange.png', x: 396, lift: -3 },
    { file: 'tubes_purple.png', x: 428, lift: -2 },
    { file: 'coral_branch_red.png', x: 456, lift: -2 },
  ],
  [
    { file: 'fan_purple.png', x: 0 },
    { file: 'coral_brain_orange.png', x: 28, lift: -2 },
    { file: 'kelp.png', x: 58, sway: true },
    { file: 'coral_tube.png', x: 66, lift: -2 },
    { file: 'seagrass_tall.png', x: 366, sway: true },
    { file: 'rock_small.png', x: 390 },
    { file: 'coral_brain_pink.png', x: 394, lift: -2 },
    { file: 'coral_green.png', x: 434, lift: -2 },
    { file: 'coral_branch_pink.png', x: 456, lift: -2 },
  ],
]

/**
 * 一个地点长什么样。**按地点 id 认,不按格子号认。**
 *
 * 原来是 `DECOR_VARIANTS[i % 3]` —— 三套排布按格子轮换。这在只有三个地点时看不出问题,
 * 六个地点一开就露馅:珊瑚花园和家海草床是同一批珊瑚摆在同一个位置。
 * 更要命的是格子号会变 —— 「开放地点」是爸爸在后台随手拨的,关掉一个海豚潟湖,
 * 它后面每一个地点的珊瑚都会换一批。「同一个地点永远长同一个样」(REFACTOR_PLAN §2.5)
 * 按格号取模根本守不住,得钉在 id 上。
 *
 * 摆位的两条硬约束:
 *   ① **中间那条水道要留出来** —— 海草种在第一格的 x 6%–94%,别的地点中间也是邻居站的地方
 *      (NPC 落在 0.65 处,见 App 的 npcViews),大件一律往两侧和中前段摆
 *   ② lift 是**负数往沙里沉、正数往水里抬**(baseline = 沙面 + 6 - lift)。
 *      鱼群要给正的 lift 才游在珊瑚上方,不然一群鱼趴在沙上
 *
 * 地点的性格照 GDD §3 红海地点表,一个字没自己加:
 *   换气水面「抬头看天」→ 最空,中间什么都没有;珊瑚花园「五颜六色的珊瑚、小鱼群」→ 最挤;
 *   沙地浅滩「挖沙、找贝壳」→ 沙洲和贝壳堆,珊瑚几乎没有;老沉船「长满珊瑚的旧船」→ 船是主角
 */
export const SPOT_DECOR: Record<string, Decor[]> = {
  // 家海草床保持原样。这是童童最熟的一格,没有理由动它
  home_meadow: DECOR_VARIANTS[0],

  surface: [
    { file: 'kelp.png', x: -8, sway: true },
    { file: 'rock_small.png', x: 6 },
    { file: 'seagrass_tall.png', x: 40, sway: true },
    { file: 'coral_green.png', x: 62, lift: -2 },
    { file: 'rock_small.png', x: 392 },
    { file: 'tubes_purple.png', x: 416, lift: -2 },
    { file: 'kelp.png', x: 452, sway: true },
  ],

  dolphin_lagoon: [
    { file: 'rock_big.png', x: -16 },
    { file: 'kelp.png', x: 6, sway: true },
    { file: 'fan_purple.png', x: 22 },
    { file: 'coral_brain_pink.png', x: 62, lift: -2 },
    { file: 'seagrass_tall.png', x: 104, sway: true },
    { file: 'rock_small.png', x: 392 },
    { file: 'coral_brain_orange.png', x: 404, lift: -3 },
    { file: 'coral_green.png', x: 436, lift: -2 },
    { file: 'kelp.png', x: 462, sway: true },
  ],

  coral_garden: [
    { file: 'rock_big.png', x: -22 },
    { file: 'coral_brain_pink.png', x: -4, lift: -2 },
    { file: 'tubes_purple.png', x: 28 },
    { file: 'coral_branch_red.png', x: 58, lift: -2 },
    { file: 'fan_purple.png', x: 92 },
    { file: 'fish_school.png', x: 96, lift: 96, sway: true },
    { file: 'anemone.png', x: 138, lift: -1 },
    { file: 'coral_green.png', x: 168, lift: -2 },
    { file: 'fish_school.png', x: 176, lift: 58, sway: true },
    { file: 'coral_brain_orange.png', x: 208, lift: -2 },
    { file: 'anemone.png', x: 246, lift: -1 },
    { file: 'rock_small.png', x: 360 },
    { file: 'coral_branch_pink.png', x: 356, lift: -2 },
    { file: 'coral_tube.png', x: 396, lift: -2 },
    { file: 'coral_brain_pink.png', x: 424, lift: -2 },
    { file: 'kelp.png', x: 466, sway: true },
  ],

  // 这一格的东西**故意小而多**:第一版只摆了两堆贝壳,上屏是两个米粒,
  // 「找贝壳」这件事在画面上根本不成立。现在是一路撒过去,走到哪儿脚边都有几个
  sand_flat: [
    { file: 'seagrass_tall.png', x: 2, sway: true },
    { file: 'rock_small.png', x: 20 },
    { file: 'sand_mound.png', x: 54 },
    { file: 'shell_pile.png', x: 42 },
    { file: 'shell_pile.png', x: 116 },
    { file: 'starfish.png', x: 150 },
    { file: 'shell_pink.png', x: 168 },
    { file: 'shell_pile.png', x: 196 },
    { file: 'shell_white.png', x: 236 },
    { file: 'shell_pile.png', x: 262 },
    { file: 'sand_mound.png', x: 286 },
    { file: 'starfish.png', x: 318 },
    { file: 'shell_pile.png', x: 344 },
    { file: 'shell_white.png', x: 372 },
    { file: 'shell_pile.png', x: 388 },
    { file: 'rock_small.png', x: 402 },
    { file: 'coral_green.png', x: 430, lift: -2 },
    { file: 'kelp.png', x: 464, sway: true },
  ],

  old_wreck: [
    { file: 'rock_big.png', x: -20 },
    { file: 'kelp.png', x: 4, sway: true },
    { file: 'wreck_mast.png', x: 30 },
    { file: 'wreck_hull.png', x: 78 },
    { file: 'seagrass_tall.png', x: 236, sway: true },
    { file: 'rock_small.png', x: 250 },
    { file: 'coral_branch_red.png', x: 396, lift: -2 },
    { file: 'rock_small.png', x: 410 },
    { file: 'coral_green.png', x: 440, lift: -2 },
    { file: 'kelp.png', x: 466, sway: true },
  ],
}

/** 这一格该画哪一批装饰。没写过的地点(印度海湾/澳洲浅海还没做美术)退回原来的三套轮换 */
export function decorFor(spotId: string | undefined, index: number): Decor[] {
  const own = spotId ? SPOT_DECOR[spotId] : undefined
  if (own) return own
  const n = DECOR_VARIANTS.length
  return DECOR_VARIANTS[((index % n) + n) % n]
}

/** 沙底上的小散落物,位置按格子错开;不挡路、不可点,纯风景 */
export const SCATTER = [
  'shell_pink.png',
  'starfish.png',
  'stones.png',
  'shell_white.png',
  'gem_blue.png',
  'fish_small.png',
] as const

/** 参考图那种白圈+高光的描边气泡,每个地点几串,大小混着 */
export const BUBBLE_SIZES = ['bubble_big.png', 'bubble_mid.png', 'bubble_small.png'] as const

/**
 * 视差:每层跟着镜头走多少。1.0 = 和小爱心同一个平面,越小越远越慢。
 *
 * **只作用于横向。** 纵向所有层都是 1.0 —— 换气那一下镜头往上摇,水面线、沙底、
 * 天空的裁切边界必须一起动,纵向再拆因子会把这条线撕开。
 *
 * 中景装饰(珊瑚岩石)定在 1.00,这一条和 REFACTOR_PLAN §2.4 拟的 0.92 不一样,
 * 理由是那份排布表是**按一格画面来构图的**:每格十几个珊瑚全挤在左右两角,中间空出来留给
 * 小爱心和海草床。一旦这层比沙底慢 8%,格子边界就和画面边界错开 —— 实算第 4 格会出现
 * 两簇珊瑚叠在画面左半边、右边整片空,构图当场垮掉。远景那几层不吃这个亏:天空/远岛/水面/
 * 剪影要么是平铺纹理,要么是每格均匀一两个,错开了看不出来。
 */
export const PARALLAX = {
  sky: 0.15,
  farIsland: 0.3,
  waterSurface: 0.6,
  underwaterFar: 0.75,
  underwaterMid: 1.0,
  seabed: 1.0,
  /** 光柱挂在水面上,跟着水走,比中景稍慢一点 */
  lightShaft: 0.85,
  /** 前景礁比小爱心还近,所以走得比她快 */
  foreground: 1.08,
  /** 水面光斑贴着水面,和水面白沫差不多远 */
  sparkle: 0.7,
  /** 浮尘分两层:远的比她慢一点,近的比她快一点 —— 一层浮尘看不出深度,两层才行 */
  dustFar: 0.9,
  dustNear: 1.15,
} as const

/**
 * 前景遮挡礁。**按固定周期均匀撒**,不按格子摆 —— 这是它能吃视差、
 * 而中景装饰不能的原因(见 layers/overlay.ts 开头)。
 */
export const FG_REEFS = {
  files: ['fg_reef_a.png', 'fg_reef_b.png', 'fg_reef_c.png'],
  /**
   * 撑起高度的是海带,不是珊瑚。珊瑚丛只有 50 出头高,压根够不着小爱心游的那条线;
   * 海带 130–165 高、只有 30 宽 —— 够得着她,又几乎不挡视线。
   * 会摇,和中景那批海带同一套摆动参数,不然近的一动不动、远的在摇,一眼假。
   */
  kelp: {
    files: ['fg_kelp_a.png', 'fg_kelp_b.png', 'fg_kelp_c.png'],
    /** 相对一丛左边缘的位置 */
    offsets: [-12, 58, 132],
  },
  /**
   * 每隔这么远一丛 —— 约等于一屏一丛,**故意稀**。
   *
   * 一开始按参考图那样一屏两丛,结果是它们坐在家海草床上:海草种在第一格的
   * x 6%–94%(`seagrass.ts` 的 `plantSeagrass`),几乎铺满整屏,一丛前景礁往中间一站
   * 就把她种的草挡了。等三天才长成的东西不能被石头盖住。
   * 稀到一屏一丛之后,第 0 丛正好卡在第一格的最左边(见 offset),海草床全露着。
   */
  period: 640,
  /** 左右挪一点,不要看出等距 */
  jitter: 120,
  /** 整体左移:让第 0 丛(offset 就是它的位置)大半沉在画面左边外面,别压到最左边那株海草 */
  offset: -120,
  /** 往画面外沉多少 —— 前景是被底边切掉的,不是整丛摆在沙上 */
  sink: 14,
} as const

/**
 * 水下光柱。**是氛围不是主角** —— 第一版按 alpha 0.45–1.0 画,整屏几道白带子,
 * 连小爱心都被洗白了。现在压到 0.22–0.5,而且整层挪到了小爱心后面。
 */
export const SHAFT = {
  period: 156,
  swaySec: 11,
  swayPx: 7,
  breathSec: 7,
  alphaMin: 0.22,
  alphaMax: 0.5,
} as const

/** CSS 动画的时长/关键帧数值,照抄 index.css,搬进 canvas 之后观感才不变 */
export const MOTION = {
  cloudDriftSec: 46,
  cloudFrom: -40,
  cloudTo: 520,
  surfaceDriftSec: 3,
  surfaceSteps: 24,
  surfaceShift: 96,
  swaySec: 5,
  swayDeg: 4,
  ambientBubbleRise: 70,
  petBobSec: 4,
  petBobFrom: { y: -8, deg: 1.8 },
  petBobTo: { y: 10, deg: -2.4 },
  petTapScale: 1.08,
  petTapMs: 300,
  petTurnMs: 500,
  breathBubbleSec: 3.2,
  breathBubbleRise: 70,
  cameraPanMs: 400,
} as const

/** 世界层要用到的全部素材。少一张就少画一层,不阻塞、不白屏 */
export const WORLD_PRELOAD: readonly string[] = [
  ...['sky.png', 'cloud_big.png', 'cloud_small.png', 'island_big.png', 'island_small.png',
    'surface.png', 'far.png', 'sand.png', 'shadow.png', 'light_shaft.png'].map((f) => `${WORLD_DIR}/${f}`),
  ...[...FG_REEFS.files, ...FG_REEFS.kelp.files].map((f) => `${WORLD_DIR}/${f}`),
  ...new Set([...DECOR_VARIANTS.flat(), ...Object.values(SPOT_DECOR).flat()].map((d) => `${WORLD_DIR}/${d.file}`)),
  ...SCATTER.map((f) => `${WORLD_DIR}/${f}`),
  ...BUBBLE_SIZES.map((f) => `${WORLD_DIR}/${f}`),
]
