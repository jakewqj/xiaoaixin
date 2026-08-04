// canvas 文字。像素字体 Zpix,字号必须是它的整数倍才不糊(点阵字体的原生格是 12px)
//
// UI canvas 的后备缓冲区是设备分辨率(见 src/ui/HUD.tsx),所以这里画出来的字
// 是按原生分辨率栅格化的,不会被最近邻放大成马赛克

export const PIXEL_FONT = '"Zpix", "ZCOOL KuaiLe", "PingFang SC", "Microsoft YaHei", sans-serif'

// Zpix 是 12px 点阵字体。字号取 12 的整数倍笔画才对得上像素格,
// 取 9、10、11 这种会被字体引擎重采样,像素点变成灰边
export const SIZES = { small: 12, normal: 12, large: 24 } as const

let ready = false

/** 字体就绪之前先用系统字顶上,不留白 —— 和现行 CSS font-family 的兜底链一个道理 */
export function whenFontReady(onReady: () => void): void {
  if (ready) {
    onReady()
    return
  }
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
  if (!fonts) {
    ready = true
    onReady()
    return
  }
  // 显式 load 一次:光等 fonts.ready 在字体还没被用到时不会去下载
  fonts
    .load(`12px Zpix`, '第天贝壳0123')
    .catch(() => undefined)
    .then(() => fonts.ready)
    .then(() => {
      ready = true
      onReady()
    })
    .catch(() => {
      ready = true
      onReady()
    })
}

export function isFontReady(): boolean {
  return ready
}

export function setFont(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.font = `${size}px ${PIXEL_FONT}`
  ctx.textBaseline = 'top'
}

/**
 * 画一行字。像素字体在非整数坐标上会被重采样出灰边,所以坐标一律取整
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  size: number = SIZES.normal,
): number {
  setFont(ctx, size)
  ctx.fillStyle = color
  ctx.fillText(text, Math.round(x), Math.round(y))
  return ctx.measureText(text).width
}

export function measure(ctx: CanvasRenderingContext2D, text: string, size: number = SIZES.normal): number {
  setFont(ctx, size)
  return ctx.measureText(text).width
}
