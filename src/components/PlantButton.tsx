// 种海草。没有花费、没有数量限制的焦虑,种满了也只是种满了。
// 和相册/图鉴/换海用同一种 56px 圆按钮语言
function PlantButton({ onPlant }: { onPlant: () => void }) {
  return (
    <button
      type="button"
      onClick={onPlant}
      aria-label="种海草"
      className="pointer-events-auto flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-white/85 text-3xl shadow-lg transition-transform active:scale-95 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
    >
      <span aria-hidden="true">🌿</span>
    </button>
  )
}

export default PlantButton
