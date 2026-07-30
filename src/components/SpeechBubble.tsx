// 小爱心头顶的话。文字读不懂也不影响操作,所以这里只负责显示,不承载任何按钮。
// 中文下方那行小字是英文 —— 同一件事的第二种叫法,没有就不显示。
// 不自带定位,由 Dialogue 把它和选项一起摆在小爱心头顶
function SpeechBubble({ text, en }: { text: string; en?: string }) {
  return (
    <div className="w-max max-w-[300px] rounded-3xl bg-white/92 px-4 py-1.5 text-center shadow-lg">
      <p className="font-kuaile text-2xl leading-snug whitespace-pre-line text-ink">
        {text}
      </p>
      {en && <p className="font-wenkai mt-0.5 text-base leading-snug text-ink/50">{en}</p>}
    </div>
  )
}

export default SpeechBubble
