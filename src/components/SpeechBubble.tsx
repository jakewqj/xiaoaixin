// 小爱心头顶的话。文字读不懂也不影响操作,所以这里只负责显示,不承载任何按钮。
// 中文下方那行小字是英文 —— 同一件事的第二种叫法,没有就不显示
function SpeechBubble({ text, en }: { text: string; en?: string }) {
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 mb-4 w-max max-w-[80vw] -translate-x-1/2 rounded-3xl bg-white/92 px-6 py-3 text-center shadow-lg">
      <p className="font-kuaile text-3xl leading-snug whitespace-pre-line text-ink">
        {text}
      </p>
      {en && <p className="font-wenkai mt-1 text-lg leading-snug text-ink/50">{en}</p>}
    </div>
  )
}

export default SpeechBubble
