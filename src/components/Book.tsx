import type { KnowledgeCardData } from '../hooks/useKnowledge'

const SUBJECT_ORDER = ['生物', '自然', '数学', '历史', '百科']

interface BookProps {
  cards: KnowledgeCardData[]
  onClose: () => void
}

// 图鉴。只摆出她已经见过的和本来就住在这里的,不显示总数、不显示未解锁的格子 ——
// 她不知道一共有多少张,就没有什么需要集齐
function Book({ cards, onClose }: BookProps) {
  const groups = SUBJECT_ORDER.map((subject) => ({
    subject,
    list: cards.filter((card) => card.学科 === subject),
  })).filter((group) => group.list.length > 0)

  const others = cards.filter((card) => !SUBJECT_ORDER.includes(card.学科))
  if (others.length > 0) groups.push({ subject: '还有', list: others })

  return (
    <div className="fixed inset-0 z-20 overflow-y-auto bg-parchment">
      <div className="sticky top-0 border-b-4 border-wood-dark bg-wood px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          className="hud-panel-lg flex min-h-14 cursor-pointer items-center gap-2 px-4 py-2 transition-transform active:translate-y-px focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-heart"
        >
          <span className="ui-text-tight" aria-hidden="true">
            🌊
          </span>
          <span className="ui-text font-kuaile text-[#f8e8c8]">回海里</span>
        </button>
      </div>

      <div className="mx-auto flex max-w-2xl flex-col gap-7 px-5 pt-2 pb-16">
        {groups.map((group) => (
          <section key={group.subject} className="flex flex-col gap-3">
            {/* 标题和正文同字号,靠颜色分层级 —— 和对话面板里「说话人 vs 台词」一个做法。
                Zpix 只有 12 的整数倍是锐的,再大一档就是 24×scale,在列表里过大 */}
            <h2 className="ui-text font-kuaile text-wood-dark/80">{group.subject}</h2>
            {group.list.map((card) => (
              <article key={card.id} className="sv-plate-lg px-6 py-4">
                <p className="ui-text font-kuaile whitespace-pre-line text-ink">
                  {card.childText}
                </p>
                {card.en && (
                  <p className="ui-text-tight font-wenkai mt-1 text-ink/50">{card.en}</p>
                )}
              </article>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}

export default Book
