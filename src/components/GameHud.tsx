import { useRef } from 'react'
import type { GrowthStage } from '../lib/pet'

// 长按标题进控制后台需要按住这么久,比童童的手指停留时间长得多,不会被误触发
const ADMIN_HOLD_MS = 5000

const UI = '/assets/world/ui'

interface GameHudProps {
  day: number
  moonPhase: string
  tide: string
  // 当前成长阶段。体长/体重只是好玩的展示数字,不是分数,不会因为没达标而扣什么
  stage: GrowthStage
  // 长按标题 5 秒:爸爸的控制后台入口。童童不知道要按这么久,不会误进去
  onHoldTitle?: () => void
}

// 左上角状态挂件:仿参考图的深棕木底+金棕边+奶白字像素面板,图标也是像素画。
// moonPhase/tide 仍是占位文字(S4 才算真的),第几天和体长/体重是真数据
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
      className="hud-panel absolute top-2 left-2 px-1.5 py-1 select-none"
    >
      {/* 两行信息,和参考图时钟挂件一样紧凑:上行月相/潮汐,下行天数+体长体重 */}
      <p className="font-kuaile text-[7px] leading-none text-[#e8d4a8]/60">小爱心</p>
      <p className="mt-1 flex items-center gap-1 font-wenkai text-[9px] leading-none whitespace-nowrap text-[#f8e8c8]">
        <img src={`${UI}/icon_moon.png`} alt="" aria-hidden="true" />
        <span>{moonPhase}</span>
        <img src={`${UI}/icon_wave.png`} alt="" aria-hidden="true" />
        <span>{tide}</span>
      </p>
      <p className="mt-1 flex items-center gap-1 font-wenkai text-[9px] leading-none whitespace-nowrap text-[#f8e8c8]">
        <span>第 {day} 天</span>
        {stage.真实体长_m !== undefined && stage.真实体重_kg !== undefined && (
          <>
            <img src={`${UI}/icon_ruler.png`} alt="" aria-hidden="true" />
            <span>{stage.真实体长_m} m</span>
            <img src={`${UI}/icon_weight.png`} alt="" aria-hidden="true" />
            <span>{stage.真实体重_kg} kg</span>
          </>
        )}
      </p>
    </div>
  )
}

export default GameHud
