import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { moonAt, seasonAt, skyAt, tideAt } from '../lib/time'
import type { MoonState, SkyState, TideState } from '../lib/time'

export interface ClockState {
  /** 这一份是按哪一刻算的(毫秒)。dev 下 __setClock 钉住的时刻也在这里 —— 事件按它判断,不各自读 Date.now() */
  at: number
  sky: SkyState
  moon: MoonState
  tide: TideState
  season: string
}

function read(now: number): ClockState {
  return { at: now, sky: skyAt(now), moon: moonAt(now), tide: tideAt(now), season: seasonAt(now) }
}

// 开发构建里可以把时钟钉在某一刻(测试要验「夜里是什么样」,总不能等到半夜)。
// 和渲染层的 `window.__renderFreeze` 同一个路子:**只在 dev 下挂**,生产包里没有这个口子
declare global {
  interface Window {
    __setClock?: (iso: string | null) => void
  }
}

// 天色 / 月相 / 潮汐。**一分钟才算一次** —— 这些是慢变量,跟着每帧走是白烧电。
// 位置和镜头那种高频状态归渲染层的 ref(宪法二十一 配套约束),这一份反过来:
// 它变得极慢,而 HUD 上那三个字和世界的色调必须读同一份,所以放 React 里最省事。
//
// **结果是算出来的,不是存下来的**:存的只有「现在几点」这一个数。
// 写成「effect 里 setState 一份算好的」会多一条 `set-state-in-effect` 警告,
// 而这个仓库的规矩是 lint 一条都不新增(3-6 那轮为这条绕过三版)
//
// `onDusk`:玩着玩着天正好黑下来的那一刻(白天 → 黄昏)叫一声(ROADMAP 4-3,nat_day_night)。
// **在定时器回调里判断,不在 effect 里比前后两份 state** —— 后者要在 effect 里 setState
// 出卡,会多一条 `set-state-in-effect`。开局就是黄昏或夜里不算:那不是「天黑下来了」,
// 是她来的时候天就是黑的
export function useClock(onDusk?: () => void): ClockState {
  const [override, setOverride] = useState<number | null>(null)
  const [tick, setTick] = useState(() => Date.now())
  // 上一次算的是哪个时刻,和最新的回调。都是定时器回调里读的,不参与渲染
  // null = 还没走过第一步。第一步只记下时刻、不判断 —— 开局那一刻不算「天黑下来」
  const lastAt = useRef<number | null>(null)
  const duskCb = useRef(onDusk)
  useEffect(() => {
    duskCb.current = onDusk
  }, [onDusk])

  // 从 lastAt 走到 at,中间跨过了「白天 → 黄昏」就叫一声
  const advance = useCallback((at: number) => {
    const last = lastAt.current
    lastAt.current = at
    if (last === null) return
    if (skyAt(last).phase === 'day' && skyAt(at).phase === 'dusk') duskCb.current?.()
  }, [])

  // 挂上就记下开局时刻。在 effect 里记而不是 useRef(Date.now()) —— 渲染期间不读时钟
  useEffect(() => {
    advance(Date.now())
  }, [advance])

  useEffect(() => {
    if (import.meta.env.PROD) return
    window.__setClock = (iso) => {
      const t = iso === null ? null : Date.parse(iso)
      const next = t !== null && Number.isNaN(t) ? null : t
      advance(next ?? Date.now())
      setOverride(next)
    }
    return () => {
      delete window.__setClock
    }
  }, [advance])

  useEffect(() => {
    if (override !== null) return
    // 先对齐到下一个整分钟再按分钟走 —— 不然「第几分钟」是随机的,
    // 天色变化的时刻会比整点晚几十秒。看不出来,但没必要差
    let timer = 0
    const run = () => {
      const now = Date.now()
      advance(now)
      setTick(now)
      timer = window.setTimeout(run, 60000)
    }
    timer = window.setTimeout(run, 60000 - (Date.now() % 60000))
    return () => clearTimeout(timer)
  }, [override, advance])

  return useMemo(() => read(override ?? tick), [override, tick])
}
