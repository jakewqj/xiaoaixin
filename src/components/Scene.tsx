import type { ReactNode } from 'react'
import { STAGE_HEIGHT, STAGE_WIDTH } from './ScreenFrame'
import { LAYER_Z } from '../lib/layers'
import type { SeaTheme } from '../lib/seas'

// 九层图层结构的占位版本:每层先用纯色块确认层级顺序和视差节奏对不对,
// 真实美术素材接进来时只换每层内部的内容,层级本身不用再动
const WATER_LINE = STAGE_HEIGHT * 0.32

// 世界比舞台高出一截天空:平时(潜水)镜头往上顶到底,画面里全是水下,
// 一点天空都看不见;换气时镜头往下松开 WATER_LINE 这么多,天空和水面线一起露出来
const WORLD_HEIGHT = STAGE_HEIGHT + WATER_LINE

// 水越浑,水下这层的沙色雾越厚。和原 Ocean.tsx 的取值保持一致
const MAX_HAZE = 0.34

function Sky() {
  return (
    <div
      className="absolute inset-x-0 top-0 overflow-hidden"
      style={{ height: WATER_LINE, zIndex: LAYER_Z.sky, background: '#bfe4e8' }}
    >
      <div className="scene-cloud" style={{ top: '18%', width: 34, height: 12 }} />
      <div className="scene-cloud" style={{ top: '45%', width: 22, height: 9, animationDelay: '-9s' }} />
    </div>
  )
}

function FarIsland() {
  return (
    <div
      className="absolute"
      style={{
        left: '58%',
        top: WATER_LINE - 14,
        width: 70,
        height: 16,
        zIndex: LAYER_Z.farIsland,
        background: '#5c7a6a',
        opacity: 0.55,
        borderRadius: '100% 100% 0 0',
      }}
    />
  )
}

function WaterSurface() {
  return (
    <div
      className="scene-water-surface absolute inset-x-0"
      style={{ top: WATER_LINE - 2, height: 4, zIndex: LAYER_Z.waterSurface, background: '#e8f6f2' }}
    />
  )
}

// 水下部分正好是一整个舞台高,潜水时镜头贴顶,这一层就刚好填满可见范围。
// 颜色读 sea 主题(和原 Ocean.tsx 三层水色渐变一致),换海只换这一层。
// 横向铺满整个世界宽度(不分地点),地点之间暂时共用同一片海底——真素材来了再分
function Underwater({ sea, clarity }: { sea: SeaTheme; clarity: number }) {
  return (
    <div
      className="absolute inset-x-0"
      style={{
        top: WATER_LINE,
        height: STAGE_HEIGHT,
        zIndex: LAYER_Z.underwaterFar,
        background: `linear-gradient(to bottom, ${sea.shallow}, ${sea.mid} 45%, ${sea.deep} 100%)`,
      }}
    >
      <div className="scene-plant-far" style={{ left: '10%' }} />
      <div className="scene-plant-far" style={{ left: '70%' }} />
      <div className="absolute inset-0 bg-sand" style={{ opacity: (1 - clarity) * MAX_HAZE }} />
    </div>
  )
}

function UnderwaterMid() {
  return (
    <div className="absolute inset-x-0 bottom-0" style={{ zIndex: LAYER_Z.underwaterMid }}>
      <div className="scene-coral" style={{ left: '20%' }} />
      <div className="scene-coral" style={{ left: '82%', animationDelay: '-2s' }} />
    </div>
  )
}

function Seabed() {
  return (
    <div
      className="absolute inset-x-0 bottom-0"
      style={{ height: 24, zIndex: LAYER_Z.seabed, background: '#e8dcc0' }}
    >
      <span className="scene-litter" style={{ left: '35%' }} />
      <span className="scene-litter" style={{ left: '63%' }} />
    </div>
  )
}

// 每个地点在世界横条里占一格,先只放个名字牌——真的地点美术还没做,
// 这层只负责证明"横向移动到了正确的格子",不是最终视觉
function LocationLabels({ names }: { names: string[] }) {
  return (
    <div className="absolute inset-x-0 top-0" style={{ height: WATER_LINE, zIndex: LAYER_Z.farIsland }}>
      {names.map((name, index) => (
        <span
          key={name}
          className="absolute font-wenkai text-[10px] text-ink/40"
          style={{ left: index * STAGE_WIDTH + STAGE_WIDTH / 2, top: 6, transform: 'translateX(-50%)' }}
        >
          {name}
        </span>
      ))}
    </div>
  )
}

// 右边界之外还有没开放的地点时,露出一点模糊的影子——看得见、够不着、点了没反应
function LockedHint({ atLeftEdge, atRightEdge }: { atLeftEdge: boolean; atRightEdge: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6" style={{ zIndex: LAYER_Z.underwaterMid }}>
      {atRightEdge && (
        <span
          className="absolute rounded-full bg-ink/20 blur-[3px]"
          style={{ right: -20, width: 40, height: 60 }}
        />
      )}
      {atLeftEdge && (
        <span
          className="absolute rounded-full bg-ink/20 blur-[3px]"
          style={{ left: -20, width: 40, height: 60 }}
        />
      )}
    </div>
  )
}

// 小爱心、海草床、NPC 都挂在这一层,内容由调用方传进来。这层跟着世界一起摇镜头
function Actors({ children }: { children?: ReactNode }) {
  return (
    <div className="absolute inset-0" style={{ zIndex: LAYER_Z.actors }}>
      {children}
    </div>
  )
}

function Bubbles() {
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: LAYER_Z.bubbles }}>
      <span className="scene-bubble" style={{ left: '46%', bottom: 30 }} />
      <span className="scene-bubble" style={{ left: '49%', bottom: 30, animationDelay: '-1.4s' }} />
    </div>
  )
}

// HUD 永远钉在屏幕上,不跟着镜头摇,所以摆在摇镜头的世界层外面。
// 整层默认穿透点击,里面真正要点的按钮各自开 pointer-events-auto
function Hud({ children }: { children?: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: LAYER_Z.hud }}>
      {children}
    </div>
  )
}

interface SceneProps {
  sea: SeaTheme
  clarity: number
  // 换气时为 true:镜头往下松开,露出天空和水面线。见 CLAUDE.md 十二「镜头」
  surfaced?: boolean
  // 当前海域里已经开放的地点名字,按 world.json 里的顺序。默认只有一个地点,水平不动
  locationNames?: string[]
  locationIndex?: number
  // 开放地点之外,世界那一侧是不是还有没开放的地点(用来露模糊影子)
  lockedBeyondEnd?: boolean
  lockedBeforeStart?: boolean
  actors?: ReactNode
  hud?: ReactNode
}

function Scene({
  sea,
  clarity,
  surfaced = false,
  locationNames = [''],
  locationIndex = 0,
  lockedBeyondEnd = false,
  lockedBeforeStart = false,
  actors,
  hud,
}: SceneProps) {
  const worldWidth = STAGE_WIDTH * locationNames.length
  return (
    <div
      className="relative overflow-hidden"
      style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
    >
      <div
        className="camera-world absolute top-0 left-0"
        style={{
          width: worldWidth,
          height: WORLD_HEIGHT,
          transform: `translate(${-locationIndex * STAGE_WIDTH}px, ${surfaced ? 0 : -WATER_LINE}px)`,
        }}
      >
        <Sky />
        <FarIsland />
        <WaterSurface />
        <Underwater sea={sea} clarity={clarity} />
        <UnderwaterMid />
        <Seabed />
        {locationNames.length > 1 && <LocationLabels names={locationNames} />}
        <Actors>{actors}</Actors>
        <Bubbles />
        {(lockedBeyondEnd || lockedBeforeStart) && (
          <div
            className="absolute top-0"
            style={{ left: locationIndex * STAGE_WIDTH, width: STAGE_WIDTH, height: STAGE_HEIGHT }}
          >
            <LockedHint atLeftEdge={lockedBeforeStart} atRightEdge={lockedBeyondEnd} />
          </div>
        )}
      </div>
      <Hud>{hud}</Hud>
    </div>
  )
}

export default Scene
