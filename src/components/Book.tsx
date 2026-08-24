import type { KnowledgeCardData } from '../hooks/useKnowledge'
import PixelIcon from './PixelIcon'

const SUBJECT_ORDER = ['生物', '自然', '数学', '历史', '百科']

interface BookProps {
  cards: KnowledgeCardData[]
  /** 知识卡 id → 她给那张卡画的画(object URL)。没画过的就没有这一项 */
  drawings: Record<string, string>
  /** 还能不能画新的。config.json 的「系统开关.图鉴手绘页」说了算 ——
   *  关掉之后**只是不再出「我来画」那块**,她已经画过的那几张照旧贴着(原则 10) */
  canDraw: boolean
  onDraw: (card: KnowledgeCardData) => void
  onClose: () => void
}

// 图鉴。只摆出她已经见过的和本来就住在这里的,不显示总数、不显示未解锁的格子 ——
// 她不知道一共有多少张,就没有什么需要集齐
function Book({ cards, drawings, canDraw, onDraw, onClose }: BookProps) {
  const groups = SUBJECT_ORDER.map((subject) => ({
    subject,
    list: cards.filter((card) => card.学科 === subject),
  })).filter((group) => group.list.length > 0)

  const others = cards.filter((card) => !SUBJECT_ORDER.includes(card.学科))
  if (others.length > 0) groups.push({ subject: '还有', list: others })

  // 「你画了 N 张」就只是这一句(ROADMAP 2-7 明写:不做进度条、不做完成度百分比)。
  // **一张都没画时什么都不显示** —— 挂一个「你画了 0 张」出来就是个零分的记分牌了(原则 4)
  const drawn = cards.filter((card) => drawings[card.id]).length

  return (
    <div className="fixed inset-0 z-20 overflow-y-auto bg-parchment">
      <div className="sticky top-0 flex items-center gap-4 border-b-4 border-wood-dark bg-wood px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          className="hud-panel-lg flex min-h-14 cursor-pointer items-center gap-2 px-4 py-2 transition-transform active:translate-y-px focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-heart"
        >
          <PixelIcon emoji="🌊" scaled />
          <span className="ui-text font-kuaile text-[#f8e8c8]">回海里</span>
        </button>
        {drawn > 0 && (
          <span className="ui-text font-kuaile text-[#f8e8c8]">你画了 {drawn} 张</span>
        )}
      </div>

      <div className="mx-auto flex max-w-2xl flex-col gap-7 px-5 pt-2 pb-16">
        {groups.map((group) => (
          <section key={group.subject} className="flex flex-col gap-3">
            {/* 标题和正文同字号,靠颜色分层级 —— 和对话面板里「说话人 vs 台词」一个做法。
                Zpix 只有 12 的整数倍是锐的,再大一档就是 24×scale,在列表里过大 */}
            <h2 className="ui-text font-kuaile text-wood-dark/80">{group.subject}</h2>
            {group.list.map((card) => (
              <article key={card.id} className="sv-plate-lg flex items-start gap-4 px-6 py-4">
                {/* 左半留给她画(ROADMAP 2-7)。**不画也能看知识** ——
                    右边那段字和这块空白没有任何关系,不画不会少一个字。
                    关掉手绘页之后这一半整个不出现(不是留一块空框在那儿),那张卡就回到纯文字 */}
                {(drawings[card.id] || canDraw) && (
                  <div className="w-1/2 shrink-0">
                    <CardDrawing
                      url={drawings[card.id]}
                      onDraw={() => onDraw(card)}
                      alt={card.childText}
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="ui-text font-kuaile whitespace-pre-line text-ink">
                    {card.childText}
                  </p>
                  {card.en && (
                    <p className="ui-text-tight font-wenkai mt-1 text-ink/50">{card.en}</p>
                  )}
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}

// 画好的那张:普通 <img>,长按能存进系统相册(2-8 那条对图鉴也成立)。
// 还没画的:一个木框,里面是空白的纸。**画过之后这块不再是按钮** ——
// 原则 10 她画的不许被改掉,也就没有「重画一张」
function CardDrawing({
  url,
  alt,
  onDraw,
}: {
  url?: string
  alt: string
  onDraw: () => void
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={alt}
        className="hud-panel-lg block aspect-[4/3] w-full object-cover"
      />
    )
  }
  return (
    <button
      type="button"
      onClick={onDraw}
      aria-label="我来画"
      className="hud-panel-lg block aspect-[4/3] w-full cursor-pointer transition-transform active:translate-y-px focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-heart"
    >
      {/* 纸色和 DrawingOverlay 导出时垫的底同一个值:画好之后贴上来,底色不会跳 */}
      <span className="flex h-full w-full items-center justify-center gap-2 bg-[#fffdf6]">
        <PixelIcon emoji="✏" scaled />
        <span className="ui-text font-kuaile text-ink">我来画</span>
      </span>
    </button>
  )
}

export default Book
