import { useCallback, useEffect, useMemo, useState } from 'react'

export interface KnowledgeCardData {
  id: string
  学科: string
  childText: string
  en?: string
  锚点?: string
  事件?: string
  图鉴?: boolean
  // 这张卡进图鉴的哪一页(ROADMAP 3-5)。**不写就是「关于我」那一页** ——
  // 讲她这个物种的事跟着她走,换到哪片海都在;讲某片海里的环境、邻居、故事的才写。
  // 值是 world.json 里的海域名(红海浅滩 / 印度海湾 / 澳洲浅海),不是 seas.ts 的 id
  海域?: string
}

interface RawCard extends KnowledgeCardData {
  已核对?: boolean
  情绪敏感?: boolean
  dadNote?: string
}

interface Rules {
  主动触发概率: number
  同卡冷却小时: number
}

const DEFAULT_RULES: Rules = { 主动触发概率: 0.15, 同卡冷却小时: 24 }

// 知识白名单。三道闸门都在这里:
// 已核对为 false 的不进游戏(没核对过的知识宁可不说),
// 情绪敏感的也不进游戏(比如「同伴变少了」,那种话该由爸爸当面说,不该由小爱心说),
// 爸爸在后台屏蔽掉的也不进游戏。
//
// **屏蔽那道闸是 2026-09-13 才接上的。** 在那之前 `config.json` 的「知识卡.屏蔽」
// 从来没有任何地方读过 —— 后台能填、填了没用,是个死控件。3-4 让砗磲奶奶直接
// 从白名单里取卡,这道闸再不接上,爸爸屏蔽的卡就会从她嘴里漏出去。
export function useKnowledge(blocked: string[] = []) {
  const [cards, setCards] = useState<KnowledgeCardData[]>([])
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES)
  // 搜索用的索引:id → 可被搜到的文字。**dadNote 只进这里,永远不进 cards** ——
  // 它是写给爸爸看的(`_爸爸须知`:「dadNote 是给你看的」),里面有专业表述和
  // 需要他斟酌的内容,一个字都不该显示给童童。当索引用没问题,它不露面
  const [index, setIndex] = useState<Record<string, { child: string; extra: string }>>({})
  const [unknownLines, setUnknownLines] = useState<string[]>([])

  useEffect(() => {
    fetch('/content/knowledge.json')
      .then((res) => res.json() as Promise<unknown>)
      .then((raw) => {
        // 先把 JSON 收进一个明确的形状再用。原来直接在 any 上取成员,
        // eslint 每取一次报一条 unsafe-member-access —— 这次顺手收掉
        const data = (raw ?? {}) as {
          卡片?: unknown
          不知道时的回答?: unknown
          触发规则?: Partial<Rules>
        }
        const list: RawCard[] = Array.isArray(data.卡片) ? (data.卡片 as RawCard[]) : []
        const usable = list.filter(
          (card) => card.已核对 === true && card.情绪敏感 !== true,
        )
        setCards(usable.map(({ dadNote: _drop, 已核对: _v, 情绪敏感: _s, ...rest }) => rest))
        // **分两层存。** 童童说出口的那句话(childText / en)命中,和爸爸的注解
        // (dadNote)里顺带提了一句,分量完全不同 —— 「海草」这个词几乎每张卡的
        // dadNote 里都有(她天天吃海草),混在一起算的话问「海草」会抽到
        // 「越往下光越少」那种只是顺带提过的卡
        setIndex(
          Object.fromEntries(
            usable.map((card) => [
              card.id,
              {
                child: [card.childText, card.en].filter(Boolean).join(' ').toLowerCase(),
                extra: [card.dadNote, card.学科, card.id].filter(Boolean).join(' ').toLowerCase(),
              },
            ]),
          ),
        )
        if (Array.isArray(data.不知道时的回答)) setUnknownLines(data.不知道时的回答 as string[])
        if (data.触发规则) setRules({ ...DEFAULT_RULES, ...data.触发规则 })
      })
      .catch(() => {})
  }, [])

  // **依赖用拼出来的字符串,不用数组本身。** CLAUDE.md 记过:`useConfig` 每次渲染
  // 都返回新的 config 对象,所以 `config.知识卡.屏蔽` 每次都是新引用 ——
  // 直接拿它当依赖,这个 memo 每渲染都重算,`open` 每次都是新数组,
  // 下游 useCallback 全部跟着换身份,最后会一路传到世界快照那条 effect 上。
  // S2 那次的 `Maximum update depth exceeded` 就是这么来的
  const blockedKey = blocked.join(',')
  const open = useMemo(() => {
    const skip = new Set(blockedKey ? blockedKey.split(',') : [])
    return cards.filter((card) => !skip.has(card.id))
  }, [cards, blockedKey])

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
      open.find((card) => card.锚点 === anchor && isCool(card.id, seen)),
    [open, isCool],
  )

  // 小爱心自己开口是「偶尔」,不是每次。掷不中就什么都不发生。
  // 必定 = true 留给一辈子只发生几次的时刻(比如长大一点),那种时候不该靠掷骰子
  const pickByEvent = useCallback(
    (event: string, seen: Record<string, string>, 必定 = false) => {
      if (!必定 && Math.random() >= rules.主动触发概率) return undefined
      const pool = open.filter(
        (card) => card.事件 === event && isCool(card.id, seen),
      )
      if (pool.length === 0) return undefined
      return pool[Math.floor(Math.random() * pool.length)]
    },
    [open, isCool, rules],
  )

  // 问到了她知道的事,就**一定要答得出来**。所以这里和 pickByEvent 不一样:
  // 不掷骰子,而且冷却里也不算「不知道」—— 她确实知道,只是刚说过。
  // 优先给没在冷却里的;全都在冷却里就给最久没说过的那张,宁可重复也不能装不知道
  const leastRecent = useCallback(
    (pool: KnowledgeCardData[], seen: Record<string, string>) => {
      if (pool.length === 0) return undefined
      const fresh = pool.filter((card) => isCool(card.id, seen))
      const from = fresh.length > 0 ? fresh : pool
      return from.reduce((best, card) =>
        (Date.parse(seen[card.id] ?? '') || 0) < (Date.parse(seen[best.id] ?? '') || 0) ? card : best,
      )
    },
    [isCool],
  )

  // 按学科问(不打字的那条路)。学科字段有「生物 / 历史」这种两栖的,所以用包含匹配
  const pickBySubject = useCallback(
    (subject: string, seen: Record<string, string>) =>
      leastRecent(open.filter((card) => card.学科.includes(subject)), seen),
    [open, leastRecent],
  )

  // 打字问。**只在白名单里找,一个字都不生成**(原则 5)。
  // 中文按 2 字窗口滑过去比对(六岁孩子问的是「海草」「大象」「泡泡」这种词),
  // 英文按空格切词。命中几个窗口就算几分,分最高的那张胜出;一分没有就是「不知道」
  const search = useCallback(
    (text: string, seen: Record<string, string>) => {
      const q = text.trim().toLowerCase()
      if (q.length === 0) return undefined
      const terms = new Set<string>()
      for (const word of q.split(/[\s,，。?？!！、]+/)) {
        if (word.length >= 2) terms.add(word)
      }
      // 2 字窗口:「海草会开花吗」→ 海草 / 草会 / 会开 / 开花 / 花吗,总有一个能命中
      for (let i = 0; i + 2 <= q.length; i++) {
        const w = q.slice(i, i + 2)
        if (/^\s|\s$/.test(w)) continue
        terms.add(w)
      }
      if (terms.size === 0) return undefined
      // childText 命中算 3 倍。她问的多半就是卡面上那句话里的词
      const scoreOf = (id: string) => {
        const hay = index[id]
        if (!hay) return 0
        let score = 0
        for (const t of terms) {
          if (hay.child.includes(t)) score += t.length * 3
          else if (hay.extra.includes(t)) score += t.length
        }
        return score
      }
      let bestScore = 0
      for (const card of open) bestScore = Math.max(bestScore, scoreOf(card.id))
      if (bestScore === 0) return undefined
      // 同分时优先给没说过的那张
      return leastRecent(open.filter((card) => scoreOf(card.id) === bestScore), seen)
    },
    [open, index, leastRecent],
  )

  // 哪些身体部位是可以点的。不随冷却变化,免得热区忽有忽无
  const anchors = [
    ...new Set(open.map((card) => card.锚点).filter((a): a is string => !!a)),
  ]

  // 能问的学科。从白名单里现算 —— 爸爸屏蔽掉整科的卡之后,那一科就不该还摆在那儿
  const subjects = useMemo(() => {
    const order = ['生物', '自然', '数学', '历史', '百科']
    return order.filter((s) => open.some((card) => card.学科.includes(s)))
  }, [open])

  // 按 id 取一张。委托做完时给的那张卡走这条路(ROADMAP 3-6)。
  // **不看冷却** —— 那是一辈子只发生一次的时刻,和「长大一点」那种 必定=true 同一类;
  // 但**照样过屏蔽那道闸**(取的是 open 不是 cards):爸爸屏蔽掉的卡不该从委托里漏出去
  const cardById = useCallback(
    (id: string | null | undefined) => (id ? open.find((card) => card.id === id) : undefined),
    [open],
  )

  // 图鉴里放两种卡:本来就住在图鉴里的,和她已经在海里遇到过的。
  // 不显示「还没解锁」的格子,也不显示总数 —— 她不知道一共有多少张,就没有什么可集齐的
  const bookCards = useCallback(
    (seen: Record<string, string>) =>
      open.filter((card) => card.图鉴 === true || Boolean(seen[card.id])),
    [open],
  )

  return { anchors, subjects, unknownLines, bookCards, cardById, pickByAnchor, pickByEvent, pickBySubject, search }
}
