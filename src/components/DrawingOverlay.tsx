import { useCallback, useRef, useState } from 'react'
import PixelIcon from './PixelIcon'
import { DrawingBoard } from './DrawingBoard'
import type { DrawingCanvasHandle } from './DrawingCanvas'

// 画东西的那一屏。两处在用:
//   S2-4 画点什么送给邻居 → 送出去挂在她身边的木板上
//   S2-6 给海草/地点起个名字 → 手写的纸条贴在那儿
// 画板本身(4 色 + 笔 + 橡皮 + 退一步 + 重来)是 DrawingBoard 的事,
// 这里只负责三件:告诉她这是画给谁/写给什么的,以及「交出去」和「先不写」两个出口。
//
// 宪法相关:
//   原则 1 没有失败态 —— 一笔没画就交,只是什么也不发生,不弹「你还没画呢」
//   原则 10 不判对错 —— 没有预览确认、没有「确定吗」、没有任何评价
//   §二十二·5 全屏弹层活在舞台缩放之外,边框和字号都要乘 --ui-scale

// 纸的颜色。导出时垫在笔迹底下:画布本身是透明的,而挂到木板上、贴到木牌上的那张
// 必须有底,否则墨色笔画压在深色木头上看不清。和 DrawingBoard 里那层纸是同一个色
const PAPER = '#fffdf6'

type Props = {
  /** 「画给 Dolly」「给它起个名字」这类,一句话说清这是在画什么 */
  title: string
  /** 交出去那个按钮上的字。送礼是「送给她」,起名字是「贴上去」 */
  confirmLabel: string
  confirmIcon: string
  /** 出口那个按钮上的字。写字是「先不写」,画画是「先不画」——
   *  按钮上写着「我来画」、退出去却写「先不写」,对着正在认字的孩子是两回事 */
  closeLabel?: string
  onConfirm: (png: Blob) => void
  onClose: () => void
}

export function DrawingOverlay({
  title,
  confirmLabel,
  confirmIcon,
  closeLabel = '先不写',
  onConfirm,
  onClose,
}: Props) {
  const canvas = useRef<DrawingCanvasHandle | null>(null)
  // 交出去这一下要等导出和写库,按第二次不该变成两张
  const [busy, setBusy] = useState(false)

  const confirm = useCallback(async () => {
    if (busy) return
    setBusy(true)
    const png = await canvas.current?.exportBlob(PAPER)
    if (png) onConfirm(png)
    else setBusy(false) // 导不出来就当这次没按过,让她再试一次,不报错
  }, [busy, onConfirm])

  return (
    <div className="fixed inset-0 z-20 overflow-y-auto bg-parchment">
      <div className="sticky top-0 flex flex-wrap items-center gap-3 border-b-4 border-wood-dark bg-wood px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          className="hud-panel-lg flex cursor-pointer items-center gap-2 px-4 py-2 transition-transform active:translate-y-px focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-heart"
        >
          <PixelIcon emoji="🌊" scaled />
          <span className="ui-text font-kuaile text-ink">{closeLabel}</span>
        </button>

        <span className="ui-text font-kuaile text-[#f8e8c8]">{title}</span>

        <button
          type="button"
          onClick={() => void confirm()}
          className="hud-panel-lg ml-auto flex cursor-pointer items-center gap-2 px-4 py-2 transition-transform active:translate-y-px focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-heart"
        >
          <PixelIcon emoji={confirmIcon} scaled />
          <span className="ui-text font-kuaile text-ink">{confirmLabel}</span>
        </button>
      </div>

      <div className="mx-auto max-w-3xl px-5 pt-4 pb-16">
        <DrawingBoard ref={canvas} />
      </div>
    </div>
  )
}
