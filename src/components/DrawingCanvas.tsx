import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, Ref } from 'react'

// 童童画画的那块布(ROADMAP S2-2)。这个文件只管「怎么把一笔画出来」:
// 颜色盘、橡皮、撤销、重来是 2-3 的事,挂到哪个 NPC 的木板上是 2-4 的事。
//
// 三条硬规矩,都来自 ROADMAP 2-2 那一行:
//   1. 逻辑分辨率恒为 1024×768,画布后备缓冲区按 DPR 放大 —— 视网膜屏上线条才不毛
//   2. pointerType === 'touch' 一律不画。童童用 Pencil,手掌一定会压在屏幕上,
//      不挡掉的话每一笔旁边都会多出一道手掌拖出来的粗线
//   3. 压感控制线宽;设备不给压感(恒为 0.5)时降级成固定线宽,而不是画出一条
//      到处一样粗又假装有压感的线
//
// 宪法相关:原则 10「她画的永远不被判对错、永远不消失」—— 所以这里没有任何
// 识别、评分、纠正,也没有任何自动清空的路径。clear() 只在调用方明确要求时才响。

export const DRAW_WIDTH = 1024
export const DRAW_HEIGHT = 768

// 基础线宽(逻辑 px)。有压感时按下面的系数上下浮动,没压感时就是它本身
const BASE_LINE_WIDTH = 6

// 压感 0→1 映射到 0.4×→1.6× 基础线宽。中点 0.5 正好是 1.0× ——
// 这样「有压感」和「没压感」画出来的平均粗细一致,换设备不会突然变粗变细
const PRESSURE_MIN = 0.4
const PRESSURE_SPAN = 1.2

// Pointer Events 规定:设备不支持压感时,按下期间 pressure 恒为 0.5。
// 所以「见到过一个既不是 0 也不是 0.5 的值」就是这台设备真有压感的证据
const NOMINAL_PRESSURE = 0.5
const PRESSURE_EPSILON = 1e-3

export type DrawingCanvasHandle = {
  clear(): void
  // 导出成 1024×768 的 PNG。存不出来返回 null(调用方当「这次没导出」处理,别报错)
  exportBlob(): Promise<Blob | null>
  getStats(): DrawingCanvasStats
}

// 全是给验证页看的计数。高频状态放 ref 不进 React state(CLAUDE.md 二十一),
// 所以这里是「拉」不是「推」—— 验证页自己按低频去问
export type DrawingCanvasStats = {
  dpr: number
  backingWidth: number
  backingHeight: number
  lastPointerType: string | null
  pressureSupported: boolean
  lastPressure: number
  strokes: number
  samples: number
  // samples 里有多少是 getCoalescedEvents() 补回来的。Pencil 的采样率远高于
  // 屏幕刷新率,不取这些补点的话快速画一笔会画成折线
  coalescedSamples: number
  ignoredTouch: number
}

type Point = { x: number; y: number; pressure: number }

type Props = {
  color?: string
  lineWidth?: number
  className?: string
  ref?: Ref<DrawingCanvasHandle>
}

function emptyStats(): DrawingCanvasStats {
  return {
    dpr: 1,
    backingWidth: 0,
    backingHeight: 0,
    lastPointerType: null,
    pressureSupported: false,
    lastPressure: 0,
    strokes: 0,
    samples: 0,
    coalescedSamples: 0,
    ignoredTouch: 0,
  }
}

export function DrawingCanvas({
  color = '#243642',
  lineWidth = BASE_LINE_WIDTH,
  className,
  ref,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)

  const activePointer = useRef<number | null>(null)
  const lastPoint = useRef<Point | null>(null)
  const lastMid = useRef<Point | null>(null)
  const moved = useRef(false)
  const stats = useRef<DrawingCanvasStats>(emptyStats())

  // 画笔参数放 ref:pointermove 每秒会跑上百次,不该每次都去读闭包里的 props。
  // 同步必须在 effect 里做 —— 渲染期间写 ref 会被 React 判为副作用
  const colorRef = useRef(color)
  const widthRef = useRef(lineWidth)
  useEffect(() => {
    colorRef.current = color
    widthRef.current = lineWidth
  }, [color, lineWidth])

  // 后备缓冲区 = 逻辑尺寸 × DPR。ctx.scale 之后所有绘制仍用 0–1024 / 0–768 的坐标,
  // 调用方和这个文件里的其它代码都不用知道 DPR 是多少
  const setupBackingStore = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(DRAW_WIDTH * dpr)
    const h = Math.round(DRAW_HEIGHT * dpr)
    if (canvas.width === w && canvas.height === h && ctxRef.current) return

    // 改 width/height 会清空画布。DPR 变了(挪到别的显示器、浏览器缩放)不该让
    // 童童已经画的东西消失 —— 原则 10。先拓下来,换完再贴回去
    let snapshot: HTMLCanvasElement | null = null
    if (canvas.width > 0 && canvas.height > 0) {
      snapshot = document.createElement('canvas')
      snapshot.width = canvas.width
      snapshot.height = canvas.height
      snapshot.getContext('2d')?.drawImage(canvas, 0, 0)
    }

    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (snapshot) ctx.drawImage(snapshot, 0, 0, DRAW_WIDTH, DRAW_HEIGHT)
    ctxRef.current = ctx

    stats.current.dpr = dpr
    stats.current.backingWidth = w
    stats.current.backingHeight = h
  }, [])

  useEffect(() => {
    setupBackingStore()

    // DPR 变化没有专门的事件,而且**不能只听 resize**:把窗口拖到另一块不同 DPI 的
    // 屏幕上时,视口尺寸可能一点没变,resize 压根不会响 —— 实测 DPR 从 2 掉到 1 之后
    // 后备缓冲区还停在 2048×1536,线条从此一直是被拉伸的。
    // 可靠的做法是盯住「当前这个 dpr」的媒体查询:它一旦不再匹配,就是 DPR 变了。
    // resize 仍然留着当兜底,反正 setupBackingStore 查出没变化会直接返回
    let media: MediaQueryList | null = null
    let stopped = false

    function onDprChange() {
      setupBackingStore()
      arm() // 变完要按新的 dpr 重新布一次哨,否则只能抓到第一次
    }

    function arm() {
      if (stopped) return
      media?.removeEventListener('change', onDprChange)
      const dpr = window.devicePixelRatio || 1
      media = window.matchMedia(`(resolution: ${dpr}dppx)`)
      media.addEventListener('change', onDprChange)
    }

    const onResize = () => setupBackingStore()
    arm()
    window.addEventListener('resize', onResize)
    return () => {
      stopped = true
      media?.removeEventListener('change', onDprChange)
      window.removeEventListener('resize', onResize)
    }
  }, [setupBackingStore])

  // 屏幕坐标 → 1024×768 逻辑坐标。按实际 CSS 尺寸换算,所以画布被摆多大都对得上
  const toLogical = useCallback((clientX: number, clientY: number): Point | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    return {
      x: ((clientX - rect.left) / rect.width) * DRAW_WIDTH,
      y: ((clientY - rect.top) / rect.height) * DRAW_HEIGHT,
      pressure: NOMINAL_PRESSURE,
    }
  }, [])

  // 只认「见过非 0 且非 0.5 的压力值」这一条证据。标志位只会从 false 翻到 true,
  // 不会翻回去 —— 中途换成鼠标画不该把已经确认的压感能力否掉
  const notePressure = useCallback((pressure: number) => {
    stats.current.lastPressure = pressure
    if (
      pressure > 0 &&
      Math.abs(pressure - NOMINAL_PRESSURE) > PRESSURE_EPSILON
    ) {
      stats.current.pressureSupported = true
    }
  }, [])

  const widthFor = useCallback((pressure: number) => {
    const base = widthRef.current
    if (!stats.current.pressureSupported) return base
    const p = Math.min(1, Math.max(0, pressure))
    return base * (PRESSURE_MIN + PRESSURE_SPAN * p)
  }, [])

  // 一段一段地描,每段自己的线宽 —— 一条 path 只能有一个 lineWidth,
  // 压感变化必须拆成多次 stroke。round 的端点和转角让相邻两段看不出接缝
  const strokeSegment = useCallback(
    (from: Point, control: Point, to: Point, pressure: number) => {
      const ctx = ctxRef.current
      if (!ctx) return
      ctx.strokeStyle = colorRef.current
      ctx.lineWidth = widthFor(pressure)
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.quadraticCurveTo(control.x, control.y, to.x, to.y)
      ctx.stroke()
    },
    [widthFor],
  )

  const dot = useCallback((at: Point, pressure: number) => {
    const ctx = ctxRef.current
    if (!ctx) return
    ctx.fillStyle = colorRef.current
    ctx.beginPath()
    ctx.arc(at.x, at.y, widthFor(pressure) / 2, 0, Math.PI * 2)
    ctx.fill()
  }, [widthFor])

  // 取两点中点做控制点的经典平滑:曲线穿过每一对相邻采样点的中点,
  // 采样点本身当控制点。比直接 lineTo 少一堆折角,而且不需要缓存整条笔迹
  const extend = useCallback(
    (point: Point) => {
      const previous = lastPoint.current
      const previousMid = lastMid.current
      if (!previous || !previousMid) return
      const mid = {
        x: (previous.x + point.x) / 2,
        y: (previous.y + point.y) / 2,
        pressure: point.pressure,
      }
      strokeSegment(previousMid, previous, mid, point.pressure)
      lastPoint.current = point
      lastMid.current = mid
    },
    [strokeSegment],
  )

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      stats.current.lastPointerType = event.pointerType
      // 手掌误触:整只手压在屏幕上会连着发一串 touch 事件,一笔旁边就多一道粗线
      if (event.pointerType === 'touch') {
        stats.current.ignoredTouch += 1
        return
      }
      if (!event.isPrimary || activePointer.current !== null) return

      const point = toLogical(event.clientX, event.clientY)
      if (!point) return
      point.pressure = event.pressure
      notePressure(event.pressure)

      activePointer.current = event.pointerId
      lastPoint.current = point
      lastMid.current = point
      moved.current = false
      stats.current.strokes += 1
      stats.current.samples += 1

      // 抓住这个指针,手滑出画布边界再回来仍然是同一笔
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [notePressure, toLogical],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (event.pointerType === 'touch') {
        stats.current.ignoredTouch += 1
        return
      }
      if (activePointer.current !== event.pointerId) return

      // Pencil 的采样率(~240Hz)远高于屏幕刷新率,浏览器会把两帧之间的点攒起来。
      // 不取这些补点,快速画一笔就是几条直线段接起来的折线
      const native = event.nativeEvent
      const coalesced =
        typeof native.getCoalescedEvents === 'function'
          ? native.getCoalescedEvents()
          : []
      const batch = coalesced.length > 0 ? coalesced : [native]
      if (coalesced.length > 0) {
        stats.current.coalescedSamples += coalesced.length - 1
      }

      for (const sample of batch) {
        const point = toLogical(sample.clientX, sample.clientY)
        if (!point) continue
        point.pressure = sample.pressure
        notePressure(sample.pressure)
        stats.current.samples += 1
        moved.current = true
        extend(point)
      }
    },
    [extend, notePressure, toLogical],
  )

  const finishStroke = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (activePointer.current !== event.pointerId) return
      const point = lastPoint.current
      const mid = lastMid.current

      if (point && mid) {
        if (moved.current) {
          // 平滑用的曲线只画到最后一个中点,收笔时把剩下那小截补上,
          // 否则每一笔的末端都会短一点点
          strokeSegment(mid, point, point, point.pressure)
        } else {
          // 点一下不动:这是一个点,不是一笔。不补的话什么都不会留下
          dot(point, point.pressure)
        }
      }

      activePointer.current = null
      lastPoint.current = null
      lastMid.current = null
      moved.current = false
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    },
    [dot, strokeSegment],
  )

  useEffect(() => {
    if (!ref) return
    const handle: DrawingCanvasHandle = {
      clear() {
        const ctx = ctxRef.current
        const canvas = canvasRef.current
        if (!ctx || !canvas) return
        // 清的是逻辑尺寸那一块。ctx 已经 scale 过,不能拿 canvas.width 当宽度
        ctx.clearRect(0, 0, DRAW_WIDTH, DRAW_HEIGHT)
      },
      async exportBlob() {
        const canvas = canvasRef.current
        if (!canvas) return null
        // 后备缓冲区在 2 倍屏上是 2048×1536,直接导出会是 4 倍体积。
        // S2-1 量配额用的是 1024×768,存进去的尺寸就该稳定在这个数
        const out = document.createElement('canvas')
        out.width = DRAW_WIDTH
        out.height = DRAW_HEIGHT
        const outCtx = out.getContext('2d')
        if (!outCtx) return null
        outCtx.drawImage(canvas, 0, 0, DRAW_WIDTH, DRAW_HEIGHT)
        return new Promise<Blob | null>((resolve) => {
          try {
            out.toBlob((blob) => resolve(blob), 'image/png')
          } catch {
            resolve(null)
          }
        })
      },
      getStats() {
        return { ...stats.current }
      },
    }
    if (typeof ref === 'function') {
      ref(handle)
      return () => {
        ref(null)
      }
    }
    ref.current = handle
    return () => {
      ref.current = null
    }
  }, [ref])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      // touch-none 让浏览器别把笔画当成滚动/缩放手势。
      // imageRendering 必须显式设回 auto:index.css 把 pixelated 钉在 :root 上,
      // 而它是可继承属性 —— 不写这一行,童童的铅笔线会被最近邻放大成锯齿块。
      // 那条规则是给 480×270 的像素世界定的,这块布不是像素画
      style={{ touchAction: 'none', imageRendering: 'auto' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
      aria-label="画画的地方"
    />
  )
}
