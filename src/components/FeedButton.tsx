// 喂食按钮。和相册/图鉴/换海用同一种 56px 圆按钮语言,图标够大不识字也认得出
function FeedButton({ onFeed }: { onFeed: () => void }) {
  return (
    <button
      type="button"
      onClick={onFeed}
      aria-label="喂海草"
      className="pointer-events-auto flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-white/85 text-3xl shadow-lg transition-transform active:scale-95 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
    >
      <span aria-hidden="true">🌱</span>
    </button>
  )
}

export default FeedButton
