import { useEffect, useState } from 'react'

export interface NpcAnim {
  文件: string
  帧数: number
  fps: number
}

export interface NpcTopic {
  id: string
  say: string
  options?: { text: string; icon: string }[]
}

export interface NpcGiftReaction {
  text: string
  audio?: string | null
}

export interface NpcSpec {
  名字: string
  地点: string
  语言: string
  精灵: string
  /** 对话框右边那格立绘的文件名,和「精灵」目录拼起来用。
      没画头像的邻居不填 —— 对话框会退回没有头像的旧版式,不留空框 */
  头像?: string
  精灵规格?: { 尺寸: string }
  /** 「沙面」= 坐在海底(砗磲这类固着生物)。不写就是游在水里 */
  落位?: string
  动画: Record<string, NpcAnim>
  话题库?: Record<string, NpcTopic[]>
  熟悉度上限?: number
  礼物反馈?: { 很喜欢: NpcGiftReaction; 谢谢你: NpcGiftReaction }
  // 偶尔提起挂在自己身边的画(ROADMAP 2-5)。只表达喜欢,不评价画得怎么样。
  // 没填的邻居走 App 里的兜底文案
  挂画反馈?: { text: string; icon?: string }[]
}

/** npc.json 里「地点」写成这个值 = 不落地点,跟着小爱心游(小金是唯一一个) */
export const FOLLOW_PET = '跟随小爱心'

/** npc.json 里「语言」写成这个值 = 复读(小金)。它既不是 zh 也不是外语,
 *  对话面板不能凭「不是 zh」就把它当外语用 TTS 念中文 —— 见 App.tsx 的 foreign 判定 */
export const REPEAT_LANG = '复读'

// "112x48" 这种字符串换算成像素宽高。哪个 NPC 的格式写错了就退回一个不算太离谱的默认方块,
// 不让一条坏数据把整个地点渲染炸掉
export function frameSizeOf(npc: NpcSpec): [number, number] {
  const match = /^(\d+)x(\d+)$/.exec(npc.精灵规格?.尺寸 ?? '')
  if (!match) return [64, 64]
  return [Number(match[1]), Number(match[2])]
}

// 熟悉度解锁话题库:等级到了哪一档,就能抽到那一档及以下的话。
// 刚认识、等级还是 0 的时候也按 1 算,不然第一次见面反而一句话都抽不到
export function unlockedTopics(npc: NpcSpec, level: number): NpcTopic[] {
  const effective = Math.max(level, 1)
  return Object.entries(npc.话题库 ?? {})
    .filter(([tier]) => Number(tier) <= effective)
    .flatMap(([, topics]) => topics)
}

export type NpcMap = Record<string, NpcSpec>

// npc.json 的唯一读取口。哪些角色真的出现,交给 config.json 的「开放NPC」判断
export function useNpcs() {
  const [spec, setSpec] = useState<NpcMap | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/content/npc.json')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSpec(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return spec
}
