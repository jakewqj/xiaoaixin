import SpeechBubble from './SpeechBubble'
import type { DialogueOption, DialogueScene } from '../hooks/useDialogue'

interface DialogueProps {
  scene: DialogueScene
  onChoose: (option: DialogueOption) => void
}

// 剧本对话。台词和选项摞在一起,整块钉在小爱心头顶——
// 舞台只有 270 逻辑像素高,选项要是摆在小爱心下面会和底部的喂食/种海草按钮撞在一起
function Dialogue({ scene, onChoose }: DialogueProps) {
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 flex -translate-x-1/2 flex-col items-center gap-1">
      <SpeechBubble text={scene.text} en={scene.en} />
      {scene.options && scene.options.length > 0 && (
        <div className="pointer-events-auto flex w-max max-w-[300px] flex-wrap justify-center gap-1">
          {scene.options.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => onChoose(option)}
              className="flex min-h-14 min-w-14 cursor-pointer flex-col items-center gap-0 rounded-2xl bg-white/92 px-2 py-1 shadow-lg transition-transform active:scale-95 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
            >
              <span className="text-2xl leading-none" aria-hidden="true">
                {option.icon}
              </span>
              <span className="font-kuaile text-2xl leading-tight text-ink">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default Dialogue
