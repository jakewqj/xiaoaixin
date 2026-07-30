import { useCallback, useEffect, useState } from 'react'
import { prefersReducedMotion } from '../lib/motion'
import { playSfx } from '../lib/sfx'

const BREATH_INTERVAL_MS = 3 * 60 * 1000

export const SWIM_MS = 8000
export const POP_MS = 600

export type BreathPhase = 'submerged' | 'rising' | 'waiting' | 'popping' | 'sinking'

// 换气的自动流程。注意 waiting 不在表里 —— 她不来点,小爱心就一直在水面等着,不会有任何后果
function autoAdvance(
  swimMs: number,
): Partial<Record<BreathPhase, { to: BreathPhase; ms: number }>> {
  return {
    submerged: { to: 'rising', ms: BREATH_INTERVAL_MS },
    rising: { to: 'waiting', ms: swimMs },
    popping: { to: 'sinking', ms: POP_MS },
    sinking: { to: 'submerged', ms: swimMs },
  }
}

export function useBreath() {
  const [phase, setPhase] = useState<BreathPhase>('submerged')

  // 整个换气循环只靠这一个定时器推进,页面一关就没了,不存在任何后台行为
  useEffect(() => {
    const swimMs = prefersReducedMotion() ? 0 : SWIM_MS
    const step = autoAdvance(swimMs)[phase]
    if (!step) return
    const timer = setTimeout(() => setPhase(step.to), step.ms)
    return () => clearTimeout(timer)
  }, [phase])

  // 在水面等着的时候戳它就是帮它换气;还在水下的时候戳它,它就现在游上去
  const nudge = useCallback(() => {
    if (phase === 'waiting') {
      playSfx('bubble')
      setPhase('popping')
    } else if (phase === 'submerged') {
      setPhase('rising')
    }
  }, [phase])

  // 浮出水面的这几个阶段共用一个判断,Pet 和摇镜头的 Scene 都要用,别各写一份
  const atSurface = phase === 'rising' || phase === 'waiting' || phase === 'popping'

  return { phase, nudge, atSurface }
}
