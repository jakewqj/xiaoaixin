import { useCallback, useEffect, useState } from 'react'

export interface ConfigSpec {
  开放海域: string[]
  开放地点: string[]
  开放NPC: { id: string; 语言?: string; 熟悉度上限?: number }[]
  系统开关: Record<string, boolean>
  语言设置: { 拼音: boolean; 英语朗读: boolean; 英语选项数量: number }
  成长设置: { 阶段推进速度: number; 手动设置阶段: string | null }
  知识卡: { 屏蔽: string[] }
  陪伴设置: { 单次游玩软提示分钟: number; 提示方式?: string }
  小爱心皮肤: string
  后台: { 密码: string; 对话日志上限: number }
}

// 后台改动只覆盖爸爸动过的那几个字段,其余照读 config.json 的默认值
export type ConfigOverride = Partial<{
  开放海域: string[]
  开放地点: string[]
  开放NPC: ConfigSpec['开放NPC']
  系统开关: Partial<ConfigSpec['系统开关']>
  语言设置: Partial<ConfigSpec['语言设置']>
  成长设置: Partial<ConfigSpec['成长设置']>
  知识卡: Partial<ConfigSpec['知识卡']>
  陪伴设置: Partial<ConfigSpec['陪伴设置']>
  小爱心皮肤: string
  后台: Partial<ConfigSpec['后台']>
}>

const OVERRIDE_KEY = 'xiaoaixin_config'

// 「一键回到只有小爱心」:地点收回到 S0.5 时就有的两个(家海草床、换气水面),邻居清空
export const ONLY_PET_OVERRIDE: ConfigOverride = {
  开放地点: ['家海草床', '换气水面'],
  开放NPC: [],
}

function readOverride(): ConfigOverride {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function writeOverride(override: ConfigOverride) {
  try {
    if (Object.keys(override).length === 0) {
      localStorage.removeItem(OVERRIDE_KEY)
    } else {
      localStorage.setItem(OVERRIDE_KEY, JSON.stringify(override))
    }
  } catch {
    // 存不进去就算了,这次的后台改动这一局有效,但下次打开会回到文件默认值
  }
}

function mergeConfig(base: ConfigSpec, override: ConfigOverride): ConfigSpec {
  return {
    ...base,
    ...override,
    系统开关: { ...base.系统开关, ...override.系统开关 } as Record<string, boolean>,
    语言设置: { ...base.语言设置, ...override.语言设置 },
    成长设置: { ...base.成长设置, ...override.成长设置 },
    知识卡: { ...base.知识卡, ...override.知识卡 },
    陪伴设置: { ...base.陪伴设置, ...override.陪伴设置 },
    后台: { ...base.后台, ...override.后台 },
  }
}

function mergeOverride(prev: ConfigOverride, patch: ConfigOverride): ConfigOverride {
  return {
    ...prev,
    ...patch,
    系统开关: patch.系统开关 ? { ...prev.系统开关, ...patch.系统开关 } : prev.系统开关,
    语言设置: patch.语言设置 ? { ...prev.语言设置, ...patch.语言设置 } : prev.语言设置,
    成长设置: patch.成长设置 ? { ...prev.成长设置, ...patch.成长设置 } : prev.成长设置,
    知识卡: patch.知识卡 ? { ...prev.知识卡, ...patch.知识卡 } : prev.知识卡,
    陪伴设置: patch.陪伴设置 ? { ...prev.陪伴设置, ...patch.陪伴设置 } : prev.陪伴设置,
    后台: patch.后台 ? { ...prev.后台, ...patch.后台 } : prev.后台,
  }
}

// config.json 的唯一读取口,叠加后台(隐藏控制面板)存在 localStorage 的覆盖层。
// 组件读到的 config 永远是「文件默认值 + 爸爸改过的部分」合并后的结果
export function useConfig() {
  const [defaults, setDefaults] = useState<ConfigSpec | null>(null)
  const [override, setOverride] = useState<ConfigOverride>(() => readOverride())

  useEffect(() => {
    let cancelled = false
    fetch('/content/config.json')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setDefaults(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    writeOverride(override)
  }, [override])

  const update = useCallback((patch: ConfigOverride) => {
    setOverride((prev) => mergeOverride(prev, patch))
  }, [])

  const reset = useCallback(() => setOverride({}), [])

  const resetToOnlyPet = useCallback(() => setOverride(ONLY_PET_OVERRIDE), [])

  return {
    config: defaults ? mergeConfig(defaults, override) : null,
    update,
    reset,
    resetToOnlyPet,
  }
}
