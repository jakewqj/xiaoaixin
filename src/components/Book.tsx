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
          className="flex min-h-14 cursor-pointer items-center gap-2 rounded-xl border-2 border-wood-dark bg-parchment px-6 py-3 shadow-lg transition-transform active:scale-95 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
        >
          <span className="text-3xl leading-none" aria-hidden="true">
            🌊
          </span>
          <span className="font-kuaile text-2xl text-ink">回海里</span>
        </button>
      </div>

      <div className="mx-auto flex max-w-2xl flex-col gap-7 px-5 pt-2 pb-16">
        {groups.map((group) => (
          <section key={group.subject} className="flex flex-col gap-3">
            <h2 className="font-kuaile text-xl text-wood-dark/80">{group.subject}</h2>
            {group.list.map((card) => (
              <article
                key={card.id}
                className="rounded-xl border-2 border-wood-dark/50 bg-white/60 px-6 py-4 shadow-sm"
              >
                <p className="font-kuaile text-2xl leading-snug whitespace-pre-line text-ink">
                  {card.childText}
                </p>
                {card.en && (
                  <p className="font-wenkai mt-1 text-base leading-snug text-ink/50">
                    {card.en}
                  </p>
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
