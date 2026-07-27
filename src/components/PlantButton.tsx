// 种海草。没有花费、没有数量限制的焦虑,种满了也只是种满了
function PlantButton({ onPlant }: { onPlant: () => void }) {
  return (
    <button
      type="button"
      onClick={onPlant}
      className="flex min-h-14 min-w-14 cursor-pointer flex-col items-center gap-0.5 rounded-3xl bg-white/85 px-6 py-3 shadow-lg transition-transform active:scale-95 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
    >
      <span className="text-4xl leading-none" aria-hidden="true">
        🌿
      </span>
      <span className="font-kuaile text-2xl text-ink">种一棵</span>
    </button>
  )
}

export default PlantButton
