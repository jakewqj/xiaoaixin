import { useEffect, useState } from 'react'
import Sprite from './Sprite'
import NpcDialogue from './NpcDialogue'
import { frameSizeOf } from '../hooks/useNpcs'
import type { NpcSpec, NpcTopic } from '../hooks/useNpcs'

// 选中一个选项之后開心一下的时长。没有 happy 动画的邻居就不会有这个反应
const REACT_MS = 1800

interface NpcProps {
  npc: NpcSpec
  // 地点里的大致落点(那个地点占的 480 宽范围内的百分比),互动点还没有真坐标,先给个合理位置
  leftPercent: number
}

// 邻居:idle 待机,点一下从话题库第 1 级里随机挑一句开口。选中任何一个选项都关掉对话,
// 有 happy 动画的话短暂切过去当反应——熟悉度解锁更高级话题是 1-5 的事,这里先只用第 1 级
function Npc({ npc, leftPercent }: NpcProps) {
  const [topic, setTopic] = useState<NpcTopic | null>(null)
  const [reacting, setReacting] = useState(false)
  const [frameWidth, frameHeight] = frameSizeOf(npc)

  useEffect(() => {
    if (!reacting) return
    const timer = setTimeout(() => setReacting(false), REACT_MS)
    return () => clearTimeout(timer)
  }, [reacting])

  const pool = npc.话题库?.['1'] ?? []
  const animKey = reacting && npc.动画.happy ? 'happy' : 'idle'
  const anim = npc.动画[animKey]
  if (!anim) return null

  function handleTapSprite() {
    if (topic) {
      setTopic(null)
      return
    }
    if (pool.length === 0) return
    setTopic(pool[Math.floor(Math.random() * pool.length)])
  }

  function handleChoose() {
    setTopic(null)
    if (npc.动画.happy) setReacting(true)
  }

  return (
    <div className="absolute bottom-20 -translate-x-1/2" style={{ left: `${leftPercent}%` }}>
      {topic && <NpcDialogue npc={npc} topic={topic} onChoose={handleChoose} />}
      <button
        type="button"
        onClick={handleTapSprite}
        aria-label={npc.名字}
        className="pointer-events-auto block min-h-14 min-w-14 cursor-pointer"
      >
        <Sprite
          src={`${npc.精灵}${anim.文件}`}
          frameWidth={frameWidth}
          frameHeight={frameHeight}
          frameCount={anim.帧数}
          fps={anim.fps}
        />
      </button>
    </div>
  )
}

export default Npc
