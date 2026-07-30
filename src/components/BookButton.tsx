// 打开图鉴。她自己按才会进去,小爱心从不主动把她拽进来
function BookButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="图鉴"
      className="pointer-events-auto absolute right-5 bottom-5 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-white/70 text-3xl shadow-lg transition-transform active:scale-95 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
    >
      <span aria-hidden="true">📖</span>
    </button>
  )
}

export default BookButton
