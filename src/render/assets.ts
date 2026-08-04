// 图片预载与缓存。渲染层只按路径要图,不关心怎么来的 —— 素材是可替换资源(CLAUDE.md 五/十三),
// 路径来自 pet.json / npc.json / 常量,这里不许出现任何硬编码的图形绘制
//
// 加载失败一律静默降级:拿不到就返回 null,调用方跳过这一层继续画。
// 绝不白屏 —— 孩子看不懂 error(CLAUDE.md 十四同款要求)

const cache = new Map<string, HTMLImageElement>()
const pending = new Map<string, Promise<HTMLImageElement | null>>()
const failed = new Set<string>()

function loadOne(src: string): Promise<HTMLImageElement | null> {
  const existing = pending.get(src)
  if (existing) return existing

  const task = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => {
      cache.set(src, img)
      resolve(img)
    }
    img.onerror = () => {
      failed.add(src)
      resolve(null)
    }
    img.src = src
  })

  pending.set(src, task)
  return task
}

/** 预载一批图。返回加载失败的路径,调用方可以打日志但不该因此中断 */
export async function preload(srcs: readonly string[]): Promise<string[]> {
  const results = await Promise.all(srcs.map((src) => loadOne(src).then((img) => (img ? null : src))))
  return results.filter((src): src is string => src !== null)
}

/** 取一张已经载好的图。没载好就返回 null —— 调用方跳过,不要等 */
export function get(src: string): HTMLImageElement | null {
  return cache.get(src) ?? null
}

export function isFailed(src: string): boolean {
  return failed.has(src)
}
