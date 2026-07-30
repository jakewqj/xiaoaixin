import { useEffect, useState } from 'react'

export interface Spot {
  id: string
  名字: string
  解锁阶段?: string
  常驻NPC?: string[]
  factRef?: string
}

export interface SeaWorld {
  id: string
  解锁阶段?: string
  factRef?: string
  地点: Spot[]
}

export interface WorldSpec {
  海域: Record<string, SeaWorld>
}

// world.json 的唯一读取口:海域 → 地点。哪些地点真的能进,交给 config.json 的「开放地点」判断
export function useWorld() {
  const [spec, setSpec] = useState<WorldSpec | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/content/world.json')
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
