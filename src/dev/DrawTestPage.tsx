// 绘画画布验证页的界面(ROADMAP S2-2 / S2-3)。挂载入口在同目录的 draw-test.tsx。
//
// 这里要能亲眼看见的六件事:
//   1. 线条平滑、不毛 —— 后备缓冲区按 DPR 放大了,而且没被 :root 的
//      image-rendering: pixelated 继承到(所以入口**故意**引 index.css,
//      不引的话那个坑根本不会出现,等于没测)
//   2. 手掌/手指画不出东西 —— 「挡掉的 touch」那一栏会往上跳,画面纹丝不动
//   3. 有 Pencil 时线条随力道变粗细,「压感」一栏显示「有」;
//      鼠标画时恒为 0.5,显示「无(固定线宽)」,线条从头到尾一样粗
//   4. 四个颜色、笔、橡皮切得动,选中的那个格子换成红框
//   5. 退一步能一笔一笔退回去;**重来之后再退一步,整张画会全部回来**
//   6. 导出的 PNG 恒为 1024×768,和 S2-1 量配额用的尺寸一致
//
// 「存取往返」按钮会真的写一次 IndexedDB,但读回来显示完就把它删掉,
// 不留垃圾,也不碰跑之前就存在的画。

import { useCallback, useEffect, useRef, useState } from 'react'
import { DrawingBoard } from '../components/DrawingBoard'
import { DRAW_HEIGHT, DRAW_WIDTH } from '../components/DrawingCanvas'
import type { DrawingCanvasHandle, DrawingCanvasStats } from '../components/DrawingCanvas'
import { deleteDrawing, loadDrawing, saveDrawing } from '../lib/drawings'

const POLL_MS = 200

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

export function DrawTestPage() {
  const canvas = useRef<DrawingCanvasHandle | null>(null)
  const [stats, setStats] = useState<DrawingCanvasStats | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [preview, setPreview] = useState<string | null>(null)

  // 高频状态在组件里放 ref(CLAUDE.md 二十一),这一页低频来拉就行 ——
  // 每一笔都触发一次 React 重渲染的话,重渲染本身就会干扰要测的东西
  useEffect(() => {
    const timer = setInterval(() => {
      setStats(canvas.current?.getStats() ?? null)
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [])

  // 换一张预览就把上一张的 object URL 撤掉,不然每次导出都漏一个
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const say = useCallback((line: string) => {
    setLog((previous) => [...previous, line])
  }, [])

  const showBlob = useCallback((blob: Blob) => {
    setPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return URL.createObjectURL(blob)
    })
  }, [])

  const onExport = useCallback(async () => {
    const blob = await canvas.current?.exportBlob()
    if (!blob) {
      say('✗ 导不出来(exportBlob 返回 null)')
      return
    }
    const bitmap = await createImageBitmap(blob)
    const width = bitmap.width
    const height = bitmap.height
    bitmap.close()
    const sizeOk = width === DRAW_WIDTH && height === DRAW_HEIGHT
    say(
      `${sizeOk ? '✓' : '✗'} 导出 ${width}×${height}` +
        `  ${(blob.size / 1024).toFixed(1)} KB` +
        (sizeOk ? '' : `  ← 应该是 ${DRAW_WIDTH}×${DRAW_HEIGHT}`),
    )
    showBlob(blob)
  }, [say, showBlob])

  const onRoundTrip = useCallback(async () => {
    const blob = await canvas.current?.exportBlob()
    if (!blob) {
      say('✗ 导不出来,存取往返跳过')
      return
    }
    const id = await saveDrawing(blob)
    if (!id) {
      say('✗ 存不进 IndexedDB(saveDrawing 返回 null)')
      return
    }
    say(`✓ 存进去了  ${id}`)
    const back = await loadDrawing(id)
    if (!back) {
      say(`✗ 读不回来  ${id}`)
      return
    }
    const same = back.size === blob.size
    say(
      `${same ? '✓' : '✗'} 读回来 ${(back.size / 1024).toFixed(1)} KB` +
        (same ? '(和存进去的一样大)' : '  ← 大小对不上'),
    )
    showBlob(back)
    const removed = await deleteDrawing(id)
    say(`${removed ? '✓' : '✗'} 收尾:这张测试画已删掉`)
  }, [say, showBlob])

  return (
    <div className="wrap">
      <div className="board">
        <h1>画布验证 · S2-2 / S2-3</h1>
        <p className="note">
          用 Pencil 或鼠标画。手指/手掌画不出东西是<b>对的</b>——那是防误触。
        </p>
        <DrawingBoard ref={canvas} />
        <div className="bar">
          <button onClick={() => void onExport()}>导出 PNG</button>
          <button onClick={() => void onRoundTrip()}>存取往返</button>
        </div>
      </div>

      <aside>
        <h2>实时读数</h2>
        {stats && (
          <>
            <Row label="DPR" value={String(stats.dpr)} />
            <Row
              label="后备缓冲区"
              value={`${stats.backingWidth}×${stats.backingHeight}`}
            />
            <Row label="逻辑分辨率" value={`${DRAW_WIDTH}×${DRAW_HEIGHT}`} />
            <Row label="最近的指针" value={stats.lastPointerType ?? '(还没碰)'} />
            <Row
              label="压感"
              value={stats.pressureSupported ? '有' : '无(固定线宽)'}
            />
            <Row label="最近压力值" value={stats.lastPressure.toFixed(3)} />
            <Row label="笔画数" value={String(stats.strokes)} />
            <Row label="可退步数" value={String(stats.undoDepth)} />
            <Row label="采样点" value={String(stats.samples)} />
            <Row label="其中补点" value={String(stats.coalescedSamples)} />
            <Row label="挡掉的 touch" value={String(stats.ignoredTouch)} />
          </>
        )}
        <h2>记录</h2>
        <pre>{log.length ? log.join('\n') : '按上面的按钮开始。'}</pre>
        {preview && (
          <>
            <h2>导出的图</h2>
            <img src={preview} alt="导出的画" />
          </>
        )}
      </aside>
    </div>
  )
}
