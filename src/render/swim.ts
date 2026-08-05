// 小爱心在世界横条里的位置与移动:点击某处 → 转向那边 → 匀速游过去。
//
// 算法是从 hooks/usePetSwim.ts 原样搬来的,只把 `setX` 换成写实例字段 ——
// 位置每帧都在变,放进 React state 就是每帧全树重渲染一次(REFACTOR_PLAN §1.2 第 3 条)。
// 宪法二十一配套约束第 2 条:高频状态放 ref/类实例,不进 React state。

import { STAGE_WIDTH } from '../components/ScreenFrame'

// 点哪游哪的巡游速度:儒艮悠闲巡游约 5 km/h ≈ 1.4 m/s;
// 游戏里成年体长 3m = 192 逻辑px,即 64px/m → 1.4 × 64 ≈ 90 逻辑px/秒。
// 不做加速冲刺——她永远是纪录片里那种不紧不慢的游法
export const SWIM_SPEED = 90

// 身体一半宽度左右的安全边距,免得头或尾巴探出世界边缘
const EDGE_MARGIN = 80

export class Swim {
  x = STAGE_WIDTH / 2
  facingLeft = false
  /** 这一帧的水平速度(逻辑px/秒,带正负)。停着就是 0。镜头的前瞻量读它 */
  vx = 0
  private target: number | null = null
  private worldWidth = STAGE_WIDTH

  /** 世界变小了(后台关掉了地点)就把她拉回有效范围,别让她卡在不存在的地方 */
  setWorldWidth(width: number): void {
    this.worldWidth = width
    this.x = this.clamp(this.x)
    if (this.target !== null) this.target = this.clamp(this.target)
  }

  private clamp(value: number): number {
    return Math.max(EDGE_MARGIN, Math.min(this.worldWidth - EDGE_MARGIN, value))
  }

  swimTo(rawX: number): void {
    const clamped = this.clamp(rawX)
    if (Math.abs(clamped - this.x) < 4) return
    this.facingLeft = clamped < this.x
    this.target = clamped
  }

  get swimming(): boolean {
    return this.target !== null
  }

  update(dt: number): void {
    if (this.target === null) {
      this.vx = 0
      return
    }
    const diff = this.target - this.x
    const move = SWIM_SPEED * dt
    if (Math.abs(diff) <= move) {
      this.x = this.target
      this.target = null
      this.vx = 0
      return
    }
    this.x += Math.sign(diff) * move
    this.vx = Math.sign(diff) * SWIM_SPEED
  }
}
