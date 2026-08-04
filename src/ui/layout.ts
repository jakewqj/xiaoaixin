// HUD 的布局常量与配色。全部是 480x270 逻辑分辨率下的像素值。
//
// 尺寸来源:wiki/graphic/hud-9slice.json 的 logical_px(参考图实测值)
// 配色来源:wiki/graphic/palette.json 的 ui 段(Pillow 量化取样,非眼估)
// 想调位置只改这里,不要去 draw.ts 里改魔法数字

export const UI_DIR = '/assets/world/ui'
export const SV_DIR = '/assets/world/ui/sv'

/** 九宫格纹理。切片宽度和 hud-9slice.json 对齐 */
export const TEX = {
  panel: `${SV_DIR}/frame_panel.png`,
  plate: `${SV_DIR}/plate_cream.png`,
  slot: `${SV_DIR}/slot.png`,
  slotActive: `${SV_DIR}/slot_active.png`,
  bar: `${SV_DIR}/goldbar.png`,
  dial: `${SV_DIR}/dial.png`,
  shell: `${SV_DIR}/shell.png`,
} as const

export const SLICE = { panel: 4, plate: 3, bar: 7 } as const

export const COLOR = {
  ink: '#4D2502',
  inkDim: '#85360F',
  cream: '#F4DEB9',
  numeral: '#8E1B0A',
  /** 饱食度:亮着的格子是海草绿(和原来 FullnessMeter 的 --color-seagrass 同一个色),
   *  空格子用 goldbar 纹理自己的暗棕。**永远不用红色** —— 饿了不是失败(CLAUDE.md 原则 1) */
  meterFull: '#6FA84B',
  meterFullTop: '#A8CC72',
  meterEmpty: '#C76F16',
} as const

/** 顶部栏。参考图是「时钟盘压住面板左端 + 右边两行文字 + 下方计数条」
 *
 *  竖向是被 Zpix 撑死的:点阵字体原生格 12px,两行就要 12+2+12=26,
 *  加 plate 的 3px 边框 = 32,再加 panel 的 4px 边框 = 40。第一版按参考图取 36,
 *  第二行直接压到木框上了 —— 参考图那两行是英文,比中文矮
 */
export const TOP = {
  panel: { x: 2, y: 2, w: 124, h: 40 },
  dial: { x: 4, y: 8, size: 28 },
  plate: { x: 34, y: 6, w: 88, h: 32 },
  /** 两行文字在 plate 内的起点。行距 13 = 12px 字 + 1px 间隙 */
  line1: { x: 38, y: 10 },
  line2: { x: 38, y: 23 },
  /** 长按 5 秒进控制后台的热区 = 整个面板 */
  titleHold: { x: 2, y: 2, w: 124, h: 40 },
} as const

/** 饱食度条。2026-08-04 用户决议:原来贴在海底中央的海草计量条(FullnessMeter)
 *  搬到顶部,顶掉原来的贝壳计数条。贝壳数不再常驻显示 —— 顺带解掉
 *  CLAUDE.md 十六「❌ 常驻金钱 HUD」那条一直挂着的冲突
 *
 *  沿用 goldbar.png 这张纹理:它是 24x17,threeSliceX 按原图高度画,所以条高恒为 17。
 *  纹理内边距实测(逐像素 dump):木框占外圈 3px,中间 x3..x20 / y3..y13 是奶白格底。
 *  格子区就摆在这块奶白里,再往里让 1px 免得压到斜面高光
 */
export const METER = {
  bar: { x: 20, y: 39, w: 72 },
  /** span 是 5 格 + 4 条缝的总宽;单格宽由 max 反算,MAX_FULLNESS 改了这里不用跟着改 */
  cells: { x: 24, y: 43, span: 64, h: 9, gap: 1 },
} as const

/** 底部快捷栏。两排,每排 5 格,格子 20x20(参考图实测值) */
export const HOTBAR = {
  slot: 20,
  cols: 5,
  rows: 2,
  border: 4,
  get w() {
    return this.cols * this.slot + this.border * 2
  },
  get h() {
    return this.rows * this.slot + this.border * 2
  },
  get x() {
    return 480 - this.w - 2
  },
  get y() {
    return 270 - this.h - 2
  },
  /** 16x16 的图标在 20x20 的格子里居中 */
  iconInset: 2,
} as const

/** 提示气泡(点了灰格子给一句话),浮在快捷栏上方 */
export const TIP = { h: 16, gap: 3, maxW: 160 } as const

/** 预载清单。少一张就少画一层,不阻塞 */
export const PRELOAD: readonly string[] = [
  ...Object.values(TEX),
  `${UI_DIR}/icon_shell.png`,
  `${UI_DIR}/icon_gift.png`,
  `${UI_DIR}/icon_backpack.png`,
  `${UI_DIR}/icon_book.png`,
  `${UI_DIR}/icon_sprout.png`,
  `${UI_DIR}/icon_seagrass.png`,
  `${UI_DIR}/icon_map.png`,
  `${UI_DIR}/icon_camera.png`,
  `${UI_DIR}/icon_bubble.png`,
  `${UI_DIR}/icon_moon.png`,
  `${UI_DIR}/icon_wave.png`,
]
