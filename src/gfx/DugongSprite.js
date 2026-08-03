// 小爱心(儒艮)的 Canvas 2D 渲染类。独立于现有 React/DOM 渲染(Sprite.tsx),
// 供需要连续像素运动(气泡粒子、正弦浮力)的场景挂进自己的 rAF 循环使用。
//
// 尺寸、帧宽、锚点全部读 pet.json(src/lib/pet.ts 的 FRAME_WIDTH/HEIGHT、
// 皮肤目录、锚点表),不许在这里硬编码坐标 —— 素材是可替换资源(CLAUDE.md 五)。
//
// 帧循环:swim 精灵表是 6 帧 @ 8fps,本类按需求做 8 帧循环 ——
// 帧序列 [0,1,2,3,4,5,4,2],像乒乓回摆一样把 6 帧拉成 8 帧,
// 尾鳍上下拍打 + 鳍肢划水的往复看起来更连贯。
//
// 加载失败一律静默降级:拿不到图就画占位色块,绝不白屏(CLAUDE.md 渲染层约定)。

import { DEFAULT_SKIN_DIR, FRAME_HEIGHT, FRAME_WIDTH } from '../lib/pet'

// 8 帧循环:swim.png 的 6 帧映射成首尾不回头的往复序列
const FRAME_SEQUENCE = [0, 1, 2, 3, 4, 5, 4, 2]
const FRAME_COUNT = FRAME_SEQUENCE.length
const ANIM_FPS = 8

// 浮力偏移的默认值。振幅/周期后续要调只改这里
const DEFAULT_BUOYANCY = {
  // 上下浮动的振幅(逻辑像素)。身体一半高以内,不会顶到头顶气泡
  amplitude: 4,
  // 左右轻微漂的振幅,模拟水流推搡
  swayAmplitude: 2,
  // 一次完整起伏的秒数。儒艮是慢悠悠的动物,周期别太急
  period: 3.2,
}

// 气泡粒子参数。都是相对一帧 192x64 的比例,体型缩放后跟着变小
const BUBBLE_INTERVAL_MS = 1600 // 两次冒泡的间隔,带 ±30% 随机
const BUBBLE_LIFE_MS = 2200 // 一颗泡活多久
const BUBBLE_RISE_SPEED = 26 // 逻辑 px/s,越接近水面越快(见 update)
const BUBBLE_DRIFT = 6 // 上升过程中的水平漂移幅度
const MAX_BUBBLES = 24 // 上限,防止长挂机堆粒子

/** 一颗从嘴部冒出来的像素气泡。纯数据 + update/draw,不知道小爱心的存在 */
export class BubbleParticle {
  constructor(x, y, rng = Math.random) {
    this.x = x
    this.y = y
    this.bornX = x
    this.age = 0
    this.life = BUBBLE_LIFE_MS * (0.8 + rng() * 0.4)
    // 2-4 逻辑像素的微小气泡,像素风下就是一个 2-4px 的小方块圈
    this.size = 2 + Math.floor(rng() * 3)
    this.phase = rng() * Math.PI * 2
    this.dead = false
  }

  update(dtMs) {
    this.age += dtMs
    if (this.age >= this.life) {
      this.dead = true
      return
    }
    const t = this.age / this.life
    // 越往上浮得越快:气泡接近水面时阻力小,物理上也确实加速
    this.y -= BUBBLE_RISE_SPEED * (0.6 + t) * (dtMs / 1000)
    // 正弦横向漂移,气泡不是直直上升的
    this.x = this.bornX + Math.sin(this.phase + t * Math.PI * 2) * BUBBLE_DRIFT * t
  }

  draw(ctx) {
    const t = this.age / this.life
    const alpha = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25 // 最后 1/4 淡出
    const s = this.size
    const x = Math.round(this.x)
    const y = Math.round(this.y)
    ctx.globalAlpha = alpha
    // 浅蓝描边小方块 + 左上角 1px 高光,无抗锯齿的像素气泡
    ctx.fillStyle = '#C3D3D9'
    ctx.fillRect(x, y, s, s)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(x, y, 1, 1)
    ctx.globalAlpha = 1
  }
}

/** 小爱心本体:精灵表 8 帧循环 + 正弦浮力 + 定期冒泡 */
export class DugongSprite {
  constructor(options = {}) {
    const {
      skinDir = DEFAULT_SKIN_DIR,
      animFile = 'swim.png',
      src = `${skinDir}${animFile}`,
      anchors = { mouth: [0.885, 0.7] }, // 调用方应传 pet.json 的锚点;这里只兜底
      frameWidth = FRAME_WIDTH,
      frameHeight = FRAME_HEIGHT,
      frameCount = FRAME_COUNT,
      fps = ANIM_FPS,
      scale = 1,
      facingLeft = false,
      buoyancy = {},
      rng = Math.random,
    } = options

    this.src = src
    this.anchors = anchors
    this.frameWidth = frameWidth
    this.frameHeight = frameHeight
    this.frameCount = frameCount
    this.fps = fps
    this.scale = scale
    this.facingLeft = facingLeft
    this.rng = rng
    this.buoyancy = { ...DEFAULT_BUOYANCY, ...buoyancy }

    this.image = null
    this.loadFailed = false
    this.time = 0 // 动画时钟(ms),驱动帧切换与浮力相位
    this.bubbles = []
    this.nextBubbleAt = this._scheduleBubble(0)
  }

  /** 预载精灵图。失败不抛错,只标记降级 —— 和 render/assets.ts 同一个约定 */
  load() {
    if (this.image || this.loadFailed) return Promise.resolve(this.image)
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        this.image = img
        resolve(img)
      }
      img.onerror = () => {
        this.loadFailed = true
        resolve(null)
      }
      img.src = this.src
    })
  }

  // 正弦波浮力:返回这一时刻相对锚定点的 [dx, dy] 偏移(已乘体型缩放)
  buoyancyOffset() {
    const { amplitude, swayAmplitude, period } = this.buoyancy
    const phase = (this.time / 1000 / period) * Math.PI * 2
    const dy = Math.sin(phase) * amplitude
    // 水平漂移用半频,上下浮两次才左右晃一个来回,更像被水流慢慢推
    const dx = Math.sin(phase / 2 + Math.PI / 4) * swayAmplitude
    return [dx * this.scale, dy * this.scale]
  }

  _scheduleBubble(fromMs) {
    return fromMs + BUBBLE_INTERVAL_MS * (0.7 + this.rng() * 0.6)
  }

  // 嘴部锚点的世界坐标。facingLeft 时 x 镜像 —— 和 Bubbles.tsx 同一套镜像规则
  _mouthPosition(originX, originY) {
    const [ax, ay] = this.anchors.mouth ?? [0.885, 0.7]
    const mirroredX = this.facingLeft ? 1 - ax : ax
    return [
      originX + mirroredX * this.frameWidth * this.scale,
      originY + ay * this.frameHeight * this.scale,
    ]
  }

  /** 推进时钟、切帧、冒泡、更新粒子。dtMs 来自调用方的 rAF 循环 */
  update(dtMs) {
    this.time += dtMs

    if (this.time >= this.nextBubbleAt && this.bubbles.length < MAX_BUBBLES) {
      // 出生时先放在原点,draw 时会加上浮力偏移和嘴部锚点,见 draw()
      this.bubbles.push(new BubbleParticle(0, 0, this.rng))
      this.nextBubbleAt = this._scheduleBubble(this.time)
    }

    for (const bubble of this.bubbles) bubble.update(dtMs)
    this.bubbles = this.bubbles.filter((bubble) => !bubble.dead)
  }

  /** 当前该播序列里的第几帧。8 帧循环,映射回精灵表的真实帧号 */
  currentFrame() {
    const step = Math.floor((this.time / 1000) * this.fps) % this.frameCount
    return FRAME_SEQUENCE[step % FRAME_SEQUENCE.length]
  }

  /**
   * 画到 ctx 上。(originX, originY) 是精灵左上角的世界坐标,
   * 浮力偏移在内部叠加。调用前请保证 ctx.imageSmoothingEnabled = false
   */
  draw(ctx, originX, originY) {
    const [bx, by] = this.buoyancyOffset()
    const x = Math.round(originX + bx)
    const y = Math.round(originY + by)
    const w = this.frameWidth * this.scale
    const h = this.frameHeight * this.scale

    // 先画气泡,再画身体:嘴部刚冒出来的小气泡从吻部后面钻出来更自然
    const [mx, my] = this._mouthPosition(x, y)
    for (const bubble of this.bubbles) {
      ctx.save()
      ctx.translate(mx, my)
      bubble.draw(ctx)
      ctx.restore()
    }

    if (!this.image) {
      if (!this.loadFailed) this.load() // 顺手触发加载,下一帧起就有图
      else {
        // 图挂了:画一个身体色占位块,位置大小不变,绝不白屏
        ctx.fillStyle = '#8CA3B0'
        ctx.fillRect(x, y, w, h)
      }
      return
    }

    const frame = this.currentFrame()
    const sx = frame * this.frameWidth

    ctx.save()
    if (this.facingLeft) {
      // 绕精灵中心水平镜像,锚点已经在 _mouthPosition 里单独镜像过
      ctx.translate(x + w / 2, 0)
      ctx.scale(-1, 1)
      ctx.translate(-(x + w / 2), 0)
    }
    ctx.drawImage(
      this.image,
      sx, 0, this.frameWidth, this.frameHeight,
      x, y, w, h,
    )
    ctx.restore()
  }
}

export default DugongSprite
