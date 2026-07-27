import { MAX_FULLNESS } from '../hooks/useSave'

function Blade({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 40" className="h-10 w-6" aria-hidden="true">
      <g
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        stroke={filled ? 'var(--color-seagrass)' : 'rgb(255 255 255 / 0.45)'}
      >
        <path d="M12 38 C 10 26 6 18 7 8" />
        <path d="M12 38 C 15 28 18 22 17 13" />
      </g>
    </svg>
  )
}

// 饱食度:5 棵海草,亮着的就是还有的。永远不显示数字和百分比,也永远不变红
function FullnessMeter({ value }: { value: number }) {
  return (
    <div className="flex items-end gap-1" role="img" aria-label="小爱心的肚子">
      {Array.from({ length: MAX_FULLNESS }, (_, i) => (
        <Blade key={i} filled={i < value} />
      ))}
    </div>
  )
}

export default FullnessMeter
