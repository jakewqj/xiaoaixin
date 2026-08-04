// HUD 的订阅式数据源。React 往里推快照,canvas 订阅并按需重画。
//
// 为什么要这一层:canvas 的重绘代价和 React 的重渲染频率无关。App 每渲染一次
// 就重画一遍设备分辨率的全屏 UI 是纯浪费。这里做一次浅比较,值真的变了才通知,
// 于是「HUD 重绘次数 = HUD 内容变化次数」,不是「App 重渲染次数」。
//
// 这不是状态库(CLAUDE.md 三禁止 Redux/Zustand)—— 它不持有游戏状态,
// 只是把 React 那边的真值搬运过来的一块镜子。唯一的真值仍在 useSave。

import type { HudSnapshot } from './types'

type Listener = (snap: HudSnapshot) => void

const EMPTY: HudSnapshot = {
  day: 1,
  season: '',
  moonPhase: '',
  tide: '',
  shells: 0,
  slots: [],
  tip: null,
}

/** 浅比较。slots 是数组,逐项按字段比 —— 每次 render 都是新数组,不能只比引用 */
function same(a: HudSnapshot, b: HudSnapshot): boolean {
  if (
    a.day !== b.day ||
    a.season !== b.season ||
    a.moonPhase !== b.moonPhase ||
    a.tide !== b.tide ||
    a.shells !== b.shells ||
    a.tip !== b.tip ||
    a.slots.length !== b.slots.length
  ) {
    return false
  }
  return a.slots.every((s, i) => {
    const t = b.slots[i]
    return (
      s.id === t.id &&
      s.icon === t.icon &&
      s.label === t.label &&
      s.locked === t.locked &&
      s.badge === t.badge &&
      s.glow === t.glow
    )
  })
}

class HudStore {
  private snap: HudSnapshot = EMPTY
  private listeners = new Set<Listener>()

  get(): HudSnapshot {
    return this.snap
  }

  /** 订阅。返回退订函数 —— 组件卸载时必须调,不然 canvas 没了还在被通知 */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  /** 推一份新快照。和当前值一样就什么都不做,这是省掉无谓重绘的关键 */
  set(next: HudSnapshot): void {
    if (same(this.snap, next)) return
    this.snap = next
    for (const fn of this.listeners) fn(next)
  }
}

export const hudStore = new HudStore()
