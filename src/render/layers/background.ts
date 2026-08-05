// 背景六层(z0 天空 / z1 远岛 / z2 水面线 / z3 水下远景 / z4 中景 / z5 沙底)。
//
// 从 Scene.tsx 的六个函数逐个翻译过来,**摆放数值一个都没改**。
// 原来是 CSS 的地方(云横移、水面 steps 漂移、海带摇摆)按 index.css 里的时长和关键帧复刻,
// 见 world-data.ts 的 MOTION —— 验收标准是「画面看不出区别」,不是「效果更好」。
//
// 坐标全部是世界坐标(y=0 是天空顶,y=WORLD_HEIGHT 是沙底底)。
// CSS 那边大量用 `bottom: xxx`,这里统一用 worldH - bottom 换算,不要每处手算。

import { STAGE_HEIGHT, STAGE_WIDTH } from '../../components/ScreenFrame'
import type { SeaTheme } from '../../lib/seas'
import * as assets from '../assets'
import { alternateProgress, EASE_IN_OUT, lerp, LINEAR, loopProgress, stepIndex } from '../easing'
import { indexRange, layer } from '../parallax'
import { DUST_FAR, drawDust, drawSparkles } from './particles'
import {
  DECOR_VARIANTS,
  LOCKED_HINT_COLOR,
  MAX_HAZE,
  MOTION,
  PARALLAX,
  SAND_COLOR,
  SAND_H,
  SCATTER,
  SHAFT,
  WATER_LINE,
  WORLD_DIR,
} from '../world-data'

export interface BgState {
  now: number
  camX: number
  camY: number
  worldWidth: number
  worldHeight: number
  slotCount: number
  sea: SeaTheme
  clarity: number
  lockedBeyondEnd: boolean
  lockedBeforeStart: boolean
  reduced: boolean
}

function img(file: string): HTMLImageElement | null {
  return assets.get(`${WORLD_DIR}/${file}`)
}

/** repeat-x 平铺一条带子。phase 对应 CSS 的 background-position-x */
function tileX(
  ctx: CanvasRenderingContext2D,
  tex: HTMLImageElement,
  y: number,
  left: number,
  right: number,
  phase = 0,
): void {
  const w = tex.width
  if (w <= 0) return
  let x = phase + Math.floor((left - phase) / w) * w
  for (; x < right; x += w) ctx.drawImage(tex, Math.round(x), Math.round(y))
}

// 天空 + 云。云离得最远飘得最慢,整层被水面线裁掉 —— 原来靠 overflow-hidden,这里靠 clip
function drawSky(ctx: CanvasRenderingContext2D, s: BgState, ox: number, from: number, to: number): void {
  const sky = img('sky.png')
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox, 0, STAGE_WIDTH, WATER_LINE)
  ctx.clip()
  if (sky) tileX(ctx, sky, 0, ox, ox + STAGE_WIDTH)

  const big = img('cloud_big.png')
  const small = img('cloud_small.png')
  const drift = (delaySec: number) =>
    s.reduced
      ? MOTION.cloudFrom
      : lerp(
          MOTION.cloudFrom,
          MOTION.cloudTo,
          LINEAR(loopProgress(s.now, MOTION.cloudDriftSec, delaySec)),
        )

  for (let i = from; i <= to; i++) {
    if (big) {
      ctx.drawImage(
        big,
        Math.round(i * STAGE_WIDTH + drift(-(i * 7) % 40)),
        8 + ((i * 53) % 14),
      )
    }
    if (small) {
      ctx.drawImage(
        small,
        Math.round(i * STAGE_WIDTH + drift((-9 - i * 11) % 40)),
        26 + ((i * 31) % 10),
      )
    }
  }
  ctx.restore()
}

// 海平线上的棕榈小岛:参考图是一大一小两座,底座压着海平线
function drawIslands(ctx: CanvasRenderingContext2D, from: number, to: number): void {
  const big = img('island_big.png')
  const small = img('island_small.png')
  for (let i = from; i <= to; i++) {
    if (big) ctx.drawImage(big, i * STAGE_WIDTH + 260 + ((i * 97) % 120), 15)
    if (small) ctx.drawImage(small, i * STAGE_WIDTH + 150 + ((i * 61) % 90), 27)
  }
}

// 白沫波纹贴着水面线横向慢慢漂(steps 硬切,像素风不做平滑滚动)
function drawSurface(ctx: CanvasRenderingContext2D, s: BgState, ox: number): void {
  const tex = img('surface.png')
  if (!tex) return
  const step = s.reduced
    ? 0
    : stepIndex(loopProgress(s.now, MOTION.surfaceDriftSec), MOTION.surfaceSteps)
  const phase = (MOTION.surfaceShift * step) / MOTION.surfaceSteps
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox, WATER_LINE - 3, STAGE_WIDTH, tex.height)
  ctx.clip()
  tileX(ctx, tex, WATER_LINE - 3, ox, ox + STAGE_WIDTH, phase)
  ctx.restore()
}

// 三层水色渐变(读 sea 主题)。横向是均匀的,视差对它没有意义,跟着镜头走就行
function drawWater(ctx: CanvasRenderingContext2D, s: BgState, ox: number): void {
  const top = WATER_LINE
  const grad = ctx.createLinearGradient(0, top, 0, s.worldHeight)
  grad.addColorStop(0, s.sea.shallow)
  grad.addColorStop(0.45, s.sea.mid)
  grad.addColorStop(1, s.sea.deep)
  ctx.fillStyle = grad
  ctx.fillRect(ox, top, STAGE_WIDTH, s.worldHeight - top)
}

// 深色剪影。半透明,叠在哪片海的渐变上都成立,所以三片海不用各出一套
function drawFarSilhouette(ctx: CanvasRenderingContext2D, s: BgState, ox: number): void {
  const far = img('far.png')
  if (!far) return
  // CSS 是 `bottom: SAND_H-6; height:120; background-position:bottom`,far.png 正好 120 高,
  // 所以纵向贴着那条底线画一排就行。**横向有个坑**:`background-position: bottom` 展开是
  // `50% 100%` —— 横向那个 50% 会把平铺起点挪到 (容器宽 - 图宽)/2,不是 0。
  // 第一版按 0 画,剪影整体错了 120px,截图比对时才发现
  const phase = (s.worldWidth - far.width) / 2
  tileX(ctx, far, s.worldHeight - (SAND_H - 6) - far.height, ox, ox + STAGE_WIDTH, phase)
}

// 浑浊度沙雾。压在剪影之上、中景之下 —— 水越浑,远处越糊,近处照旧清楚
function drawHaze(ctx: CanvasRenderingContext2D, s: BgState, ox: number): void {
  const haze = (1 - s.clarity) * MAX_HAZE
  if (haze <= 0) return
  ctx.fillStyle = `rgba(${SAND_COLOR}, ${haze})`
  ctx.fillRect(ox, WATER_LINE, STAGE_WIDTH, s.worldHeight - WATER_LINE)
}

// 中景装饰:珊瑚和岩石挤在画面两侧,中间留给小爱心和海草床。
// 三种排布按格子取模轮换,同一个地点永远同一种
function drawDecor(ctx: CanvasRenderingContext2D, s: BgState, from: number, to: number): void {
  for (let i = from; i <= to; i++) {
    const variant = DECOR_VARIANTS[((i % DECOR_VARIANTS.length) + DECOR_VARIANTS.length) % DECOR_VARIANTS.length]
    variant.forEach((decor, j) => {
      const tex = img(decor.file)
      if (!tex) return
      const left = i * STAGE_WIDTH + decor.x
      const baseline = s.worldHeight - (SAND_H - 6 + (decor.lift ?? 0))
      if (!decor.sway || s.reduced) {
        ctx.drawImage(tex, left, baseline - tex.height)
        return
      }
      // transform-origin: bottom center —— 根部固定,只有梢在摇
      const deg = lerp(
        -MOTION.swayDeg,
        MOTION.swayDeg,
        EASE_IN_OUT(alternateProgress(s.now, MOTION.swaySec, -((i * 7 + j * 3) % 8))),
      )
      ctx.save()
      ctx.translate(left + tex.width / 2, baseline)
      ctx.rotate((deg * Math.PI) / 180)
      ctx.drawImage(tex, -tex.width / 2, -tex.height)
      ctx.restore()
    })
  }
}

// 世界边界之外还有没开放的地点时,在边缘露出一点模糊的影子——看得见、够不着
function drawLockedHint(ctx: CanvasRenderingContext2D, s: BgState): void {
  if (!s.lockedBeyondEnd && !s.lockedBeforeStart) return
  const y = s.worldHeight - 64 - 60
  ctx.save()
  // ctx.filter 老浏览器可能没有;没有就画一团不带模糊的,总比不画强
  if ('filter' in ctx) ctx.filter = 'blur(3px)'
  ctx.fillStyle = LOCKED_HINT_COLOR
  const blob = (left: number) => {
    ctx.beginPath()
    ctx.ellipse(left + 20, y + 30, 20, 30, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  if (s.lockedBeyondEnd) blob(s.worldWidth - 20)
  if (s.lockedBeforeStart) blob(-20)
  ctx.restore()
}

// 金沙海底 + 散落的贝壳石子,位置按格子错开;不挡路、不可点,纯风景
function drawSeabed(ctx: CanvasRenderingContext2D, s: BgState, ox: number, from: number, to: number): void {
  const sand = img('sand.png')
  const top = s.worldHeight - SAND_H
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox, top, STAGE_WIDTH, SAND_H)
  ctx.clip()
  if (sand) tileX(ctx, sand, top, ox, ox + STAGE_WIDTH)

  for (let i = from; i <= to; i++) {
    SCATTER.forEach((file, j) => {
      const tex = img(file)
      if (!tex) return
      const left = i * STAGE_WIDTH + 116 + ((i * 211 + j * 149) % 250)
      const bottom = s.worldHeight - (4 + ((i * 31 + j * 17) % 14))
      ctx.drawImage(tex, left, bottom - tex.height)
    })
  }
  ctx.restore()
}

// 水下光柱:从水面斜插下来。整束只是慢慢左右晃 + 明暗呼吸,不做形变
function drawShafts(ctx: CanvasRenderingContext2D, s: BgState, ox: number): void {
  const tex = img('light_shaft.png')
  if (!tex) return
  ctx.save()
  ctx.beginPath()
  // 光是从水面来的,不能漏到天上去,也不该压在沙底上
  ctx.rect(ox, WATER_LINE, STAGE_WIDTH, s.worldHeight - WATER_LINE - SAND_H + 8)
  ctx.clip()

  const [from, to] = indexRange(ox, SHAFT.period)
  for (let i = from; i <= to; i++) {
    const phase = ((i * 37) % 20) / 20
    const swayT = s.reduced ? 0.5 : alternateProgress(s.now, SHAFT.swaySec, -phase * SHAFT.swaySec)
    const breathT = s.reduced ? 0.5 : alternateProgress(s.now, SHAFT.breathSec, -phase * SHAFT.breathSec)
    ctx.globalAlpha = lerp(SHAFT.alphaMin, SHAFT.alphaMax, EASE_IN_OUT(breathT))
    ctx.drawImage(
      tex,
      Math.round(i * SHAFT.period + ((i * 53) % 40) + lerp(-SHAFT.swayPx, SHAFT.swayPx, EASE_IN_OUT(swayT))),
      WATER_LINE - 4,
    )
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

/**
 * 画一整帧背景。ctx 由 world.ts 设好 imageSmoothingEnabled=false。
 *
 * 纵向的镜头(换气那一下的摇移)在最外层一次性挪掉,所有层同步;
 * 横向每层各走各的视差因子,进 layer() 各自挪。
 */
export function drawBackground(ctx: CanvasRenderingContext2D, s: BgState): void {
  ctx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  ctx.save()
  ctx.translate(0, -Math.round(s.camY))

  layer(ctx, s.camX, s.slotCount, PARALLAX.sky, (ox, from, to) => drawSky(ctx, s, ox, from, to))
  layer(ctx, s.camX, s.slotCount, PARALLAX.farIsland, (_ox, from, to) => drawIslands(ctx, from, to))
  layer(ctx, s.camX, s.slotCount, PARALLAX.waterSurface, (ox) => drawSurface(ctx, s, ox))
  layer(ctx, s.camX, s.slotCount, PARALLAX.underwaterMid, (ox) => drawWater(ctx, s, ox))
  layer(ctx, s.camX, s.slotCount, PARALLAX.underwaterFar, (ox) => drawFarSilhouette(ctx, s, ox))
  layer(ctx, s.camX, s.slotCount, PARALLAX.underwaterMid, (ox, from, to) => {
    drawHaze(ctx, s, ox)
    drawDecor(ctx, s, from, to)
  })
  layer(ctx, s.camX, s.slotCount, PARALLAX.seabed, (ox, from, to) => {
    drawLockedHint(ctx, s)
    drawSeabed(ctx, s, ox, from, to)
  })
  // 光柱是最后一道背景:它照在沙上,但压在小爱心后面
  layer(ctx, s.camX, s.slotCount, PARALLAX.lightShaft, (ox) => drawShafts(ctx, s, ox))
  layer(ctx, s.camX, s.slotCount, PARALLAX.sparkle, (ox) => drawSparkles(ctx, s, ox))
  layer(ctx, s.camX, s.slotCount, PARALLAX.dustFar, (ox) => drawDust(ctx, s, ox, DUST_FAR))
  ctx.restore()
}
