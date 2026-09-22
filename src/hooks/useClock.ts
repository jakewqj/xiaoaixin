import { useEffect, useMemo, useState } from 'react'
import { moonAt, seasonAt, skyAt, tideAt } from '../lib/time'
import type { MoonState, SkyState, TideState } from '../lib/time'

export interface ClockState {
  sky: SkyState
  moon: MoonState
  tide: TideState
  season: string
}

function read(now: number): ClockState {
  return { sky: skyAt(now), moon: moonAt(now), tide: tideAt(now), season: seasonAt(now) }
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
export function useClock(): ClockState {
  const [override, setOverride] = useState<number | null>(null)
  const [tick, setTick] = useState(() => Date.now())

  useEffect(() => {
    if (import.meta.env.PROD) return
    window.__setClock = (iso) => {
      const t = iso === null ? null : Date.parse(iso)
      setOverride(t !== null && Number.isNaN(t) ? null : t)
    }
    return () => {
      delete window.__setClock
    }
  }, [])

  useEffect(() => {
    if (override !== null) return
    // 先对齐到下一个整分钟再按分钟走 —— 不然「第几分钟」是随机的,
    // 天色变化的时刻会比整点晚几十秒。看不出来,但没必要差
    let timer = 0
    const run = () => {
      setTick(Date.now())
      timer = window.setTimeout(run, 60000)
    }
    timer = window.setTimeout(run, 60000 - (Date.now() % 60000))
    return () => clearTimeout(timer)
  }, [override])

  return useMemo(() => read(override ?? tick), [override, tick])
}
