import { heightOf, isGrown } from '../lib/seagrass'
import type { Seagrass as Plant } from '../lib/seagrass'

function Blades({ grown }: { grown: boolean }) {
  const color = grown ? 'var(--color-seagrass)' : 'var(--color-seagrass-young)'
  return (
    <svg viewBox="0 0 40 100" className="h-full w-full" aria-hidden="true">
      <g fill="none" stroke={color} strokeWidth="7" strokeLinecap="round">
        <path d="M20 100 C 16 72 8 52 10 22" />
        {grown && <path d="M20 100 C 26 74 34 56 32 30" />}
        {grown && <path d="M20 100 C 20 70 21 50 20 34" />}
      </g>
    </svg>
  )
}

// 海草床。新芽矮、颜色浅,长成的高、颜色深 —— 差别要一眼看得出,不然三天的等待就白等了。
// 高度原来用 dvh(相对真实视口),现在舞台是固定像素的世界,换算成固定像素
function SeagrassBed({ bed, onTap }: { bed: Plant[]; onTap: () => void }) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label="海草床"
      className="absolute inset-x-0 bottom-0 h-[70px] cursor-pointer focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
    >
      {bed.map((plant) => {
        const grown = isGrown(plant)
        return (
          <span
            key={plant.id}
            // 沙底 tile 高 36px,根扎在沙面往下一点,像长在沙里而不是浮在沙上
            className="absolute bottom-[30px] block w-[7%] max-w-10 -translate-x-1/2 origin-bottom"
            style={{
              left: `${plant.x}%`,
              height: `${(grown ? 34 : 16) * heightOf(plant)}px`,
            }}
          >
            <Blades grown={grown} />
          </span>
        )
      })}
    </button>
  )
}

export default SeagrassBed
