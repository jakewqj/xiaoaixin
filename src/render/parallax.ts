// 视差:每层跟着镜头走多少,以及「这一帧看得见哪几格」。
// 背景层和 overlay 层共用同一套,免得两边各写一份、哪天调了一处忘了另一处。

import { STAGE_WIDTH } from '../components/ScreenFrame'

/** 这一帧看得见哪几格。左右各多算一格 —— 云会飘出去、礁石会探出格子边界 */
export function visibleSlots(camX: number, slotCount: number): [number, number] {
  const first = Math.max(0, Math.floor(camX / STAGE_WIDTH) - 1)
  const last = Math.min(slotCount - 1, Math.floor((camX + STAGE_WIDTH - 1) / STAGE_WIDTH) + 1)
  return [first, last]
}

/**
 * 进到某一层自己的坐标系。ox 是这层的镜头位置(= 镜头 × 视差因子),
 * 层内一切照旧按世界坐标画,不用关心自己被挪了多少。
 *
 * **取整是硬性的**:半像素偏移在整数倍放大之后会沿着每条边撕出一道毛边,
 * 像素画最忌这个(REFACTOR_PLAN §2.4)。
 */
export function layer(
  ctx: CanvasRenderingContext2D,
  camX: number,
  slotCount: number,
  factor: number,
  draw: (ox: number, from: number, to: number) => void,
): void {
  const ox = Math.round(camX * factor)
  const [from, to] = visibleSlots(ox, slotCount)
  ctx.save()
  ctx.translate(-ox, 0)
  draw(ox, from, to)
  ctx.restore()
}

/** 按固定周期均匀撒东西:返回这一屏里第几个到第几个。两头各多给一个,免得边上突然冒出来 */
export function indexRange(ox: number, period: number): [number, number] {
  return [Math.floor(ox / period) - 1, Math.floor((ox + STAGE_WIDTH) / period) + 1]
}
