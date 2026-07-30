import { useCallback, useEffect, useMemo, useState } from 'react'
import ScreenFrame, { STAGE_WIDTH } from './components/ScreenFrame'
import Scene from './components/Scene'
import GameHud from './components/GameHud'
import Pet, { EAT_MS } from './components/Pet'
import type { PoseName } from './components/Pet'
import Dialogue from './components/Dialogue'
import FullnessMeter from './components/FullnessMeter'
import FeedButton from './components/FeedButton'
import KnowledgeCard from './components/KnowledgeCard'
import SeagrassBed from './components/Seagrass'
import PlantButton from './components/PlantButton'
import Book from './components/Book'
import BookButton from './components/BookButton'
import Album from './components/Album'
import AlbumButton from './components/AlbumButton'
import SeaButton from './components/SeaButton'
import SeaPicker from './components/SeaPicker'
import LocationNav from './components/LocationNav'
import {
  BED_LIMIT,
  clarityOf,
  countGrown,
  plantSeagrass,
} from './lib/seagrass'
import { SEAS, seaById, SEA_CARD_EVENTS } from './lib/seas'
import { currentStage, isHanddrawn, stagesReached } from './lib/pet'
import { useSave, MAX_FULLNESS, HUNGER_STEP_MS } from './hooks/useSave'
import { usePet } from './hooks/usePet'
import { useBreath } from './hooks/useBreath'
import { useDialogue } from './hooks/useDialogue'
import type { DialogueOption } from './hooks/useDialogue'
import { useKnowledge } from './hooks/useKnowledge'
import type { KnowledgeCardData } from './hooks/useKnowledge'
import { useAlbum } from './hooks/useAlbum'
import { useWorld } from './hooks/useWorld'
import { useConfig } from './hooks/useConfig'
import { useNpcs } from './hooks/useNpcs'
import Npc from './components/Npc'
import { playSfx } from './lib/sfx'

const POSE_MS = 2500
const CARD_MS = 15000
const DAY_MS = 24 * 60 * 60 * 1000
const WELCOME_BACK_DAYS = 3

// 由条件触发的场景。greet_reply 是顺着选项的 next 过来的,不在这里
const TRIGGERED = [
  'greet_first',
  'handdrawn',
  'welcome_back',
  'grow_up',
  'need_air',
  'hungry',
]

function App() {
  // 存档只在这里持有一份,相册也从这里往下传
  const { save, update, awayMs } = useSave()
  const pet = usePet()
  const breath = useBreath()
  const scenes = useDialogue()
  const knowledge = useKnowledge()
  const album = useAlbum()

  const [pose, setPose] = useState<PoseName>('idle')
  const [sceneId, setSceneId] = useState<string | null>(null)
  const [answered, setAnswered] = useState<string[]>([])
  const [card, setCard] = useState<KnowledgeCardData | null>(null)
  // 不用路由库,页面切换就是一个状态
  const [page, setPage] = useState<'sea' | 'book' | 'album'>('sea')
  const [seaPickerOpen, setSeaPickerOpen] = useState(false)

  const grownCount = countGrown(save.seagrass)
  const clarity = clarityOf(save.seagrass)
  const stage = currentStage(pet.spec, save.daysPlayed)
  const stages = stagesReached(pet.spec, save.daysPlayed)
  const sea = seaById(save.sea)

  const world = useWorld()
  const config = useConfig()
  const [locationIndex, setLocationIndex] = useState(0)

  // world.json 的海域用中文名当 key,seas.ts 的 sea.name 正好是同一个字符串,靠它对上
  const allSpots = world?.海域[sea.name]?.地点 ?? []
  // config 还没加载完之前先当作一个地点都没开放,免得先闪出一整排、加载完又收回去
  const openSpots = config ? allSpots.filter((spot) => config.开放地点.includes(spot.名字)) : []
  const locationNames = openSpots.length > 0 ? openSpots.map((spot) => spot.名字) : ['']
  // 假定 config 里开放的地点是 world.json 地点列表的一段前缀,这是当前唯一一份内容数据的实际排法
  const lockedBeyondEnd = openSpots.length > 0 && allSpots.length > openSpots.length

  // 换了一片海,地点索引要归零,不然可能指向一个不存在的地点
  useEffect(() => {
    setLocationIndex(0)
  }, [save.sea])

  // 地点数变少了(比如后台关掉了一个)就把索引拉回有效范围
  useEffect(() => {
    setLocationIndex((prev) => Math.min(prev, Math.max(0, locationNames.length - 1)))
  }, [locationNames.length])

  const npcs = useNpcs()
  const currentSpotId = openSpots[locationIndex]?.id
  // 只有「开放NPC」里点了名、又刚好住在当前这个地点的邻居才会出现
  const visibleNpcs =
    npcs && config
      ? Object.entries(npcs).filter(
          ([id, npc]) => npc.地点 === currentSpotId && config.开放NPC.some((n) => n.id === id),
        )
      : []

  // 摆一会儿姿势就回到平时的样子。进食要沉下去啃一会儿,时间给得长一些
  useEffect(() => {
    if (pose === 'idle') return
    const timer = setTimeout(() => setPose('idle'), pose === 'eating' ? EAT_MS : POSE_MS)
    return () => clearTimeout(timer)
  }, [pose])

  useEffect(() => {
    const timer = setInterval(() => {
      update((prev) => ({ fullness: Math.max(0, prev.fullness - 1) }))
    }, HUNGER_STEP_MS)
    return () => clearInterval(timer)
  }, [update])

  // 把一件事记进相册。已经记过的不再覆盖 —— 相册记的是第一次,不是最近一次
  const remember = useCallback(
    (id: string, at?: string) => {
      update((prev) =>
        prev.albumEvents[id]
          ? {}
          : {
              albumEvents: {
                ...prev.albumEvents,
                [id]: at ?? new Date().toISOString(),
              },
            },
      )
    },
    [update],
  )

  // 相册的第一页永远是认识那天。老存档也补得上 —— 用的是存档建立的时间
  useEffect(() => {
    update((prev) =>
      prev.albumEvents.first_meet
        ? {}
        : { albumEvents: { ...prev.albumEvents, first_meet: prev.createdAt } },
    )
  }, [update])

  // 存档第一次见到成长阶段时,先把当前阶段悄悄记下来。
  // 不然老存档一打开就会冒出一句「我长大一点了」—— 那一刻其实什么都没发生
  useEffect(() => {
    if (!pet.spec) return
    update((prev) =>
      prev.stageSeen === ''
        ? { stageSeen: currentStage(pet.spec, prev.daysPlayed).id }
        : {},
    )
  }, [pet.spec, update])

  // 触发条件按 dialogue.json 里「触发」字段的描述接,排在前面的先说
  const activeScenes = useMemo(() => {
    const ids: string[] = []
    if (!save.seenScenes.includes('greet_first')) ids.push('greet_first')
    // 手稿换上去之后只认一次,认完就记进相册,以后不再提
    if (isHanddrawn(pet.spec) && !save.albumEvents.handdrawn) ids.push('handdrawn')
    if (awayMs >= WELCOME_BACK_DAYS * DAY_MS) ids.push('welcome_back')
    if (save.stageSeen !== '' && save.stageSeen !== stage.id) ids.push('grow_up')
    if (breath.phase === 'waiting') ids.push('need_air')
    if (grownCount > save.grownSeen) ids.push('seagrass_grown')
    if (save.fullness === 0) ids.push('hungry')
    return ids
  }, [
    save.seenScenes,
    save.fullness,
    save.grownSeen,
    save.stageSeen,
    save.albumEvents.handdrawn,
    stage.id,
    pet.spec,
    grownCount,
    awayMs,
    breath.phase,
  ])

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
      remember('first_breath')
      showCard(knowledge.pickByEvent('换气后', save.knowledgeSeen))
    }
  }, [breath, showCard, knowledge, save.knowledgeSeen, remember])

  // 喂一次涨一格。已经吃饱了再喂也照样有反应,只是格子不再涨。
  // 吃的是长成的海草,但不会把它吃没 —— 儒艮啃过的海草会自己长回来,
  // 而且「没海草可喂」会变成一个卡住她的失败态
  const feed = useCallback(() => {
    setPose('eating')
    playSfx('eat')
    update((prev) => ({ fullness: Math.min(MAX_FULLNESS, prev.fullness + 1) }))
    remember('first_feed')
    showCard(knowledge.pickByEvent('喂食后', save.knowledgeSeen))
  }, [update, showCard, knowledge, save.knowledgeSeen, remember])

  // 种一棵新芽。种满了就只是种满了,按下去照样有反应
  const plant = useCallback(() => {
    playSfx('plant')
    update((prev) =>
      prev.seagrass.length >= BED_LIMIT
        ? {}
        : { seagrass: [...prev.seagrass, plantSeagrass()] },
    )
    remember('first_plant')
    showCard(knowledge.pickByEvent('种海草后', save.knowledgeSeen))
  }, [update, showCard, knowledge, save.knowledgeSeen, remember])

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
      remember('first_grown')
    }

    // 陪她长大的那一天记进相册,并且这一次一定给一张关于长大的知识卡 ——
    // 这种时刻一辈子只有几次,不该靠掷骰子
    if (sceneId === 'grow_up') {
      update({ stageSeen: stage.id })
      remember(`grow_${stage.id}`)
      showCard(knowledge.pickByEvent('长大后', save.knowledgeSeen, true))
    }

    // 手稿仪式:认出这是童童画的,记进相册,以后不再提
    if (sceneId === 'handdrawn') {
      remember('handdrawn')
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

  // 换一片海:只换风景,海草床、饱腹度、换气都不动。第一次去某片海记进相册,
  // 并且一定给一张那片海的知识卡 —— 这种第一次不该靠掷骰子
  const pickSea = useCallback(
    (id: string) => {
      setSeaPickerOpen(false)
      if (id === save.sea) return
      update({ sea: id })
      remember(`visit_${id}`)
      const event = SEA_CARD_EVENTS[id]
      if (event) showCard(knowledge.pickByEvent(event, save.knowledgeSeen, true))
    },
    [save.sea, save.knowledgeSeen, update, remember, showCard, knowledge],
  )

  return (
    <>
      <ScreenFrame>
        <Scene
          sea={sea}
          clarity={clarity}
          surfaced={breath.atSurface}
          locationNames={locationNames}
          locationIndex={locationIndex}
          lockedBeyondEnd={lockedBeyondEnd}
          actors={
            // 世界横条一格是一个地点、宽度是 STAGE_WIDTH 的整数倍;这个包装 div 卡在
            // 当前地点那一格,小爱心跟着她去哪个地点就到哪一格的正中间。
            // 海草床固定长在「家海草床」,不跟她走到别的地点去
            <div className="absolute inset-y-0" style={{ left: locationIndex * STAGE_WIDTH, width: STAGE_WIDTH }}>
              {locationIndex === 0 && (
                <SeagrassBed
                  bed={save.seagrass}
                  onTap={() => showCard(knowledge.pickByEvent('点海草', save.knowledgeSeen))}
                />
              )}
              {visibleNpcs.map(([id, npc], i) => (
                <Npc key={id} npc={npc} leftPercent={65 + i * 15} />
              ))}
              <Pet
                pet={pet}
                stage={stage}
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
            </div>
          }
          hud={
            <>
              {/* 月相和潮汐还没有真的算,先占位;第几天是存档里现成的真数据。见 S4「时间系统」 */}
              <GameHud
                day={save.daysPlayed}
                moonPhase="满月"
                tide="涨潮中"
                grownSeagrass={grownCount}
              />
              {card && <KnowledgeCard card={card} onDismiss={() => setCard(null)} />}
              {page === 'sea' && openSpots.length > 1 && (
                <LocationNav
                  name={locationNames[locationIndex]}
                  canPrev={locationIndex > 0}
                  canNext={locationIndex < locationNames.length - 1}
                  onPrev={() => setLocationIndex((i) => Math.max(0, i - 1))}
                  onNext={() => setLocationIndex((i) => Math.min(locationNames.length - 1, i + 1))}
                />
              )}
              {page === 'sea' && (
                <>
                  <AlbumButton onOpen={() => setPage('album')} />
                  <BookButton onOpen={() => setPage('book')} />
                  <SeaButton onOpen={() => setSeaPickerOpen(true)} />
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
            </>
          }
        />
      </ScreenFrame>
      {page === 'book' && (
        <Book
          cards={knowledge.bookCards(save.knowledgeSeen)}
          onClose={() => setPage('sea')}
        />
      )}
      {page === 'album' && (
        <Album
          pet={pet}
          stages={stages}
          memories={album.memories}
          titles={album.titles}
          events={save.albumEvents}
          metAt={save.createdAt}
          onClose={() => setPage('sea')}
        />
      )}
      {seaPickerOpen && (
        <SeaPicker
          seas={SEAS}
          current={sea.id}
          onPick={pickSea}
          onClose={() => setSeaPickerOpen(false)}
        />
      )}
    </>
  )
}

export default App
