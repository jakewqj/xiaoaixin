import type { CSSProperties } from 'react'

export interface SpriteProps {
  src: string
  frameWidth: number
  frameHeight: number
  frameCount: number
  fps: number
  /** 只显示某一帧、不播放动画(比如相册缩略图),不传就正常循环播放 */
  frame?: number
  flipped?: boolean
  className?: string
  style?: CSSProperties
}

// 精灵表逐帧播放:纯 CSS steps() 切背景图的位置,不引入 canvas 游戏循环。见 CLAUDE.md 十三
function Sprite({
  src,
  frameWidth,
  frameHeight,
  frameCount,
  fps,
  frame,
  flipped,
  className,
  style,
}: SpriteProps) {
  const still = frame !== undefined

  return (
    <div
      aria-hidden="true"
      className={[still ? undefined : 'sprite-frames', className].filter(Boolean).join(' ')}
      style={
        {
          width: frameWidth,
          height: frameHeight,
          backgroundImage: `url(${src})`,
          backgroundSize: `${frameWidth * frameCount}px ${frameHeight}px`,
          backgroundPosition: still ? `${-(frame * frameWidth)}px 0` : undefined,
          animationDuration: still ? undefined : `${frameCount / fps}s`,
          animationTimingFunction: still ? undefined : `steps(${frameCount}, jump-end)`,
          transform: flipped ? 'scaleX(-1)' : undefined,
          '--sprite-shift': `${-(frameWidth * frameCount)}px`,
          ...style,
        } as CSSProperties
      }
    />
  )
}

export default Sprite
