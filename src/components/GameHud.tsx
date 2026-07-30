import { useEffect, useState } from 'react'

// 右下道具栏固定 3 格,永远不超过 4 格。见 ROADMAP §0 变更 2:星露谷的 12 格背包对 6 岁是灾难。
// 贝壳/礼物对应的系统(S5 贝币经济、S1 送礼)还没做,先灰着占位,点了给一句话而不是没反应
const LOCKED_ITEMS = [
  { icon: '🐚', label: '贝壳', tip: '长大了才有' },
  { icon: '🎁', label: '礼物', tip: '长大了才有' },
]

interface GameHudProps {
  day: number
  moonPhase: string
  tide: string
  // 已经长成、可以喂给小爱心的海草有几棵。这里只显示数量,不是按钮——
  // 真正喂食的动作在下面那个圆按钮上,两边不重复
  grownSeagrass: number
}

// 左上木框(月相 + 潮汐 + 第几天)+ 右下道具栏。不放金钱、不放剑、不放鱼——见 ROADMAP §0 变更 2。
// moonPhase/tide 现在还是外面传进来的占位文字,真正的月相/潮汐计算是 S4 的事,这里不算
function GameHud({ day, moonPhase, tide, grownSeagrass }: GameHudProps) {
  const [tip, setTip] = useState<string | null>(null)

  // 提示自己收起来,不用她点第二下
  useEffect(() => {
    if (!tip) return
    const timer = setTimeout(() => setTip(null), 2200)
    return () => clearTimeout(timer)
  }, [tip])

  return (
    <>
      <div className="absolute top-2 left-2 rounded-md border-2 border-ink bg-sand/90 px-2 py-1 shadow-sm">
        <p className="flex items-center gap-1.5 font-wenkai text-[9px] leading-none whitespace-nowrap text-ink">
          <span aria-hidden="true">🌙</span>
          <span>{moonPhase}</span>
          <span aria-hidden="true">🌊</span>
          <span>{tide}</span>
        </p>
        <p className="mt-1 font-wenkai text-[9px] leading-none text-ink">第 {day} 天</p>
      </div>

      {/* 右下角已经被相册/图鉴/换海几个圆按钮占满了,道具栏挪到右上角,别撞在一起 */}
      <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
        <div className="flex gap-1 rounded-md border-2 border-ink bg-sand/90 px-1.5 py-1 shadow-sm">
          <div className="flex flex-col items-center gap-0.5">
            <span
              aria-hidden="true"
              className="flex h-5 w-5 items-center justify-center rounded bg-white/70 text-[11px] leading-none"
            >
              🌱
            </span>
            <span className="font-wenkai text-[7px] leading-none text-ink/70">
              海草 x{grownSeagrass}
            </span>
          </div>
          {LOCKED_ITEMS.map((item) => (
            <button
              key={item.icon}
              type="button"
              onClick={() => setTip(item.tip)}
              aria-label={`${item.label}(${item.tip})`}
              className="pointer-events-auto flex flex-col items-center gap-0.5"
            >
              <span
                aria-hidden="true"
                className="flex h-5 w-5 items-center justify-center rounded bg-white/70 text-[11px] leading-none opacity-40 grayscale"
              >
                {item.icon}
              </span>
              <span className="font-wenkai text-[7px] leading-none text-ink/40">{item.label}</span>
            </button>
          ))}
        </div>
        {tip && (
          <p className="pointer-events-none rounded-md bg-ink/85 px-2 py-1 font-wenkai text-[9px] leading-none whitespace-nowrap text-white shadow-sm">
            {tip}
          </p>
        )}
      </div>
    </>
  )
}

export default GameHud
