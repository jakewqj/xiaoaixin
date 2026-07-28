import type { CSSProperties } from 'react'

// 水越浑,这层沙色的雾越厚。只是看起来不一样,不影响任何玩法
const MAX_HAZE = 0.34

// 从水面斜射下来的光柱。每一根的位置 / 宽窄 / 倾角 / 明暗节奏都在这里,不在样式里写死
const RAYS = [
  { left: '-6%', width: '22%', tilt: '18deg', peak: 0.4, dur: '9s', delay: '0s' },
  { left: '15%', width: '9%', tilt: '15deg', peak: 0.28, dur: '12s', delay: '-4s' },
  { left: '33%', width: '17%', tilt: '12deg', peak: 0.36, dur: '10s', delay: '-7s' },
  { left: '57%', width: '10%', tilt: '9deg', peak: 0.24, dur: '13s', delay: '-2s' },
  { left: '74%', width: '19%', tilt: '6deg', peak: 0.32, dur: '11s', delay: '-5s' },
]

// 水里缓缓上浮的悬浮小颗粒,让水看起来是「活的」
const MOTES = [
  { left: '8%', top: '30%', size: 5, dur: '13s', delay: '0s' },
  { left: '22%', top: '58%', size: 4, dur: '17s', delay: '-5s' },
  { left: '35%', top: '40%', size: 3, dur: '15s', delay: '-9s' },
  { left: '48%', top: '66%', size: 5, dur: '19s', delay: '-3s' },
  { left: '61%', top: '34%', size: 3, dur: '14s', delay: '-11s' },
  { left: '72%', top: '52%', size: 4, dur: '16s', delay: '-7s' },
  { left: '84%', top: '44%', size: 5, dur: '18s', delay: '-2s' },
  { left: '92%', top: '62%', size: 3, dur: '15s', delay: '-13s' },
]

// 海洋背景:复刻纪录片里红海浅滩的样子 —— 清澈的水、天光和光柱、缓坡沙丘
function Ocean({ clarity }: { clarity: number }) {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 overflow-hidden bg-linear-to-b from-water-shallow via-water-mid via-45% to-water-deep"
    >
      {/* 水面透下来的天光 */}
      <div className="absolute inset-x-0 top-0 h-[18dvh] bg-linear-to-b from-white/40 to-transparent" />
      {/* 水面波光,左右缓缓晃 */}
      <div className="surface-glimmer absolute top-0 left-0 h-[7dvh] w-[200%]" />
      {RAYS.map((ray) => (
        <span
          key={ray.left}
          className="ray"
          style={
            {
              left: ray.left,
              width: ray.width,
              animationDuration: ray.dur,
              animationDelay: ray.delay,
              '--ray-tilt': ray.tilt,
              '--ray-peak': ray.peak,
            } as CSSProperties
          }
        />
      ))}
      {MOTES.map((mote) => (
        <span
          key={mote.left}
          className="mote"
          style={{
            left: mote.left,
            top: mote.top,
            width: mote.size,
            height: mote.size,
            animationDuration: mote.dur,
            animationDelay: mote.delay,
          }}
        />
      ))}
      {/* 沙底:两座缓坡沙丘 + 底部一条沙带,沙面上有水流推出来的细波纹 */}
      <div className="absolute bottom-[6dvh] left-[-12%] h-[9dvh] w-[65%] rounded-[100%] bg-sand" />
      <div className="absolute bottom-[7dvh] right-[-15%] h-[8dvh] w-[60%] rounded-[100%] bg-sand" />
      <div className="absolute inset-x-0 bottom-0 h-[10dvh] bg-sand" />
      <div className="sand-ripples absolute inset-x-0 bottom-0 h-[9dvh]" />
      <div
        className="absolute inset-0 bg-sand transition-opacity duration-[2s]"
        style={{ opacity: (1 - clarity) * MAX_HAZE }}
      />
    </div>
  )
}

export default Ocean
