// 打开选海卡片。和相册、图鉴的按钮一个样式,她自己按才会出来
function SeaButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="换一片海"
      className="pointer-events-auto absolute right-5 bottom-24 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-white/70 text-3xl shadow-lg transition-transform active:scale-95 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
    >
      <span aria-hidden="true">🗺️</span>
    </button>
  )
}

export default SeaButton
