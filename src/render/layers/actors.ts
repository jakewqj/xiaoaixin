// 角色层(z6 小爱心 / 海草床 / 邻居 + z7 环境气泡)。
//
// 从 Pet.tsx / Npc.tsx / Seagrass.tsx / Bubbles.tsx 翻译过来。DOM 那边是一层套一层的
// transform(swim → bob → dip → tap → 精灵翻转),这里换成 ctx 的变换栈,套的顺序完全一致 ——
// 顺序错一层,摇摆的支点就变了。
//
// 画完返回热区。canvas 出像素,DOM 出语义 —— 焦点框、aria-label、Tab 顺序全靠上面那层
// 透明 <button>(CLAUDE.md 四「键盘焦点可见」不因为 canvas 化而失效)。

import { STAGE_HEIGHT, STAGE_WIDTH } from '../../components/ScreenFrame'
import { FRAME_HEIGHT, FRAME_WIDTH } from '../../lib/pet'
import { heightOf, isGrown } from '../../lib/seagrass'
import type { Seagrass as Plant } from '../../lib/seagrass'
import * as assets from '../assets'
import { alternateProgress, EASE_IN, EASE_IN_OUT, lerp, loopProgress } from '../easing'
import type { Hotspot } from '../types'
import { BUBBLE_SIZES, MOTION, SAND_H, WORLD_DIR } from '../world-data'

/** 触摸下限。DOM 那边是 Tailwind 的 min-h-14 / min-w-14,同一个 56 */
const MIN_TOUCH = 56

/** 热区直径占小爱心宽度的比例。固定像素不行 —— 小爱心长大了热区要跟着变大 */
const HOTSPOT_RATIO = 0.26

const ANCHOR_LABELS: Record<string, string> = {
  tailTip: '小爱心的尾巴',
  bellyCenter: '小爱心的肚子',
  mouth: '小爱心的嘴',
  eye: '小爱心的眼睛',
  blowhole: '小爱心的鼻孔',
}

/** 泡泡的相对排布。left/size 都是相对小爱心图片宽度的百分比,换手稿后不用改 */
const BREATH_BUBBLES = [
  { left: 0, size: 5.5, delay: 0 },
  { left: -2.6, size: 4, delay: 0.6 },
  { left: 2.2, size: 4.6, delay: 1.2 },
  { left: -1.2, size: 3.4, delay: 1.8 },
  { left: 1.6, size: 5, delay: 2.4 },
]

export interface PetView {
  anim: { src: string; frameCount: number; fps: number } | null
  /** 成长阶段的体型倍数 */
  scale: number
  /** 成长阶段的体色,CSS filter 字符串;成年是 undefined(不染色) */
  tone?: string
  anchors: Record<string, [number, number]>
  anchorNames: string[]
  atSurface: boolean
  eating: boolean
  showBubbles: boolean
  popping: boolean
  popMs: number
  tapLabel: string
}

export interface NpcView {
  id: string
  name: string
  leftPx: number
  src: string
  frameWidth: number
  frameHeight: number
  frameCount: number
  fps: number
  canGift: boolean
}

export interface ActorState {
  now: number
  camX: number
  camY: number
  worldWidth: number
  worldHeight: number
  slotCount: number
  reduced: boolean
  petX: number
  /** 转身是 500ms 的 scaleX 过渡,不是瞬间镜像,所以这里是 -1..1 的连续值 */
  flip: number
  petTop: number
  pet: PetView
  seagrass: Plant[]
  npcs: NpcView[]
  /** 一次性动画的起点(ms)。null = 现在没在播 */
  dipAt: number | null
  tapAt: number | null
  bubblesAt: number | null
  poppingAt: number | null
}

// ---- 体色染色缓存 ------------------------------------------------------
// DOM 那边是 CSS filter,每帧由合成器处理。canvas 每帧 ctx.filter 太贵,
// 而体色只在成长阶段变化时才动,所以整张精灵表预染一次存起来(REFACTOR_PLAN §三 阶段 2)
const tinted = new Map<string, HTMLCanvasElement>()

function tintedSheet(img: HTMLImageElement, src: string, tone: string): CanvasRenderingContext2D['canvas'] {
  const key = `${src}|${tone}`
  const hit = tinted.get(key)
  if (hit) return hit
  const off = document.createElement('canvas')
  off.width = img.width
  off.height = img.height
  const octx = off.getContext('2d')
  if (octx) {
    octx.imageSmoothingEnabled = false
    octx.filter = tone
    octx.drawImage(img, 0, 0)
  }
  tinted.set(key, off)
  return off
}

/** 精灵翻帧。低帧率的顿挫感是 Stardew 观感的一半,不许跟着 rAF 跑到 60fps(宪法十三) */
function frameOf(now: number, fps: number, count: number, frozen: boolean): number {
  if (frozen || fps <= 0) return 0
  return Math.floor(now / (1000 / fps)) % count
}

// ---- 小爱心 -----------------------------------------------------------

interface PetBox {
  w: number
  h: number
  cx: number
  cy: number
  spriteH: number
}

/** 小爱心那一摞 div 的盒子。
 *
 *  boxH 会被 min-h-14(56px 的触摸下限)抬高 —— 幼年精灵只有 32 高,盒子却是 56。
 *  多出来的那截**上下平分**:<button> 会把内容垂直居中,这是 Blink 对按钮的固有行为,
 *  不是哪条 CSS 写的。第一版按「贴上沿」画,Dolly 整体高了 4px,截图比对才逮到 */
function petBox(s: ActorState): PetBox {
  const w = FRAME_WIDTH * s.pet.scale
  const spriteH = FRAME_HEIGHT * s.pet.scale
  const h = Math.max(MIN_TOUCH, spriteH)
  return { w, h, cx: s.petX, cy: s.petTop, spriteH }
}

/** 把 ctx 变换到「小爱心盒子中心」,bob 摇摆和进食下潜都已经套好 */
function enterPetFrame(ctx: CanvasRenderingContext2D, s: ActorState, box: PetBox): void {
  ctx.translate(box.cx, box.cy)
  if (!s.reduced) {
    const t = EASE_IN_OUT(alternateProgress(s.now, MOTION.petBobSec))
    ctx.translate(0, lerp(MOTION.petBobFrom.y, MOTION.petBobTo.y, t))
    ctx.rotate((lerp(MOTION.petBobFrom.deg, MOTION.petBobTo.deg, t) * Math.PI) / 180)
  } else {
    ctx.translate(0, MOTION.petBobFrom.y)
    ctx.rotate((MOTION.petBobFrom.deg * Math.PI) / 180)
  }
  ctx.translate(0, dipOffset(s))
}

// 进食:沉向海草床啃一会儿再自己浮回来。关键帧 0% / 25% / 78% / 100%,
// CSS 的 animation-timing-function 是逐段生效的,所以两头各缓动一次,中间是平的
function dipOffset(s: ActorState): number {
  if (s.dipAt === null || s.reduced) return 0
  const p = (s.now - s.dipAt) / EAT_MS
  if (p <= 0 || p >= 1) return 0
  if (p < 0.25) return lerp(0, MOTION.petDipY, EASE_IN_OUT(p / 0.25))
  if (p < 0.78) return MOTION.petDipY
  return lerp(MOTION.petDipY, 0, EASE_IN_OUT((p - 0.78) / 0.22))
}

/** 进食一次的时长:沉下去 → 贴底啃一会儿 → 浮回来 */
export const EAT_MS = 4200

function tapScale(s: ActorState): number {
  if (s.tapAt === null || s.reduced) return 1
  const p = (s.now - s.tapAt) / MOTION.petTapMs
  if (p <= 0 || p >= 1) return 1
  return p < 0.5
    ? lerp(1, MOTION.petTapScale, EASE_IN_OUT(p / 0.5))
    : lerp(MOTION.petTapScale, 1, EASE_IN_OUT((p - 0.5) / 0.5))
}

function drawPet(ctx: CanvasRenderingContext2D, s: ActorState, spots: Hotspot[]): void {
  const { anim } = s.pet
  if (!anim) return
  const sheet = assets.get(anim.src)
  if (!sheet) return
  const box = petBox(s)

  ctx.save()
  enterPetFrame(ctx, s, box)

  // 精灵在按钮里是居中的,按钮又填满整个盒子 —— 两个中心重合,所以这里不用再挪
  ctx.save()
  const tap = tapScale(s)
  ctx.scale(tap * (s.flip || 1e-6), tap)
  const frame = frameOf(s.now, anim.fps, anim.frameCount, s.reduced)
  const source = s.pet.tone ? tintedSheet(sheet, anim.src, s.pet.tone) : sheet
  ctx.drawImage(
    source,
    frame * FRAME_WIDTH,
    0,
    FRAME_WIDTH,
    FRAME_HEIGHT,
    -box.w / 2,
    -box.spriteH / 2,
    box.w,
    box.spriteH,
  )
  ctx.restore()

  if (s.pet.showBubbles) drawBreathBubbles(ctx, s, box)
  ctx.restore()

  // 热区:本体一个 + 每个锚点一个。位置跟着 bob/dip 走,但不跟着转 ——
  // 2 度的倾斜落到 56px 的方块上不到 1px,不值得给每个按钮上矩阵
  const shift = petShift(s)
  pushSpot(spots, s, '__pet', s.pet.tapLabel, box.cx - box.w / 2 + shift.x, box.cy - box.h / 2 + shift.y, box.w, box.h)

  const size = Math.max(MIN_TOUCH, HOTSPOT_RATIO * box.w)
  for (const name of s.pet.anchorNames) {
    const point = s.pet.anchors[name]
    if (!point) continue
    const [ax, ay] = point
    const px = (s.flip < 0 ? 1 - ax : ax) * box.w
    const py = ay * box.h
    pushSpot(
      spots,
      s,
      `anchor:${name}`,
      ANCHOR_LABELS[name] ?? '小爱心',
      box.cx - box.w / 2 + px - size / 2 + shift.x,
      box.cy - box.h / 2 + py - size / 2 + shift.y,
      size,
      size,
    )
  }
}

/** bob + dip 带来的整体位移(转动不算进去,热区不跟着转) */
function petShift(s: ActorState): { x: number; y: number } {
  const bob = s.reduced
    ? MOTION.petBobFrom.y
    : lerp(
        MOTION.petBobFrom.y,
        MOTION.petBobTo.y,
        EASE_IN_OUT(alternateProgress(s.now, MOTION.petBobSec)),
      )
  return { x: 0, y: bob + dipOffset(s) }
}

// 换气泡泡。位置来自 pet.json 的 blowhole 锚点,小爱心转身时 x 跟着镜像。
// 它是「该换气了」的唯一提示 —— 减弱动态效果时泡泡不动,但必须还看得见(index.css 同款例外)
function drawBreathBubbles(ctx: CanvasRenderingContext2D, s: ActorState, box: PetBox): void {
  const anchor = s.pet.anchors.blowhole
  if (!anchor || s.bubblesAt === null) return
  const [ax, ay] = anchor
  const originX = (s.flip < 0 ? 1 - ax : ax) * box.w - box.w / 2
  const originY = ay * box.h - box.h / 2

  // 散开时整层一起淡出:泡泡各自升到哪就在哪消失,不会跳回鼻孔重来一遍
  let layerAlpha = 1
  if (s.poppingAt !== null) {
    layerAlpha = Math.max(0, 1 - (s.now - s.poppingAt) / s.pet.popMs)
  }
  if (layerAlpha <= 0) return

  for (const bubble of BREATH_BUBBLES) {
    const cx = originX + (bubble.left / 100) * box.w
    const r = ((bubble.size / 100) * box.w) / 2
    const elapsed = (s.now - s.bubblesAt) / 1000 - bubble.delay

    // 正 delay:动画还没开始,fill-mode 是 none,所以显示的是元素本身的样子
    let dy = 0
    let scale = 1
    let alpha = 1
    if (elapsed >= 0 && !s.reduced) {
      const p = EASE_IN(loopProgress(elapsed * 1000, MOTION.breathBubbleSec))
      dy = -MOTION.breathBubbleRise * p
      scale = lerp(0.3, 1, p)
      alpha = p < 0.2 ? lerp(0, 0.95, p / 0.2) : lerp(0.95, 0, (p - 0.2) / 0.8)
    }
    if (alpha <= 0) continue

    ctx.save()
    ctx.globalAlpha = layerAlpha * alpha
    ctx.beginPath()
    ctx.arc(cx, originY + dy, r * scale, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)'
    ctx.fill()
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'
    ctx.stroke()
    ctx.restore()
  }
}

// ---- 海草床 -----------------------------------------------------------

// 唯一一处不是 drawImage 的绘制:海草本来就是 SVG 描边矢量图,烧成 PNG 反而失真。
// 新芽矮、颜色浅,长成的高、颜色深 —— 差别要一眼看得出,不然三天的等待就白等了
const BLADE_YOUNG = '#a8cc72'
const BLADE_GROWN = '#6fa84b'

function blade(ctx: CanvasRenderingContext2D, path: [number, number, number, number, number, number]): void {
  ctx.beginPath()
  ctx.moveTo(20, 100)
  ctx.bezierCurveTo(path[0], path[1], path[2], path[3], path[4], path[5])
  ctx.stroke()
}

function drawSeagrassBed(ctx: CanvasRenderingContext2D, s: ActorState, spots: Hotspot[]): void {
  // 海草床固定长在第一格「家海草床」,不跟她走
  const bedTop = s.worldHeight - 70
  pushSpot(spots, s, '__bed', '海草床', 0, bedTop, STAGE_WIDTH, 70)

  for (const plant of s.seagrass) {
    const grown = isGrown(plant)
    const w = Math.min(40, STAGE_WIDTH * 0.07)
    const h = (grown ? 34 : 16) * heightOf(plant)
    const left = (plant.x / 100) * STAGE_WIDTH - w / 2
    // 沙底 tile 高 40px,根扎在沙面往下一点,像长在沙里而不是浮在沙上
    const bottom = s.worldHeight - 30

    // SVG 默认 preserveAspectRatio="xMidYMid meet":等比缩放后居中,不是拉伸
    const k = Math.min(w / 40, h / 100)
    ctx.save()
    ctx.translate(left + (w - 40 * k) / 2, bottom - h + (h - 100 * k) / 2)
    ctx.scale(k, k)
    ctx.strokeStyle = grown ? BLADE_GROWN : BLADE_YOUNG
    ctx.lineWidth = 7
    ctx.lineCap = 'round'
    blade(ctx, [16, 72, 8, 52, 10, 22])
    if (grown) {
      blade(ctx, [26, 74, 34, 56, 32, 30])
      blade(ctx, [20, 70, 21, 50, 20, 34])
    }
    ctx.restore()
  }
}

// ---- 邻居 -------------------------------------------------------------

function drawNpcs(ctx: CanvasRenderingContext2D, s: ActorState, spots: Hotspot[]): void {
  for (const npc of s.npcs) {
    const sheet = assets.get(npc.src)
    // bottom-40:游在中上层水域,错开小爱心的漂移带和右下角按钮区
    const boxW = Math.max(MIN_TOUCH, npc.frameWidth)
    const boxH = Math.max(MIN_TOUCH, npc.frameHeight)
    const left = npc.leftPx - boxW / 2
    const top = s.worldHeight - 160 - boxH

    if (sheet) {
      const frame = frameOf(s.now, npc.fps, npc.frameCount, s.reduced)
      // 精灵在按钮里居中(见 petBox 的注释),盒子被 56px 触摸下限撑高时要跟着让开
      ctx.drawImage(
        sheet,
        frame * npc.frameWidth,
        0,
        npc.frameWidth,
        npc.frameHeight,
        Math.round(left + (boxW - npc.frameWidth) / 2),
        Math.round(top + (boxH - npc.frameHeight) / 2),
        npc.frameWidth,
        npc.frameHeight,
      )
    }
    pushSpot(spots, s, `npc:${npc.id}`, npc.name, left, top, boxW, boxH)

    if (!npc.canGift) continue
    const gx = left + boxW + 8 - 20
    const gy = top - 32
    const slot = assets.get(`${WORLD_DIR}/ui/sv/slot.png`)
    const icon = assets.get(`${WORLD_DIR}/ui/icon_sprout.png`)
    if (slot) ctx.drawImage(slot, gx, gy)
    if (icon) ctx.drawImage(icon, gx + 2, gy + 2)
    pushSpot(spots, s, `gift:${npc.id}`, `送海草给${npc.name}`, gx, gy, 20, 20)
  }
}

// ---- 环境气泡(z7,压在角色之上)---------------------------------------

function drawAmbientBubbles(ctx: CanvasRenderingContext2D, s: ActorState): void {
  const first = Math.max(0, Math.floor(s.camX / STAGE_WIDTH) - 1)
  const last = Math.min(s.slotCount - 1, Math.floor((s.camX + STAGE_WIDTH - 1) / STAGE_WIDTH) + 1)
  for (let i = first; i <= last; i++) {
    for (let j = 0; j < 5; j++) {
      const tex = assets.get(`${WORLD_DIR}/${BUBBLE_SIZES[(i + j) % 3]}`)
      if (!tex) continue
      const left = i * STAGE_WIDTH + 90 + ((i * 173 + j * 97) % 320)
      const bottom = s.worldHeight - (SAND_H + 40 + ((i * 53 + j * 71) % 110))
      const durationSec = 3.4 + ((i + j * 3) % 4) * 0.6
      const p = s.reduced ? 0 : EASE_IN(loopProgress(s.now, durationSec, -((i * 5 + j * 13) % 40) / 10))
      ctx.save()
      ctx.globalAlpha = lerp(0.95, 0, p)
      ctx.drawImage(tex, left, Math.round(bottom - tex.height - MOTION.ambientBubbleRise * p))
      ctx.restore()
    }
  }
}

// ---- 组装 -------------------------------------------------------------

/** 热区是屏幕坐标(舞台 480x270 里的位置),画完顺手算出来,和像素永远对得上 */
function pushSpot(
  spots: Hotspot[],
  s: ActorState,
  id: string,
  label: string,
  worldX: number,
  worldY: number,
  w: number,
  h: number,
): void {
  const x = worldX - s.camX
  const y = worldY - s.camY
  if (x + w < 0 || x > STAGE_WIDTH || y + h < 0 || y > STAGE_HEIGHT) return
  spots.push({ id, label, x, y, w, h })
}

export function drawActors(ctx: CanvasRenderingContext2D, s: ActorState): Hotspot[] {
  ctx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  const spots: Hotspot[] = []
  ctx.save()
  ctx.translate(-Math.round(s.camX), -Math.round(s.camY))

  drawSeagrassBed(ctx, s, spots)
  drawNpcs(ctx, s, spots)
  drawShadow(ctx, s)
  drawPet(ctx, s, spots)
  drawAmbientBubbles(ctx, s)

  ctx.restore()
  return spots
}

// 白天投在沙地上的影子,跟着她游动移动(参考图沙地中间那块深色)。体型长大影子跟着变大
function drawShadow(ctx: CanvasRenderingContext2D, s: ActorState): void {
  const tex = assets.get(`${WORLD_DIR}/shadow.png`)
  if (!tex) return
  const w = 170 * s.pet.scale
  const h = (tex.height / tex.width) * w
  ctx.drawImage(tex, s.petX - w / 2, s.worldHeight - 30 - h, w, h)
}
