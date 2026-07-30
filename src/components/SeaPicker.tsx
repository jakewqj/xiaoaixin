import type { SeaTheme } from '../lib/seas'

const SEA_ICONS: Record<string, string> = {
  redsea: '🪸',
  indian: '🌿',
  pacific: '🐢',
}

interface SeaPickerProps {
  seas: SeaTheme[]
  current: string
  onPick: (id: string) => void
  onClose: () => void
}

// 换一片海。从底下浮上来三张卡,点一张就出发;点空白处就收回去。
// 不是教程,不拦住她,她随时可以不选
function SeaPicker({ seas, current, onPick, onClose }: SeaPickerProps) {
  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-20 flex items-end justify-center pb-10"
    >
      <div
        role="presentation"
        onClick={(event) => event.stopPropagation()}
        className="sea-picker flex translate-y-0 items-end gap-3 opacity-100 transition-all duration-300 starting:translate-y-8 starting:opacity-0"
      >
        {seas.map((sea) => {
          const isCurrent = sea.id === current
          return (
            <button
              key={sea.id}
              type="button"
              onClick={() => onPick(sea.id)}
              aria-label={sea.name}
              className={`flex min-h-36 w-28 cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-wood-dark px-3 py-4 shadow-lg transition-transform active:scale-95 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart ${
                isCurrent ? 'bg-parchment' : 'bg-parchment/75'
              }`}
            >
              <span
                className="h-8 w-8 rounded-full shadow-inner"
                style={{
                  background: `linear-gradient(to bottom, ${sea.shallow}, ${sea.deep})`,
                }}
                aria-hidden="true"
              />
              <span className="text-3xl leading-none" aria-hidden="true">
                {SEA_ICONS[sea.id] ?? '🌊'}
              </span>
              <span className="font-kuaile text-xl text-ink">{sea.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default SeaPicker
