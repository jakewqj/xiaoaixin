import { useEffect, useState } from 'react'
import { loadDrawing } from '../lib/drawings'

// 把 IndexedDB 里的画变成渲染层能用的图片路径(ROADMAP S2-4)。
//
// 渲染层只按路径要图(render/assets.ts 的第一句),不认识 IndexedDB,也不该认识 ——
// 素材是可替换资源(CLAUDE.md 五/十三)。所以这里把 blob 转成 object URL,
// 让童童的画和 /assets/ 下的 PNG 走同一条加载路径。
//
// 读不到的 id 就是没有这一项:不抛错、不占位、不把 id 从存档里删掉
// (原则 10:她画的东西永远不消失 —— 读不出来可能只是数据库这会儿打不开)。

export function useDrawingUrls(ids: readonly string[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  // 依赖用拼好的字符串,不用数组本身 —— 每次 App 重渲染都会新建一个数组,
  // 拿数组当依赖会导致每帧都重新加载一遍
  const key = ids.join('|')

  useEffect(() => {
    let alive = true
    const made: string[] = []
    const wanted = key ? key.split('|') : []

    void (async () => {
      const pairs: [string, string][] = []
      for (const id of wanted) {
        const blob = await loadDrawing(id)
        if (!alive) break
        if (!blob) continue
        const url = URL.createObjectURL(blob)
        made.push(url)
        pairs.push([id, url])
      }
      if (!alive) return
      setUrls(Object.fromEntries(pairs))
    })()

    return () => {
      alive = false
      // 换一批就把上一批撤掉。不撤的话每次挂新画都漏一个 blob,
      // 而一张画是几百 KB —— 玩一下午能漏出几十 MB
      for (const url of made) URL.revokeObjectURL(url)
    }
  }, [key])

  return urls
}
