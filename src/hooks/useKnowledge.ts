import { useCallback, useEffect, useState } from 'react'

export interface KnowledgeCardData {
  id: string
  学科: string
  childText: string
  en?: string
  锚点?: string
  事件?: string
  图鉴?: boolean
}

interface RawCard extends KnowledgeCardData {
  已核对?: boolean
  情绪敏感?: boolean
}

interface Rules {
  主动触发概率: number
  同卡冷却小时: number
}

const DEFAULT_RULES: Rules = { 主动触发概率: 0.15, 同卡冷却小时: 24 }

// 知识白名单。两道闸门都在这里:
// 已核对为 false 的不进游戏(没核对过的知识宁可不说),
// 情绪敏感的也不进游戏(比如「同伴变少了」,那种话该由爸爸当面说,不该由小爱心说)
export function useKnowledge() {
  const [cards, setCards] = useState<KnowledgeCardData[]>([])
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES)

  useEffect(() => {
    fetch('/content/knowledge.json')
      .then((res) => res.json())
      .then((data) => {
        const list: RawCard[] = Array.isArray(data?.卡片) ? data.卡片 : []
        setCards(
          list.filter(
            (card) => card.已核对 === true && card.情绪敏感 !== true,
          ),
        )
        if (data?.触发规则) setRules({ ...DEFAULT_RULES, ...data.触发规则 })
      })
      .catch(() => {})
  }, [])

  // 同一张卡隔 24 小时才会再出现一次
  const isCool = useCallback(
    (id: string, seen: Record<string, string>) => {
      const last = Date.parse(seen[id] ?? '')
      if (Number.isNaN(last)) return true
      return Date.now() - last >= rules.同卡冷却小时 * 60 * 60 * 1000
    },
    [rules],
  )

  // 她主动点身体部位,一定给卡(只要不在冷却里)
  const pickByAnchor = useCallback(
    (anchor: string, seen: Record<string, string>) =>
      cards.find((card) => card.锚点 === anchor && isCool(card.id, seen)),
    [cards, isCool],
  )

  // 小爱心自己开口是「偶尔」,不是每次。掷不中就什么都不发生。
  // 必定 = true 留给一辈子只发生几次的时刻(比如长大一点),那种时候不该靠掷骰子
  const pickByEvent = useCallback(
    (event: string, seen: Record<string, string>, 必定 = false) => {
      if (!必定 && Math.random() >= rules.主动触发概率) return undefined
      const pool = cards.filter(
        (card) => card.事件 === event && isCool(card.id, seen),
      )
      if (pool.length === 0) return undefined
      return pool[Math.floor(Math.random() * pool.length)]
    },
    [cards, isCool, rules],
  )

  // 哪些身体部位是可以点的。不随冷却变化,免得热区忽有忽无
  const anchors = [
    ...new Set(cards.map((card) => card.锚点).filter((a): a is string => !!a)),
  ]

  // 图鉴里放两种卡:本来就住在图鉴里的,和她已经在海里遇到过的。
  // 不显示「还没解锁」的格子,也不显示总数 —— 她不知道一共有多少张,就没有什么可集齐的
  const bookCards = useCallback(
    (seen: Record<string, string>) =>
      cards.filter((card) => card.图鉴 === true || Boolean(seen[card.id])),
    [cards],
  )

  return { anchors, bookCards, pickByAnchor, pickByEvent }
}
