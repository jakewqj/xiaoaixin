// 三层视差海底背景。Canvas 2D 手写渲染,和 DugongSprite 一样挂在调用方的 rAF 循环里。
//
// 三层(对应 CLAUDE.md 十二 的图层语义):
//   背景 sky       —— 天空 + 远景海平面/岛屿,几乎不随镜头动(0.15x)
//   中景 mid       —— 浅水波光光斑 + 深海渐变,半速跟随(0.5x)
//   前景 fore      —— 海草/珊瑚 tilemap,全速跟随镜头(1.0x)
//
// 配色全部来自 CLAUDE.md 四 的调色板,素材全部来自 /assets/world/,
// 代码里不出现硬编码的自绘图形 —— 素材是可替换资源(CLAUDE.md 五)。
// 加载失败静默降级成纯色,绝不白屏。

// 调色板(CLAUDE.md 四,不许自行换色)
const COLORS = {
  skyTop: '#AEE6EA', // 天空高处,比浅滩水色更亮一档
  skyHorizon: '#7FD1D8', // 海平线融进浅滩水色
  shallow: '#7FD1D8',
  mid: '#2E8B9B',
  deep: '#14495C',
  caustic: '#C3D3D9', // 波光光斑色,和小爱心腹部同色系
}

// 水面线在舞台里的高度占比。和 Scene.tsx 里水下部分的起始位置对齐
const SURFACE_Y = 0.22

// 中景波光光斑的参数
const CAUSTIC = {
  rows: 3, // 光斑层叠的行数
  spotsPerRow: 6, // 每行几个光斑
  radius: 26, // 单个光斑半径(逻辑 px)
  speed: 0.35, // 正弦相位推进速度(rad/s)
  maxAlpha: 0.16, // 最亮时的透明度,克制一点别晃眼
}

// 前景 tilemap 的生成密度。海草为主、珊瑚点缀 —— 家海草床的主角是海草
const MEADOW = {
  seagrassEvery: 34, // 平均每隔多少逻辑 px 一丛海草(带随机抖动)
  coralEvery: 130, // 珊瑚稀一些,别抢戏
  swayPx: 2, // 摆动帧交替时的水平偏移
  swayPeriod: 1600, // 2 帧交替的周期(ms)
}

// 背景层用到的素材。spec 见各文件在 /assets/world/ 里的实际尺寸
const SKY_TILE = '/assets/world/sky.png' // 96x86
const FAR_TILE = '/assets/world/far.png' // 240x120,远景岛屿+海面
const SURFACE_TILE = '/assets/world/surface.png' // 96x12,水面线
const SAND_TILE = '/assets/world/sand.png' // 96x40,沙底
const SEAGRASS = '/assets/world/seagrass_tall.png' // 26x48
const KELP = '/assets/world/kelp.png' // 26x100
const CORALS = [
  '/assets/world/coral_green.png',
  '/assets/world/coral_brain_pink.png',
  '/assets/world/coral_brain_orange.png',
  '/assets/world/coral_branch_pink.png',
  '/assets/world/fan_purple.png',
]

// 世界比舞台宽,给镜头留出游过去的位置。默认 2 个舞台宽,和 App.tsx 的 slotCount 同量级
const DEFAULT_WORLD_WIDTH = 960

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null) // 拿不到就降级,见文件头
    img.src = src
  })
}

/** 三层视差海底背景。new 完调 load(),之后每帧 draw(ctx, cameraX, timeMs) */
export class Background {
  constructor(options = {}) {
    const {
      stageWidth = 480,
      stageHeight = 270,
      worldWidth = DEFAULT_WORLD_WIDTH,
      seed = 20260803, // tilemap 布局固定用同一个种子,每次进来海草长在同一个地方
    } = options

    this.stageWidth = stageWidth
    this.stageHeight = stageHeight
    this.worldWidth = worldWidth
    this.images = {} // src -> HTMLImageElement | null
    this.tiles = this._buildMeadow(seed)
    this.ready = false
  }

  /** 预载全部素材。失败的路径记为 null,draw 时走纯色降级 */
  async load() {
    const srcs = [SKY_TILE, FAR_TILE, SURFACE_TILE, SAND_TILE, SEAGRASS, KELP, ...CORALS]
    const imgs = await Promise.all(srcs.map(loadImage))
    srcs.forEach((src, i) => {
      this.images[src] = imgs[i]
    })
    this.ready = true
  }

  // 简易可复现随机数(mulberry32),种子固定则海草/珊瑚布局固定
  _rng(seed) {
    let a = seed >>> 0
    return () => {
      a |= 0
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  // 前景 tilemap:海草为主、间或一棵海带、稀疏珊瑚。每个 tile 记录摆动相位,2 帧交替错开才不像集体木偶
  _buildMeadow(seed) {
    const rand = this._rng(seed)
    const tiles = []
    const sandTop = this.stageHeight * 0.82 // 沙底线,植物都长在它上面

    for (let x = 12; x < this.worldWidth; x += MEADOW.seagrassEvery * (0.7 + rand() * 0.6)) {
      const kelp = rand() < 0.18
      tiles.push({
        kind: 'plant',
        src: kelp ? KELP : SEAGRASS,
        x: Math.round(x),
        baseY: sandTop,
        phase: rand() * Math.PI * 2,
      })
    }
    for (let x = 60; x < this.worldWidth; x += MEADOW.coralEvery * (0.7 + rand() * 0.6)) {
      tiles.push({
        kind: 'coral',
        src: CORALS[Math.floor(rand() * CORALS.length)],
        x: Math.round(x),
        baseY: sandTop,
        phase: rand() * Math.PI * 2,
      })
    }
    return tiles
  }

  /**
   * 浅水波光的 alpha 混合光斑:多行错开相位的正弦呼吸光斑,
   * alpha = maxAlpha * (0.5 + 0.5*sin(...)) 的叠加,正弦相位随时间推进。
   * 两层正弦(行内 + 行间)错开,光斑会像水面的折射一样游走。
   */
  _drawCaustics(ctx, offsetX, t) {
    const top = this.stageHeight * SURFACE_Y
    const band = this.stageHeight * 0.45 // 波光只在浅水带,深水没有直射阳光
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, top, this.stageWidth, band)
    ctx.clip()
    ctx.fillStyle = COLORS.caustic
    for (let row = 0; row < CAUSTIC.rows; row++) {
      const y = top + ((row + 0.5) / CAUSTIC.rows) * band
      for (let i = 0; i < CAUSTIC.spotsPerRow; i++) {
        const spacing = this.stageWidth / (CAUSTIC.spotsPerRow - 1)
        const phase = t * CAUSTIC.speed + row * 1.7 + i * 2.3
        // 光斑中心随正弦左右游走,透明度随另一条正弦呼吸
        const x = ((i * spacing + Math.sin(phase * 0.7) * 18 - offsetX) % (this.stageWidth + 80)) - 40
        const alpha = CAUSTIC.maxAlpha * (0.5 + 0.5 * Math.sin(phase))
        const r = CAUSTIC.radius * (0.8 + 0.2 * Math.sin(phase * 1.3))
        ctx.globalAlpha = alpha
        ctx.beginPath()
        ctx.ellipse(x, y, r, r * 0.38, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()
    ctx.globalAlpha = 1
  }

  /** 背景层:天空 → 远景岛屿海平面 → 水面线。几乎不随镜头动 */
  drawSky(ctx, cameraX) {
    const surfaceY = Math.round(this.stageHeight * SURFACE_Y)
    const offset = Math.round(cameraX * 0.15)

    // 天空:优先平铺 sky.png,没图就画两段纯色渐变带
    const sky = this.images[SKY_TILE]
    if (sky) {
      for (let x = -(offset % sky.width) - sky.width; x < this.stageWidth; x += sky.width) {
        ctx.drawImage(sky, x, 0, sky.width, surfaceY)
      }
    } else {
      ctx.fillStyle = COLORS.skyTop
      ctx.fillRect(0, 0, this.stageWidth, surfaceY)
    }

    // 远景海平面/岛屿:far.png 240px 宽,平铺到水面线位置
    const far = this.images[FAR_TILE]
    if (far) {
      const h = Math.min(far.height, surfaceY + 24)
      for (let x = -(offset % far.width) - far.width; x < this.stageWidth; x += far.width) {
        ctx.drawImage(far, x, surfaceY + 12 - h, far.width, h)
      }
    }

    // 水面线:96x12 的 surface.png 平铺在交界处
    const surface = this.images[SURFACE_TILE]
    if (surface) {
      for (let x = -((offset * 2) % surface.width) - surface.width; x < this.stageWidth; x += surface.width) {
        ctx.drawImage(surface, x, surfaceY - surface.height / 2)
      }
    } else {
      ctx.fillStyle = COLORS.shallow
      ctx.fillRect(0, surfaceY - 1, this.stageWidth, 2)
    }
  }

  /** 中景:水下三段渐变 + 浅水波光。半速视差 */
  drawMid(ctx, cameraX, t) {
    const surfaceY = Math.round(this.stageHeight * SURFACE_Y)
    const offset = Math.round(cameraX * 0.5)

    // 深海渐变:浅滩 → 中层 → 深水,三段硬切保持像素感,不用平滑渐变。
    // 以沙底线(0.82)为界往上分:浅水带窄一些,中层占主体,沙底以下不再画水体
    const sandTop = Math.round(this.stageHeight * 0.82)
    const shallowBottom = Math.round(surfaceY + (sandTop - surfaceY) * 0.35)
    const midBottom = Math.round(surfaceY + (sandTop - surfaceY) * 0.75)
    ctx.fillStyle = COLORS.shallow
    ctx.fillRect(0, surfaceY, this.stageWidth, shallowBottom - surfaceY)
    ctx.fillStyle = COLORS.mid
    ctx.fillRect(0, shallowBottom, this.stageWidth, midBottom - shallowBottom)
    ctx.fillStyle = COLORS.deep
    ctx.fillRect(0, midBottom, this.stageWidth, sandTop - midBottom)
    this._drawCaustics(ctx, offset, t / 1000)
  }

  /** 前景:沙底 + 海草/珊瑚 tilemap,2 帧交替摆动。全速跟随镜头 */
  drawFore(ctx, cameraX, t) {
    const sandTop = Math.round(this.stageHeight * 0.82)
    const offset = Math.round(cameraX)

    // 沙底:sand.png 平铺,没图就用调色板沙色
    const sand = this.images[SAND_TILE]
    if (sand) {
      const h = this.stageHeight - sandTop
      for (let x = -(offset % sand.width) - sand.width; x < this.stageWidth; x += sand.width) {
        ctx.drawImage(sand, x, sandTop, sand.width, h)
      }
    } else {
      ctx.fillStyle = '#E8DCC0'
      ctx.fillRect(0, sandTop, this.stageWidth, this.stageHeight - sandTop)
    }

    // 2 帧交替摆动:按 (time + tile相位) 二选一,奇数帧原位、偶数帧偏移 swayPx,
    // 相位错开后有的草摆有的草停,就是水下被水流推的样子
    for (const tile of this.tiles) {
      const img = this.images[tile.src]
      if (!img) continue
      const sx = tile.x - offset
      if (sx < -img.width || sx > this.stageWidth + img.width) continue
      const frame = Math.floor(t / MEADOW.swayPeriod + tile.phase) % 2
      const dx = frame === 0 ? 0 : MEADOW.swayPx
      // 摆动绕根部转:底部贴住沙底不动,只让上端横移 —— 用倾斜而不是整体平移
      ctx.save()
      ctx.translate(sx, tile.baseY)
      if (dx !== 0) ctx.transform(1, 0, dx / img.height, 1, 0, 0) // 切变,草尖动草根不动
      ctx.drawImage(img, 0, -img.height)
      ctx.restore()
    }
  }

  /**
   * 一帧画完三层。cameraX 是镜头在世界里的 x 坐标,t 是累计毫秒。
   * 调用前请保证 ctx.imageSmoothingEnabled = false(波光光斑是唯一的例外,
   * 它用椭圆 + alpha,本身就是软的,像素硬边只作用在素材上)
   */
  draw(ctx, cameraX, t) {
    this.drawMid(ctx, cameraX, t) // 水体垫底
    this.drawSky(ctx, cameraX) // 天空画在水体上方的水面线以上
    this.drawFore(ctx, cameraX, t)
  }
}

export default Background


