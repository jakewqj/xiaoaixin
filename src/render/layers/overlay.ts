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
}
