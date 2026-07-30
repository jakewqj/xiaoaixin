import { useEffect, useState } from 'react'
import { speak } from '../lib/speech'

export interface PanelOption {
  icon: string
  label: string
  onSelect: () => void
}

export interface PanelContent {
  speaker: string
  text: string
  en?: string
  options: PanelOption[]
  // 外语角色:文字区域可以再点一下重新朗读
  foreign?: boolean
  // 没有选项的内容(比如送礼的反馈):点文字区域直接收起,不用非等它自己走
  onDismiss?: () => void
}

const SLIDE_MS = 320

// 小爱心和邻居共用的唯一一个对话面板,仿参考图的木纹边框、贴底滑出。
// 只有一个面板意味着不可能同时弹出两份对话——App.tsx 只允许同一时刻传一份 content 进来。
// 没有选项时,点文字区域直接收起(下滑退出);有选项时靠选一个来关闭
function DialoguePanel({ content }: { content: PanelContent | null }) {
  const [shown, setShown] = useState<PanelContent | null>(null)

  useEffect(() => {
    if (content) {
      setShown(content)
      return
    }
    const timer = setTimeout(() => setShown(null), SLIDE_MS)
    return () => clearTimeout(timer)
  }, [content])

  useEffect(() => {
    if (content?.foreign) speak(content.text)
  }, [content])

  if (!shown) return null
  const open = content !== null

  function handleTextTap() {
    if (shown?.foreign) speak(shown.text)
    if (shown?.options.length === 0) shown.onDismiss?.()
  }

  return (
    <div
      className="dialogue-panel pointer-events-none absolute inset-x-0 bottom-0 flex justify-center"
      style={{ transform: open ? 'translateY(0)' : 'translateY(100%)' }}
    >
      <div className="hud-panel pointer-events-auto w-full max-w-[420px] px-1 pt-0.5 pb-1 shadow-lg">
        <p className="font-wenkai mb-1 text-[9px] leading-none text-[#f8e8c8]/85">{shown.speaker}</p>
        <button
          type="button"
          onClick={handleTextTap}
          className="w-full rounded-md border-2 border-wood-dark bg-parchment px-3 py-1.5 text-left"
        >
          <p className="font-kuaile text-2xl leading-snug whitespace-pre-line text-ink">
            {shown.text}
          </p>
          {shown.en && (
            <p className="font-wenkai mt-0.5 text-base leading-snug text-ink/50">{shown.en}</p>
          )}
        </button>
        {shown.options.length > 0 && (
          <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
            {shown.options.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={option.onSelect}
                className="flex min-h-9 cursor-pointer items-center gap-1 rounded-md border-2 border-wood-dark bg-parchment px-2 py-1 shadow-sm transition-transform active:scale-95 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
              >
                <span className="text-lg leading-none" aria-hidden="true">
                  {option.icon}
                </span>
                <span className="font-kuaile text-lg leading-tight text-ink">{option.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DialoguePanel
