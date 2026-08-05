// 浮尘和水面光斑。
//
// **这两样是唯二用 fillRect 而不是 drawImage 画的东西**,理由和海草床那处例外一样:
// 它们不是「形象」。一颗浮尘就是 1×1 或 2×2 个逻辑像素,为它出一张 PNG 只会让整数倍
// 放大时多一道采样;fillRect 到整数坐标才是像素级精确的。宪法五/十三 管的是**美术素材**
// (小爱心、珊瑚、UI 框),那些一律走 `/assets/` 路径,这里没有破例。
//
// 位置是 `(索引, 时刻)` 的纯函数,不存粒子数组、不随机生成。好处有三个:
// 时钟钉死就能逐像素复现、减弱动态效果时原地不动即可、切后台回来不会一次补上几千帧。
// 环境气泡(actors.ts)本来就是这么写的,这里沿用同一套写法。

import { indexRange } from '../parallax'
import { EASE_IN_OUT, alternateProgress, lerp, loopProgress } from '../easing'
import { SAND_H, WATER_LINE } from '../world-data'

export interface ParticleState {
  now: number
  worldHeight: number
  reduced: boolean
}

export interface DustBand {
  /** 每隔多少世界 px 一颗 */
  period: number
  /** 边长(逻辑px)。1 在 ×3 缩放下已经是一个 3×3 的方块,够看见了 */
  size: number
  alpha: number
  /** 从水面沉到沙面要多少秒 */
  fallSec: number
  swayPx: number
  swaySec: number
  color: string
}

/** 确定性伪随机:同一个索引永远给同一个数。和摆装饰用的 `(i*97)%120` 是同一路做法 */
function jitter(i: number, salt: number, range: number): number {
  return (((i * 1103 + salt * 12289) % range) + range) % range
}

/**
 * 浮尘:整片水体里慢慢往下沉的小颗粒(海雪)。到底了从水面重新开始 ——
 * 两头各留一段淡入淡出,不然会看见它在沙面上凭空消失、在水面上凭空冒出来。
 */
export function drawDust(
  ctx: CanvasRenderingContext2D,
  s: ParticleState,
  ox: number,
  band: DustBand,
): void {
  const top = WATER_LINE + 4
  const bottom = s.worldHeight - SAND_H + 4
  const column = bottom - top
  if (column <= 0) return

  const [from, to] = indexRange(ox, band.period)
  ctx.save()
  ctx.fillStyle = band.color
  for (let i = from; i <= to; i++) {
    const phase = jitter(i, 7, 100) / 100
    const p = s.reduced
      ? phase
      : loopProgress(s.now, band.fallSec, -phase * band.fallSec)
    const sway = s.reduced
      ? 0
      : lerp(
          -band.swayPx,
          band.swayPx,
          EASE_IN_OUT(alternateProgress(s.now, band.swaySec, -jitter(i, 3, 13))),
        )
    ctx.globalAlpha = band.alpha * Math.min(1, Math.min(p, 1 - p) * 6)
    ctx.fillRect(
      Math.round(i * band.period + jitter(i, 1, band.period) + sway),
      Math.round(top + p * column),
      band.size,
      band.size,
    )
  }
  ctx.restore()
}

/** 水面下那一层一闪一闪的光斑。只在贴着水面线的一条窄带里,越往下越少 */
export function drawSparkles(ctx: CanvasRenderingContext2D, s: ParticleState, ox: number): void {
  const [from, to] = indexRange(ox, SPARKLE.period)
  ctx.save()
  ctx.fillStyle = SPARKLE.color
  for (let i = from; i <= to; i++) {
    const depth = jitter(i, 5, 100) / 100
    const t = s.reduced
      ? 0.5
      : EASE_IN_OUT(alternateProgress(s.now, SPARKLE.blinkSec, -jitter(i, 11, 17) / 2))
    // 越深的光斑越暗:阳光是从上面来的
    ctx.globalAlpha = lerp(0, SPARKLE.alpha, t) * (1 - depth * 0.7)
    ctx.fillRect(
      Math.round(i * SPARKLE.period + jitter(i, 2, SPARKLE.period)),
      Math.round(WATER_LINE + 3 + depth * SPARKLE.band),
      1,
      1,
    )
  }
  ctx.restore()
}

/**
 * 远处的浮尘:小、淡、沉得慢。画在小爱心后面。
 *
 * **两个数是调出来的,不是拍出来的。**
 * ① 密度:一开始 period 23(一屏 21 颗),整屏白点子,像屏幕脏了。1 逻辑px 在 ×3 缩放下
 *    是一个 3×3 的实心方块,不小 —— 一屏 7 颗才是「水里有东西在飘」,20 颗就是噪点。
 * ② 颜色:一开始用近白色 #eaf6f6,alpha 调低到看不见、调高就刺眼,中间没有好档位。
 *    换成偏水色的浅青之后,alpha 0.4 既看得见又不抢戏 —— 差在色相不在明度。
 */
export const DUST_FAR: DustBand = {
  period: 48,
  size: 1,
  alpha: 0.4,
  fallSec: 30,
  swayPx: 6,
  swaySec: 9,
  color: '#a8dcdc',
}

/** 近处的浮尘:大一号、亮一点、沉得快。画在小爱心**前面**,连前景礁都压在它下面 */
export const DUST_NEAR: DustBand = {
  period: 100,
  size: 2,
  alpha: 0.3,
  fallSec: 17,
  swayPx: 11,
  swaySec: 6,
  color: '#c6ecec',
}

/** 水面光斑。会闪,所以更要少 —— 一屏十来颗,慢慢地亮灭,不做快频闪 */
const SPARKLE = {
  period: 46,
  /** 光斑分布的深度带(从水面线往下) */
  band: 46,
  blinkSec: 3.4,
  alpha: 0.55,
  color: '#eafcff',
}
