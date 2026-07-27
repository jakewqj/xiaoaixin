import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Bubbles from './Bubbles'
import { playSfx } from '../lib/sfx'
import { SWIM_MS, POP_MS } from '../hooks/useBreath'
import type { BreathPhase } from '../hooks/useBreath'

export type PoseName = 'idle' | 'happy' | 'eating' | 'sleeping'

interface PetSpec {
  文件: Record<string, string>
  锚点: Record<string, [number, number]>
}

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
  pose,
  breath,
  talking,
  anchors,
  onBreathe,
  onAnchorTap,
  children,
}: PetProps) {
  const [spec, setSpec] = useState<PetSpec | null>(null)
  const [facingLeft, setFacingLeft] = useState(false)
  const [tapped, setTapped] = useState(false)
  const [missingPoses, setMissingPoses] = useState<string[]>([])

  useEffect(() => {
    fetch('/assets/pet/pet.json')
      .then((res) => res.json())
      .then(setSpec)
      .catch(() => {})
  }, [])

  // 开局先摸一遍还没画出来的形象,免得第一次切换姿势时闪一下空白。画好的那几张顺便预加载了
  useEffect(() => {
    if (!spec) return
    for (const [name, filename] of Object.entries(spec.文件)) {
      if (name === 'idle') continue
      const probe = new Image()
      probe.onerror = () =>
        setMissingPoses((prev) => (prev.includes(name) ? prev : [...prev, name]))
      probe.src = `/assets/pet/${filename}`
    }
  }, [spec])

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

  if (!spec) return null

  const atSurface = breath === 'rising' || breath === 'waiting' || breath === 'popping'
  const showBubbles = breath === 'waiting' || breath === 'popping'

  // 想要哪张图就写哪张。文件还没画出来时自动退回 idle,画好了拖进文件夹就自己生效
  const file = spec.文件[missingPoses.includes(pose) ? 'idle' : pose] ?? spec.文件.idle

  return (
    <div
      className="pet-swim absolute left-1/2 w-[45%] -translate-x-1/2 -translate-y-1/2"
      style={
        {
          // 别再往上了:头顶要留得下气泡,不然浮上来说的那句话会跑到屏幕外
          top: atSurface ? '30%' : '50%',
          '--swim-duration': `${SWIM_MS}ms`,
        } as CSSProperties
      }
    >
      {/* 说话时停住不飘 —— 选项按钮不能是移动靶子 */}
      <div className={talking ? 'pet-drift is-talking' : 'pet-drift'}>
        <div className="pet-bob">
          <div className="relative">
            <button
              type="button"
              onClick={handleTap}
              aria-label={breath === 'waiting' ? '帮小爱心换气' : '摸摸小爱心'}
              className="block min-h-14 min-w-14 w-full cursor-pointer rounded-full focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
            >
              <div className={tapped ? 'pet-tap' : undefined}>
                <img
                  src={`/assets/pet/${file}`}
                  alt=""
                  draggable={false}
                  onError={() =>
                    setMissingPoses((prev) =>
                      prev.includes(pose) ? prev : [...prev, pose],
                    )
                  }
                  className="pet-turn w-full select-none"
                  style={{ transform: facingLeft ? 'scaleX(-1)' : undefined }}
                />
              </div>
            </button>
            {/* 身体部位的热区。位置读 pet.json 的锚点,转身时跟着镜像 */}
            {anchors.map((name) => {
              const point = spec.锚点[name]
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
            {showBubbles && (
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
