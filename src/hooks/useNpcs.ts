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

export interface NpcSpec {
  名字: string
  地点: string
  语言: string
  精灵: string
  精灵规格?: { 尺寸: string }
  动画: Record<string, NpcAnim>
  话题库?: Record<string, NpcTopic[]>
}

// "112x48" 这种字符串换算成像素宽高。哪个 NPC 的格式写错了就退回一个不算太离谱的默认方块,
// 不让一条坏数据把整个地点渲染炸掉
export function frameSizeOf(npc: NpcSpec): [number, number] {
  const match = /^(\d+)x(\d+)$/.exec(npc.精灵规格?.尺寸 ?? '')
  if (!match) return [64, 64]
  return [Number(match[1]), Number(match[2])]
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
