import { useCallback, useEffect, useState } from 'react'
import { PET_DIR, stagesOf } from '../lib/pet'
import type { GrowthStage, PetSpec } from '../lib/pet'

// pet.json 的唯一读取口。形象文件名、锚点、成长阶段全部从这里来,组件里不许写死
export function usePet() {
  const [spec, setSpec] = useState<PetSpec | null>(null)
  const [missing, setMissing] = useState<string[]>([])

  useEffect(() => {
    fetch(`${PET_DIR}/pet.json`)
      .then((res) => res.json())
      .then(setSpec)
      .catch(() => {})
  }, [])

  const markMissing = useCallback((file: string) => {
    setMissing((prev) => (prev.includes(file) ? prev : [...prev, file]))
  }, [])

  // 开局先摸一遍还没画出来的形象,免得第一次切换姿势或长大时闪一下空白。
  // 画好的那几张顺便预加载了
  useEffect(() => {
    if (!spec) return
    const declared = [
      ...Object.values(spec.文件 ?? {}),
      ...stagesOf(spec).flatMap((stage) => Object.values(stage.文件 ?? {})),
    ]
    for (const file of new Set(declared)) {
      if (file === spec.文件?.idle) continue
      const probe = new Image()
      probe.onerror = () => markMissing(file)
      probe.src = `${PET_DIR}/${file}`
    }
  }, [spec, markMissing])

  // 想要哪张图就写哪张:先找这个阶段专属的,再找通用的,都没有就退回 idle。
  // 缺一张不影响别的,童童画好了拖进文件夹就自己生效
  const fileFor = useCallback(
    (pose: string, stage?: GrowthStage) => {
      if (!spec) return null
      const fallback = spec.文件?.idle
      const found = [stage?.文件?.[pose], spec.文件?.[pose], fallback].find(
        (file): file is string => Boolean(file) && !missing.includes(file as string),
      )
      return found ?? fallback ?? null
    },
    [spec, missing],
  )

  return { spec, fileFor, markMissing }
}
