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
              className={`hud-panel-lg flex min-h-36 w-28 cursor-pointer flex-col items-center gap-2 px-3 py-4 transition-transform active:translate-y-px focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-heart ${
                isCurrent ? '' : 'opacity-80'
              }`}
            >
              {/* 原来是圆形渐变色球:渐变和圆角都是像素风做不出来的东西。
                  改成三条硬边色带,直接把这片海的浅/中/深三色摆出来 —— 信息量还更大 */}
              <span className="flex h-8 w-8 flex-col overflow-hidden" aria-hidden="true">
                <span className="flex-1" style={{ background: sea.shallow }} />
                <span className="flex-1" style={{ background: sea.mid }} />
                <span className="flex-1" style={{ background: sea.deep }} />
              </span>
              <span className="ui-text-tight" aria-hidden="true">
                {SEA_ICONS[sea.id] ?? '🌊'}
              </span>
              <span className="ui-text font-kuaile text-[#f8e8c8]">{sea.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default SeaPicker
