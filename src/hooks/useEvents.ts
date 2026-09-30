import { useEffect, useState } from 'react'
import type { NatureEvent } from '../lib/events'

// 自然事件表。全部来自 /content/events.json,代码里一句台词都不写。
// 读不到就没有事件,游戏照常玩 —— 和 useDialogue 同一个路子
export function useEvents(): NatureEvent[] {
  const [events, setEvents] = useState<NatureEvent[]>([])

  useEffect(() => {
    fetch('/content/events.json')
      .then((res) => res.json())
      .then((data: { 事件?: unknown }) => {
        if (Array.isArray(data?.事件)) setEvents(data.事件 as NatureEvent[])
      })
      .catch(() => {})
  }, [])

  return events
}
