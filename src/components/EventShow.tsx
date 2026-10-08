import { useEffect, useRef, useState } from 'react'
import type { NatureEvent } from '../lib/events'

interface EventShowProps {
  event: NatureEvent
  /** 最后一句也点过了 = 看完了。记相册、记「今晚看过」都在 App 那边 */
  onDone: () => void
}

// 自然事件的演出骨架(ROADMAP 4-4):画面暗下来,小爱心一句一句说,点一下换下一句。
// 是她点了「去看看」才开演的,所以这一层盖住整个舞台 —— 正在看的时候不该还能游走、喂食。
//
// **暗下来和专属画面都在渲染层**(ROADMAP 4-5,render/layers/event-fx.ts):
// 4-4 时暗幕是这里的一层 DOM,可它盖在所有 canvas 上面,珊瑚卵和小海龟会跟着一起被压暗,
// 主角反而最不亮。现在这一层是透明的,只管接点击、出台词、结束。
//
// 暗下来用的仍是夜色那个深蓝,不是黑 —— 宪法二不要黑暗惊吓,这是「屏住呼吸看」,不是「灯灭了」
function EventShow({ event, onDone }: EventShowProps) {
  const [index, setIndex] = useState(0)
  const ref = useRef<HTMLButtonElement>(null)
  const line = event.台词[index]

  // 开演时把焦点挪过来,键盘用户按回车/空格就能一句句往下看(宪法四 键盘焦点可见)
  useEffect(() => {
    ref.current?.focus()
  }, [])

  const next = () => {
    if (index + 1 < event.台词.length) setIndex(index + 1)
    else onDone()
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={next}
      aria-label={index + 1 < event.台词.length ? '下一句' : '看完了'}
      data-event-show={event.id}
      className="pointer-events-auto absolute inset-0 z-10 flex cursor-pointer items-start justify-center pt-16 focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-heart"
    >
      {line && (
        // key 跟着句子换,每换一句淡入一次
        <span key={index} className="event-line sv-plate block px-3 py-2 text-center">
          <span className="font-kuaile block text-xs leading-[16px] text-ink">{line.text}</span>
          {line.en && <span className="font-wenkai mt-1 block text-xs leading-none text-ink/50">{line.en}</span>}
        </span>
      )}
    </button>
  )
}

export default EventShow
