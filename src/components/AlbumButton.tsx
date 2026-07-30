// 打开相册。和图鉴一样,她自己按才会进去
function AlbumButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="相册"
      className="pointer-events-auto absolute bottom-5 left-5 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-white/70 text-3xl shadow-lg transition-transform active:scale-95 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
    >
      <span aria-hidden="true">📷</span>
    </button>
  )
}

export default AlbumButton
