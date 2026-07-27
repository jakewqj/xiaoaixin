import SpeechBubble from './SpeechBubble'
import type { DialogueOption, DialogueScene } from '../hooks/useDialogue'

interface DialogueProps {
  scene: DialogueScene
  onChoose: (option: DialogueOption) => void
}

// 剧本对话。选项是「大图标 + 短文字」,图标够大,不识字也能选
function Dialogue({ scene, onChoose }: DialogueProps) {
  return (
    <>
      <SpeechBubble text={scene.text} en={scene.en} />
      <div className="absolute top-full left-1/2 mt-4 flex w-max max-w-[92vw] -translate-x-1/2 flex-wrap justify-center gap-3">
        {scene.options?.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => onChoose(option)}
            className="flex min-h-14 min-w-14 cursor-pointer flex-col items-center gap-1 rounded-3xl bg-white/92 px-5 py-3 shadow-lg transition-transform active:scale-95 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
          >
            <span className="text-5xl leading-none" aria-hidden="true">
              {option.icon}
            </span>
            <span className="font-kuaile text-2xl text-ink">{option.label}</span>
          </button>
        ))}
      </div>
    </>
  )
}

export default Dialogue
