import type { KnowledgeCardData } from '../hooks/useKnowledge'

interface KnowledgeCardProps {
  card: KnowledgeCardData
  onDismiss: () => void
}

// 知识卡:从左边滑进来的一张小卡片。不挡路、不要求回答、点一下就收起,不看也会自己走
function KnowledgeCard({ card, onDismiss }: KnowledgeCardProps) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="收起"
      className="knowledge-card pointer-events-auto absolute bottom-16 left-0 max-w-[340px] cursor-pointer rounded-r-3xl bg-white/92 py-4 pr-6 pl-5 text-left shadow-xl focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
    >
      <p className="font-kuaile text-2xl leading-snug whitespace-pre-line text-ink">
        {card.childText}
      </p>
      {card.en && (
        <p className="font-wenkai mt-1 text-base leading-snug text-ink/50">
          {card.en}
        </p>
      )}
    </button>
  )
}

export default KnowledgeCard
