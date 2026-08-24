import { useEffect, useState } from 'react'

export interface Memory {
  id: string
  icon: string
  text: string
  en?: string
}

export interface AlbumTitles {
  成长: string
  回忆: string
  画画: string
}

const DEFAULT_TITLES: AlbumTitles = { 成长: '我长大', 回忆: '我们一起', 画画: '我画的' }

// 相册的文字全部来自 /content/album.json。读不到就没有相册条目,游戏照常玩
export function useAlbum() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [titles, setTitles] = useState<AlbumTitles>(DEFAULT_TITLES)

  useEffect(() => {
    fetch('/content/album.json')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.回忆)) setMemories(data.回忆)
        if (data?.标题) setTitles({ ...DEFAULT_TITLES, ...data.标题 })
      })
      .catch(() => {})
  }, [])

  return { memories, titles }
}
