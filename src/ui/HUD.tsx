// 九宫格 UI 层。HUD 从 DOM 搬进 canvas —— 2026-08-03 用户决议,推翻 CLAUDE.md 二十一·4。
//
// 两条不可省的配套约束(见 REFACTOR_PLAN §〇):
//
// 1. 后备缓冲区用设备分辨率,不是 480x270。世界层的逻辑分辨率整数倍放大是为了像素画,
//    同样的做法用在中文文字上会把笔画糊成马赛克。九宫格木框和图标仍然关闭平滑、
//    整数倍最近邻,像素感不变;只有文字按原生分辨率栅格化
// 2. canvas 上方铺一层透明 <button> 热区,每个可点元素一个,带 aria-label,进 Tab 顺序。
//    canvas 出像素,DOM 出语义 —— 宪法四「键盘焦点可见」不因为 canvas 化而失效
//
// 重绘是事件驱动的,不进 rAF:HUD 一秒变不了几次,每帧重画一遍设备分辨率的全屏 UI 是纯浪费

import { useCallback, useEffect, useRef, useState } from 'react'
import { STAGE_HEIGHT, STAGE_WIDTH } from '../components/ScreenFrame'
import * as assets from '../render/assets'
import { stageScale } from '../render/stage'
import { whenFontReady } from '../render/text'
import { drawHud } from './draw'
import { hudStore } from './hud-store'
import { PRELOAD } from './layout'
import type { Hotspot, HudSnapshot } from './types'

// 长按标题进控制后台要按住这么久,比童童的手指停留时间长得多,不会被误触发
const ADMIN_HOLD_MS = 5000

interface HudProps {
  snapshot: HudSnapshot
  onSlotTap: (id: string) => void
  onHoldTitle: () => void
}

/** 后备缓冲区倍数。取整,不然九宫格木框会被非整数缩放毁掉像素网格 */
function bufferScale(): number {
  const css = stageScale(window.innerWidth, window.innerHeight)
  const dpr = window.devicePixelRatio || 1
  return Math.max(1, Math.round(css * dpr))
}

function HUD({ snapshot, onSlotTap, onHoldTitle }: HudProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [scale, setScale] = useState(bufferScale)
  const holdTimer = useRef<number | null>(null)

  // React 那边的值推进 store。store 自己做浅比较,值没变就不会往下通知
  useEffect(() => {
    hudStore.set(snapshot)
  }, [snapshot])

  // 重画一帧。热区是画出来的副产物,和像素永远对得上
  const redraw = useCallback(() => {
    const ctx = ctxRef.current
    if (!ctx) return
    setHotspots(drawHud(ctx, hudStore.get()))
  }, [])

  // 缩放变了就重建缓冲区 —— 尺寸一改 canvas 的内容会被清掉,必须紧接着重画
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = STAGE_WIDTH * scale
    canvas.height = STAGE_HEIGHT * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctxRef.current = ctx
    redraw()
  }, [scale, redraw])

  useEffect(() => {
    function measure() {
      setScale(bufferScale())
    }
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
  }, [])

  // 素材和字体各自就绪之后各重画一次。任何一个失败都只是少画一层,不阻塞、不白屏
  useEffect(() => {
    let alive = true
    assets
      .preload(PRELOAD)
      .then((missing) => {
        if (!alive) return
        if (missing.length) console.warn('[HUD] 这些素材没载上,对应的层跳过:', missing)
        redraw()
      })
      // preload 自己吞掉了单张图的失败,这里兜的是意料之外的抛出。
      // 无论如何都要再画一次 —— 有什么画什么,绝不留白屏(CLAUDE.md 十四)
      .catch(() => {
        if (alive) redraw()
      })
    whenFontReady(() => {
      if (alive) redraw()
    })
    return () => {
      alive = false
    }
  }, [redraw])

  // 订阅:store 里的值真的变了才重画
  useEffect(() => hudStore.subscribe(redraw), [redraw])

  const startHold = useCallback(() => {
    holdTimer.current = window.setTimeout(onHoldTitle, ADMIN_HOLD_MS)
  }, [onHoldTitle])

  const cancelHold = useCallback(() => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }, [])

  useEffect(() => cancelHold, [cancelHold])

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, imageRendering: 'pixelated' }}
      />
      {/* 饱食度条现在画在 canvas 上,canvas 没有语义。补一个只给读屏器看的节点,
          role 和 label 与它取代的 FullnessMeter 保持一致。它不可点,所以不进 Tab 顺序 */}
      <div className="sr-only" role="img" aria-label="小爱心的肚子" />
      {/* 透明热区层:canvas 出像素,这里出语义。opacity-0 而不是 hidden ——
          hidden 会让读屏器也读不到,那就白铺了 */}
      {hotspots.map((spot) =>
        spot.id === '__title' ? (
          <button
            key={spot.id}
            type="button"
            aria-label="小爱心(长按 5 秒进入设置)"
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
            className="pointer-events-auto absolute cursor-default opacity-0 focus-visible:opacity-100 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-heart"
            style={{ left: spot.x, top: spot.y, width: spot.w, height: spot.h }}
          />
        ) : (
          <button
            key={spot.id}
            type="button"
            aria-label={spot.label}
            onClick={() => onSlotTap(spot.id)}
            className="pointer-events-auto absolute cursor-pointer opacity-0 focus-visible:opacity-100 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-heart"
            style={{ left: spot.x, top: spot.y, width: spot.w, height: spot.h }}
          />
        ),
      )}
    </>
  )
}

export default HUD
