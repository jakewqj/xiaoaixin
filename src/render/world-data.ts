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
  petDipY: 40,
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
    'surface.png', 'far.png', 'sand.png', 'shadow.png'].map((f) => `${WORLD_DIR}/${f}`),
  ...new Set(DECOR_VARIANTS.flat().map((d) => `${WORLD_DIR}/${d.file}`)),
  ...SCATTER.map((f) => `${WORLD_DIR}/${f}`),
  ...BUBBLE_SIZES.map((f) => `${WORLD_DIR}/${f}`),
]
