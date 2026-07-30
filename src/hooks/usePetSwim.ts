import { useCallback, useEffect, useRef, useState } from 'react'
import { STAGE_WIDTH } from '../components/ScreenFrame'

// 点哪游哪的巡游速度:儒艮悠闲巡游约 5 km/h ≈ 1.4 m/s;
// 游戏里成年体长 3m = 192 逻辑px,即 64px/m → 1.4 × 64 ≈ 90 逻辑px/秒。
// 不做加速冲刺——她永远是纪录片里那种不紧不慢的游法
const SWIM_SPEED = 90

// 身体一半宽度左右的安全边距,免得头或尾巴探出世界边缘
const EDGE_MARGIN = 80

// 小爱心在世界横条里的位置与移动:点击屏幕某处 → 转向那边 → 匀速游过去。
// 场景切换不再有按钮,就是她自己游过去,镜头跟着她
export function usePetSwim(worldWidth: number) {
  const [x, setX] = useState(STAGE_WIDTH / 2)
  const [facingLeft, setFacingLeft] = useState(false)
  const [target, setTarget] = useState<number | null>(null)
  const xRef = useRef(x)
  xRef.current = x

  const swimTo = useCallback(
    (rawX: number) => {
      const clamped = Math.max(EDGE_MARGIN, Math.min(worldWidth - EDGE_MARGIN, rawX))
      if (Math.abs(clamped - xRef.current) < 4) return
      setFacingLeft(clamped < xRef.current)
      setTarget(clamped)
    },
    [worldWidth],
  )

  // 世界变小了(后台关掉了地点)就把她拉回有效范围,别让她卡在不存在的地方
  useEffect(() => {
    setX((prev) => Math.max(EDGE_MARGIN, Math.min(worldWidth - EDGE_MARGIN, prev)))
    setTarget((prev) =>
      prev === null ? null : Math.max(EDGE_MARGIN, Math.min(worldWidth - EDGE_MARGIN, prev)),
    )
  }, [worldWidth])

  useEffect(() => {
    if (target === null) return
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      setX((prev) => {
        const diff = target - prev
        const move = SWIM_SPEED * dt
        if (Math.abs(diff) <= move) {
          setTarget(null)
          return target
        }
        return prev + Math.sign(diff) * move
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])

  return { x, facingLeft, swimming: target !== null, swimTo }
}
