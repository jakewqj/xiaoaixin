import type { ReactNode } from 'react'
import { STAGE_HEIGHT, STAGE_WIDTH } from './ScreenFrame'
import { LAYER_Z } from '../lib/layers'
import type { SeaTheme } from '../lib/seas'

// 九层图层,素材来自 draw-world.mjs 生成的像素图(public/assets/world/)。
// 层级顺序见 CLAUDE.md 十二;素材是可替换资源,这里只按路径引用,不内联图形
const WORLD_DIR = '/assets/world'

// 水面线取整数像素:sky.png 就是按这个高度画的,非整数会引起半像素拉伸
const WATER_LINE = 86

// 金沙海底的高度(sand.png tile 的高度)。参考图沙地约占画面高 15%
const SAND_H = 40

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

// 海平线上的棕榈小岛:参考图是一大一小两座,底座压着海平线(y=46)
function FarIslands({ count }: { count: number }) {
  return (
    <div className="absolute inset-x-0 top-0" style={{ height: WATER_LINE, zIndex: LAYER_Z.farIsland }}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i}>
          <img
            src={`${WORLD_DIR}/island_big.png`}
            alt=""
            className="absolute"
            style={{ left: i * STAGE_WIDTH + 260 + ((i * 97) % 120), top: 15 }}
          />
          <img
            src={`${WORLD_DIR}/island_small.png`}
            alt=""
            className="absolute"
            style={{ left: i * STAGE_WIDTH + 150 + ((i * 61) % 90), top: 27 }}
          />
        </span>
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
          height: 120,
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

// 数组顺序就是叠放顺序(后面的画在前面):岩石垫底,珊瑚层层叠在岩石前,
// 参考图两个下角都是这样挤满的,中间留给小爱心和海草床
const DECOR_VARIANTS: Decor[][] = [
  [
    // 左角
    { file: 'kelp.png', x: 0, sway: true },
    { file: 'rock_big.png', x: -18 },
    { file: 'tubes_purple.png', x: 4 },
    { file: 'coral_brain_pink.png', x: 32, lift: -2 },
    { file: 'coral_branch_red.png', x: 68, lift: -2 },
    { file: 'seagrass_tall.png', x: 100, sway: true },
    // 中部沙线上的小件,参考图的构图中间也不是全空的
    { file: 'rock_small.png', x: 278 },
    { file: 'coral_green.png', x: 296, lift: -2 },
    // 右角
    { file: 'kelp.png', x: 454, sway: true },
    { file: 'rock_small.png', x: 396 },
    { file: 'fan_purple.png', x: 368 },
    { file: 'coral_green.png', x: 398, lift: -2 },
    { file: 'coral_brain_orange.png', x: 424, lift: -3 },
    { file: 'coral_tube.png', x: 452, lift: -2 },
  ],
  [
    { file: 'kelp.png', x: 4, sway: true },
    { file: 'rock_small.png', x: -12 },
    { file: 'coral_branch_pink.png', x: 8, lift: -2 },
    { file: 'coral_green.png', x: 40, lift: -2 },
    { file: 'seagrass_tall.png', x: 74, sway: true },
    { file: 'kelp.png', x: 428, sway: true },
    { file: 'rock_big.png', x: 392 },
    { file: 'coral_brain_orange.png', x: 396, lift: -3 },
    { file: 'tubes_purple.png', x: 428, lift: -2 },
    { file: 'coral_branch_red.png', x: 456, lift: -2 },
  ],
  [
    { file: 'fan_purple.png', x: 0 },
    { file: 'coral_brain_orange.png', x: 28, lift: -2 },
    { file: 'kelp.png', x: 58, sway: true },
    { file: 'coral_tube.png', x: 66, lift: -2 },
    { file: 'seagrass_tall.png', x: 366, sway: true },
    { file: 'rock_small.png', x: 390 },
    { file: 'coral_brain_pink.png', x: 394, lift: -2 },
    { file: 'coral_green.png', x: 434, lift: -2 },
    { file: 'coral_branch_pink.png', x: 456, lift: -2 },
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
const SCATTER = [
  'shell_pink.png',
  'starfish.png',
  'stones.png',
  'shell_white.png',
  'gem_blue.png',
  'fish_small.png',
] as const

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
      {Array.from({ length: count }, (_, i) => (
        <span key={i}>
          {SCATTER.map((file, j) => (
            <img
              key={j}
              src={`${WORLD_DIR}/${file}`}
              alt=""
              className="absolute"
              style={{
                left: i * STAGE_WIDTH + 116 + ((i * 211 + j * 149) % 250),
                bottom: 4 + ((i * 31 + j * 17) % 14),
              }}
            />
          ))}
        </span>
      ))}
    </div>
  )
}

// 世界边界之外还有没开放的地点时,在边缘露出一点模糊的影子——看得见、够不着
function LockedHint({ atLeftEdge, atRightEdge, worldWidth }: { atLeftEdge: boolean; atRightEdge: boolean; worldWidth: number }) {
  return (
    <div className="pointer-events-none absolute inset-y-0" style={{ width: worldWidth, zIndex: LAYER_Z.underwaterMid }}>
      {atRightEdge && (
        <span
          className="absolute bottom-16 rounded-full bg-ink/20 blur-[3px]"
          style={{ left: worldWidth - 20, width: 40, height: 60 }}
        />
      )}
      {atLeftEdge && (
        <span
          className="absolute bottom-16 rounded-full bg-ink/20 blur-[3px]"
          style={{ left: -20, width: 40, height: 60 }}
        />
      )}
    </div>
  )
}

// 小爱心、海草床、NPC 都挂在这一层,内容由调用方传进来。这层跟着世界一起摇镜头。
// 整层必须穿透点击(不然会把下面「点哪游哪」的点击层整个吞掉),
// 真正可以点的角色按钮各自开 pointer-events-auto
function Actors({ children }: { children?: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: LAYER_Z.actors }}>
      {children}
    </div>
  )
}

// 参考图那种白圈+高光的描边气泡,每个地点几串,大小混着,慢慢升起
const BUBBLE_SIZES = ['bubble_big.png', 'bubble_mid.png', 'bubble_small.png'] as const

function Bubbles({ count }: { count: number }) {
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: LAYER_Z.bubbles }}>
      {Array.from({ length: count }, (_, i) =>
        Array.from({ length: 5 }, (_, j) => (
          <img
            key={`${i}-${j}`}
            src={`${WORLD_DIR}/${BUBBLE_SIZES[(i + j) % 3]}`}
            alt=""
            className="scene-bubble"
            style={{
              left: i * STAGE_WIDTH + 90 + ((i * 173 + j * 97) % 320),
              bottom: SAND_H + 40 + ((i * 53 + j * 71) % 110),
              animationDelay: `${-((i * 5 + j * 13) % 40) / 10}s`,
              animationDuration: `${3.4 + ((i + j * 3) % 4) * 0.6}s`,
            }}
          />
        )),
      )}
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
  // 开放地点数,决定世界横条一共有几格
  slotCount?: number
  // 镜头水平位置(世界坐标),由 App 按小爱心的位置算好传进来
  cameraX?: number
  // 点了世界里的某一点(x 是世界坐标):小爱心朝那边游过去
  onWorldTap?: (x: number) => void
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
  slotCount = 1,
  cameraX = 0,
  onWorldTap,
  lockedBeyondEnd = false,
  lockedBeforeStart = false,
  actors,
  hud,
}: SceneProps) {
  const count = Math.max(1, slotCount)
  const worldWidth = STAGE_WIDTH * count
  return (
    <div
      className="relative overflow-hidden"
      style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
    >
      {/* 水平跟随逐帧更新不做缓动(小爱心本身就是匀速的);垂直摇移(换气)保留 400ms 平滑 */}
      <div
        className="absolute top-0 left-0"
        style={{ width: worldWidth, height: WORLD_HEIGHT, transform: `translateX(${-cameraX}px)` }}
      >
        <div
          className="camera-world absolute top-0 left-0"
          style={{
            width: worldWidth,
            height: WORLD_HEIGHT,
            transform: `translateY(${surfaced ? 0 : -WATER_LINE}px)`,
          }}
        >
          <Sky count={count} />
          <FarIslands count={count} />
          <WaterSurface />
          <Underwater sea={sea} clarity={clarity} />
          <UnderwaterMid count={count} />
          <Seabed count={count} />
          {/* 点哪游哪:铺满整个世界的点击层,在角色层之下——点小爱心/邻居仍是他们自己的反应 */}
          {onWorldTap && (
            <div
              role="presentation"
              className="absolute inset-0 cursor-pointer"
              style={{ zIndex: LAYER_Z.actors }}
              onClick={(event) => onWorldTap(event.nativeEvent.offsetX)}
            />
          )}
          <Actors>{actors}</Actors>
          <Bubbles count={count} />
          {(lockedBeyondEnd || lockedBeforeStart) && (
            <LockedHint
              atLeftEdge={lockedBeforeStart}
              atRightEdge={lockedBeyondEnd}
              worldWidth={worldWidth}
            />
          )}
        </div>
      </div>
      <Hud>{hud}</Hud>
    </div>
  )
}

export default Scene
