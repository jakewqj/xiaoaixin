interface LocationNavProps {
  name: string
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
}

// 地点左右切换。没有更多地方可去时箭头直接不出现,不做成灰色可点但没反应的样子
function LocationNav({ name, canPrev, canNext, onPrev, onNext }: LocationNavProps) {
  return (
    <div className="pointer-events-auto absolute top-2 left-1/2 flex -translate-x-1/2 items-center gap-1">
      {canPrev && (
        <button
          type="button"
          onClick={onPrev}
          aria-label="去左边"
          className="flex h-8 min-h-8 w-8 min-w-8 cursor-pointer items-center justify-center rounded-md border-2 border-wood-dark bg-parchment/95 text-xs text-ink shadow focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
        >
          ◀
        </button>
      )}
      <span className="rounded-md border-2 border-wood-dark bg-parchment/95 px-2 py-1 font-kuaile text-[10px] whitespace-nowrap text-ink shadow">
        {name}
      </span>
      {canNext && (
        <button
          type="button"
          onClick={onNext}
          aria-label="去右边"
          className="flex h-8 min-h-8 w-8 min-w-8 cursor-pointer items-center justify-center rounded-md border-2 border-wood-dark bg-parchment/95 text-xs text-ink shadow focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
        >
          ▶
        </button>
      )}
    </div>
  )
}

export default LocationNav
