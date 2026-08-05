// 镜头。水平跟着小爱心逐帧走(不做缓动,她本身就是匀速的),
// 垂直只有换气那一次摇移:潜水时贴顶,浮上来时往下松开 WATER_LINE,天空和水面线一起露出来。
//
// 数值照抄原来的实现:水平那条是 App.tsx 的 cameraX 公式,
// 垂直那条是 index.css `.camera-world { transition: transform 400ms ease-in-out }`。
// 宪法十二「不做缩放」这半句没被松绑,这里也就没有缩放。

import { STAGE_WIDTH } from '../components/ScreenFrame'
import { EASE_IN_OUT, lerp } from './easing'
import { MOTION, WATER_LINE } from './world-data'

export class Camera {
  x = 0
  y = WATER_LINE

  private fromY = WATER_LINE
  private toY = WATER_LINE
  private panAt = -Infinity

  /** 减弱动态效果时镜头瞬移,不摇 —— 宪法二十一配套约束第 3 条 */
  reduced = false

  setSurfaced(surfaced: boolean, now: number): void {
    const next = surfaced ? 0 : WATER_LINE
    if (next === this.toY) return
    this.fromY = this.y
    this.toY = next
    this.panAt = now
  }

  update(now: number, petX: number, worldWidth: number): void {
    this.x = Math.max(0, Math.min(worldWidth - STAGE_WIDTH, petX - STAGE_WIDTH / 2))

    if (this.reduced) {
      this.y = this.toY
      return
    }
    const t = (now - this.panAt) / MOTION.cameraPanMs
    this.y = t >= 1 ? this.toY : lerp(this.fromY, this.toY, EASE_IN_OUT(Math.max(0, t)))
  }

  /** 这一帧镜头还在动吗。背景层靠它决定要不要重绘 */
  get panning(): boolean {
    return this.y !== this.toY
  }
}
