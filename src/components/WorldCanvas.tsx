// 渲染桥。React 只认识这一个组件 —— 它把状态快照推给渲染运行时,把语义事件收回来。
//
// 三块 canvas:背景层(z0–z5)、角色层(z6–z7)、overlay 前景层(前景礁 + 水下光柱),
// 后备缓冲区都是 480x270 逻辑分辨率,
// 由 ScreenFrame 整数倍放大 —— 像素画要的就是这个(HUD 那块 canvas 不一样,它用设备分辨率,
// 因为放大中文会糊,见 ui/HUD.tsx)。
//
// canvas 上方铺一层透明 <button> 热区:canvas 出像素,DOM 出语义。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { STAGE_HEIGHT, STAGE_WIDTH } from './ScreenFrame'
import * as assets from '../render/assets'
import type { Hotspot } from '../render/types'
import { WorldRenderer } from '../render/world'
import type { WorldSnapshot } from '../render/world'
import { WORLD_PRELOAD, WORLD_DIR } from '../render/world-data'

interface WorldCanvasProps {
  snapshot: WorldSnapshot
  onTapPet: () => void
  onTapAnchor: (name: string) => void
  onTapBed: () => void
  onTapNpc: (id: string) => void
  onTapGift: (id: string) => void
  onTapDraw: (id: string) => void
  onTapNote: (key: string) => void
  onSpotChanged: (index: number) => void
  /** 她真的低头开吃 / 吃完抬头的那一刻。游去海草床的路上还不算「在吃」 */
  onEatingChanged: (active: boolean) => void
  hud?: ReactNode
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      return false
    }
  })
  useEffect(() => {
    let mq: MediaQueryList
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    } catch {
      return
    }
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function WorldCanvas({
  snapshot,
  onTapPet,
  onTapAnchor,
  onTapBed,
  onTapNpc,
  onTapGift,
  onTapDraw,
  onTapNote,
  onSpotChanged,
  onEatingChanged,
  hud,
}: WorldCanvasProps) {
  const bgRef = useRef<HTMLCanvasElement>(null)
  const actorRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [renderer] = useState(() => new WorldRenderer())
  const [spots, setSpots] = useState<Hotspot[]>([])
  const reduced = useReducedMotion()

  useEffect(() => {
    const bg = bgRef.current?.getContext('2d')
    const actors = actorRef.current?.getContext('2d')
    const overlay = overlayRef.current?.getContext('2d')
    if (!bg || !actors || !overlay) return
    renderer.attach(bg, actors, overlay)
    renderer.onHotspotsChanged(setSpots)
    renderer.start()
    return () => renderer.stop()
  }, [renderer])

  // 小爱心和邻居的精灵表路径是跟着状态变的,和固定的世界素材分开预载。
  // 少一张就少画一层,不阻塞、不白屏(CLAUDE.md 十四)
  const srcKey = [
    snapshot.pet.anim?.src,
    ...snapshot.npcs.map((n) => n.src),
    // 童童挂上去的画也是「跟着状态变的图」,和精灵表一起载。它们是 object URL,
    // 但 assets 只按路径认图,不关心是 /assets/ 还是 blob:
    ...snapshot.npcs.flatMap((n) => n.hangings),
    // 纸条也是跟着状态变的图,和挂画一起载
    ...snapshot.notes.map((n) => n.src).filter(Boolean),
  ].join('|')
  const spriteSrcs = useMemo(
    () => [
      `${WORLD_DIR}/ui/sv/slot.png`,
      `${WORLD_DIR}/ui/icon_sprout.png`,
      `${WORLD_DIR}/ui/icons/pencil.png`,
      `${WORLD_DIR}/hang_board.png`,
      `${WORLD_DIR}/note_tag.png`,
      ...srcKey.split('|').filter(Boolean),
    ],
    [srcKey],
  )

  useEffect(() => {
    let alive = true
    assets
      .preload([...WORLD_PRELOAD, ...spriteSrcs])
      .then((missing) => {
        if (!alive) return
        if (missing.length) console.warn('[world] 这些素材没载上,对应的层跳过:', missing)
      })
      // preload 自己吞掉了单张图的失败,这里兜的是意料之外的抛出。有什么画什么,绝不白屏
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [spriteSrcs])

  useEffect(() => {
    renderer.setSnapshot(snapshot, reduced)
  }, [renderer, snapshot, reduced])

  // 进食的真正时长由渲染层决定(游过去多远它才知道),所以是它回头通知 React,
  // 不是 React 定一个死时长
  useEffect(() => {
    renderer.onEatingChanged(onEatingChanged)
  }, [renderer, onEatingChanged])

  useEffect(() => {
    renderer.onSpotChanged(onSpotChanged)
  }, [renderer, onSpotChanged])

  // 开发构建里给截图脚本用:把时钟钉死,重构前后才能在同一相位比对
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as Record<string, unknown>
    w.__renderFreeze = (at: number | null) => renderer.freeze(at)
    w.__debugPet = () => renderer.debug()
  }, [renderer])

  // 点哪游哪整条链都不经过 React:点击层拿到坐标直接交给渲染层的 swim,
  // 位置是实例字段,不会触发任何重渲染。横竖两个坐标都给 —— 她朝着那个点游,不是只左右挪
  const handleWorldTap = useCallback(
    (event: React.MouseEvent) => {
      const { offsetX, offsetY } = event.nativeEvent
      renderer.swimTo(renderer.toWorldX(offsetX), renderer.toWorldY(offsetY))
    },
    [renderer],
  )

  const handleSpot = useCallback(
    (id: string) => {
      if (id === '__pet') {
        renderer.tap()
        onTapPet()
        return
      }
      if (id === '__bed') {
        onTapBed()
        return
      }
      if (id.startsWith('anchor:')) {
        renderer.tap()
        onTapAnchor(id.slice(7))
        return
      }
      if (id.startsWith('npc:')) {
        onTapNpc(id.slice(4))
        return
      }
      if (id.startsWith('gift:')) onTapGift(id.slice(5))
      if (id.startsWith('draw:')) onTapDraw(id.slice(5))
      if (id.startsWith('note:')) onTapNote(id.slice(5))
    },
    [renderer, onTapPet, onTapAnchor, onTapBed, onTapNpc, onTapGift, onTapDraw, onTapNote],
  )

  return (
    <div className="relative overflow-hidden" style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}>
      <canvas
        ref={bgRef}
        width={STAGE_WIDTH}
        height={STAGE_HEIGHT}
        aria-hidden="true"
        className="absolute inset-0"
        style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
      />
      <canvas
        ref={actorRef}
        width={STAGE_WIDTH}
        height={STAGE_HEIGHT}
        aria-hidden="true"
        className="absolute inset-0"
        style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
      />
      <canvas
        ref={overlayRef}
        width={STAGE_WIDTH}
        height={STAGE_HEIGHT}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
      />
      {/* 点哪游哪:铺满舞台的点击层,在热区之下 —— 点小爱心/邻居仍是他们自己的反应 */}
      <div role="presentation" className="absolute inset-0 cursor-pointer" onClick={handleWorldTap} />
      {spots.map((spot) => (
        <button
          key={spot.id}
          type="button"
          ref={(el) => {
            renderer.bindHotspot(spot.id, el)
            return () => renderer.bindHotspot(spot.id, null)
          }}
          aria-label={spot.label}
          onClick={() => handleSpot(spot.id)}
          className="absolute cursor-pointer opacity-0 focus-visible:opacity-100 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-heart"
          style={{ left: spot.x, top: spot.y, width: spot.w, height: spot.h }}
        />
      ))}
      {/* HUD 永远钉在屏幕上,不跟着镜头摇。整层默认穿透点击,里面的按钮各自开 pointer-events-auto */}
      <div className="pointer-events-none absolute inset-0">{hud}</div>
    </div>
  )
}

export default WorldCanvas
