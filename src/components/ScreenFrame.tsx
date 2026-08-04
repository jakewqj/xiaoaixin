import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { stageScale } from '../render/stage'

// 逻辑分辨率:以后所有游戏坐标都基于这个,不是 CSS 像素。见 CLAUDE.md 十二
export const STAGE_WIDTH = 480
export const STAGE_HEIGHT = 270

// 把舞台倍数写给 CSS。全屏弹层(图鉴/相册/换海)在舞台缩放之外,
// 靠这个值把 4px 的木框边宽乘回同样的观感 —— 见 index.css 的 .hud-panel-lg
function usePublishScale(scale: number) {
  useEffect(() => {
    document.documentElement.style.setProperty('--ui-scale', String(scale))
  }, [scale])
}

function useViewportSize() {
  const [size, setSize] = useState(() => ({
    width: typeof window === 'undefined' ? STAGE_WIDTH : window.innerWidth,
    height: typeof window === 'undefined' ? STAGE_HEIGHT : window.innerHeight,
  }))

  useEffect(() => {
    function measure() {
      setSize({ width: window.innerWidth, height: window.innerHeight })
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
  }, [])

  return size
}

// 竖屏时不渲染游戏,只让她看得懂「转一下」——没有拼音也能懂,图标是主角
function RotatePrompt() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-water-deep px-8 text-center">
      <svg
        viewBox="0 0 64 64"
        className="h-16 w-16 motion-safe:animate-[rotate-hint_1.8s_ease-in-out_infinite]"
        aria-hidden="true"
      >
        <rect x="18" y="8" width="28" height="48" rx="4" fill="none" stroke="#fff" strokeWidth="3" />
        <circle cx="32" cy="50" r="1.6" fill="#fff" />
      </svg>
      <p className="font-kuaile text-4xl text-white">请横过来</p>
    </div>
  )
}

// 480x270 逻辑分辨率的舞台,整数倍缩放,居中,四周留纯色边。
// 竖屏时不渲染游戏,只显示转屏提示。这一步只搭渲染容器,不动任何游戏逻辑
function ScreenFrame({ children }: { children: ReactNode }) {
  const { width, height } = useViewportSize()
  const isPortrait = height > width
  // 在提前 return 之前算,不然 usePublishScale 会变成条件调用的 hook
  const scale = stageScale(width, height)
  usePublishScale(scale)

  if (isPortrait) {
    return (
      <div className="fixed inset-0">
        <RotatePrompt />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-ink">
      <div
        style={{ width: STAGE_WIDTH * scale, height: STAGE_HEIGHT * scale, overflow: 'hidden' }}
      >
        <div
          style={{
            width: STAGE_WIDTH,
            height: STAGE_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export default ScreenFrame
