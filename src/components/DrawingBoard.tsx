import { useCallback, useRef, useState } from 'react'
import PixelIcon from './PixelIcon'
import { DrawingCanvas } from './DrawingCanvas'
import type { DrawingCanvasHandle, DrawingTool } from './DrawingCanvas'

// 画板的工具栏(ROADMAP S2-3)。规格是那一行原话:
// **只给 4 种颜色 + 1 支笔 + 橡皮 + 撤销 + 重来。不要更多工具。**
//
// 所以这里没有:笔刷粗细滑块、更多颜色、取色器、图层、填充、形状、缩放、重做。
// 一个都别加 —— 工具一多,画画就从「玩」变成「学软件」了。
//
// 怎么摆到游戏里(从哪进、画完送给谁)是 2-4 的事,这个组件不管,
// 所以它既没有关闭按钮也不认识任何 NPC。
//
// 宪法相关:
//   §二 文字是奖励不是门槛 —— 每个按钮都是「图标 + 2–3 个字」,
//     图标必须自己就说得清,童童一个字不认也要能按对
//   §二十二·3 像素 UI 禁圆角/阴影/渐变,按下反馈一律 translate-y-px
//   §二十二·5 全屏弹层的边框和字号要乘 --ui-scale,否则在 ×3 ×4 下和舞台脱节
//   原则 1 没有失败态 —— 撤销到底了就是什么都不发生,不变灰、不提示、不出声

// 四种颜色,全部取自 §四 那张表,一个新色都没发明。
// 顺序按「最常用的排第一」:墨色画轮廓,粉色是小爱心自己的颜色
const COLORS = [
  { value: '#243642', label: '墨色' },
  { value: '#ff8fa3', label: '粉色' },
  { value: '#6fa84b', label: '草绿' },
  { value: '#7fd1d8', label: '海蓝' },
] as const

const TOOLS: { value: DrawingTool; icon: string; label: string }[] = [
  { value: 'pen', icon: '✏', label: '笔' },
  { value: 'eraser', icon: '🧽', label: '橡皮' },
]

const SLOT = 'ui-slot-lg flex cursor-pointer items-center justify-center'
const FOCUS =
  'transition-transform active:translate-y-px focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-heart'

type Props = {
  className?: string
  ref?: React.Ref<DrawingCanvasHandle>
}

export function DrawingBoard({ className, ref }: Props) {
  const canvas = useRef<DrawingCanvasHandle | null>(null)
  const [color, setColor] = useState<string>(COLORS[0].value)
  const [tool, setTool] = useState<DrawingTool>('pen')

  // 外面(2-4 的送礼流程)要拿到 exportBlob,同时这里自己也要用同一个 handle
  const attach = useCallback(
    (handle: DrawingCanvasHandle | null) => {
      canvas.current = handle
      if (typeof ref === 'function') ref(handle)
      else if (ref) ref.current = handle
    },
    [ref],
  )

  // 选了颜色就自动切回笔。她想换个颜色接着画,不该还要多按一下「笔」
  const pickColor = useCallback((value: string) => {
    setColor(value)
    setTool('pen')
  }, [])

  return (
    <div className={className}>
      <div className="hud-panel-lg bg-parchment p-2">
        {/* 纸。画布本身是透明的,纸色由这一层给 —— 组件只负责笔迹 */}
        <div className="aspect-[4/3] w-full bg-[#fffdf6]">
          <DrawingCanvas
            ref={attach}
            color={color}
            tool={tool}
            className="block h-full w-full"
          />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {COLORS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            // aria-pressed 而不是 aria-selected:这是一组开关,不是列表选项
            aria-pressed={tool === 'pen' && color === entry.value}
            aria-label={entry.label}
            onClick={() => pickColor(entry.value)}
            className={`${SLOT} ${FOCUS}`}
          >
            {/* 颜色本身就是图标,不需要再画个笔尖上去 */}
            <span
              className="block h-[calc(12px*var(--ui-scale,2))] w-[calc(12px*var(--ui-scale,2))]"
              style={{ backgroundColor: entry.value }}
            />
          </button>
        ))}

        <span className="mx-1 h-[calc(20px*var(--ui-scale,2))] w-1 bg-wood-dark" />

        {TOOLS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            aria-pressed={tool === entry.value}
            onClick={() => setTool(entry.value)}
            className={`${SLOT} ${FOCUS}`}
          >
            <PixelIcon emoji={entry.icon} scaled />
            <span className="sr-only">{entry.label}</span>
          </button>
        ))}

        <span className="mx-1 h-[calc(20px*var(--ui-scale,2))] w-1 bg-wood-dark" />

        {/* 字用墨色不用奶白:木框面板的填充是浅棕,#f8e8c8 压上去发虚 ——
            实测放大截图一眼看得出。奶白是给深色木底用的(HUD 那边),
            浅底一律墨色,和对话面板、知识卡同一套做法 */}
        {/* 撤销和重来不是「选中」状态,所以用木框按钮而不是道具格,
            形状上就和左边那排分得开。重来本身也进撤销历史,按错了退一步全回来 */}
        <button
          type="button"
          onClick={() => canvas.current?.undo()}
          className={`hud-panel-lg flex cursor-pointer items-center gap-2 px-3 py-1 ${FOCUS}`}
        >
          <PixelIcon emoji="↩" scaled />
          <span className="ui-text font-kuaile text-ink">退一步</span>
        </button>

        <button
          type="button"
          onClick={() => canvas.current?.clear()}
          className={`hud-panel-lg flex cursor-pointer items-center gap-2 px-3 py-1 ${FOCUS}`}
        >
          <PixelIcon emoji="📄" scaled />
          <span className="ui-text font-kuaile text-ink">重来</span>
        </button>
      </div>
    </div>
  )
}
