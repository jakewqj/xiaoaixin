// HUD 的 canvas 绘制。只画,不碰任何游戏状态(REFACTOR_PLAN §四 闸 3)。
//
// 画完返回热区列表,HUD.tsx 据此摆透明 <button> —— canvas 出像素,DOM 出语义。
// 这是 HUD 进 canvas 的必要配套:canvas 里没有 <button>,焦点框、aria-label、
// Tab 顺序、读屏器全得靠那层 DOM 撑住(CLAUDE.md 四「键盘焦点可见」)。

import * as assets from '../render/assets'
import { nineSlice, threeSliceX } from '../render/nineSlice'
import { drawText, measure, SIZES } from '../render/text'
import { COLOR, HOTBAR, METER, SLICE, TEX, TIP, TOP, UI_DIR } from './layout'
import type { HudSnapshot, Hotspot, SlotSpec } from './types'

const STAGE_W = 480
const STAGE_H = 270

/** 图标画在整数坐标上,像素才不会糊 */
function icon(ctx: CanvasRenderingContext2D, src: string, x: number, y: number, dim = false): void {
  const img = assets.get(src)
  if (!img) return
  if (dim) ctx.globalAlpha = 0.35
  ctx.drawImage(img, Math.round(x), Math.round(y))
  ctx.globalAlpha = 1
}

/**
 * 饱食度的格子。先用暗棕整格垫底,盖掉 goldbar 纹理自带的金币格纹 ——
 * 那道 5px 一格的纹路和这里的 5 格对不上,不盖掉两套格子会打架。
 * 亮着的格子顶上再压 1px 浅绿当斜面高光,像素画的立体感全靠这一条边
 */
function drawMeter(ctx: CanvasRenderingContext2D, value: number, max: number): void {
  const { x, y, span, h, gap } = METER.cells
  const n = Math.max(1, max)
  const w = Math.floor((span - gap * (n - 1)) / n)
  if (w <= 0) return

  for (let i = 0; i < n; i++) {
    const cx = x + i * (w + gap)
    ctx.fillStyle = COLOR.meterEmpty
    ctx.fillRect(cx, y, w, h)
    if (i < value) {
      ctx.fillStyle = COLOR.meterFull
      ctx.fillRect(cx, y, w, h)
      ctx.fillStyle = COLOR.meterFullTop
      ctx.fillRect(cx, y, w, 1)
    }
  }
}

/** 顶部栏:时钟盘 + 两行文字(第几天/季节、月相/潮汐)+ 饱食度条 */
function drawTopBar(ctx: CanvasRenderingContext2D, snap: HudSnapshot, spots: Hotspot[]): void {
  const panel = assets.get(TEX.panel)
  const plate = assets.get(TEX.plate)

  if (panel) nineSlice(ctx, panel, TOP.panel.x, TOP.panel.y, TOP.panel.w, TOP.panel.h, SLICE.panel, 'repeat')
  if (plate) nineSlice(ctx, plate, TOP.plate.x, TOP.plate.y, TOP.plate.w, TOP.plate.h, SLICE.plate, 'stretch')

  const dial = assets.get(TEX.dial)
  if (dial) ctx.drawImage(dial, TOP.dial.x, TOP.dial.y)

  // 第一行:第 N 天 + 季节。天数是存档里的真数据,季节是 S4 之前的占位
  let x = TOP.line1.x
  x += drawText(ctx, `第${snap.day}天`, x, TOP.line1.y, COLOR.ink, SIZES.normal) + 6
  if (snap.season) drawText(ctx, snap.season, x, TOP.line1.y, COLOR.inkDim, SIZES.normal)

  // 第二行:月相 + 潮汐。两个都是 S4 之前的占位文字
  x = TOP.line2.x
  icon(ctx, `${UI_DIR}/icon_moon.png`, x, TOP.line2.y + 1)
  x += 12
  x += drawText(ctx, snap.moonPhase, x, TOP.line2.y, COLOR.ink, SIZES.normal) + 5
  icon(ctx, `${UI_DIR}/icon_wave.png`, x, TOP.line2.y + 1)
  x += 12
  drawText(ctx, snap.tide, x, TOP.line2.y, COLOR.ink, SIZES.normal)

  // 饱食度条:5 格,亮着的就是还有的。没有数字、没有百分比、没有图标 ——
  // 它接替的是原来贴在海底那排海草叶片,语义靠「海草绿」这个颜色延续下来
  const bar = assets.get(TEX.bar)
  if (bar) threeSliceX(ctx, bar, METER.bar.x, METER.bar.y, METER.bar.w, SLICE.bar)
  drawMeter(ctx, snap.fullness, snap.maxFullness)

  spots.push({
    id: '__title',
    x: TOP.titleHold.x,
    y: TOP.titleHold.y,
    w: TOP.titleHold.w,
    h: TOP.titleHold.h,
    label: '小爱心',
  })
}

/** 一格快捷栏 */
function drawSlot(ctx: CanvasRenderingContext2D, slot: SlotSpec, x: number, y: number): void {
  const tex = assets.get(slot.glow ? TEX.slotActive : TEX.slot)
  if (tex) ctx.drawImage(tex, x, y)
  if (slot.empty) return

  icon(ctx, slot.icon, x + HOTBAR.iconInset, y + HOTBAR.iconInset, slot.locked)

  if (slot.badge !== undefined && slot.badge > 0) {
    const text = String(slot.badge)
    const w = Math.ceil(measure(ctx, text, SIZES.small))
    // Zpix 最小就是 12px,在 20px 的格子里必然压到图标上。四向描边试过了,
    // 在浅色图标上仍然糊 —— 改成给数字垫一块深色底板,任何图标上都读得出来
    const bw = w + 2
    const bx = x + HOTBAR.slot - bw - 1
    const by = y + HOTBAR.slot - SIZES.small - 1
    ctx.fillStyle = '#3E2614'
    ctx.fillRect(bx, by, bw, SIZES.small)
    drawText(ctx, text, bx + 1, by - 1, COLOR.cream, SIZES.small)
  }
}

/** 底部快捷栏:两排格子,排布和内容由 App 传进来,这里不判断谁该亮谁该灰 */
function drawHotbar(ctx: CanvasRenderingContext2D, snap: HudSnapshot, spots: Hotspot[]): void {
  const panel = assets.get(TEX.panel)
  if (panel) nineSlice(ctx, panel, HOTBAR.x, HOTBAR.y, HOTBAR.w, HOTBAR.h, SLICE.panel, 'repeat')

  snap.slots.forEach((slot, i) => {
    const col = i % HOTBAR.cols
    const row = Math.floor(i / HOTBAR.cols)
    const x = HOTBAR.x + HOTBAR.border + col * HOTBAR.slot
    const y = HOTBAR.y + HOTBAR.border + row * HOTBAR.slot
    drawSlot(ctx, slot, x, y)
    // 占位格只画一个空框,不给热区 —— 没有名字的按钮进了 Tab 顺序,
    // 读屏器只会念出一个「按钮」,那比没有更糟
    if (!slot.empty) {
      spots.push({ id: slot.id, x, y, w: HOTBAR.slot, h: HOTBAR.slot, label: slot.label })
    }
  })
}

/** 点了灰格子给的一句话。自己会消失,不用她点第二下 */
function drawTip(ctx: CanvasRenderingContext2D, tip: string): void {
  const w = Math.min(TIP.maxW, measure(ctx, tip, SIZES.normal) + 12)
  const x = HOTBAR.x + HOTBAR.w - w
  const y = HOTBAR.y - TIP.h - TIP.gap

  const panel = assets.get(TEX.panel)
  if (panel) nineSlice(ctx, panel, x, y, w, TIP.h, SLICE.panel, 'repeat')
  drawText(ctx, tip, x + 6, y + 2, COLOR.cream, SIZES.normal)
}

/**
 * 画一整帧 HUD。返回这一帧的可点区域。
 * ctx 已经被 HUD.tsx 设好 scale 和 imageSmoothingEnabled,这里一律用逻辑坐标
 */
export function drawHud(ctx: CanvasRenderingContext2D, snap: HudSnapshot): Hotspot[] {
  ctx.clearRect(0, 0, STAGE_W, STAGE_H)
  const spots: Hotspot[] = []
  drawTopBar(ctx, snap, spots)
  drawHotbar(ctx, snap, spots)
  if (snap.tip) drawTip(ctx, snap.tip)
  return spots
}
