import { useRef, useState } from 'react'
import PixelIcon from './PixelIcon'

// 学科 → 图标。都取自 src/lib/icons.ts 已有的像素图标,不新增素材
const SUBJECT_ICON: Record<string, string> = {
  生物: '🐢',
  自然: '🌊',
  数学: '🔢',
  历史: '📄',
  百科: '🪸',
}

interface AskPanelProps {
  /** 砗磲奶奶的立绘路径。她是白名单知识库的具身化(GDD §6.2),问问题就是在问她 */
  portrait?: string
  name: string
  /** 白名单里现有的学科。爸爸把整科屏蔽掉之后,那一科就不该还摆在这儿 */
  subjects: string[]
  onPickSubject: (subject: string) => void
  onAsk: (text: string) => void
  onClose: () => void
}

// 「问砗磲奶奶」。**两条路通到同一个地方**:点学科图标,或者打字问。
//
// 两条路都要有,这是宪法二十三定的硬约束:「打字永远不是唯一的路」——
// 依据是原则 2 那条没动过的底线「任何一句话读不懂,只看图标也能完成操作」。
// 六岁的手在 iPad 上打字又慢又容易放弃,做成非打字不可等于把功能关掉。
//
// 这一层活在舞台**外面**(fixed,真实视口像素),和 SeaPicker 一样。
// 放进舞台里的话输入框会跟着 transform 缩放,而 **iOS Safari 在字号小于 16px 的
// 输入框获得焦点时会自动放大整页** —— 那会把横屏锁定和整数倍缩放一起打乱。
// 所以字号用 max(16px, 12px × --ui-scale):×2 档是 24px,小屏也保底 16px。
function AskPanel({ portrait, name, subjects, onPickSubject, onAsk, onClose }: AskPanelProps) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function submit() {
    const q = text.trim()
    // 空着就按一下 —— 把焦点给她,而不是什么都不发生。
    // 按钮在那儿、点下去没反应,是这个项目最忌讳的死点击
    if (q.length === 0) {
      inputRef.current?.focus()
      return
    }
    setText('')
    onAsk(q)
  }

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-20 flex items-end justify-center pb-8"
    >
      <div
        role="presentation"
        onClick={(event) => event.stopPropagation()}
        className="sea-picker hud-panel-lg flex w-[92vw] max-w-[720px] flex-col gap-3 p-4 opacity-100 transition-all duration-300 starting:translate-y-8 starting:opacity-0"
      >
        <div className="flex items-center gap-3">
          {portrait && (
            <div className="sv-plate-lg shrink-0">
              {/* alt 留空:名字就写在旁边,读屏念两遍是噪音 */}
              <img
                src={portrait}
                alt=""
                className="block"
                style={{ width: 'calc(48px * var(--ui-scale, 2))', height: 'calc(48px * var(--ui-scale, 2))' }}
              />
            </div>
          )}
          <div className="flex flex-col gap-1">
            {/* **墨色,不是奶白。** 那个奶白(#f8e8c8)是给 HUD 的深色木底用的,
                压在这块浅木面板上对比度很低 —— 画板那一轮(S2-3)已经栽过一次:
                「浅底一律墨色」。六岁的眼睛看不清就等于没写 */}
            <span className="ui-text font-kuaile text-ink">{name}</span>
            {/* 3–8 字,和所有台词一个规格(原则 2) */}
            <span className="ui-text font-kuaile text-ink/70">你想知道什么</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="不问了"
            className="sv-plate-lg ml-auto cursor-pointer self-start px-3 py-1 transition-transform active:translate-y-px focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
          >
            <span className="ui-text font-kuaile text-ink">不问了</span>
          </button>
        </div>

        {/* 路一:点图标。不识字、不会打字也走得通 */}
        <div className="flex flex-wrap gap-2">
          {subjects.map((subject) => (
            <button
              key={subject}
              type="button"
              onClick={() => onPickSubject(subject)}
              className="sv-plate-lg flex cursor-pointer items-center gap-2 px-3 py-2 transition-transform active:translate-y-px focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
            >
              <PixelIcon emoji={SUBJECT_ICON[subject] ?? '❓'} scaled />
              <span className="ui-text font-kuaile text-ink">{subject}</span>
            </button>
          ))}
        </div>

        {/* 路二:打字。**不做拼写检查、不标红、不联想纠错**(原则 10)——
            她打什么就是什么。spellCheck/autoCorrect/autoCapitalize 全关掉,
            系统给她画红波浪线也是一种「你写错了」 */}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={text}
            maxLength={24}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            aria-label={`问${name}一个问题`}
            placeholder="也可以打字问"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') submit() }}
            className="sv-plate-lg font-kuaile min-w-0 flex-1 px-3 py-2 text-ink outline-none focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
            style={{ fontSize: 'max(16px, calc(12px * var(--ui-scale, 2)))' }}
          />
          <button
            type="button"
            onClick={submit}
            className="sv-plate-lg flex shrink-0 cursor-pointer items-center gap-2 px-3 py-2 transition-transform active:translate-y-px focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
          >
            <PixelIcon emoji="❓" scaled />
            <span className="ui-text font-kuaile text-ink">问她</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default AskPanel
