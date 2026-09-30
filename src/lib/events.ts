// 自然事件(ROADMAP 4-4,GDD §9.3「事件日历」)。
//
// 全部是纯函数:给事件表、一个时间戳、她在哪片海,算出此刻哪些事件的条件成立。
// **不存状态** —— 「今晚演过没有」存在存档的 eventNights 里,由 App 比对。
//
// 两条从爸爸那里定下来的规矩(2026-09-29):
//   ① 条件满足时不自己开演,小爱心冒一句邀请,童童点了才演(宪法二 不打扰)
//   ② 每逢条件满足就有一次,同一晚只演一次;相册只记第一次。错过了下次还有

import { moonAt, seasonAt, skyAt } from './time'
import type { DayPhase } from './time'

export interface EventLine {
  text: string
  en?: string
}

export interface EventCondition {
  海域?: string[]
  时段?: DayPhase[]
  /** [最少, 最多] 天,从满月那一刻算起 */
  满月后天数?: [number, number]
  /** 按北半球日历。南半球的海别用,用「月份」 */
  季节?: string[]
  /** 1–12,按本机日历。季节因半球而反、因地点而异的事用它(海龟孵化:红海 8–10 月) */
  月份?: number[]
}

export interface NatureEvent {
  id: string
  名字: string
  factRef: string
  已核对?: boolean
  条件: EventCondition
  邀请: EventLine
  /** 渲染层的专属效果名。4-5 才实现,没实现的就只有暗下来 + 台词 */
  画面?: string
  台词: EventLine[]
  相册: { icon: string; text: string; en?: string }
}

// 朔望月,和 lib/time.ts 同一个数。满月后第几天 = (月龄 - 0.5) × 朔望月
const SYNODIC_DAYS = 29.530588853

/** 这一刻离满月过去了几天。满月之前是负数 */
export function daysAfterFullMoon(now: number): number {
  return (moonAt(now).age - 0.5) * SYNODIC_DAYS
}

/**
 * 「同一晚」的钥匙。一个夜晚横跨午夜(晚上 10 点和凌晨 2 点是同一晚),
 * 所以往回拨 12 小时再取日期:中午 12 点之前都算前一天的那一晚
 */
export function nightKey(now: number): string {
  const d = new Date(now - 12 * 3600 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// 一条事件的条件此刻成立吗。没写的条件不看
function matches(c: EventCondition, now: number, seaName: string): boolean {
  if (c.海域 && !c.海域.includes(seaName)) return false
  if (c.时段 && !c.时段.includes(skyAt(now).phase)) return false
  if (c.季节 && !c.季节.includes(seasonAt(now))) return false
  if (c.月份 && !c.月份.includes(new Date(now).getMonth() + 1)) return false
  if (c.满月后天数) {
    const d = daysAfterFullMoon(now)
    if (d < c.满月后天数[0] || d > c.满月后天数[1]) return false
  }
  return true
}

/** 此刻条件成立的事件。**没核对过的不算** —— 原则 9,没出处的设定不进游戏 */
export function activeEvents(events: NatureEvent[], now: number, seaName: string): NatureEvent[] {
  return events.filter((e) => e.已核对 === true && matches(e.条件, now, seaName))
}
