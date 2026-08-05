// HUD 的数据契约。canvas 只认这一份快照,不知道数据从哪来 ——
// 它不知道 fullness 为什么是 3,只知道现在是 3(REFACTOR_PLAN §四 闸 3/4)

/** 一格快捷栏 */
export interface SlotSpec {
  id: string
  /** 图标路径,来自 /assets/world/ui/ */
  icon: string
  /** 读屏器念的名字。canvas 画不出语义,全靠这个字段撑住可访问性 */
  label: string
  /** 系统还没做:图标压灰,点了给提示而不是没反应 */
  locked?: boolean
  /** 右下角的小数字(比如长成的海草棵数) */
  badge?: number
  /** 现在特别需要点它(比如该换气了):换成红框 */
  glow?: boolean
  /** 点了给一句提示,而不是执行动作 */
  tip?: string
  /** 占位空格:只画一个空框,不可点、不进 Tab 顺序 */
  empty?: boolean
}

/** 推给 canvas 的一份完整 HUD 状态 */
export interface HudSnapshot {
  /** 累计打开天数。真数据,来自存档 */
  day: number
  /** 季节 / 月相 / 潮汐:S4「潮汐与月亮」才算真的,现在是占位字符串 */
  season: string
  moonPhase: string
  tide: string
  /** 饱食度 0–max。只画格子,**永远不显示数字或百分比、永远不变红**
   *  (CLAUDE.md 原则 1「没有失败态」+ 原 FullnessMeter 的注释) */
  fullness: number
  maxFullness: number
  slots: readonly SlotSpec[]
  /** 灰格子被点后的提示文字,自己会消失 */
  tip: string | null
}

/** 画完之后交出来的可点区域。HUD.tsx 据此摆透明 <button>。
 *  世界层和 HUD 层共用同一个形状,定义放在 render/types.ts */
export type { Hotspot } from '../render/types'
