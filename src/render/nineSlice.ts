// 九宫格绘制。切片规格来自 wiki/graphic/hud-9slice.json(参考图实测:边框 4px、格子 20x20)
//
// 四角永远按原尺寸画,不缩放 —— 这是九宫格的全部意义。中段两种模式:
//   repeat  按源尺寸整块平铺,最后一块裁掉多出来的。木纹用这个
//   stretch 拉伸。纯色中段用这个,省几次 drawImage
//
// 调用前 ctx.imageSmoothingEnabled 必须已经是 false

export type SliceMode = 'repeat' | 'stretch'

/**
 * 九宫格。s 是四边统一的切片宽度(源图和目标都用同一个值,因为整数倍缩放下它们相等)
 */
export function nineSlice(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  s: number,
  mode: SliceMode = 'repeat',
): void {
  const iw = img.width
  const ih = img.height
  const cw = iw - s * 2 // 源中段
  const ch = ih - s * 2
  const mw = w - s * 2 // 目标中段
  const mh = h - s * 2

  if (cw <= 0 || ch <= 0) return
  // 目标比两个角还窄时画不出中段,退化成只画四角,免得出现负宽度的 drawImage
  if (mw < 0 || mh < 0) return

  // 四角
  ctx.drawImage(img, 0, 0, s, s, x, y, s, s)
  ctx.drawImage(img, iw - s, 0, s, s, x + w - s, y, s, s)
  ctx.drawImage(img, 0, ih - s, s, s, x, y + h - s, s, s)
  ctx.drawImage(img, iw - s, ih - s, s, s, x + w - s, y + h - s, s, s)

  if (mode === 'stretch') {
    if (mw > 0) {
      ctx.drawImage(img, s, 0, cw, s, x + s, y, mw, s)
      ctx.drawImage(img, s, ih - s, cw, s, x + s, y + h - s, mw, s)
    }
    if (mh > 0) {
      ctx.drawImage(img, 0, s, s, ch, x, y + s, s, mh)
      ctx.drawImage(img, iw - s, s, s, ch, x + w - s, y + s, s, mh)
    }
    if (mw > 0 && mh > 0) ctx.drawImage(img, s, s, cw, ch, x + s, y + s, mw, mh)
    return
  }

  // repeat:上下边 + 中心
  for (let dx = 0; dx < mw; dx += cw) {
    const tw = Math.min(cw, mw - dx)
    ctx.drawImage(img, s, 0, tw, s, x + s + dx, y, tw, s)
    ctx.drawImage(img, s, ih - s, tw, s, x + s + dx, y + h - s, tw, s)
    for (let dy = 0; dy < mh; dy += ch) {
      const th = Math.min(ch, mh - dy)
      ctx.drawImage(img, s, s, tw, th, x + s + dx, y + s + dy, tw, th)
    }
  }
  // 左右边
  for (let dy = 0; dy < mh; dy += ch) {
    const th = Math.min(ch, mh - dy)
    ctx.drawImage(img, 0, s, s, th, x, y + s + dy, s, th)
    ctx.drawImage(img, iw - s, s, s, th, x + w - s, y + s + dy, s, th)
  }
}

/**
 * 横向三段:左端帽 / 中段平铺 / 右端帽,高度锁死不缩放。
 * 金币栏那类只横向拉伸的用它 —— 套 nineSlice 会因为纵向切片是 0 而除零
 */
export function threeSliceX(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  s: number,
): void {
  const iw = img.width
  const ih = img.height
  const cw = iw - s * 2
  const mw = w - s * 2
  if (cw <= 0 || mw < 0) return

  ctx.drawImage(img, 0, 0, s, ih, x, y, s, ih)
  ctx.drawImage(img, iw - s, 0, s, ih, x + w - s, y, s, ih)
  for (let dx = 0; dx < mw; dx += cw) {
    const tw = Math.min(cw, mw - dx)
    ctx.drawImage(img, s, 0, tw, ih, x + s + dx, y, tw, ih)
  }
}
