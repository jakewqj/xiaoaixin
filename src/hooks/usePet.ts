import { useCallback, useEffect, useState } from 'react'
import { PET_DIR, skinDir } from '../lib/pet'
import type { PetSpec } from '../lib/pet'

export interface ResolvedAnim {
  src: string
  frameCount: number
  fps: number
}

// pet.json 的唯一读取口。动画文件名、锚点、成长阶段全部从这里来,组件里不许写死
export function usePet() {
  const [spec, setSpec] = useState<PetSpec | null>(null)
  const [missing, setMissing] = useState<string[]>([])

  // 加载失败就一直重试(间隔慢慢拉长,最多等 8 秒再试)—— 小爱心不该因为一次网络抖动就整局消失
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    function load(attempt: number) {
      fetch(`${PET_DIR}/pet.json`)
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled) setSpec(data)
        })
        .catch(() => {
          if (cancelled) return
          timer = setTimeout(() => load(attempt + 1), Math.min(1000 * 2 ** attempt, 8000))
        })
    }

    load(0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  const markMissing = useCallback((pose: string) => {
    setMissing((prev) => (prev.includes(pose) ? prev : [...prev, pose]))
  }, [])

  // 开局先探一遍每套动画的精灵表,缺哪套就记下来,免得播放时对着一张空图硬切帧。
  // 童童画好了拖进对应文件夹,下次刷新自己生效
  useEffect(() => {
    if (!spec) return
    const dir = skinDir(spec)
    for (const [pose, anim] of Object.entries(spec.动画 ?? {})) {
      const probe = new Image()
      probe.onerror = () => markMissing(pose)
      probe.src = `${dir}${anim.文件}`
    }
  }, [spec, markMissing])

  // 想要哪套动画就要哪套:这一套缺了就退回 idle,idle 也缺就没有可播的
  const animFor = useCallback(
    (pose: string): ResolvedAnim | null => {
      if (!spec) return null
      const key = !missing.includes(pose) && spec.动画?.[pose] ? pose : 'idle'
      const anim = spec.动画?.[key]
      if (!anim || missing.includes(key)) return null
      return { src: `${skinDir(spec)}${anim.文件}`, frameCount: anim.帧数, fps: anim.fps }
    },
    [spec, missing],
  )

  return { spec, animFor }
}
