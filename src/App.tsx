import { useCallback, useEffect, useMemo, useState } from 'react'
import ScreenFrame, { STAGE_WIDTH } from './components/ScreenFrame'
import Scene from './components/Scene'
import GameHud from './components/GameHud'
import Pet, { EAT_MS } from './components/Pet'
import type { PoseName } from './components/Pet'
import DialoguePanel from './components/DialoguePanel'
import type { PanelContent } from './components/DialoguePanel'
import FullnessMeter from './components/FullnessMeter'
import KnowledgeCard from './components/KnowledgeCard'
import SeagrassBed from './components/Seagrass'
import Book from './components/Book'
import Album from './components/Album'
import ActionBar from './components/ActionBar'
import SeaPicker from './components/SeaPicker'
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
import { useNpcs, unlockedTopics } from './hooks/useNpcs'
import type { NpcSpec, NpcTopic } from './hooks/useNpcs'
import { usePetSwim } from './hooks/usePetSwim'
import Npc from './components/Npc'
import AdminGate from './components/AdminGate'
import AdminPanel from './components/AdminPanel'
import { useDialogueLog } from './hooks/useDialogueLog'
import { playSfx } from './lib/sfx'
import HUD from './ui/HUD'
import { UI_DIR } from './ui/layout'
import type { HudSnapshot, SlotSpec } from './ui/types'

const POSE_MS = 2500
const CARD_MS = 15000
const DAY_MS = 24 * 60 * 60 * 1000
const WELCOME_BACK_DAYS = 3

// 由条件触发的场景。greet_reply 是顺着选项的 next 过来的,不在这里。
// 饿了/要换气不再走这里的文字气泡——分别换成了 FullnessMeter 和小爱心自己的「屏息」姿势,
// 靠视觉就看得出来,不用再读一句话
const TRIGGERED = ['greet_first', 'handdrawn', 'welcome_back', 'grow_up']

// 新旧 HUD 双轨:默认走 canvas 九宫格层,加 ?hud=dom 退回旧的 DOM 版对比。
// REFACTOR_PLAN 阶段 4「拆掉旧渲染」时把这个开关和旧组件一起删掉
const legacyHud =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('hud') === 'dom'

// 选中一个选项之后開心一下的时长。没有 happy 动画的邻居就不会有这个反应
const NPC_REACT_MS = 1800
// 送礼的反馈比普通反应停久一点,够她看完再消失(也可以直接点一下提前收起)
const GIFT_REPLY_MS = 3000

// 没有真的礼物道具,送出去的是已经长成的海草。npc.json 大部分邻居还没填「礼物反馈」,
// 给个通用兜底,不因为缺数据就哑掉
const FALLBACK_GIFT_TEXT: Record<'很喜欢' | '谢谢你', string> = {
  很喜欢: '谢谢你,我很喜欢!',
  谢谢你: '谢谢你!',
}

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
  // 邻居这边唯一的一份对话状态,和 sceneId 共用同一个道理:同一时刻只可能有一份内容在说话,
  // 从根上不会出现小爱心和邻居同时弹出两个对话框——见 ROADMAP 已知坑「对话没有互斥」
  const [npcTalk, setNpcTalk] = useState<{
    npcId: string
    topic: NpcTopic
    isGift: boolean
  } | null>(null)
  const [reactingNpc, setReactingNpc] = useState<string | null>(null)
  const [answered, setAnswered] = useState<string[]>([])
  const [card, setCard] = useState<KnowledgeCardData | null>(null)
  // 不用路由库,页面切换就是一个状态
  const [page, setPage] = useState<'sea' | 'book' | 'album' | 'admin'>('sea')
  const [seaPickerOpen, setSeaPickerOpen] = useState(false)
  const [adminGateOpen, setAdminGateOpen] = useState(false)

  const grownCount = countGrown(save.seagrass)
  const clarity = clarityOf(save.seagrass)
  const stage = currentStage(pet.spec, save.daysPlayed)
  const stages = stagesReached(pet.spec, save.daysPlayed)
  const sea = seaById(save.sea)

  const world = useWorld()
  const { config, update: updateConfig, reset: resetConfig, resetToOnlyPet } = useConfig()

  // world.json 的海域用中文名当 key,seas.ts 的 sea.name 正好是同一个字符串,靠它对上
  const allSpots = world?.海域[sea.name]?.地点 ?? []
  // config 还没加载完之前先当作一个地点都没开放,免得先闪出一整排、加载完又收回去
  const openSpots = config ? allSpots.filter((spot) => config.开放地点.includes(spot.名字)) : []
  // 假定 config 里开放的地点是 world.json 地点列表的一段前缀,这是当前唯一一份内容数据的实际排法
  const lockedBeyondEnd = openSpots.length > 0 && allSpots.length > openSpots.length

  // 世界横条:一格一个地点。地点切换没有按钮了——点哪游哪,她自己游过去,镜头跟着
  const slotCount = Math.max(1, openSpots.length)
  const worldWidth = slotCount * STAGE_WIDTH
  const petSwim = usePetSwim(worldWidth)
  const cameraX = Math.max(0, Math.min(worldWidth - STAGE_WIDTH, petSwim.x - STAGE_WIDTH / 2))

  const npcs = useNpcs()
  const { entries: logEntries, log: logDialogue } = useDialogueLog(config?.后台.对话日志上限)
  // 「开放NPC」里点了名、住的地点也开放了的邻居,按她住的那格摆进世界
  const placedNpcs =
    npcs && config
      ? Object.entries(npcs).flatMap(([id, npc]) => {
          if (!config.开放NPC.some((n) => n.id === id)) return []
          const spotIndex = openSpots.findIndex((spot) => spot.id === npc.地点)
          if (spotIndex < 0) return []
          return [{ id, npc, spotIndex }]
        })
      : []

  // 熟悉度只增不减、每天最多涨一级。上限读 config.json 的「开放NPC」,不在里面就按 5 算
  const bumpFamiliarity = useCallback(
    (npcId: string, cap: number) => {
      const today = new Date().toDateString()
      update((prev) => {
        if (prev.familiarityLastAt[npcId] === today) return {}
        const level = prev.familiarity[npcId] ?? 0
        return {
          familiarity:
            level >= cap ? prev.familiarity : { ...prev.familiarity, [npcId]: level + 1 },
          familiarityLastAt: { ...prev.familiarityLastAt, [npcId]: today },
        }
      })
    },
    [update],
  )

  // 送礼:每个邻居每天只能送 1 次,礼物是已经长成的海草——不消耗数量,和喂食一个道理。
  // 送礼也走熟悉度的每日一涨规则,和聊天共用同一个「今天涨过了没」
  const giveGift = useCallback(
    (npcId: string, cap: number) => {
      const today = new Date().toDateString()
      update((prev) => ({ giftedAt: { ...prev.giftedAt, [npcId]: today } }))
      bumpFamiliarity(npcId, cap)
    },
    [update, bumpFamiliarity],
  )

  // 点了这个邻居:她自己在说话就当作把话收起;小爱心或另一个邻居正在说话就不理这次点击;
  // 都没有就从她熟悉度解锁的话题库里随机挑一句
  function handleNpcTapSprite(id: string, npc: NpcSpec, level: number) {
    if (npcTalk?.npcId === id) {
      setNpcTalk(null)
      return
    }
    if (sceneId || npcTalk) return
    const pool = unlockedTopics(npc, level)
    if (pool.length === 0) return
    setNpcTalk({ npcId: id, topic: pool[Math.floor(Math.random() * pool.length)], isGift: false })
  }

  function handleNpcChoose(id: string, npc: NpcSpec, cap: number, option: { text: string; icon: string }) {
    setNpcTalk(null)
    if (npc.动画.happy) setReactingNpc(id)
    bumpFamiliarity(id, cap)
    logDialogue(id, npc.名字, option.text)
  }

  function handleNpcGift(id: string, npc: NpcSpec, cap: number) {
    const tier: '很喜欢' | '谢谢你' = Math.random() < 0.5 ? '很喜欢' : '谢谢你'
    const reaction = npc.礼物反馈?.[tier] ?? { text: FALLBACK_GIFT_TEXT[tier] }
    setNpcTalk({ npcId: id, topic: { id: `gift_${tier}`, say: reaction.text }, isGift: true })
    if (npc.动画.happy) setReactingNpc(id)
    giveGift(id, cap)
  }

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
    if (grownCount > save.grownSeen) ids.push('seagrass_grown')
    return ids
  }, [
    save.seenScenes,
    save.grownSeen,
    save.stageSeen,
    save.albumEvents.handdrawn,
    stage.id,
    pet.spec,
    grownCount,
    awayMs,
  ])

  // 条件消失了就把「已经答过」的记录抹掉,下次条件再成立时它还会说
  useEffect(() => {
    setAnswered((prev) => {
      const kept = prev.filter((id) => activeScenes.includes(id))
      return kept.length === prev.length ? prev : kept
    })
  }, [activeScenes])

  useEffect(() => {
    // 邻居正在说话就先不冒出来,等她把那边关掉——两边共用「同一时刻只能有一个」这条底线
    if (sceneId || npcTalk) return
    const next = activeScenes.find((id) => !answered.includes(id) && scenes[id])
    if (next) setSceneId(next)
  }, [activeScenes, answered, sceneId, npcTalk, scenes])

  // 反应动画自己会停
  useEffect(() => {
    if (!reactingNpc) return
    const timer = setTimeout(() => setReactingNpc(null), NPC_REACT_MS)
    return () => clearTimeout(timer)
  }, [reactingNpc])

  // 送礼的反馈自己会走,不用她做任何事;当然也能直接点一下提前收起(DialoguePanel 的点击收起逻辑)
  useEffect(() => {
    if (!npcTalk?.isGift) return
    const timer = setTimeout(() => setNpcTalk(null), GIFT_REPLY_MS)
    return () => clearTimeout(timer)
  }, [npcTalk])

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

  // ---- 新 HUD(canvas 九宫格层)----------------------------------------
  // 灰格子的提示。自己会消失,不用她点第二下
  const [hudTip, setHudTip] = useState<string | null>(null)
  useEffect(() => {
    if (!hudTip) return
    const timer = setTimeout(() => setHudTip(null), 2200)
    return () => clearTimeout(timer)
  }, [hudTip])

  // 推给 canvas 的一份快照。季节/月相/潮汐还没有真的算,先占位;
  // 天数、贝壳、海草棵数是存档里现成的真数据。见 ROADMAP S4「潮汐与月亮」
  const hudSnapshot: HudSnapshot = useMemo(() => {
    const slots: SlotSpec[] = [
      // 第一排 = 道具栏,永远不超过 4 格(CLAUDE.md 十六)
      { id: 'shell', icon: `${UI_DIR}/icon_shell.png`, label: '贝壳(长大了才有)', locked: true, tip: '长大了才有' },
      { id: 'gift', icon: `${UI_DIR}/icon_gift.png`, label: '礼物(长大了才有)', locked: true, tip: '长大了才有' },
      { id: 'backpack', icon: `${UI_DIR}/icon_backpack.png`, label: '背包(长大了才有)', locked: true, tip: '长大了才有' },
      { id: 'book', icon: `${UI_DIR}/icon_book.png`, label: '图鉴' },
      { id: 'pad', icon: '', label: '', empty: true },
      // 第二排 = 常用动作
      grownCount > 0
        ? { id: 'feed', icon: `${UI_DIR}/icon_sprout.png`, label: '喂海草', badge: grownCount }
        : { id: 'feed', icon: `${UI_DIR}/icon_sprout.png`, label: '海草还没长成', locked: true, tip: '还没有长成的海草' },
      { id: 'plant', icon: `${UI_DIR}/icon_seagrass.png`, label: '种海草' },
      { id: 'sea', icon: `${UI_DIR}/icon_map.png`, label: '换一片海' },
      { id: 'album', icon: `${UI_DIR}/icon_camera.png`, label: '相册' },
      { id: 'breathe', icon: `${UI_DIR}/icon_bubble.png`, label: '帮小爱心换气', glow: breath.phase === 'waiting' },
    ]
    return {
      day: save.daysPlayed,
      season: '夏天',
      moonPhase: '满月',
      tide: '涨潮',
      shells: save.shells,
      slots,
      tip: hudTip,
    }
  }, [save.daysPlayed, save.shells, grownCount, breath.phase, hudTip])

  const handleSlotTap = useCallback(
    (id: string) => {
      const slot = hudSnapshot.slots.find((s) => s.id === id)
      if (slot?.tip) {
        setHudTip(slot.tip)
        return
      }
      switch (id) {
        case 'book':
          setPage('book')
          break
        case 'feed':
          feed()
          break
        case 'plant':
          plant()
          break
        case 'sea':
          setSeaPickerOpen(true)
          break
        case 'album':
          setPage('album')
          break
        case 'breathe':
          handleBreathe()
          break
      }
    },
    [hudSnapshot.slots, feed, plant, handleBreathe],
  )

  const scene = sceneId ? scenes[sceneId] : undefined
  const talkingNpc = npcTalk ? npcs?.[npcTalk.npcId] : undefined

  // 小爱心和邻居共用同一个对话面板的内容:同一时刻只可能有其中一份非空,
  // DialoguePanel 本身不知道「谁」在说话,只管显示传进来的这一份
  const panelContent: PanelContent | null = scene
    ? {
        speaker: '小爱心',
        text: scene.text,
        en: scene.en,
        options: (scene.options ?? []).map((option) => ({
          icon: option.icon,
          label: option.label,
          onSelect: () => chooseOption(option),
        })),
      }
    : npcTalk && talkingNpc
      ? {
          speaker: talkingNpc.名字,
          text: npcTalk.topic.say,
          foreign: talkingNpc.语言 !== 'zh',
          options: npcTalk.isGift
            ? []
            : (npcTalk.topic.options ?? []).map((option) => {
                const cap =
                  config?.开放NPC.find((n) => n.id === npcTalk.npcId)?.熟悉度上限 ?? 5
                return {
                  icon: option.icon,
                  label: option.text,
                  onSelect: () => handleNpcChoose(npcTalk.npcId, talkingNpc, cap, option),
                }
              }),
          onDismiss: npcTalk.isGift ? () => setNpcTalk(null) : undefined,
        }
      : null

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
          slotCount={slotCount}
          cameraX={cameraX}
          onWorldTap={petSwim.swimTo}
          lockedBeyondEnd={lockedBeyondEnd}
          actors={
            // 所有角色都用世界坐标摆放。海草床固定长在第一格「家海草床」,不跟她走
            <>
              <div className="absolute inset-y-0" style={{ left: 0, width: STAGE_WIDTH }}>
                <SeagrassBed
                  bed={save.seagrass}
                  onTap={() => showCard(knowledge.pickByEvent('点海草', save.knowledgeSeen))}
                />
              </div>
              {placedNpcs.map(({ id, npc, spotIndex }) => {
                const cap = config?.开放NPC.find((n) => n.id === id)?.熟悉度上限 ?? 5
                const canGift =
                  grownCount > 0 && save.giftedAt[id] !== new Date().toDateString()
                const level = save.familiarity[id] ?? 0
                return (
                  <Npc
                    key={id}
                    npc={npc}
                    leftPx={spotIndex * STAGE_WIDTH + STAGE_WIDTH * 0.65}
                    reacting={reactingNpc === id}
                    onTapSprite={() => handleNpcTapSprite(id, npc, level)}
                    canGift={canGift}
                    onGift={() => handleNpcGift(id, npc, cap)}
                  />
                )
              })}
              {/* 白天投在沙地上的影子,跟着她游动移动(参考图沙地中间那块深色)。
                  体型长大影子跟着变大 */}
              <img
                src="/assets/world/shadow.png"
                alt=""
                className="pointer-events-none absolute -translate-x-1/2"
                style={{ left: petSwim.x, bottom: 30, width: 170 * stage.体型 }}
              />
              <Pet
                pet={pet}
                stage={stage}
                pose={pose}
                breath={breath.phase}
                worldX={petSwim.x}
                facingLeft={petSwim.facingLeft}
                anchors={knowledge.anchors}
                onBreathe={handleBreathe}
                onAnchorTap={(anchor) =>
                  showCard(knowledge.pickByAnchor(anchor, save.knowledgeSeen))
                }
              />
            </>
          }
          hud={
            <>
              {card && <KnowledgeCard card={card} onDismiss={() => setCard(null)} />}
              <DialoguePanel content={panelContent} />
              {/* 对话面板从底部滑上来的时候,饱腹度条和 HUD 会被它盖住/撞在一起——
                  说话的时候先让它们让开,面板收起再回来 */}
              {page === 'sea' && !panelContent && (
                <>
                  {legacyHud ? (
                    <GameHud
                      day={save.daysPlayed}
                      moonPhase="满月"
                      tide="涨潮中"
                      stage={stage}
                      onHoldTitle={() => setAdminGateOpen(true)}
                    />
                  ) : (
                    <HUD
                      snapshot={hudSnapshot}
                      onSlotTap={handleSlotTap}
                      onHoldTitle={() => setAdminGateOpen(true)}
                    />
                  )}
                  {/* 换气(镜头在水面)时藏起来:计量条长得像海草,浮在水面画面里
                      会被当成"种的海草跟着浮上来了" */}
                  {!breath.atSurface && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
                      <FullnessMeter value={save.fullness} />
                    </div>
                  )}
                  {legacyHud && (
                    <ActionBar
                      grownSeagrass={grownCount}
                      breathWaiting={breath.phase === 'waiting'}
                      onFeed={feed}
                      onPlant={plant}
                      onOpenSea={() => setSeaPickerOpen(true)}
                      onOpenAlbum={() => setPage('album')}
                      onOpenBook={() => setPage('book')}
                      onBreathe={handleBreathe}
                    />
                  )}
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
      {adminGateOpen && (
        <AdminGate
          password={config?.后台.密码 ?? '0000'}
          onUnlock={() => {
            setAdminGateOpen(false)
            setPage('admin')
          }}
          onClose={() => setAdminGateOpen(false)}
        />
      )}
      {page === 'admin' && config && (
        <AdminPanel
          config={config}
          world={world}
          npcs={npcs}
          logEntries={logEntries}
          onUpdate={updateConfig}
          onReset={resetConfig}
          onResetToOnlyPet={resetToOnlyPet}
          onClose={() => setPage('sea')}
        />
      )}
    </>
  )
}

export default App
