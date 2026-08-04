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
      className="knowledge-card sv-plate pointer-events-auto absolute bottom-16 left-0 max-w-[200px] cursor-pointer py-2 pr-3 pl-2 text-left focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
    >
      {/* 跟着对话面板一起降到 12px(2026-08-04 用户决议)。这张卡在舞台里,
          用的是逻辑px,所以直接写 text-xs —— 不像全屏弹层那样要乘 --ui-scale。
          内边距同步收紧:12px 的字配原来 16/24px 的留白会显得空 */}
      <p className="font-kuaile text-xs leading-[16px] whitespace-pre-line text-ink">
        {card.childText}
      </p>
      {card.en && (
        <p className="font-wenkai mt-1 text-xs leading-none text-ink/50">
          {card.en}
        </p>
      )}
    </button>
  )
}

export default KnowledgeCard
