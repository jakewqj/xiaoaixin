import { useCallback, useEffect, useMemo, useState } from 'react'
import Ocean from './components/Ocean'
import Pet from './components/Pet'
import type { PoseName } from './components/Pet'
import Dialogue from './components/Dialogue'
import FullnessMeter from './components/FullnessMeter'
import FeedButton from './components/FeedButton'
import KnowledgeCard from './components/KnowledgeCard'
import SeagrassBed from './components/Seagrass'
import PlantButton from './components/PlantButton'
import Book from './components/Book'
import BookButton from './components/BookButton'
import {
  BED_LIMIT,
  clarityOf,
  countGrown,
  plantSeagrass,
} from './lib/seagrass'
import { useSave, MAX_FULLNESS, HUNGER_STEP_MS } from './hooks/useSave'
import { useBreath } from './hooks/useBreath'
import { useDialogue } from './hooks/useDialogue'
import type { DialogueOption } from './hooks/useDialogue'
import { useKnowledge } from './hooks/useKnowledge'
import type { KnowledgeCardData } from './hooks/useKnowledge'
import { playSfx } from './lib/sfx'

const POSE_MS = 2500
const CARD_MS = 15000
const DAY_MS = 24 * 60 * 60 * 1000
const WELCOME_BACK_DAYS = 3

// 由条件触发的场景。greet_reply 是顺着选项的 next 过来的,不在这里
const TRIGGERED = ['greet_first', 'welcome_back', 'need_air', 'hungry']

function App() {
  // 存档只在这里持有一份,后面的相册也从这里往下传
  const { save, update, awayMs } = useSave()
  const breath = useBreath()
  const scenes = useDialogue()
  const knowledge = useKnowledge()

  const [pose, setPose] = useState<PoseName>('idle')
  const [sceneId, setSceneId] = useState<string | null>(null)
  const [answered, setAnswered] = useState<string[]>([])
  const [card, setCard] = useState<KnowledgeCardData | null>(null)
  // 不用路由库,页面切换就是一个状态
  const [page, setPage] = useState<'sea' | 'book'>('sea')

  const grownCount = countGrown(save.seagrass)
  const clarity = clarityOf(save.seagrass)

  // 摆一会儿姿势就回到平时的样子
  useEffect(() => {
    if (pose === 'idle') return
    const timer = setTimeout(() => setPose('idle'), POSE_MS)
    return () => clearTimeout(timer)
  }, [pose])

  useEffect(() => {
    const timer = setInterval(() => {
      update((prev) => ({ fullness: Math.max(0, prev.fullness - 1) }))
    }, HUNGER_STEP_MS)
    return () => clearInterval(timer)
  }, [update])

  // 触发条件按 dialogue.json 里「触发」字段的描述接,排在前面的先说。
  // seagrass_grown(海草长成)要等第 3 周的海草床,到时候在这里加一行就通了
  const activeScenes = useMemo(() => {
    const ids: string[] = []
    if (!save.seenScenes.includes('greet_first')) ids.push('greet_first')
    if (awayMs >= WELCOME_BACK_DAYS * DAY_MS) ids.push('welcome_back')
    if (breath.phase === 'waiting') ids.push('need_air')
    if (grownCount > save.grownSeen) ids.push('seagrass_grown')
    if (save.fullness === 0) ids.push('hungry')
    return ids
  }, [save.seenScenes, save.fullness, save.grownSeen, grownCount, awayMs, breath.phase])

  // 条件消失了就把「已经答过」的记录抹掉,下次条件再成立时它还会说
  useEffect(() => {
    setAnswered((prev) => {
      const kept = prev.filter((id) => activeScenes.includes(id))
      return kept.length === prev.length ? prev : kept
    })
  }, [activeScenes])

  useEffect(() => {
    if (sceneId) return
    const next = activeScenes.find((id) => !answered.includes(id) && scenes[id])
    if (next) setSceneId(next)
  }, [activeScenes, answered, sceneId, scenes])

  // 条件自己不成立了就把气泡收起来。比如她没点选项,而是直接去戳小爱心把气换了
  useEffect(() => {
    if (!sceneId || !TRIGGERED.includes(sceneId)) return
    if (activeScenes.includes(sceneId)) return
    setSceneId(null)
  }, [sceneId, activeScenes])

  // 卡片自己会走,不需要她做任何事。看不看都行
  useEffect(() => {
    if (!card) return
    const timer = setTimeout(() => setCard(null), CARD_MS)
    return () => clearTimeout(timer)
  }, [card])

  // 给一张知识卡,同时记下时间用于 24 小时冷却。没有可给的就返回 false
  const showCard = useCallback(
    (next?: KnowledgeCardData) => {
      if (!next) return false
      setCard(next)
      update((prev) => ({
        knowledgeSeen: {
          ...prev.knowledgeSeen,
          [next.id]: new Date().toISOString(),
        },
      }))
      return true
    },
    [update],
  )

  // 帮它换完气之后,有小概率主动说一句相关的知识。
  // 放在这里而不是 effect 里:换气完成是一次事件,不是一个持续状态,effect 会重复触发
  const handleBreathe = useCallback(() => {
    const finishing = breath.phase === 'waiting'
    breath.nudge()
    if (finishing) {
      showCard(knowledge.pickByEvent('换气后', save.knowledgeSeen))
    }
  }, [breath, showCard, knowledge, save.knowledgeSeen])

  // 喂一次涨一格。已经吃饱了再喂也照样有反应,只是格子不再涨。
  // 吃的是长成的海草,但不会把它吃没 —— 儒艮啃过的海草会自己长回来,
  // 而且「没海草可喂」会变成一个卡住她的失败态
  const feed = useCallback(() => {
    setPose('eating')
    playSfx('eat')
    update((prev) => ({ fullness: Math.min(MAX_FULLNESS, prev.fullness + 1) }))
    showCard(knowledge.pickByEvent('喂食后', save.knowledgeSeen))
  }, [update, showCard, knowledge, save.knowledgeSeen])

  // 种一棵新芽。种满了就只是种满了,按下去照样有反应
  const plant = useCallback(() => {
    playSfx('plant')
    update((prev) =>
      prev.seagrass.length >= BED_LIMIT
        ? {}
        : { seagrass: [...prev.seagrass, plantSeagrass()] },
    )
    showCard(knowledge.pickByEvent('种海草后', save.knowledgeSeen))
  }, [update, showCard, knowledge, save.knowledgeSeen])

  // 选项动作。第 3 周才有的海草床先不接,选了它只是把气泡收起来 ——
  // 宁可什么都不发生,也不临时编一个机制出来
  function chooseOption(option: DialogueOption) {
    switch (option.action) {
      case 'feed':
      case 'goto_feed':
        feed()
        break
      case 'breathe':
      case 'goto_breathe':
        handleBreathe()
        break
      case 'hug':
        setPose('happy')
        break
      case 'sleep':
        setPose('sleeping')
        break
    }

    if (sceneId === 'greet_first') {
      update((prev) =>
        prev.seenScenes.includes('greet_first')
          ? {}
          : { seenScenes: [...prev.seenScenes, 'greet_first'] },
      )
    }

    // 「海草长大啦」说过就记下来,下次只有再多长一棵才会再说
    if (sceneId === 'seagrass_grown') {
      update({ grownSeen: grownCount })
    }

    if (option.next && scenes[option.next]) {
      setSceneId(option.next)
      return
    }

    const current = sceneId
    if (current) {
      setAnswered((prev) => (prev.includes(current) ? prev : [...prev, current]))
    }
    setSceneId(null)
  }

  const scene = sceneId ? scenes[sceneId] : undefined

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Ocean clarity={clarity} />
      <SeagrassBed
        bed={save.seagrass}
        onTap={() => showCard(knowledge.pickByEvent('点海草', save.knowledgeSeen))}
      />
      <Pet
        pose={pose}
        breath={breath.phase}
        talking={Boolean(scene)}
        anchors={knowledge.anchors}
        onBreathe={handleBreathe}
        onAnchorTap={(anchor) =>
          showCard(knowledge.pickByAnchor(anchor, save.knowledgeSeen))
        }
      >
        {scene && <Dialogue scene={scene} onChoose={chooseOption} />}
      </Pet>
      {card && <KnowledgeCard card={card} onDismiss={() => setCard(null)} />}
      {page === 'sea' && (
        <>
          <BookButton onOpen={() => setPage('book')} />
          {/* 这条横栏铺满整个屏幕宽度,必须让空白处透过点击 ——
              否则它会把左右下角的按钮和海草床整片挡住 */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 pb-5">
            <FullnessMeter value={save.fullness} />
            <div className="pointer-events-auto flex items-end gap-3">
              {grownCount > 0 && <FeedButton onFeed={feed} />}
              <PlantButton onPlant={plant} />
            </div>
          </div>
        </>
      )}
      {page === 'book' && (
        <Book
          cards={knowledge.bookCards(save.knowledgeSeen)}
          onClose={() => setPage('sea')}
        />
      )}
    </main>
  )
}

export default App
