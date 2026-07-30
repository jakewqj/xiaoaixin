import { useEffect, useState } from 'react'

export interface ConfigSpec {
  开放海域: string[]
  开放地点: string[]
  开放NPC: { id: string; 语言?: string; 熟悉度上限?: number }[]
}

// 爸爸的控制后台默认值。1-7 会加 localStorage 覆盖层,现在先只读 config.json 本身
export function useConfig() {
  const [spec, setSpec] = useState<ConfigSpec | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/content/config.json')
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
