import type { ReactNode } from 'react'
import { STAGE_HEIGHT, STAGE_WIDTH } from './ScreenFrame'
import { LAYER_Z } from '../lib/layers'
import type { SeaTheme } from '../lib/seas'

// 九层图层,素材来自 draw-world.mjs 生成的像素图(public/assets/world/)。
// 层级顺序见 CLAUDE.md 十二;素材是可替换资源,这里只按路径引用,不内联图形
const WORLD_DIR = '/assets/world'

// 水面线取整数像素:sky.png 就是按这个高度画的,非整数会引起半像素拉伸
const WATER_LINE = 86

// 金沙海底的高度(sand.png tile 的高度)
const SAND_H = 36

// 世界比舞台高出一截天空:平时(潜水)镜头往上顶到底,画面里全是水下,
// 一点天空都看不见;换气时镜头往下松开 WATER_LINE 这么多,天空和水面线一起露出来
const WORLD_HEIGHT = STAGE_HEIGHT + WATER_LINE

// 水越浑,水下这层的沙色雾越厚。和原 Ocean.tsx 的取值保持一致
const MAX_HAZE = 0.34

// 每个地点一格(480 宽)。云/岛/装饰都按格子确定性摆放——同一个地点永远长同一个样
function Sky({ count }: { count: number }) {
  return (
    <div
      className="absolute inset-x-0 top-0 overflow-hidden"
      style={{
        height: WATER_LINE,
        zIndex: LAYER_Z.sky,
        backgroundImage: `url(${WORLD_DIR}/sky.png)`,
        backgroundRepeat: 'repeat-x',
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <span key={i}>
          <img
            src={`${WORLD_DIR}/cloud_big.png`}
            alt=""
            className="scene-cloud"
            style={{ left: i * STAGE_WIDTH, top: 8 + ((i * 53) % 14), animationDelay: `${-(i * 7) % 40}s` }}
          />
          <img
            src={`${WORLD_DIR}/cloud_small.png`}
            alt=""
            className="scene-cloud"
            style={{ left: i * STAGE_WIDTH, top: 26 + ((i * 31) % 10), animationDelay: `${(-9 - i * 11) % 40}s` }}
          />
        </span>
      ))}
    </div>
  )
}

// 海平线上的棕榈小岛,每个地点一座,位置随格子错开
function FarIslands({ count }: { count: number }) {
  return (
    <div className="absolute inset-x-0 top-0" style={{ height: WATER_LINE, zIndex: LAYER_Z.farIsland }}>
      {Array.from({ length: count }, (_, i) => (
        <img
          key={i}
          src={`${WORLD_DIR}/island.png`}
          alt=""
          className="absolute"
          style={{ left: i * STAGE_WIDTH + 80 + ((i * 137) % 260), top: 26 }}
        />
      ))}
    </div>
  )
}

// 白沫波纹贴着水面线横向慢慢漂(steps 硬切,像素风不做平滑滚动)
function WaterSurface() {
  return (
    <div
      className="scene-surface-tile absolute inset-x-0"
      style={{
        top: WATER_LINE - 3,
        height: 12,
        zIndex: LAYER_Z.waterSurface,
        backgroundImage: `url(${WORLD_DIR}/surface.png)`,
        backgroundRepeat: 'repeat-x',
      }}
    />
  )
}

// 水下部分正好是一整个舞台高,潜水时镜头贴顶,这一层就刚好填满可见范围。
// 底色读 sea 主题(三层水色渐变),换海只换这一层;深色剪影是半透明的,
// 叠在哪个海的渐变上都成立
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
      <div
        className="absolute inset-x-0"
        style={{
          bottom: SAND_H - 6,
          height: 130,
          backgroundImage: `url(${WORLD_DIR}/far.png)`,
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'bottom',
        }}
      />
      <div className="absolute inset-0 bg-sand" style={{ opacity: (1 - clarity) * MAX_HAZE }} />
    </div>
  )
}

// 中景装饰:参考图的构图——珊瑚和岩石挤在画面两侧,中间留给小爱心和海草床。
// 三种排布轮换,按地点格子取模,同一个地点永远同一种
interface Decor {
  file: string
  x: number
  lift?: number
  sway?: boolean
}

const DECOR_VARIANTS: Decor[][] = [
  [
    { file: 'kelp.png', x: 2, sway: true },
    { file: 'rock_grey.png', x: 12 },
    { file: 'coral_brain_pink.png', x: 42 },
    { file: 'coral_tube.png', x: 70 },
    { file: 'seagrass_tall.png', x: 92, sway: true },
    { file: 'fan_purple.png', x: 382 },
    { file: 'coral_green.png', x: 408 },
    { file: 'coral_brain_orange.png', x: 430 },
    { file: 'coral_branch_pink.png', x: 452 },
    { file: 'kelp.png', x: 464, sway: true },
  ],
  [
    { file: 'coral_branch_pink.png', x: 8 },
    { file: 'coral_green.png', x: 34 },
    { file: 'seagrass_tall.png', x: 58, sway: true },
    { file: 'kelp.png', x: 388, sway: true },
    { file: 'coral_brain_orange.png', x: 404 },
    { file: 'rock_grey.png', x: 428 },
    { file: 'coral_tube.png', x: 458 },
  ],
  [
    { file: 'fan_purple.png', x: 6 },
    { file: 'coral_brain_orange.png', x: 32 },
    { file: 'kelp.png', x: 56, sway: true },
    { file: 'seagrass_tall.png', x: 372, sway: true },
    { file: 'coral_brain_pink.png', x: 394 },
    { file: 'coral_green.png', x: 424 },
    { file: 'rock_grey.png', x: 446 },
  ],
]

function UnderwaterMid({ count }: { count: number }) {
  return (
    <div className="absolute inset-x-0 bottom-0" style={{ zIndex: LAYER_Z.underwaterMid }}>
      {Array.from({ length: count }, (_, i) =>
        DECOR_VARIANTS[i % DECOR_VARIANTS.length].map((decor, j) => (
          <img
            key={`${i}-${j}`}
            src={`${WORLD_DIR}/${decor.file}`}
            alt=""
            className={decor.sway ? 'decor-sway absolute' : 'absolute'}
            style={{
              left: i * STAGE_WIDTH + decor.x,
              bottom: SAND_H - 6 + (decor.lift ?? 0),
              animationDelay: decor.sway ? `${-((i * 7 + j * 3) % 8)}s` : undefined,
            }}
          />
        )),
      )}
    </div>
  )
}

// 沙底上的小散落物,位置按格子错开;不挡路、不可点,纯风景
const SCATTER = ['shell_pink.png', 'starfish.png', 'stones.png'] as const

function Seabed({ count }: { count: number }) {
  return (
    <div
      className="absolute inset-x-0 bottom-0"
      style={{
        height: SAND_H,
        zIndex: LAYER_Z.seabed,
        backgroundImage: `url(${WORLD_DIR}/sand.png)`,
        backgroundRepeat: 'repeat-x',
      }}
    >
      {Array.from({ length: count }, (_, i) =>
        SCATTER.map((file, j) => (
          <img
            key={`${i}-${j}`}
            src={`${WORLD_DIR}/${file}`}
            alt=""
            className="absolute"
            style={{
              left: i * STAGE_WIDTH + 120 + ((i * 211 + j * 149) % 240),
              bottom: 4 + ((i * 31 + j * 17) % 12),
            }}
          />
        )),
      )}
    </div>
  )
}

// 每个地点在世界横条里占一格,顶上放个名字牌
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
  const count = locationNames.length
  const worldWidth = STAGE_WIDTH * count
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
        <Sky count={count} />
        <FarIslands count={count} />
        <WaterSurface />
        <Underwater sea={sea} clarity={clarity} />
        <UnderwaterMid count={count} />
        <Seabed count={count} />
        {count > 1 && <LocationLabels names={locationNames} />}
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
