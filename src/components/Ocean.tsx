// 水越浑,这层沙色的雾越厚。只是看起来不一样,不影响任何玩法
const MAX_HAZE = 0.34

// 海洋背景:一屏竖屏,自上而下 浅滩 → 中层 → 深水,底部一条沙底
function Ocean({ clarity }: { clarity: number }) {
  return (
    <div className="fixed inset-0 bg-linear-to-b from-water-shallow via-water-mid via-45% to-water-deep">
      <div
        className="absolute inset-0 bg-sand transition-opacity duration-[2s]"
        style={{ opacity: (1 - clarity) * MAX_HAZE }}
      />
      <div className="absolute inset-x-0 bottom-0 h-[10dvh] bg-sand" />
    </div>
  )
}

export default Ocean
