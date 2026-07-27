// 喂食按钮。图标够大,不识字也能认出是海草
function FeedButton({ onFeed }: { onFeed: () => void }) {
  return (
    <button
      type="button"
      onClick={onFeed}
      className="flex min-h-14 min-w-14 cursor-pointer flex-col items-center gap-0.5 rounded-3xl bg-white/85 px-8 py-3 shadow-lg transition-transform active:scale-95 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
    >
      <span className="text-4xl leading-none" aria-hidden="true">
        🌱
      </span>
      <span className="text-2xl text-ink">海草</span>
      <span className="text-sm text-ink/55">Seagrass</span>
    </button>
  )
}

export default FeedButton
