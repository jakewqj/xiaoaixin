// overlay 层(前景遮挡礁)。这一层画在小爱心**前面**,她游过去会从礁后面过 ——
// 这是这一版最硬的一个深度信号,比背景视差明显得多。
//
// 水下光柱不在这里,它在背景层的最后一道:光是水体的一部分,压在小爱心前面会把她洗白。
//
// 和中景装饰的区别不只是大小:中景那张表是**按格构图**的(每格十几件全挤在左右两角,
// 中间留给小爱心),所以它不能吃视差,一错开构图就垮。前景这批反过来,是**按固定周期均匀撒**的,
// 密度处处一样,怎么挪都不会突然空一片 —— 所以它才敢跑 1.08。
//
// 素材照旧只按路径 drawImage,没有任何 arc/bezier 画出来的东西(CLAUDE.md 五 / 十三)。

import { STAGE_HEIGHT, STAGE_WIDTH } from '../../components/ScreenFrame'
import * as assets from '../assets'
import { EASE_IN_OUT, alternateProgress, lerp } from '../easing'
import { indexRange, layer } from '../parallax'
import { DUST_NEAR, drawDust } from './particles'
import { FG_REEFS, MOTION, PARALLAX, WORLD_DIR } from '../world-data'

export interface OverlayState {
  now: number
  camX: number
  camY: number
  worldWidth: number
  worldHeight: number
  slotCount: number
  reduced: boolean
  /** 天有多黑:0 = 正午,1 = 深夜(ROADMAP 4-1) */
  darkness: number
  /** 小爱心在屏幕上的位置。夜里那一圈光以她为中心 —— 她游到哪,哪里亮 */
  petScreenX: number
  petScreenY: number
  /** 这一刻看得见的水面线(随潮水升降)。夜色从这条线往下压,近浮尘从这条线往下沉 */
  surfaceY: number
}

// 夜色。**这是全项目第四处用 fillRect/渐变而不是 drawImage** ——
// 前三处是海草床的矢量描边、浮尘、犁沙的沟。理由和它们一样:
// 这是一层跟着她走、每帧都在变的光照,出不成固定 PNG;
// 宪法五/十三 管的是**美术素材**,那些照旧全走 /assets/ 路径。
//
// 夜里最暗压到 55%(2026-09-21 用户拍板的方案 B)。**不压成全黑**:
// 宪法二禁止黑暗惊吓元素,而且她多半是晚饭后才玩 —— 真压黑了,
// 她看到的几乎永远是一块黑屏。
const NIGHT = { r: 22, g: 38, b: 78 } as const
// **这个 0.62 是算出来的,不是拍的。** 目标是「远处压到白天的 55%」(用户选的方案 B)。
// 夜色不是黑而是深蓝 #16264e,它自己的亮度是 37.8,所以压出来的结果是
// (1-a)×140 + a×37.8;要落在 77(= 140 的 55%)上,a 得是 0.62。
// 第一版按直觉写 0.45,实测远处只降到 72%,读起来像暗角不像夜
const NIGHT_MAX_ALPHA = 0.62
// 她身上那圈光:内圈完全不压暗,到外圈才压满。
// **外圈不能超过半个屏宽**(舞台 480 宽),不然画面四角永远到不了满值,
// 上面那个算式就白算了 —— 第一版 150 就是这么虚掉的
const GLOW_INNER = 42
const GLOW_OUTER = 130

function drawNight(ctx: CanvasRenderingContext2D, s: OverlayState): void {
  if (s.darkness <= 0.001) return
  const a = s.darkness * NIGHT_MAX_ALPHA
  // **水面线以上不压** —— 那一截天空已经在天空层里自己压过夜色了,
  // 而且月亮就画在那儿:再压一遍,月相就读成一块灰盘(实测过)
  const skyBottom = Math.max(0, Math.round(s.surfaceY - s.camY))
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, skyBottom, STAGE_WIDTH, STAGE_HEIGHT - skyBottom)
  ctx.clip()
  const g = ctx.createRadialGradient(
    s.petScreenX, s.petScreenY, GLOW_INNER,
    s.petScreenX, s.petScreenY, GLOW_OUTER,
  )
  // 圆心透明 = 她身边照常亮;越往外夜色越浓
  g.addColorStop(0, `rgba(${NIGHT.r},${NIGHT.g},${NIGHT.b},0)`)
  g.addColorStop(1, `rgba(${NIGHT.r},${NIGHT.g},${NIGHT.b},${a})`)
  ctx.fillStyle = g
  ctx.fillRect(0, skyBottom, STAGE_WIDTH, STAGE_HEIGHT - skyBottom)
  ctx.restore()
}

function img(file: string): HTMLImageElement | null {
  return assets.get(`${WORLD_DIR}/${file}`)
}

/** 按索引取一个变体。负数索引也要能取(视野往左多算一格) */
function pick(files: readonly string[], i: number): string {
  return files[((i % files.length) + files.length) % files.length]
}

// 前景礁:坐在画面最下面,被底边切掉一截。小爱心游过去会从它后面过 —— 这就是深度信号。
// 一丛 = 几片会摇的高海带(在后)+ 一堆静止的珊瑚(在前)
function drawForeground(ctx: CanvasRenderingContext2D, s: OverlayState, ox: number): void {
  const [from, to] = indexRange(ox, FG_REEFS.period)
  for (let i = from; i <= to; i++) {
    const left = i * FG_REEFS.period + ((i * 97) % FG_REEFS.jitter) + FG_REEFS.offset
    // 基线钉在世界最底下,再按索引压低一点点,免得一排礁的顶边连成一条直线
    const bottom = s.worldHeight + FG_REEFS.sink + ((i * 31) % 10)

    FG_REEFS.kelp.offsets.forEach((dx, k) => {
      const tex = img(pick(FG_REEFS.kelp.files, i * 3 + k))
      if (!tex) return
      const x = left + dx
      if (s.reduced) {
        ctx.drawImage(tex, x, bottom - tex.height)
        return
      }
      // transform-origin: bottom center —— 根部固定,只有梢在摇
      const deg = lerp(
        -MOTION.swayDeg,
        MOTION.swayDeg,
        EASE_IN_OUT(alternateProgress(s.now, MOTION.swaySec, -((i * 5 + k * 3) % 8))),
      )
      ctx.save()
      ctx.translate(x + tex.width / 2, bottom)
      ctx.rotate((deg * Math.PI) / 180)
      ctx.drawImage(tex, -tex.width / 2, -tex.height)
      ctx.restore()
    })

    const reef = img(pick(FG_REEFS.files, i))
    if (reef) ctx.drawImage(reef, left, bottom - reef.height)
  }
}

/** 画一整帧 overlay。ctx 由 world.ts 设好 imageSmoothingEnabled=false */
export function drawOverlay(ctx: CanvasRenderingContext2D, s: OverlayState): void {
  ctx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  ctx.save()
  ctx.translate(0, -Math.round(s.camY))
  layer(ctx, s.camX, s.slotCount, PARALLAX.foreground, (ox) => drawForeground(ctx, s, ox))
  // 近浮尘是全场最近的东西,连前景礁都压在它下面
  layer(ctx, s.camX, s.slotCount, PARALLAX.dustNear, (ox) => drawDust(ctx, s, ox, DUST_NEAR))
  ctx.restore()
  // 夜色铺在最后,压住包括小爱心在内的所有东西 —— 天黑是对整个世界黑的。
  // **不跟 camY 走**:它是贴在屏幕上的一层光,不是世界里的一件东西
  drawNight(ctx, s)
}
