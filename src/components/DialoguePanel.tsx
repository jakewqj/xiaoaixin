import { useEffect, useState } from 'react'
import { speak } from '../lib/speech'
import PixelIcon from './PixelIcon'

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
      <div className="hud-panel pointer-events-auto w-full max-w-[420px] px-1 pt-0.5 pb-1">
        <p className="font-wenkai mb-0.5 text-xs leading-none text-[#f8e8c8]/85">{shown.speaker}</p>
        <button
          type="button"
          onClick={handleTextTap}
          className="sv-plate w-full px-3 py-1 text-left"
        >
          {/* 2026-08-04 用户决议:对话文字 24px → 12px,推翻 CLAUDE.md 四「对话文字最小 24px」。
              我提过这条撞宪法、也提过童童正在识字,用户确认照做。
              12px 是 Zpix 的原生点阵格,零重采样,笔画反而比 24px 锐。
              行距 16px(整数,留 4px 行间)—— 半像素行高会把基线推歪,点阵字必发虚 */}
          <p className="font-kuaile text-xs leading-[16px] whitespace-pre-line text-ink">
            {shown.text}
          </p>
          {/* 正文降到 12px 之后,英文副标题没法再更小(12 是 Zpix 下限),
              §九 说的「小字」现在只靠颜色区分:正文 text-ink,英文 text-ink/50 */}
          {shown.en && (
            <p className="font-wenkai mt-0.5 text-xs leading-none text-ink/50">{shown.en}</p>
          )}
        </button>
        {shown.options.length > 0 && (
          <div className="mt-1 flex flex-wrap justify-center gap-1">
            {shown.options.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={option.onSelect}
                className="sv-plate flex min-h-6 cursor-pointer items-center gap-1 px-2 py-0.5 transition-transform active:translate-y-px focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
              >
                <PixelIcon emoji={option.icon} />
                <span className="font-kuaile text-xs leading-none text-ink">{option.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DialoguePanel
