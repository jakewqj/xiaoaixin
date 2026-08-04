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
  /** 贝壳计数条。顶部 3px 掖在面板下面,参考图就是这么叠的。
   *  高 17 而不是参考图的 14:Zpix 最小 12px,14px 的条会把数字底部切掉 */
  shellBar: { x: 20, y: 39, w: 72, h: 17 },
  shellIcon: { x: 24, y: 43, size: 9 },
  /** 数字右对齐,左边露出来的格子当背景 —— 参考图就是这个排法 */
  shellTextRight: 88,
  shellTextY: 42,
  /** 长按 5 秒进控制后台的热区 = 整个面板 */
  titleHold: { x: 2, y: 2, w: 124, h: 40 },
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
