import { useCallback, useEffect, useState } from 'react'
import type { SaveData } from './useSave'

export interface QuestSpec {
  id: string
  say: string
  icon?: string
  完成事件: string
  /** 只有「送画给邻居」这类认对象的委托才有。不填就是任意对象都算 */
  对象?: string
  完成语: string
  /** 完成时给的图鉴卡 id。必须是 knowledge.json 里已核对过的卡(原则 5) */
  知识卡?: string | null
}

/** 绿绿身上那个按钮现在是什么状态。idle = 不该出现这个按钮 */
export type QuestPhase = 'idle' | 'new' | 'active' | 'report'

// 委托(ROADMAP 3-6)。**无时限、无失败** —— 不做就一直挂着,没有倒计时、
// 没有放弃按钮、没有任何惩罚(宪法十六:不做时间压力、不做失败态)。
// 每天最多接 1 条;做完那件事之后要回去告诉绿绿,**那一刻**才给熟悉度和图鉴卡 ——
// 「完成给熟悉度」给的是和她的关系,所以奖励发生在见到她的时候,不是事情做完的时候。
// 回不回去、什么时候回去都随便,委托会一直等着。
export function useQuests() {
  const [quests, setQuests] = useState<QuestSpec[]>([])

  useEffect(() => {
    fetch('/content/quests.json')
      .then((res) => res.json() as Promise<unknown>)
      .then((raw) => {
        const data = (raw ?? {}) as { 委托?: unknown }
        if (Array.isArray(data.委托)) setQuests(data.委托 as QuestSpec[])
      })
      .catch(() => {})
  }, [])

  const byId = useCallback(
    (id: string | undefined) => (id ? quests.find((q) => q.id === id) : undefined),
    [quests],
  )

  // 今天还能接的那一条。**按 quests.json 的顺序取第一条没做过的** ——
  // 随机抽的话「轮着来」就不成立,同一条可能连着几天都抽不到
  const nextQuest = useCallback(
    (save: SaveData) => {
      if (save.quest) return undefined
      if (save.questTakenAt === new Date().toDateString()) return undefined
      return quests.find((q) => !save.questsDone.includes(q.id))
    },
    [quests],
  )

  // 绿绿那个按钮该不该出现、点下去是哪一出。
  // **四条全做完之后回到 idle,按钮就不再出现** —— 留一个点了只会重复同一句话的
  // 按钮在那儿,就是死控件。想接着给,往 quests.json 里添就行
  const phaseOf = useCallback(
    (save: SaveData): QuestPhase => {
      if (save.quest) return save.quest.done ? 'report' : 'active'
      return nextQuest(save) ? 'new' : 'idle'
    },
    [nextQuest],
  )

  // 这个动作能不能把挂着的那条结掉。**只认「正挂着且还没做完」的那一条** ——
  // 已经 done 的再触发一次不该有任何变化,否则回去报一次就又亮一次
  const settles = useCallback(
    (save: SaveData, event: string, target?: string) => {
      if (!save.quest || save.quest.done) return false
      const q = byId(save.quest.id)
      if (!q || q.完成事件 !== event) return false
      return !q.对象 || q.对象 === target
    },
    [byId],
  )

  return { quests, byId, nextQuest, phaseOf, settles }
}
