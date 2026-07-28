import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Bubbles from './Bubbles'
import { playSfx } from '../lib/sfx'
import { PET_DIR, toneFilter } from '../lib/pet'
import type { GrowthStage } from '../lib/pet'
import type { usePet } from '../hooks/usePet'
import { SWIM_MS, POP_MS } from '../hooks/useBreath'
import type { BreathPhase } from '../hooks/useBreath'

export type PoseName = 'idle' | 'happy' | 'eating' | 'sleeping'

// 进食一次的时长:沉下去 → 贴底啃一会儿 → 浮回来。CSS 里的 pet-dip 动画用的也是这个数
export const EAT_MS = 4200

// 长到最大时占屏幕宽度的比例。小时候按成长阶段的体型往下缩
const FULL_WIDTH = 45

// 热区直径占小爱心宽度的比例。固定像素不行 —— 屏幕越大小爱心越大,固定尺寸的热区会小到点不中
const HOTSPOT_RATIO = 0.26

const ANCHOR_LABELS: Record<string, string> = {
  tailTip: '小爱心的尾巴',
  bellyCenter: '小爱心的肚子',
  mouth: '小爱心的嘴',
  eye: '小爱心的眼睛',
  blowhole: '小爱心的鼻孔',
}

interface PetProps {
  pet: ReturnType<typeof usePet>
  stage: GrowthStage
  pose: PoseName
  breath: BreathPhase
  talking: boolean
  anchors: string[]
  onBreathe: () => void
  onAnchorTap: (anchor: string) => boolean
  children?: ReactNode
}

// 小爱心本体:按 pet.json 声明的文件名加载形象,在海中间极慢地左右漂移 + 轻微上下浮动
function Pet({
  pet,
  stage,
  pose,
  breath,
  talking,
  anchors,
  onBreathe,
  onAnchorTap,
  children,
}: PetProps) {
  const [facingLeft, setFacingLeft] = useState(false)
  const [tapped, setTapped] = useState(false)

  // 放大回弹结束后自己复位。不依赖 animationend,减弱动态效果时动画不跑也能复位
  useEffect(() => {
    if (!tapped) return
    const timer = setTimeout(() => setTapped(false), 300)
    return () => clearTimeout(timer)
  }, [tapped])

  // 在水面等着的时候点它 = 帮它换气;其余时候点它 = 摸摸它
  function handleTap() {
    setTapped(true)
    if (breath === 'waiting') {
      onBreathe()
      return
    }
    setFacingLeft((v) => !v)
    playSfx('tap')
  }

  // 点身体部位。这张卡还在冷却里就当作普通的摸一摸 —— 点下去永远要有反应
  function handleAnchorTap(name: string) {
    setTapped(true)
    if (breath === 'waiting') {
      onBreathe()
      return
    }
    if (onAnchorTap(name)) return
    setFacingLeft((v) => !v)
    playSfx('tap')
  }

  const { spec, fileFor, markMissing } = pet
  const file = fileFor(pose, stage)
  if (!spec || !file) return null

  const atSurface = breath === 'rising' || breath === 'waiting' || breath === 'popping'
  const showBubbles = breath === 'waiting' || breath === 'popping'

  return (
    <div
      className="pet-swim absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
      style={
        {
          // 别再往上了:头顶要留得下气泡,不然浮上来说的那句话会跑到屏幕外
          top: atSurface ? '30%' : '50%',
          // 小时候小一点,长大了大一点。变化很慢,是一年里的事,不是一局里的事
          width: `${FULL_WIDTH * stage.体型}%`,
          '--swim-duration': `${SWIM_MS}ms`,
        } as CSSProperties
      }
    >
      {/* 说话时停住不飘 —— 选项按钮不能是移动靶子 */}
      <div className={talking ? 'pet-drift is-talking' : 'pet-drift'}>
        <div className="pet-bob">
          {/* 进食时沉向海草床啃一会儿再浮回来,复刻纪录片里贴底吃海草的动作。在水面换气时不沉 */}
          <div
            className={pose === 'eating' && !atSurface ? 'pet-dip relative' : 'relative'}
            style={{ '--dip-duration': `${EAT_MS}ms` } as CSSProperties}
          >
            <button
              type="button"
              onClick={handleTap}
              aria-label={breath === 'waiting' ? '帮小爱心换气' : '摸摸小爱心'}
              className="block min-h-14 min-w-14 w-full cursor-pointer rounded-full focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
            >
              <div className={tapped ? 'pet-tap' : undefined}>
                <img
                  src={`${PET_DIR}/${file}`}
                  alt=""
                  draggable={false}
                  onError={() => markMissing(file)}
                  className="pet-turn w-full select-none"
                  style={{
                    transform: facingLeft ? 'scaleX(-1)' : undefined,
                    filter: toneFilter(stage.体色),
                  }}
                />
              </div>
            </button>
            {/* 身体部位的热区。位置读 pet.json 的锚点,转身时跟着镜像 */}
            {anchors.map((name) => {
              const point = spec.锚点?.[name]
              if (!point) return null
              const [ax, ay] = point
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleAnchorTap(name)}
                  aria-label={ANCHOR_LABELS[name] ?? '小爱心'}
                  className="absolute aspect-square min-h-14 min-w-14 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full focus-visible:outline-4 focus-visible:outline-heart"
                  style={{
                    left: `${(facingLeft ? 1 - ax : ax) * 100}%`,
                    top: `${ay * 100}%`,
                    width: `${HOTSPOT_RATIO * 100}%`,
                  }}
                />
              )
            })}
            {children}
            {showBubbles && spec.锚点?.blowhole && (
              <Bubbles
                anchor={spec.锚点.blowhole}
                flipped={facingLeft}
                popping={breath === 'popping'}
                popMs={POP_MS}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Pet
