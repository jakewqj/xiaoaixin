import { useRef } from 'react'
import type { GrowthStage } from '../lib/pet'

// 长按标题进控制后台需要按住这么久,比童童的手指停留时间长得多,不会被误触发
const ADMIN_HOLD_MS = 5000

interface GameHudProps {
  day: number
  moonPhase: string
  tide: string
  // 当前成长阶段。体长/体重只是好玩的展示数字,不是分数,不会因为没达标而扣什么
  stage: GrowthStage
  // 长按标题 5 秒:爸爸的控制后台入口。童童不知道要按这么久,不会误进去
  onHoldTitle?: () => void
}

// 左上角的紧凑状态框:月相 + 潮汐 + 第几天 + 体长/体重。仿参考图里的时钟挂件位置和方形边框。
// moonPhase/tide 现在还是外面传进来的占位文字,真正的月相/潮汐计算是 S4 的事,这里不算。
// 体长/体重读的是 pet.json 成长阶段里的真实数据(见该文件注释里的出处和换算方法)
function GameHud({ day, moonPhase, tide, stage, onHoldTitle }: GameHudProps) {
  const holdTimer = useRef<number | null>(null)

  function startHold() {
    if (!onHoldTitle) return
    holdTimer.current = window.setTimeout(onHoldTitle, ADMIN_HOLD_MS)
  }

  function cancelHold() {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }

  return (
    <div
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      className="absolute top-2 left-2 rounded-md border-2 border-wood-dark bg-wood p-1 shadow-sm select-none"
    >
      <div className="rounded-sm bg-parchment px-1.5 py-1">
      <p className="font-kuaile text-[7px] leading-none text-ink/40">小爱心</p>
      <p className="mt-0.5 flex items-center gap-1.5 font-wenkai text-[9px] leading-none whitespace-nowrap text-ink">
        <span aria-hidden="true">🌙</span>
        <span>{moonPhase}</span>
        <span aria-hidden="true">🌊</span>
        <span>{tide}</span>
      </p>
      <p className="mt-1 font-wenkai text-[9px] leading-none text-ink">第 {day} 天</p>
      {stage.真实体长_m !== undefined && stage.真实体重_kg !== undefined && (
        <p className="mt-1 flex items-center gap-1.5 font-wenkai text-[9px] leading-none whitespace-nowrap text-ink">
          <span aria-hidden="true">📏</span>
          <span>{stage.真实体长_m} m</span>
          <span aria-hidden="true">⚖️</span>
          <span>{stage.真实体重_kg} kg</span>
        </p>
      )}
      </div>
    </div>
  )
}

export default GameHud
