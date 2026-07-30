import { useEffect, useState } from 'react'

interface SlotProps {
  icon: string
  label: string
  onClick: () => void
  locked?: boolean
  badge?: number
  glow?: boolean
}

// 一个紧凑方形按钮。尺寸按参考图的视觉比例定,不再套旧的 56px 触摸底线——
// 见本次会话决定:美术还原度优先于旧的像素数值规则(CLAUDE.md 已同步注明)。
// locked = 系统还没做,灰着占位,点了给提示而不是没反应。
// glow = 现在特别需要点它(比如该换气了),边框亮一圈,不用文字也看得出来
function Slot({ icon, label, onClick, locked, badge, glow }: SlotProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`relative flex h-9 w-9 cursor-pointer items-center justify-center rounded text-lg shadow-sm transition-transform active:scale-95 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart ${
        locked ? 'bg-parchment/70 opacity-40 grayscale' : 'bg-parchment'
      } ${glow ? 'ring-2 ring-heart' : ''}`}
    >
      <span aria-hidden="true">{icon}</span>
      {badge !== undefined && badge > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-heart px-0.5 font-wenkai text-[8px] leading-none text-white"
        >
          {badge}
        </span>
      )}
    </button>
  )
}

interface ActionBarProps {
  grownSeagrass: number
  breathWaiting: boolean
  onFeed: () => void
  onPlant: () => void
  onOpenSea: () => void
  onOpenAlbum: () => void
  onOpenBook: () => void
  onBreathe: () => void
}

// 右下角紧凑方形按钮区,仿参考图的两排布局。第一排是道具栏(贝壳/礼物/背包还没做,灰着;
// 图鉴已经做好了,混在同一排,位置比功能优先);第二排是常用动作。
// 永远不超过 4 格的是「道具栏」(贝壳/礼物/背包)——图鉴和第二排都是功能入口,不算道具
function ActionBar({
  grownSeagrass,
  breathWaiting,
  onFeed,
  onPlant,
  onOpenSea,
  onOpenAlbum,
  onOpenBook,
  onBreathe,
}: ActionBarProps) {
  const [tip, setTip] = useState<string | null>(null)

  // 提示自己收起来,不用她点第二下
  useEffect(() => {
    if (!tip) return
    const timer = setTimeout(() => setTip(null), 2200)
    return () => clearTimeout(timer)
  }, [tip])

  return (
    <div className="pointer-events-auto absolute right-2 bottom-2 flex flex-col items-end gap-1">
      {tip && (
        <p className="pointer-events-none rounded-md bg-ink/85 px-2 py-1 font-wenkai text-[9px] leading-none whitespace-nowrap text-white shadow-sm">
          {tip}
        </p>
      )}
      <div className="flex gap-1 rounded-md border-2 border-wood-dark bg-wood p-1 shadow-sm">
        <Slot icon="🐚" label="贝壳(长大了才有)" locked onClick={() => setTip('长大了才有')} />
        <Slot icon="🎁" label="礼物(长大了才有)" locked onClick={() => setTip('长大了才有')} />
        <Slot icon="🎒" label="背包(长大了才有)" locked onClick={() => setTip('长大了才有')} />
        <Slot icon="📖" label="图鉴" onClick={onOpenBook} />
      </div>
      <div className="flex gap-1 rounded-md border-2 border-wood-dark bg-wood p-1 shadow-sm">
        {grownSeagrass > 0 ? (
          <Slot icon="🌱" label="喂海草" badge={grownSeagrass} onClick={onFeed} />
        ) : (
          <Slot icon="🌱" label="海草还没长成" locked onClick={() => setTip('还没有长成的海草')} />
        )}
        <Slot icon="🌿" label="种海草" onClick={onPlant} />
        <Slot icon="🗺️" label="换一片海" onClick={onOpenSea} />
        <Slot icon="📷" label="相册" onClick={onOpenAlbum} />
        <Slot icon="🫧" label="帮小爱心换气" glow={breathWaiting} onClick={onBreathe} />
      </div>
    </div>
  )
}

export default ActionBar
