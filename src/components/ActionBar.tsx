import { useEffect, useState } from 'react'

const UI = '/assets/world/ui'

interface SlotProps {
  icon: string
  label: string
  onClick: () => void
  locked?: boolean
  badge?: number
  glow?: boolean
}

// 一格道具/动作:仿参考图 hotbar 的 26px 木格,图标是 16px 像素画,数量白字在右下。
// locked = 系统还没做,图标压灰,点了给提示而不是没反应。
// glow = 现在特别需要点它(比如该换气了),整格换成红框呼吸灯
function Slot({ icon, label, onClick, locked, badge, glow }: SlotProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`ui-slot relative flex cursor-pointer items-center justify-center transition-transform active:scale-95 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-heart ${
        glow ? 'ui-slot-active' : ''
      }`}
    >
      <img
        src={`${UI}/${icon}`}
        alt=""
        aria-hidden="true"
        className={locked ? 'opacity-35 grayscale' : undefined}
      />
      {badge !== undefined && badge > 0 && (
        <span
          aria-hidden="true"
          className="absolute right-[3px] bottom-[2px] font-wenkai text-[8px] leading-none text-[#f8e8c8] [text-shadow:1px_1px_0_#3e2614]"
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

// 右下角两排 hotbar,仿参考图的道具栏(格子紧挨着共享边框,不再套外层托盘)。
// 第一排是道具栏(贝壳/礼物/背包还没做,灰着;图鉴混在同一排);第二排是常用动作。
// 「道具栏」(贝壳/礼物/背包)永远不超过 4 格——图鉴和第二排都是功能入口,不算道具
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
        <p className="pointer-events-none rounded-sm bg-[#3e2614]/90 px-2 py-1 font-wenkai text-[9px] leading-none whitespace-nowrap text-[#f8e8c8] shadow-sm">
          {tip}
        </p>
      )}
      <div className="flex">
        <Slot icon="icon_shell.png" label="贝壳(长大了才有)" locked onClick={() => setTip('长大了才有')} />
        <Slot icon="icon_gift.png" label="礼物(长大了才有)" locked onClick={() => setTip('长大了才有')} />
        <Slot icon="icon_backpack.png" label="背包(长大了才有)" locked onClick={() => setTip('长大了才有')} />
        <Slot icon="icon_book.png" label="图鉴" onClick={onOpenBook} />
      </div>
      <div className="flex">
        {grownSeagrass > 0 ? (
          <Slot icon="icon_sprout.png" label="喂海草" badge={grownSeagrass} onClick={onFeed} />
        ) : (
          <Slot icon="icon_sprout.png" label="海草还没长成" locked onClick={() => setTip('还没有长成的海草')} />
        )}
        <Slot icon="icon_seagrass.png" label="种海草" onClick={onPlant} />
        <Slot icon="icon_map.png" label="换一片海" onClick={onOpenSea} />
        <Slot icon="icon_camera.png" label="相册" onClick={onOpenAlbum} />
        <Slot icon="icon_bubble.png" label="帮小爱心换气" glow={breathWaiting} onClick={onBreathe} />
      </div>
    </div>
  )
}

export default ActionBar
