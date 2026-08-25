// 世界渲染运行时。零 React —— 这里面不 import 任何 hook、不碰 localStorage、
// 不做任何游戏数值结算(REFACTOR_PLAN §四 四道闸)。它只知道「现在饱食度是 3」,
// 不知道为什么是 3。
//
// 唯一的 rAF 在这里。位置、镜头、粒子全部放实例字段,不进 React state ——
// 重构前小爱心游动时每帧 setX 一次,即每帧 React 全树重渲染一次;重构后是 0 次。

import { STAGE_HEIGHT, STAGE_WIDTH } from '../components/ScreenFrame'
import { FRAME_HEIGHT, FRAME_WIDTH } from '../lib/pet'
import type { SeaTheme } from '../lib/seas'
import type { Seagrass as Plant } from '../lib/seagrass'
import { Camera } from './camera'
import { EASE_IN_OUT, lerp } from './easing'
import { drawBackground } from './layers/background'
import { drawActors, EAT_MS } from './layers/actors'
import type { ActorState, NpcView, PetView, NoteView } from './layers/actors'
export type { NoteView } from './layers/actors'
export { placeNotePos, seagrassNoteRow } from './layers/actors'
import { drawOverlay } from './layers/overlay'
import { REST_Y, Swim } from './swim'
import type { Hotspot } from './types'
import type { Furrow } from './layers/background'
import { FURROW, GRAZE, MOTION, SAND_H, WATER_LINE } from './world-data'

/** 她能游到的最浅处:水面线再往下留出半个身子,别把背露出水面 */
const CEILING_PAD = 6

/** 站着换气时鼻孔探出水面多少。露一点就够,整个头拔出水面就成了跃出海面 */
const SURFACE_POKE = 2

export type { NpcView, PetView }

/** React 侧推进来的一份世界状态。低频 —— 状态变了才推,不是每帧 */
export interface WorldSnapshot {
  sea: SeaTheme
  clarity: number
  surfaced: boolean
  slotCount: number
  /** 每一格是哪个地点。渲染层只拿它挑装饰,不做任何游戏逻辑 */
  spotIds: string[]
  lockedBeyondEnd: boolean
  lockedBeforeStart: boolean
  pet: PetView
  seagrass: Plant[]
  npcs: NpcView[]
  notes: NoteView[]
  /** 换气上浮/下沉的时长,和 useBreath 用的是同一个数,不能各写一份 */
  swimMs: number
}

export class WorldRenderer {
  readonly swim = new Swim()
  readonly camera = new Camera()

  private bg: CanvasRenderingContext2D | null = null
  private actors: CanvasRenderingContext2D | null = null
  private overlay: CanvasRenderingContext2D | null = null
  private raf = 0
  private last = 0
  /** 调试用:把时钟钉死,截图比对时两版才停在同一相位 */
  private frozenAt: number | null = null
  private clock = 0

  /** 减弱动态效果:粒子停、镜头瞬移、精灵停在第一帧。
   *  canvas 化之后 index.css 的媒体查询管不着世界层了,只能在运行时实现(宪法二十一配套约束第 3 条) */
  private reduced = false

  private snap: WorldSnapshot | null = null
  private spots: Hotspot[] = []
  private spotEls = new Map<string, HTMLElement>()
  private spotKey = ''
  private onSpots: ((spots: Hotspot[]) => void) | null = null

  // 一次性动画的起点。DOM 那边靠元素挂载/类名切换触发,这里显式记时刻
  private tapAt: number | null = null
  private bubblesAt: number | null = null
  private poppingAt: number | null = null

  // 转身是 500ms 的 scaleX 过渡,不是瞬间镜像
  private flip = 1
  private flipFrom = 1
  private flipAt = -Infinity

  // 换气的纵向由 useBreath 的节拍接管:上浮 / 下沉各走 swimMs,和状态机同一个时长。
  // 其余时候纵向归 swim —— 点哪游哪现在是二维的,她自己就会上下游
  private petTop = REST_Y
  private breathFrom = REST_Y
  private breathTo = REST_Y
  private breathAt = -Infinity
  private breathHold = false
  /** 上浮前她在哪一层。换完气回原处,不会平白无故沉回默认深度 */
  private restY = REST_Y

  // 站姿进度 0→1:0 是平着游,1 是竖起来把鼻孔探出水面
  private stand = 0
  private standFrom = 0
  private standTo = 0

  // 进食(拟砂觅食)的三段:游过去 → 低头犁沙 → 抬头。null = 现在没在吃
  private grazePhase: 'travel' | 'plough' | 'lift' | null = null
  private grazeAt = 0
  private grazeFrom = 0
  private grazeTo = 0
  private grazeY = REST_Y
  /** 低头姿势的进度 0→1。犁沙时 bob 要按它压下去,不然吻会一上一下地跳出沙面 */
  private graze = 0
  /** 开犁那一刻记下 swim 的令牌数,中途变了就是童童点了别处 —— 让位给她 */
  private grazeToken = 0
  /** 正在犁的那一道(终点每帧往前长);犁完了移进 furrows */
  private live: Furrow | null = null
  private furrows: Furrow[] = []
  private onEating: ((active: boolean) => void) | null = null
  private onSpot: ((index: number) => void) | null = null
  private spotIndex = -1

  get worldWidth(): number {
    return STAGE_WIDTH * Math.max(1, this.snap?.slotCount ?? 1)
  }

  get worldHeight(): number {
    return STAGE_HEIGHT + WATER_LINE
  }

  /** 她纵向能游的范围。上不出水面,下不钻进沙里;体型长大了范围跟着收。
   *  **犁沙是唯一的例外**:吻要插进沙面以下,身体中心就得比平时的下限再低几像素 */
  private swimBounds(): { minY: number; maxY: number } {
    const half = (FRAME_HEIGHT * (this.snap?.pet.scale ?? 1)) / 2
    const floor = this.worldHeight - SAND_H - half
    return {
      minY: WATER_LINE + half + CEILING_PAD,
      maxY: this.grazePhase ? Math.max(floor, this.grazeY) : floor,
    }
  }

  attach(
    bg: CanvasRenderingContext2D,
    actors: CanvasRenderingContext2D,
    overlay: CanvasRenderingContext2D,
  ): void {
    bg.imageSmoothingEnabled = false
    actors.imageSmoothingEnabled = false
    overlay.imageSmoothingEnabled = false
    this.bg = bg
    this.actors = actors
    this.overlay = overlay
  }

  onHotspotsChanged(cb: (spots: Hotspot[]) => void): void {
    this.onSpots = cb
  }

  /** 透明热区的 DOM 节点。位置每帧由渲染层直接写 style,不走 React */
  bindHotspot(id: string, el: HTMLElement | null): void {
    if (el) this.spotEls.set(id, el)
    else this.spotEls.delete(id)
  }

  setSnapshot(next: WorldSnapshot, reduced: boolean): void {
    const prev = this.snap
    this.snap = next
    this.reduced = reduced
    const bounds = this.swimBounds()
    this.swim.setBounds(this.worldWidth, bounds.minY, bounds.maxY)
    this.swim.reduced = reduced
    this.camera.reduced = reduced

    const now = this.now()
    if (!prev || prev.surfaced !== next.surfaced) {
      this.camera.setSurfaced(next.surfaced, now)
      this.startBreathMove(next, now)
    }
    // 进食:不管她这会儿在多深,先游到海草床、下潜到沙面,再低头往前犁。
    // 在水面换气时不开吃 —— 那一下她正忙着呼吸,纵向还归换气动画管,两边会打架。
    // 这种时候当场回一声「没在吃」,免得 React 那边的姿势一直挂到兜底定时器
    if (next.pet.eating && !prev?.pet.eating) {
      if (next.pet.atSurface) this.onEating?.(false)
      else this.startGraze(now)
    }
    if (next.pet.showBubbles && !prev?.pet.showBubbles) this.bubblesAt = now
    if (!next.pet.showBubbles) this.bubblesAt = null
    if (next.pet.popping && !prev?.pet.popping) this.poppingAt = now
    if (!next.pet.popping) this.poppingAt = null

    this.draw(now)
  }

  /** 换气的一上一下。上去的同时把身子立起来,下来的同时躺平,两件事同一段进度 */
  private startBreathMove(s: WorldSnapshot, now: number): void {
    this.breathFrom = this.petTop
    this.standFrom = this.stand
    if (s.pet.atSurface) {
      this.restY = this.swim.y
      this.breathTo = this.standTop(s)
      this.standTo = 1
      this.breathHold = true
    } else {
      this.breathTo = this.restY
      this.standTo = 0
    }
    this.breathAt = now
  }

  /** 站着换气时身体中心该在哪:让鼻孔正好探出水面。
   *  鼻孔位置读 pet.json 的 blowhole 锚点 —— 换手稿后鼻孔挪了,她站的高度自动跟着变(宪法五) */
  private standTop(s: WorldSnapshot): number {
    const ax = s.pet.anchors.blowhole?.[0]
    if (ax === undefined) return 0.3 * this.worldHeight
    // 立起来之后,精灵横向上离中心多远,就等于竖向上离中心多高
    return WATER_LINE - SURFACE_POKE + (ax - 0.5) * FRAME_WIDTH * s.pet.scale
  }

  /** 犁沙时身体中心该在哪:让**吻部**(mouth 锚点)正好插到沙面以下 `GRAZE.dig` px。
   *
   *  锚点在精灵里的偏移转过低头角之后就是吻离身体中心的垂直距离。
   *  朝左时锚点横向镜像、低头角也取反,两个负号抵消 —— 所以这个高度和朝向无关,只算一次。
   *  鼻子位置来自 `pet.json`,换手稿后吻挪了,她低头的深浅自动跟着变(宪法五) */
  private grazeCenterY(s: WorldSnapshot): number {
    const scale = s.pet.scale
    const [mx, my] = s.pet.anchors.mouth ?? [0.885, 0.7]
    const drop =
      Math.abs(mx - 0.5) * FRAME_WIDTH * scale * Math.sin(GRAZE.pitch) +
      (my - 0.5) * FRAME_HEIGHT * scale * Math.cos(GRAZE.pitch)
    return this.worldHeight - SAND_H + GRAZE.dig - drop
  }

  /** 开吃:先算好这一趟要犁哪一段,然后就当成一次普通的「游到这儿」交给 swim。
   *  下潜是斜着游过去的,不是先横后竖 —— 二维游动本来就这样 */
  private startGraze(now: number): void {
    const s = this.snap
    if (!s) return
    this.grazeY = this.grazeCenterY(s)
    // 海草床固定在第一格,所以犁痕的起止是绝对坐标,不跟她走
    const a = GRAZE.fromRatio * STAGE_WIDTH
    const b = GRAZE.toRatio * STAGE_WIDTH
    // 从离她近的那头下嘴,往另一头犁 —— 不用为了「一律从左往右」多绕半张床
    const nearB = Math.abs(this.swim.x - b) < Math.abs(this.swim.x - a)
    this.grazeFrom = nearB ? b : a
    this.grazeTo = nearB ? a : b
    this.grazePhase = 'travel'
    this.grazeAt = now
    const bounds = this.swimBounds()
    this.swim.setBounds(this.worldWidth, bounds.minY, bounds.maxY)
    this.swim.swimTo(this.grazeFrom, this.grazeY)
    this.grazeToken = this.swim.commands
  }

  /** 收摊。`interrupted` = 童童中途点了别处,那就把犁到一半的沟留在沙上就行 */
  private endGraze(): void {
    if (this.live) {
      if (Math.abs(this.live.to - this.live.from) > 2) this.furrows.push(this.live)
      this.live = null
    }
    this.grazePhase = null
    this.graze = 0
    const bounds = this.swimBounds()
    this.swim.setBounds(this.worldWidth, bounds.minY, bounds.maxY)
    this.onEating?.(false)
  }

  /** 每帧推进进食。返回这一帧的低头角(0 = 没在吃) */
  private stepGraze(now: number): number {
    if (!this.grazePhase) return 0
    // 童童中途点了别处 → 她听童童的。犁到哪儿算哪儿,没有惩罚也没有「重来一次」
    if (this.swim.commands !== this.grazeToken) {
      this.endGraze()
      return 0
    }
    const dir = this.grazeTo < this.grazeFrom ? -1 : 1
    const span = Math.abs(this.grazeTo - this.grazeFrom)
    const ploughMs = this.reduced ? 0 : (span / GRAZE.speed) * 1000

    if (this.grazePhase === 'travel') {
      if (this.swim.swimming) return 0
      // 到床边了,开犁:转向犁的方向,记下这一道沟的起点
      this.grazePhase = 'plough'
      this.grazeAt = now
      const facingLeft = dir < 0
      if (facingLeft !== this.swim.facingLeft) {
        this.swim.facingLeft = facingLeft
        this.flipFrom = this.flip
        this.flipAt = now
      }
      this.live = { from: this.grazeFrom, to: this.grazeFrom, at: now }
      this.onEating?.(true)
    }

    if (this.grazePhase === 'plough') {
      const p = ploughMs <= 0 ? 1 : Math.min(1, (now - this.grazeAt) / ploughMs)
      const x = lerp(this.grazeFrom, this.grazeTo, p)
      this.swim.holdAt(x, this.grazeY)
      this.grazeToken = this.swim.commands
      if (this.live) this.live.to = x
      this.graze = this.reduced ? 1 : Math.min(1, (now - this.grazeAt) / GRAZE.easeMs)
      if (p >= 1) {
        this.grazePhase = 'lift'
        this.grazeAt = now
      }
    } else if (this.grazePhase === 'lift') {
      // 抬头:沟已经犁完了,这几百毫秒只是把姿势收回来,不再往前走。
      // **纵向也要一起收**:犁沙时她比平时的下限还低几像素(吻要插进沙),
      // 不在这儿收回来的话,收摊时 setBounds 会把她「啪」地往上弹那几像素
      const p = this.reduced ? 1 : Math.min(1, (now - this.grazeAt) / GRAZE.easeMs)
      const half = (FRAME_HEIGHT * (this.snap?.pet.scale ?? 1)) / 2
      const floor = Math.min(this.grazeY, this.worldHeight - SAND_H - half)
      this.swim.holdAt(this.grazeTo, lerp(this.grazeY, floor, p))
      this.grazeToken = this.swim.commands
      this.graze = 1 - p
      if (p >= 1) {
        this.endGraze()
        return 0
      }
    }
    // 低头角本身不带进度,进度在 draw() 里一次性插值 —— 免得两处各乘一遍
    return GRAZE.pitch * (this.swim.facingLeft ? -1 : 1)
  }

  /** 犁痕会被水慢慢抚平。过期的直接扔掉,不留着白算 alpha */
  private sweepFurrows(now: number): void {
    if (!this.furrows.length) return
    this.furrows = this.furrows.filter((f) => now - f.at < FURROW.fadeMs)
  }

  /** 进食动作真正开始/结束的时刻。React 靠它切「eating」那套精灵图 ——
   *  游过去的路上还该是 swim,到了才是 eating */
  onEatingChanged(cb: (active: boolean) => void): void {
    this.onEating = cb
  }

  /** 她游进了第几格(地点)。地点切换早就没有按钮了 —— 点哪游哪、镜头跟随,
   *  React 这边根本不知道她在哪一格。「首次抵达新地点」(ROADMAP 2-6)要的就是这个信号,
   *  所以只能由渲染层回头通知,和 onEatingChanged 同一个路子。
   *  只在**跨格**的那一帧报一次,不是每帧都报 */
  onSpotChanged(cb: (index: number) => void): void {
    this.onSpot = cb
    // 订阅晚了一步要补一次。setSnapshot 结尾会**同步**画一帧,
    // 而 React 那边是先 setSnapshot 后 onSpotChanged 两个 effect —— 第 0 格的
    // -1 → 0 就发在那一帧,回调还没挂上,而格号已经落定了永远不会再发。
    // 后果是家海草床那块「给这里起名字」的木牌一整局都不出现(2026-08-24 实测)
    if (this.spotIndex >= 0) cb(this.spotIndex)
  }

  /** 点了她一下:放大回弹。在水面等着的时候点她 = 帮她换气,这层判断在 React 那边 */
  tap(): void {
    this.tapAt = this.now()
  }

  /** 世界坐标 → 让她游过去。转身有 500ms 的过渡,不是啪一下镜像 */
  swimTo(worldX: number, worldY: number): void {
    const before = this.swim.facingLeft
    this.swim.swimTo(worldX, worldY)
    if (this.swim.facingLeft !== before) {
      this.flipFrom = this.flip
      this.flipAt = this.now()
    }
  }

  start(): void {
    if (this.raf) return
    this.last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000)
      this.last = now
      this.swim.update(dt)
      this.draw(this.frozenAt ?? now)
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  stop(): void {
    cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  private now(): number {
    return this.frozenAt ?? performance.now()
  }

  /** 调试:传毫秒把时钟钉死,传 null 放开。只在开发构建里挂到 window 上 */
  freeze(at: number | null): void {
    this.frozenAt = at
    this.draw(this.now())
    // 时钟一钉死,镜头的 dt 就恒为 0,再画多少帧都停在原地 —— 直接落位,截图才可复现
    if (at !== null) {
      this.camera.settle()
      this.draw(this.now())
    }
  }

  private draw(now: number): void {
    const s = this.snap
    if (!s || !this.bg || !this.actors || !this.overlay) return
    this.clock = now

    const reduced = this.reduced
    // 进食要先推:它可能这一帧就把她按到沙面上,镜头得看到落位之后的位置
    const grazeTilt = this.stepGraze(now)
    this.sweepFurrows(now)
    this.camera.update(now, this.swim.x, this.swim.vx, this.worldWidth)

    // 跨格才报一次。第一帧的 -1 → 0 也算一次,所以开局就能拿到「她在第 0 格」
    const slots = Math.max(1, this.snap?.slotCount ?? 1)
    const spot = Math.min(slots - 1, Math.max(0, Math.floor(this.swim.x / STAGE_WIDTH)))
    if (spot !== this.spotIndex) {
      this.spotIndex = spot
      this.onSpot?.(spot)
    }

    // 转身 / 上浮的连续过渡
    const facing = this.swim.facingLeft ? -1 : 1
    if (reduced) {
      this.flip = facing
    } else {
      const t = (now - this.flipAt) / MOTION.petTurnMs
      this.flip = t >= 1 ? facing : lerp(this.flipFrom, facing, EASE_IN_OUT(Math.max(0, t)))
    }
    // 纵向:换气那一上一下由换气动画接管,其余时候归 swim(点哪游哪是二维的)
    if (this.breathHold) {
      const t = reduced || s.swimMs <= 0 ? 1 : (now - this.breathAt) / s.swimMs
      const e = EASE_IN_OUT(Math.max(0, t))
      this.petTop = t >= 1 ? this.breathTo : lerp(this.breathFrom, this.breathTo, e)
      this.stand = t >= 1 ? this.standTo : lerp(this.standFrom, this.standTo, e)
      // 换气期间纵向不归她自己管,但横向还能点 —— 所以只按住 y
      this.swim.holdY(this.petTop)
      if (t >= 1 && !s.pet.atSurface) this.breathHold = false
    } else {
      this.petTop = this.swim.y
      this.stand = 0
    }

    // 身体俯仰:平时朝行进方向,换气时按站姿进度插到「立起来」,犁沙时按低头进度插到「低头」。
    // 立起来 = 头朝上 90°,朝左时角度取反,镜像之后合成出来还是头朝上
    const upright = (-Math.PI / 2) * facing
    const tilt =
      this.stand > 0
        ? lerp(this.swim.pitch, upright, this.stand)
        : this.graze > 0
          ? lerp(this.swim.pitch, grazeTilt, this.graze)
          : this.swim.pitch

    const common = {
      now,
      camX: this.camera.x,
      camY: this.camera.y,
      worldWidth: this.worldWidth,
      worldHeight: this.worldHeight,
      slotCount: Math.max(1, s.slotCount),
      reduced,
    }

    drawBackground(this.bg, {
      ...common,
      sea: s.sea,
      spotIds: s.spotIds,
      clarity: s.clarity,
      lockedBeyondEnd: s.lockedBeyondEnd,
      lockedBeforeStart: s.lockedBeforeStart,
      // 正在犁的那道也要画出来,不然沟是等她犁完才「啪」地出现
      furrows: this.live ? [...this.furrows, this.live] : this.furrows,
    })

    const actorState: ActorState = {
      ...common,
      petX: this.swim.x,
      flip: this.flip,
      petTop: this.petTop,
      tilt,
      graze: this.graze,
      pet: s.pet,
      seagrass: s.seagrass,
      npcs: s.npcs,
      notes: s.notes,
      tapAt: this.tapAt,
      bubblesAt: this.bubblesAt,
      poppingAt: this.poppingAt,
    }
    this.spots = drawActors(this.actors, actorState)
    // 前景礁和光柱压在角色之上 —— 小爱心游过去会从礁后面过,这是唯一的深度信号
    drawOverlay(this.overlay, common)
    this.syncHotspots()
  }

  // 热区跟着画面走。id 集合变了才通知 React 重建按钮(低频),
  // 位置变化直接写 style —— 每帧走一次 React 就白搬这一趟了
  private syncHotspots(): void {
    const key = this.spots.map((s) => `${s.id} ${s.label}`).join('|')
    if (key !== this.spotKey) {
      this.spotKey = key
      this.onSpots?.(this.spots)
      return
    }
    for (const spot of this.spots) {
      const el = this.spotEls.get(spot.id)
      if (!el) continue
      el.style.left = `${Math.round(spot.x)}px`
      el.style.top = `${Math.round(spot.y)}px`
      el.style.width = `${Math.round(spot.w)}px`
      el.style.height = `${Math.round(spot.h)}px`
    }
  }

  /** 屏幕坐标 → 世界坐标。「点哪游哪」的点击层用它 */
  toWorldX(screenX: number): number {
    return screenX + this.camera.x
  }

  toWorldY(screenY: number): number {
    return screenY + this.camera.y
  }

  debug(): {
    x: number
    y: number
    facingLeft: boolean
    pitch: number
    stand: number
    graze: number
    grazePhase: string
    anim: string
    furrows: { from: number; to: number; age: number }[]
    camX: number
    camY: number
    clock: number
  } {
    const all = this.live ? [...this.furrows, this.live] : this.furrows
    return {
      x: this.swim.x,
      y: this.swim.y,
      facingLeft: this.swim.facingLeft,
      pitch: this.swim.pitch,
      stand: this.stand,
      graze: this.graze,
      grazePhase: this.grazePhase ?? 'none',
      anim: this.snap?.pet.anim?.src.split('/').pop() ?? 'none',
      furrows: all.map((f) => ({
        from: Math.round(f.from),
        to: Math.round(f.to),
        age: Math.round(this.clock - f.at),
      })),
      camX: this.camera.x,
      camY: this.camera.y,
      clock: this.clock,
    }
  }
}

export { EAT_MS }
