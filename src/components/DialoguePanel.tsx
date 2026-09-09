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
  // 画好头像的邻居才有。有就走星露谷版式(左台词 / 右立绘 + 名牌),
  // 没有就退回名字写在框内左上角的旧版式 —— 不留一个空的立绘框
  portrait?: string
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

  const body = (
    <>
      <button
        type="button"
        onClick={handleTextTap}
        // flex-col + justify-start 是必须的:**<button> 会把内容垂直居中**,
        // 这是 Blink 对按钮的固有行为、不是哪条 CSS 写的(渲染重构阶段 1–2 已经栽过一次)。
        // 台词板一撑高,那两行字就飘到板中间去了 —— 星露谷的台词是顶格排的
        className="sv-plate flex w-full flex-1 flex-col justify-start px-3 py-1 text-left"
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
    </>
  )

  return (
    <div
      className="dialogue-panel pointer-events-none absolute inset-x-0 bottom-0 flex justify-center"
      style={{ transform: open ? 'translateY(0)' : 'translateY(100%)' }}
    >
      <div className="hud-panel pointer-events-auto w-full max-w-[420px] px-1 pt-0.5 pb-1">
        {shown.portrait ? (
          // 星露谷版式:台词在左、立绘在右、名字挂在立绘下面的名牌上。
          // 名牌顶掉了框内左上角那行小字 —— 同一个名字写两遍是噪音。
          // 面板高度**不许因此长高**:立绘 48px + 名牌一行,加起来正好压在原来的高度内。
          // 2026-08-04 那次把面板从占屏 56% 收到 37% 是用户拍的板(§二十二·2),这一版不许吃回去
          <div className="flex items-stretch gap-1">
            <div className="flex min-w-0 flex-1 flex-col">{body}</div>
            <div className="flex w-[54px] shrink-0 flex-col gap-0.5">
              <div className="sv-plate h-[54px] w-[54px]">
                {/* alt 留空:名字就在下面那块名牌上,读屏念两遍是噪音 */}
                <img src={shown.portrait} alt="" width={48} height={48} className="block" />
              </div>
              <p className="sv-plate font-kuaile px-0.5 text-center text-xs leading-[12px] text-ink">
                {shown.speaker}
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="font-wenkai mb-0.5 text-xs leading-none text-[#f8e8c8]/85">
              {shown.speaker}
            </p>
            {body}
          </>
        )}
      </div>
    </div>
  )
}

export default DialoguePanel
