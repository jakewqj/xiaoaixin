import { useEffect, useState } from 'react'

export interface DialogueOption {
  icon: string
  label: string
  next?: string
  action?: string
}

export interface DialogueScene {
  id: string
  text: string
  en?: string
  options: DialogueOption[]
}

// 台词全部来自 /content/dialogue.json,代码里一句都不写。读不到就没有对话,游戏照常玩
export function useDialogue() {
  const [scenes, setScenes] = useState<Record<string, DialogueScene>>({})

  useEffect(() => {
    fetch('/content/dialogue.json')
      .then((res) => res.json())
      .then((data) => {
        const list: DialogueScene[] = Array.isArray(data?.场景) ? data.场景 : []
        setScenes(Object.fromEntries(list.map((scene) => [scene.id, scene])))
      })
      .catch(() => {})
  }, [])

  return scenes
}
