// 镜头。水平跟着小爱心走(带缓动和前瞻),垂直只有换气那一次摇移:
// 潜水时贴顶,浮上来时往下松开 WATER_LINE,天空和水面线一起露出来。
//
// 垂直那条是照抄 index.css `.camera-world { transition: transform 400ms ease-in-out }`,没动过。
// 水平那条原来是「镜头 = 她的位置 - 半屏」,一帧不差地钉着她;
// 现在按宪法十二(已放宽:允许 easing 和 lookahead)改成跟随。**缩放仍然禁止**,这里也就没有缩放。

import { STAGE_WIDTH } from '../components/ScreenFrame'
import { EASE_IN_OUT, lerp } from './easing'
import { SWIM_SPEED } from './swim'
import { MOTION, WATER_LINE } from './world-data'

/**
 * 前瞻:她朝哪走,画面就往那边多让出这么多(约 15% 屏宽)。
 *
 * **按速度给,不按朝向。** 按朝向的话有两个毛病:她停下来镜头还偏在一边;
 * 一转身,整块画面要横甩 2×LOOKAHEAD。按速度给的话,停下来自然回中,
 * 转身要先经过 0,过程是连续的。
 */
const LOOKAHEAD = 72

/**
 * 跟随的半衰期(秒):每过这么久,镜头和目标的差距缩一半。
 *
 * 这个值同时决定了「拖影」有多长:匀速跟随一个动着的目标,指数平滑会稳定地落后
 * `速度 × 半衰期 / ln2`。0.14s 在 90px/s 下是落后 18px —— 和 72px 的前瞻叠起来,
 * 净效果是她被摆在屏幕中线前面约 54px 的位置,而不是死钉在正中间。
 */
const FOLLOW_HALF_LIFE = 0.14

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value))
}

export class Camera {
  x = 0
  y = WATER_LINE

  private targetX = 0
  private lastNow: number | null = null

  private fromY = WATER_LINE
  private toY = WATER_LINE
  private panAt = -Infinity

  /** 减弱动态效果时镜头瞬移,不摇,也不前瞻 —— 宪法二十一配套约束第 3 条。
   *  前瞻在没有缓动的情况下会变成「一转身画面横跳 144px」,比不做还糟 */
  reduced = false

  setSurfaced(surfaced: boolean, now: number): void {
    const next = surfaced ? 0 : WATER_LINE
    if (next === this.toY) return
    this.fromY = this.y
    this.toY = next
    this.panAt = now
  }

  update(now: number, petX: number, vx: number, worldWidth: number): void {
    // dt 自己算:draw() 除了主循环之外,还会被 setSnapshot 和 freeze 叫到,
    // 那两处给不出 dt。上限 0.1s 和 swim 那边同一个数(切后台回来不要瞬移一大截)
    const dt = this.lastNow === null ? 0 : clamp((now - this.lastNow) / 1000, 0, 0.1)
    this.lastNow = now

    const maxX = Math.max(0, worldWidth - STAGE_WIDTH)
    const centered = petX - STAGE_WIDTH / 2
    const lead = LOOKAHEAD * clamp(vx / SWIM_SPEED, -1, 1)
    this.targetX = clamp(centered + lead, 0, maxX)

    if (this.reduced) {
      this.x = clamp(centered, 0, maxX)
    } else {
      this.x += (this.targetX - this.x) * (1 - Math.pow(0.5, dt / FOLLOW_HALF_LIFE))
      // 剩不到半像素就贴上去。指数平滑永远差一点点,而画的时候要取整 —— 不收尾会在两个整数之间抖
      if (Math.abs(this.targetX - this.x) < 0.5) this.x = this.targetX
    }

    if (this.reduced) {
      this.y = this.toY
      return
    }
    const t = (now - this.panAt) / MOTION.cameraPanMs
    this.y = t >= 1 ? this.toY : lerp(this.fromY, this.toY, EASE_IN_OUT(Math.max(0, t)))
  }

  /** 直接落位。截图比对要用:时钟一钉死 dt 就恒为 0,不落位的话镜头会停在半路 */
  settle(): void {
    this.x = this.targetX
    this.y = this.toY
  }

  /** 这一帧镜头还在动吗。背景层靠它决定要不要重绘 */
  get panning(): boolean {
    return this.y !== this.toY
  }
}
