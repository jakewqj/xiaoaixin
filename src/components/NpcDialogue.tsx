import { useEffect } from 'react'
import { speak } from '../lib/speech'
import type { NpcSpec, NpcTopic } from '../hooks/useNpcs'

interface NpcDialogueProps {
  npc: NpcSpec
  topic: NpcTopic
  onChoose: (option: { text: string; icon: string }) => void
}

// 邻居的台词和选项摞在一起,钉在她头顶——和 Dialogue.tsx 的做法一致。
// 语言是角色的属性:语言不是 zh 的邻居,台词和选项全部英文短句 + 图标,点了会朗读
function NpcDialogue({ npc, topic, onChoose }: NpcDialogueProps) {
  const foreign = npc.语言 !== 'zh'

  // 她刚开口这一句自己先读一遍——童童还不识字,不能全指望她自己去点
  useEffect(() => {
    if (foreign) speak(topic.say)
  }, [foreign, topic.say])

  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 flex -translate-x-1/2 flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => foreign && speak(topic.say)}
        className="pointer-events-auto w-max max-w-[300px] cursor-pointer rounded-3xl bg-white/92 px-4 py-1.5 text-center shadow-lg"
      >
        <p className="font-kuaile text-2xl leading-snug whitespace-pre-line text-ink">{topic.say}</p>
      </button>
      {topic.options && topic.options.length > 0 && (
        <div className="pointer-events-auto flex w-max max-w-[300px] flex-wrap justify-center gap-1">
          {topic.options.map((option) => (
            <button
              key={option.text}
              type="button"
              onClick={() => {
                if (foreign) speak(option.text)
                onChoose(option)
              }}
              className="flex min-h-14 min-w-14 cursor-pointer flex-col items-center gap-0 rounded-2xl bg-white/92 px-2 py-1 shadow-lg transition-transform active:scale-95 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
            >
              <span className="text-2xl leading-none" aria-hidden="true">
                {option.icon}
              </span>
              <span className="font-kuaile text-2xl leading-tight text-ink">{option.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default NpcDialogue
