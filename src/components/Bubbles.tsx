import type { CSSProperties } from 'react'

// 泡泡的相对排布。left/size 都是相对小爱心图片宽度的百分比,换手稿后不用改
const BUBBLES = [
  { left: 0, size: 5.5, delay: 0 },
  { left: -2.6, size: 4, delay: 0.6 },
  { left: 2.2, size: 4.6, delay: 1.2 },
  { left: -1.2, size: 3.4, delay: 1.8 },
  { left: 1.6, size: 5, delay: 2.4 },
]

interface BubblesProps {
  anchor: [number, number]
  flipped: boolean
  popping: boolean
  popMs: number
}

// 换气泡泡。位置来自 pet.json 的 blowhole 锚点,小爱心转身时 x 跟着镜像
function Bubbles({ anchor, flipped, popping, popMs }: BubblesProps) {
  const [ax, ay] = anchor
  const x = (flipped ? 1 - ax : ax) * 100
  const y = ay * 100

  return (
    <div
      className="bubbles pointer-events-none absolute inset-0"
      aria-hidden="true"
      style={
        {
          opacity: popping ? 0 : 1,
          '--pop-duration': `${popMs}ms`,
        } as CSSProperties
      }
    >
      {BUBBLES.map((bubble) => (
        <span
          key={bubble.delay}
          className="bubble"
          style={{
            left: `${x + bubble.left}%`,
            top: `${y}%`,
            width: `${bubble.size}%`,
            animationDelay: `${bubble.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

export default Bubbles
