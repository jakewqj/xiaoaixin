// CSS 缓动函数的 JS 版本。
//
// 世界从 CSS 动画搬进 canvas 之后,原来那些 `ease-in-out` / `alternate` / `steps()`
// 必须在循环里自己算出来,不然观感会变 —— 重构的验收标准是「画面看不出区别」,
// 而不是「效果更好」(REFACTOR_PLAN 三)。

export type Easing = (t: number) => number

/** cubic-bezier(x1,y1,x2,y2)。用二分求 x 的反函数,精度够画像素了 */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const curve = (a: number, b: number, t: number) => {
    const u = 1 - t
    return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t
  }
  return (t: number) => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    let lo = 0
    let hi = 1
    let mid = t
    for (let i = 0; i < 20; i++) {
      mid = (lo + hi) / 2
      if (curve(x1, x2, mid) < t) lo = mid
      else hi = mid
    }
    return curve(y1, y2, mid)
  }
}

export const LINEAR: Easing = (t) => t
export const EASE_IN_OUT = cubicBezier(0.42, 0, 0.58, 1)
export const EASE_OUT = cubicBezier(0, 0, 0.58, 1)
export const EASE_IN = cubicBezier(0.42, 0, 1, 1)

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

/**
 * 无限循环动画在某一刻的进度。delaySec 用负数表示「开始时就已经播了这么久」,
 * 和 CSS 里那一堆 `animationDelay: -3s` 是同一个意思
 */
export function loopProgress(nowMs: number, durationSec: number, delaySec = 0): number {
  const elapsed = nowMs / 1000 - delaySec
  const p = (elapsed / durationSec) % 1
  return p < 0 ? p + 1 : p
}

/** `animation-direction: alternate` —— 奇数轮把进度倒过来播 */
export function alternateProgress(nowMs: number, durationSec: number, delaySec = 0): number {
  const elapsed = nowMs / 1000 - delaySec
  const cycles = elapsed / durationSec
  const iteration = Math.floor(cycles)
  const p = cycles - iteration
  const wrapped = p < 0 ? p + 1 : p
  const odd = ((iteration % 2) + 2) % 2 === 1
  return odd ? 1 - wrapped : wrapped
}

/** `steps(n, jump-end)` —— 精灵翻帧和水面白沫都靠它保持像素风的顿挫感 */
export function stepIndex(progress: number, steps: number): number {
  return Math.min(steps - 1, Math.floor(progress * steps))
}
