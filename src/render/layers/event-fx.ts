// 自然事件的专属画面(ROADMAP 4-5)。童童点了「去看看」之后才画,看完就停。
//
// 顺序:先把整个世界压暗一层(和 4-4 那层 DOM 暗幕同一个深蓝),再在上面画事件本身 ——
// 暗幕放在 DOM 里的话,珊瑚卵和小海龟会跟着一起被压暗,主角反而最不亮。
//
// 两条事件:
//   coral_snow   珊瑚卵团从每株珊瑚顶上慢慢往上漂向水面,像倒过来的雪(fact_coral_spawning)
//   turtle_hatch 小海龟一只只从水面钻下来,朝同一个方向游向外海(fact_turtle_hatching)
//
// 和浮尘同一个路子:每一颗、每一只的位置都是 (索引, 时刻) 的**纯函数**,不存数组、不随机 ——
// 时钟钉死可复现,减弱动态效果时原地不动,切后台回来不补帧。
//
// **卵团是全项目第五处用 fillRect 而不是 drawImage**(前四处:海草床描边、浮尘、犁沙、夜色)。
// 一颗卵团就是 1–2 个逻辑像素,出 PNG 只会多一道采样;宪法五/十三 管的是美术素材 ——
// 小海龟有脸有鳍,那就是素材,照旧走 /assets/world/hatchling.png。
//
// **发射位置读装饰表**(decorFor),不写死坐标(宪法五「特效的发射位置必须读锚点配置」):
// 哪几株是珊瑚、摆在哪、多高,都是 world-data.ts 里那张排布表说了算,换了摆位卵团跟着走。

import { STAGE_HEIGHT, STAGE_WIDTH } from '../../components/ScreenFrame'
import * as assets from '../assets'
import { layer } from '../parallax'
import { decorFor, EVENT_FX, PARALLAX, SAND_H, WORLD_DIR } from '../world-data'

export interface EventFxState {
  now: number
  camX: number
  camY: number
  worldHeight: number
  slotCount: number
  spotIds: string[]
  surfaceY: number
  reduced: boolean
  /** 演哪一种。'' = 这条事件没有专属画面,只压暗 */
  fx: string
  /** 开演那一刻(渲染层时钟)。暗幕的淡入、卵团一颗颗冒出来都从这儿算 */
  at: number
}

/**
 * 确定性伪随机,返回 [0, 1)。同一组数永远给同一个值。
 *
 * **要混得够匀。** 第一版是一轮 FNV,相邻序号的卵团算出来的起漂时间和横向位置都跟序号
 * 线性相关,上屏是一串串斜着往上的链子 —— 像冒泡,不像下雪。换成 murmur3 的收尾混合
 * (fmix32)之后才散成一片
 */
function jitter(...ns: number[]): number {
  let h = 0x9e3779b9
  for (const n of ns) {
    h = Math.imul(h ^ (n | 0), 0x85ebca6b)
    h ^= h >>> 13
    h = Math.imul(h, 0xc2b2ae35)
    h ^= h >>> 16
  }
  return (h >>> 0) / 4294967296
}

/** 开演多久了(毫秒)。减弱动态效果时钉在一个固定时刻:画面照画,只是不动 */
function elapsed(s: EventFxState): number {
  return s.reduced ? EVENT_FX.frozenAtMs : Math.max(0, s.now - s.at)
}

function drawDim(ctx: CanvasRenderingContext2D, s: EventFxState): void {
  const ramp = s.reduced ? 1 : Math.min(1, elapsed(s) / EVENT_FX.dimInMs)
  ctx.fillStyle = `rgba(${EVENT_FX.dimColor}, ${(EVENT_FX.dimAlpha * ramp).toFixed(3)})`
  ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
}

// 珊瑚卵团:每株珊瑚顶上冒一串,慢慢往上漂,到水面淡掉。一株一株错开着冒,
// 开演头几秒是「一处、两处、到处都是」—— 整片珊瑚是同一晚一起放的,但不是同一秒
function drawCoralSnow(ctx: CanvasRenderingContext2D, s: EventFxState): void {
  const t = elapsed(s)
  const C = EVENT_FX.coral
  layer(ctx, s.camX, s.slotCount, PARALLAX.underwaterMid, (_ox, from, to) => {
    for (let i = from; i <= to; i++) {
      decorFor(s.spotIds[i], i).forEach((decor, k) => {
        if (!decor.file.startsWith('coral_')) return
        const tex = assets.get(`${WORLD_DIR}/${decor.file}`)
        if (!tex) return
        const left = i * STAGE_WIDTH + decor.x
        const top = s.worldHeight - (SAND_H - 6 + (decor.lift ?? 0)) - tex.height
        const rise = top - s.surfaceY
        for (let j = 0; j < C.perCoral; j++) {
          const period = C.riseMs * (0.8 + 0.5 * jitter(i, k, j, 1))
          const delay = C.startSpreadMs * jitter(i, k, j, 2)
          if (t < delay) continue
          const p = ((t - delay) / period) % 1
          const sway = Math.sin((t / C.swayMs + jitter(i, k, j, 3)) * Math.PI * 2) * C.swayPx
          const x = Math.round(left + 2 + jitter(i, k, j, 4) * (tex.width - 4) + sway)
          const y = Math.round(top + 2 - p * rise)
          const fade = Math.min(1, p / 0.1, (1 - p) / 0.2)
          ctx.globalAlpha = C.alpha * Math.max(0, fade)
          ctx.fillStyle = C.colors[j % C.colors.length]
          // 三颗里两颗是 2px:1px 在夜里压过暗幕之后几乎看不见
          const size = j % 3 === 2 ? 1 : 2
          ctx.fillRect(x, y, size, size)
        }
      })
    }
  })
  ctx.globalAlpha = 1
}

// 小海龟:从水面一只只钻下来,朝右(精灵朝右,宪法十三)游向外海,游出画面再从头来。
// 画在屏幕坐标里 —— 这是「她在看的那一幕」,镜头停在哪、第几格都一样看得见
function drawTurtleHatch(ctx: CanvasRenderingContext2D, s: EventFxState): void {
  const tex = assets.get(`${WORLD_DIR}/hatchling.png`)
  if (!tex) return
  const t = elapsed(s)
  const H = EVENT_FX.hatch
  const fw = tex.width / 2
  const surface = s.surfaceY - Math.round(s.camY)
  for (let k = 0; k < H.count; k++) {
    const delay = k * H.staggerMs + jitter(k, 1) * H.staggerMs
    if (t < delay) continue
    const p = ((t - delay) / H.swimMs) % 1
    const x0 = H.fromX + jitter(k, 2) * H.spreadX
    const x = Math.round(x0 + p * H.travelX)
    // 先往下钻一小段,然后贴着水面下一层往外游 —— 幼龟出海头几天就是在浅层拼命划
    const dive = Math.min(1, p / 0.15)
    const y = Math.round(surface - 4 + dive * (H.depth + jitter(k, 3) * H.depthSpread) + Math.sin(p * 9 + k) * 2)
    const frame = s.reduced ? 0 : Math.floor((t + k * 60) / H.frameMs) % 2
    const fade = Math.min(1, (1 - p) / 0.08)
    ctx.globalAlpha = Math.max(0, fade)
    ctx.drawImage(tex, frame * fw, 0, fw, tex.height, x, y, fw, tex.height)
  }
  ctx.globalAlpha = 1
}

/** 画一帧事件画面。在 overlay 那块 canvas 上、夜色之后画 —— 事件是这一刻最亮的东西 */
export function drawEventFx(ctx: CanvasRenderingContext2D, s: EventFxState): void {
  drawDim(ctx, s)
  if (s.fx === 'coral_snow') {
    ctx.save()
    ctx.translate(0, -Math.round(s.camY))
    drawCoralSnow(ctx, s)
    ctx.restore()
  } else if (s.fx === 'turtle_hatch') {
    drawTurtleHatch(ctx, s)
  }
}
