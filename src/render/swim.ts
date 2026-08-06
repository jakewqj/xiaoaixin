// 小爱心在世界里的位置与移动:点哪游哪。点一下 → 转向那边 → 朝那个点匀速游过去。
//
// 位置每帧都在变,放进 React state 就是每帧全树重渲染一次(REFACTOR_PLAN §1.2 第 3 条)。
// 宪法二十一配套约束第 2 条:高频状态放 ref/类实例,不进 React state。

import { STAGE_HEIGHT, STAGE_WIDTH } from '../components/ScreenFrame'
import { WATER_LINE } from './world-data'

// 点哪游哪的巡游速度:儒艮悠闲巡游约 5 km/h ≈ 1.4 m/s;
// 游戏里成年体长 3m = 192 逻辑px,即 64px/m → 1.4 × 64 ≈ 90 逻辑px/秒。
// 不做加速冲刺——她永远是纪录片里那种不紧不慢的游法。**斜着游也是这个速度**,
// 不是横竖各 90(那样斜着会变成 127,一眼看得出在赶路)
export const SWIM_SPEED = 90

/** 没在换气、也没被点过时她待的那一层。原来这是她**唯一**的高度,现在只是个起点 */
export const REST_Y = 0.7 * (STAGE_HEIGHT + WATER_LINE)

// 身体一半宽度左右的安全边距,免得头或尾巴探出世界边缘
const EDGE_MARGIN = 80

/** 朝向死区:点在她正上方/正下方时不翻身。差几个像素就镜像一次会看着像在抽搐 */
const FACING_DEADZONE = 12

/** 俯仰追上行进方向的半衰期(秒)。要看得出是「拐了个弯」,不是啪一下换角度 */
const PITCH_HALF_LIFE = 0.22

export class Swim {
  x = STAGE_WIDTH / 2
  y = REST_Y
  facingLeft = false
  /** 这一帧的速度分量(逻辑px/秒,带正负)。停着就是 0。镜头的前瞻量读 vx */
  vx = 0
  vy = 0
  /**
   * 身体俯仰(弧度),**朝向已经折进去了** —— 渲染层在镜像之外直接 ctx.rotate 它就对。
   * 负=头朝上。朝左时角度自己是反的,所以镜像之后合成出来仍然是头朝上。
   */
  pitch = 0

  /** 减弱动态效果:俯仰不做插值,直接落到位 */
  reduced = false

  private target: { x: number; y: number } | null = null
  private worldWidth = STAGE_WIDTH
  private minY = 0
  private maxY = STAGE_HEIGHT + WATER_LINE

  /** 世界变小了(后台关掉了地点)就把她拉回有效范围,别让她卡在不存在的地方 */
  setBounds(width: number, minY: number, maxY: number): void {
    this.worldWidth = width
    this.minY = minY
    this.maxY = Math.max(minY, maxY)
    this.x = this.clampX(this.x)
    this.y = this.clampY(this.y)
    if (this.target) {
      this.target.x = this.clampX(this.target.x)
      this.target.y = this.clampY(this.target.y)
    }
  }

  private clampX(value: number): number {
    return Math.max(EDGE_MARGIN, Math.min(this.worldWidth - EDGE_MARGIN, value))
  }

  private clampY(value: number): number {
    return Math.max(this.minY, Math.min(this.maxY, value))
  }

  /**
   * 下过多少次「游到这儿」的令。**进食那一套靠它认人**:
   * 她自己在游向海草床的路上,和童童中途点了别处,两件事在 `swimming` 上长得一模一样,
   * 只有令牌变没变分得开(变了 = 童童插话了 = 进食让位)
   */
  commands = 0

  /** 世界坐标里的一个点 → 游过去。横竖一起走,不是先横后竖 */
  swimTo(rawX: number, rawY: number): void {
    const x = this.clampX(rawX)
    const y = this.clampY(rawY)
    this.commands += 1
    if (Math.hypot(x - this.x, y - this.y) < 4) return
    if (Math.abs(x - this.x) > FACING_DEADZONE) this.facingLeft = x < this.x
    this.target = { x, y }
  }

  /** 换气期间纵向交给换气动画:直接落位,并且撤掉当前的纵向目标 */
  holdY(y: number): void {
    this.y = y
    this.vy = 0
    if (this.target) this.target.y = y
  }

  /** 犁沙期间横竖都归进食动画:直接落位,并撤掉在途的目标 */
  holdAt(x: number, y: number): void {
    this.x = x
    this.y = y
    this.vx = 0
    this.vy = 0
    this.target = null
  }

  get swimming(): boolean {
    return this.target !== null
  }

  update(dt: number): void {
    if (this.target === null) {
      this.vx = 0
      this.vy = 0
      this.settlePitch(dt)
      return
    }
    const dx = this.target.x - this.x
    const dy = this.target.y - this.y
    const dist = Math.hypot(dx, dy)
    const move = SWIM_SPEED * dt
    if (dist <= move || dist === 0) {
      this.x = this.target.x
      this.y = this.target.y
      this.target = null
      this.vx = 0
      this.vy = 0
      this.settlePitch(dt)
      return
    }
    this.vx = (SWIM_SPEED * dx) / dist
    this.vy = (SWIM_SPEED * dy) / dist
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.settlePitch(dt)
  }

  // 俯仰指向行进方向。停下来就慢慢回正 —— 她不会保持一个歪着的姿势停在水里
  private settlePitch(dt: number): void {
    const facing = this.facingLeft ? -1 : 1
    const moving = this.vx !== 0 || this.vy !== 0
    const target = moving ? Math.atan2(this.vy * facing, this.vx * facing) : 0
    if (this.reduced) {
      this.pitch = target
      return
    }
    this.pitch += (target - this.pitch) * (1 - Math.pow(0.5, dt / PITCH_HALF_LIFE))
    if (Math.abs(target - this.pitch) < 0.002) this.pitch = target
  }
}
