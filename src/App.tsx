import { useCallback, useEffect, useMemo, useState } from 'react'
import ScreenFrame, { STAGE_WIDTH, STAGE_HEIGHT } from './components/ScreenFrame'
import WorldCanvas from './components/WorldCanvas'
import { EAT_MS, placeNotePos, seagrassNoteRow } from './render/world'
import { WATER_LINE } from './render/world-data'
import type { NoteView, NpcView, PetView, WorldSnapshot } from './render/world'
import DialoguePanel from './components/DialoguePanel'
import type { PanelContent } from './components/DialoguePanel'
import KnowledgeCard from './components/KnowledgeCard'
import Book from './components/Book'
import Album from './components/Album'
import type { AlbumDrawing } from './components/Album'
import SeaPicker from './components/SeaPicker'
import { DrawingOverlay } from './components/DrawingOverlay'
import {
  BED_LIMIT,
  clarityOf,
  countGrown,
  plantSeagrass,
} from './lib/seagrass'
import { SEAS, seaById, SEA_CARD_EVENTS } from './lib/seas'
import { currentStage, isHanddrawn, stagesReached, toneFilter } from './lib/pet'
import { useSave, MAX_FULLNESS, HUNGER_STEP_MS, MAX_HANGING } from './hooks/useSave'
import { useDrawingUrls } from './hooks/useDrawingUrls'
import { saveDrawing } from './lib/drawings'
import { usePet } from './hooks/usePet'
import { useBreath, POP_MS, SWIM_MS } from './hooks/useBreath'
import { useDialogue } from './hooks/useDialogue'
import type { DialogueOption } from './hooks/useDialogue'
import { useKnowledge } from './hooks/useKnowledge'
import type { KnowledgeCardData } from './hooks/useKnowledge'
import { useAlbum } from './hooks/useAlbum'
import { useWorld } from './hooks/useWorld'
import { useConfig } from './hooks/useConfig'
import { useNpcs, unlockedTopics, frameSizeOf, FOLLOW_PET, REPEAT_LANG } from './hooks/useNpcs'
import type { NpcSpec, NpcTopic } from './hooks/useNpcs'
import AdminGate from './components/AdminGate'
import AdminPanel from './components/AdminPanel'
import { useDialogueLog } from './hooks/useDialogueLog'
import { playSfx } from './lib/sfx'
import { speak } from './lib/speech'
import HUD from './ui/HUD'
import { UI_DIR } from './ui/layout'
import type { HudSnapshot, SlotSpec } from './ui/types'

type PoseName = 'idle' | 'happy' | 'eating' | 'sleeping'

const POSE_MS = 2500
/** 世界比舞台高出一个水面线 —— 摇上去能看见天空。牌子的纵坐标活在这个世界里,
 *  不是活在 480×270 的舞台里,写成 STAGE_HEIGHT - n 就会飘在半空(2026-08-24 实测) */
const WORLD_HEIGHT = STAGE_HEIGHT + WATER_LINE
/** 兜底定时器要多留出来的一段:够她从世界最远处游回海草床。
 *  正常路径永远不会走到这儿 —— 渲染层犁完就通知了 */
const GRAZE_TRAVEL_CAP_MS = 20000
const CARD_MS = 15000
/** 关着的那几页不用把画从 IndexedDB 里读出来。同一个常量数组,不然每次渲染都是新的 */
const NO_DRAWINGS: string[] = []
const DAY_MS = 24 * 60 * 60 * 1000
const WELCOME_BACK_DAYS = 3

// 由条件触发的场景。greet_reply 是顺着选项的 next 过来的,不在这里。
// 饿了/要换气不再走这里的文字气泡——分别换成了 HUD 顶部的饱食度条和小爱心自己的「屏息」姿势,
// 靠视觉就看得出来,不用再读一句话
const TRIGGERED = ['greet_first', 'handdrawn', 'welcome_back', 'grow_up']

// 选中一个选项之后開心一下的时长。没有 happy 动画的邻居就不会有这个反应
const NPC_REACT_MS = 1800
/** 小金「跟着复读」时切到 talk 动画的时长。够他念完一个短句(中英都短) */
const RECITE_MS = 1400
// 送礼的反馈比普通反应停久一点,够她看完再消失(也可以直接点一下提前收起)
const GIFT_REPLY_MS = 3000

// 没有真的礼物道具,送出去的是已经长成的海草。npc.json 大部分邻居还没填「礼物反馈」,
// 给个通用兜底,不因为缺数据就哑掉
// 邻居提起挂着的画的概率(ROADMAP 2-5「约 20% 概率」)。
// **偶尔说才珍贵** —— 每次点她都提一遍,那句话三天就没味道了(宪法十同一个道理)
const MENTION_HANGING_CHANCE = 0.2

// 没填「挂画反馈」的邻居用这句。只说喜欢,**不评价画得怎么样** ——
// 没有分数、没有星级、没有「画得真好」(原则 4:小爱心不是老师;原则 10:不判对错)。
// 6 字,在宪法二「每句话 3–8 个字」之内
const FALLBACK_HANGING_TEXT = '我喜欢你画的'

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
  // 「已经低头在啃了」。按下喂食到真的开吃中间隔着一段路 —— 那段路上她该是游泳的样子
  const [grazing, setGrazing] = useState(false)
  const [sceneId, setSceneId] = useState<string | null>(null)
  // 邻居这边唯一的一份对话状态,和 sceneId 共用同一个道理:同一时刻只可能有一份内容在说话,
  // 从根上不会出现小爱心和邻居同时弹出两个对话框——见 ROADMAP 已知坑「对话没有互斥」
  const [npcTalk, setNpcTalk] = useState<{
    npcId: string
    topic: NpcTopic
    isGift: boolean
  } | null>(null)
  const [reactingNpc, setReactingNpc] = useState<string | null>(null)
  // 小金正在「跟着复读」。只切他的 talk 动画,不弹对话框 —— 复读是声音不是一段话,
  // 而且对话框同一时刻只能有一份,他总不能把刚说完的那个 NPC 顶掉
  const [recitingNpc, setRecitingNpc] = useState<string | null>(null)
  const [answered, setAnswered] = useState<string[]>([])
  const [card, setCard] = useState<KnowledgeCardData | null>(null)
  // 不用路由库,页面切换就是一个状态
  const [page, setPage] = useState<'sea' | 'book' | 'album' | 'admin'>('sea')
  const [seaPickerOpen, setSeaPickerOpen] = useState(false)
  // 正在给哪个邻居画画。null = 没在画
  const [drawingFor, setDrawingFor] = useState<string | null>(null)
  // 正在给什么起名字。key 是位置串(seagrass:xx / place:xx),title 是给她看的那句话
  const [noteFor, setNoteFor] = useState<{ key: string; title: string } | null>(null)
  // 正在给哪张知识卡画手绘页(ROADMAP 2-7)。null = 没在画
  const [cardToDraw, setCardToDraw] = useState<KnowledgeCardData | null>(null)
  const [adminGateOpen, setAdminGateOpen] = useState(false)

  const grownCount = countGrown(save.seagrass)
  const clarity = clarityOf(save.seagrass)
  const stage = currentStage(pet.spec, save.daysPlayed)
  const stages = stagesReached(pet.spec, save.daysPlayed)
  const sea = seaById(save.sea)

  const world = useWorld()
  const { config, update: updateConfig, reset: resetConfig, resetToOnlyPet } = useConfig()

  // config.json 的「系统开关」。在这之前这些开关一个都没人读 —— 爸爸在后台拨了不响,
  // 而「按钮在、点了没反应」和「开关拨了没变化」是同一类死控件(2026-08-24 接上)。
  //
  // 两种「没写 true」要分开看:
  //   config 还没加载完 —— 当作关,否则按钮会先闪出来再收回去
  //   加载完了但没有这个键 —— 当作开,免得爸爸手改 config.json 时删掉一行就整块功能消失
  const featureOn = useCallback(
    (name: string) => (config ? config.系统开关[name] !== false : false),
    [config],
  )

  // world.json 的海域用中文名当 key,seas.ts 的 sea.name 正好是同一个字符串,靠它对上
  // 这两个原来是每次渲染新建的数组。2-6 加了几个吃它们当依赖的 useMemo/useCallback,
  // 不 memo 的话依赖每帧都变,那几个 memo 等于白写(lint 也会直接点出来)
  const allSpots = useMemo(() => world?.海域[sea.name]?.地点 ?? [], [world, sea.name])
  // config 还没加载完之前先当作一个地点都没开放,免得先闪出一整排、加载完又收回去
  const openSpots = useMemo(
    () => (config ? allSpots.filter((spot) => config.开放地点.includes(spot.名字)) : []),
    [config, allSpots],
  )
  // 假定 config 里开放的地点是 world.json 地点列表的一段前缀,这是当前唯一一份内容数据的实际排法
  const lockedBeyondEnd = openSpots.length > 0 && allSpots.length > openSpots.length

  // 世界横条:一格一个地点。地点切换没有按钮了——点哪游哪,她自己游过去,镜头跟着。
  // 位置和镜头都在渲染层(src/render),不在这里 —— 那是每帧都变的量,进 React 就是每帧全树重渲染
  const slotCount = Math.max(1, openSpots.length)
  // 每一格是哪个地点。渲染层拿它挑装饰 —— 一个地点一套排布,爸爸在后台改「开放地点」
  // 也不会把别的地点的珊瑚换掉(见 world-data.ts 的 SPOT_DECOR)
  const spotIds = useMemo(() => openSpots.map((spot) => spot.id), [openSpots])

  const npcs = useNpcs()
  const { entries: logEntries, log: logDialogue } = useDialogueLog(config?.后台.对话日志上限)
  // 「开放NPC」里点了名、住的地点也开放了的邻居,按她住的那格摆进世界
  const placedNpcs: { id: string; npc: NpcSpec; spotIndex: number; follow?: boolean }[] =
    npcs && config
      ? Object.entries(npcs).flatMap(([id, npc]) => {
          if (!config.开放NPC.some((n) => n.id === id)) return []
          // 「跟随小爱心」的邻居不落在某个地点,跟着宠物游 —— 不受「开放地点」限制。
          // spotIndex 只是占位,渲染层对 follow 的邻居根本不读它
          if (npc.地点 === FOLLOW_PET) return [{ id, npc, spotIndex: 0, follow: true }]
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

  // 挂在各个邻居身边的画。id → object URL,渲染层只认路径(见 useDrawingUrls)
  const hangingIds = useMemo(
    () => Object.values(save.hangings).flat(),
    [save.hangings],
  )
  const hangingUrls = useDrawingUrls(hangingIds)

  // 手写纸条贴在世界里的位置(ROADMAP 2-6)。
  //
  // 两种触发,处理方式**故意不一样**:
  //   种海草 —— 她刚动完手,顺势弹出来让她起名字,是对她动作的回应,不算打扰。
  //     **只有写过名字的海草才立牌**(2026-08-24 用户决议):空牌也立的话,种满 12 棵时
  //     36px 宽的牌会铺满整条沙线连成一道栅栏,把海草床整个挡住、还互相压住她写的字
  //   到新地点 —— **不弹**。她正游着,全屏弹层横插一杠就是宪法二禁止的弹窗打断。
  //     改成在那儿摆一块空木牌,想写的时候点它。写过的牌不给热区:
  //     原则 10 她写的不许被改掉,也就没有「重写」这回事
  const noteIds = useMemo(() => Object.values(save.notes), [save.notes])
  const noteUrls = useDrawingUrls(noteIds)

  // 「手写命名」关掉之后**只是不再出新的空木牌**,已经写好的照旧贴在那儿 ——
  // 爸爸关一个开关不该让童童写过的字从世界上消失(原则 10)
  const namingOn = featureOn('手写命名')

  const noteViews: NoteView[] = useMemo(() => {
    const views: NoteView[] = []
    const named = save.seagrass.filter((plant) => save.notes[`seagrass:${plant.id}`])
    const row = seagrassNoteRow(named.map((plant) => plant.x), WORLD_HEIGHT)
    named.forEach((plant, i) => {
      views.push({
        key: `seagrass:${plant.id}`,
        label: '给海草起名字',
        ...row[i],
        written: true,
        src: noteUrls[save.notes[`seagrass:${plant.id}`]] ?? null,
      })
    })
    openSpots.forEach((spot, index) => {
      if (!save.visited.includes(spot.id)) return
      const key = `place:${spot.id}`
      const id = save.notes[key]
      // 关掉之后不再摆空牌;写过的那块照样摆
      if (!id && !namingOn) return
      views.push({
        key,
        label: '给这里起名字',
        ...placeNotePos(index, WORLD_HEIGHT),
        written: Boolean(id),
        src: id ? (noteUrls[id] ?? null) : null,
      })
    })
    return views
  }, [save.seagrass, save.notes, save.visited, openSpots, noteUrls, namingOn])

  // 相册收的是全集(ROADMAP 2-8):她画过的每一张,按画下来的先后排,各自标出来处。
  //
  // **来处查的是 drawingOrigins,不是 hangings/notes/cardDrawings**:挂满 3 张之后
  // 最旧那张会从 hangings 里挪走(2-4),挪走之后就再也反查不出它当初送给了谁。
  // 老存档里的画没有来处,那就只写日期 —— 不编一个出来
  const albumDrawingUrls = useDrawingUrls(page === 'album' ? save.drawings : NO_DRAWINGS)

  const albumDrawings: AlbumDrawing[] = useMemo(() => {
    const spotName = (id: string) => allSpots.find((spot) => spot.id === id)?.名字
    return save.drawings
      .map((id) => {
        const url = albumDrawingUrls[id]
        if (!url) return null
        const origin = save.drawingOrigins[id] ?? ''
        const [kind, ref] = [origin.slice(0, origin.indexOf(':')), origin.slice(origin.indexOf(':') + 1)]
        let from = ''
        if (kind === 'npc') from = `送给${npcs?.[ref]?.名字 ?? '朋友'}`
        else if (kind === 'seagrass') from = '海草的名字'
        else if (kind === 'place') from = `${spotName(ref) ?? '这里'}的名字`
        else if (kind === 'card') from = '图鉴里画的'
        return { id, url, from }
      })
      .filter((d): d is AlbumDrawing => d !== null)
  }, [save.drawings, save.drawingOrigins, albumDrawingUrls, npcs, allSpots])

  // 她游进了第几格。只在跨格那一帧收到一次(见 render/world.ts 的 onSpotChanged),
  // 而第一格的 -1 → 0 是**开局第一帧**就发的 —— 那会儿 config.json / world.json 多半还没回来,
  // openSpots 还是空的。所以不能在回调里当场查表:查不到就永远查不到了,家海草床那块木牌
  // 一整局都不会出现。记下格号,等地点表加载完再对(2026-08-24 实测揪出来的)
  const [spotIndex, setSpotIndex] = useState(-1)
  const handleSpotChanged = useCallback((index: number) => setSpotIndex(index), [])

  useEffect(() => {
    const spot = openSpots[spotIndex]
    if (!spot || save.visited.includes(spot.id)) return
    update((prev) =>
      prev.visited.includes(spot.id) ? {} : { visited: [...prev.visited, spot.id] },
    )
  }, [spotIndex, openSpots, save.visited, update])

  // 图鉴手绘页(ROADMAP 2-7)。和纸条、挂画同一条路:图本体进 IndexedDB,
  // 存档里只留 id,渲染只认 object URL
  // 图鉴没打开就不读:一张 1024×768 的 PNG 几百 KB,一开局全读出来在 iPad 上是白扔内存
  const cardDrawingIds = useMemo(
    () => (page === 'book' ? Object.values(save.cardDrawings) : NO_DRAWINGS),
    [page, save.cardDrawings],
  )
  const cardDrawingUrls = useDrawingUrls(cardDrawingIds)

  const saveCardDrawing = useCallback(
    async (cardId: string, png: Blob) => {
      const drawingId = await saveDrawing(png)
      setCardToDraw(null)
      if (!drawingId) return
      update((prev) => ({
        drawings: [...prev.drawings, drawingId],
        drawingOrigins: { ...prev.drawingOrigins, [drawingId]: `card:${cardId}` },
        cardDrawings: { ...prev.cardDrawings, [cardId]: drawingId },
      }))
    },
    [update],
  )

  // 写好的纸条:存进 IndexedDB → 记进存档 → 贴到那个位置。
  // 存不进去就什么都不做也不报错(宪法十四),对她来说就是「这次没贴上」
  const saveNote = useCallback(
    async (key: string, png: Blob) => {
      const drawingId = await saveDrawing(png)
      setNoteFor(null)
      if (!drawingId) return
      update((prev) => ({
        drawings: [...prev.drawings, drawingId],
        // key 本身就是位置串(seagrass:xx / place:xx),直接当来处用
        drawingOrigins: { ...prev.drawingOrigins, [drawingId]: key },
        notes: { ...prev.notes, [key]: drawingId },
      }))
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

    // 身边挂着画的话,偶尔提一句。isGift 在这里读作「一句不需要她回应的话」:
    // 没有选项、过一会儿自己收起、点一下也能提前收 —— 和收到礼物那句同一种。
    // **不涨熟悉度**:那是聊天和送礼的事,她路过听见一句夸奖不该变成进度
    const hung = save.hangings[id] ?? []
    if (hung.length > 0 && Math.random() < MENTION_HANGING_CHANCE) {
      const lines = npc.挂画反馈 ?? []
      const line =
        lines.length > 0
          ? lines[Math.floor(Math.random() * lines.length)]
          : { text: FALLBACK_HANGING_TEXT }
      setNpcTalk({
        npcId: id,
        topic: { id: 'hanging_mention', say: line.text },
        isGift: true,
      })
      return
    }

    const pool = unlockedTopics(npc, level)
    if (pool.length === 0) return
    setNpcTalk({ npcId: id, topic: pool[Math.floor(Math.random() * pool.length)], isGift: false })
  }

  function handleNpcChoose(id: string, npc: NpcSpec, cap: number, option: { text: string; icon: string }) {
    setNpcTalk(null)
    if (npc.动画.happy) setReactingNpc(id)
    bumpFamiliarity(id, cap)
    logDialogue(id, npc.名字, option.text)

    // 小金跟着复读:童童选了什么,他就把那个词/短语用原文念一遍(中英都支持)。
    // 这正是 3-3 「练发音的安全出口」—— 只复读,**不判断像不像**。只在他在场时触发。
    // 语言跟着当前 NPC 走:Dolly/Sousa 的选项是英文 → en-US,中文 NPC → zh-CN;
    // 小金自己的选项都是中文词 → zh-CN。绝不会按「外语角色」用 TTS 念中文(那条旧坑)
    if (placedNpcs.some((p) => p.id === 'xiaojin')) {
      speak(option.text, npc.语言 === 'en' ? 'en-US' : 'zh-CN')
      setRecitingNpc('xiaojin')
    }
  }

  // 画完送出去。三件事按顺序:图片本体进 IndexedDB、id 进存档、挂上那块木板。
  //
  // **存不进去就什么都不做,但也不报错**(宪法十四:静默降级,绝不白屏)——
  // 对童童来说就是「这次没送成」,她可以再按一次。
  //
  // 挂满 3 张时最旧的那张只是从 hangings 里挪走,**不删**:它还在 drawings 里,
  // 也就是还在相册里(ROADMAP 2-4 原话「满了旧的自动存进相册(不删除)」)
  const sendDrawing = useCallback(
    async (npcId: string, npc: NpcSpec, cap: number, png: Blob) => {
      const drawingId = await saveDrawing(png)
      setDrawingFor(null)
      if (!drawingId) return
      update((prev) => ({
        drawings: [...prev.drawings, drawingId],
        drawingOrigins: { ...prev.drawingOrigins, [drawingId]: `npc:${npcId}` },
        hangings: {
          ...prev.hangings,
          [npcId]: [...(prev.hangings[npcId] ?? []), drawingId].slice(-MAX_HANGING),
        },
      }))
      // 反应和送海草共用同一套「很喜欢 / 谢谢你」,**不按画得怎么样分档** ——
      // 原则 10:不判对错。随机一档,和她画了什么无关
      const tier: '很喜欢' | '谢谢你' = Math.random() < 0.5 ? '很喜欢' : '谢谢你'
      const reaction = npc.礼物反馈?.[tier] ?? { text: FALLBACK_GIFT_TEXT[tier] }
      setNpcTalk({ npcId, topic: { id: `drawing_${tier}`, say: reaction.text }, isGift: true })
      if (npc.动画.happy) setReactingNpc(npcId)
      bumpFamiliarity(npcId, cap)
    },
    [bumpFamiliarity, update],
  )

  function handleNpcGift(id: string, npc: NpcSpec, cap: number) {
    const tier: '很喜欢' | '谢谢你' = Math.random() < 0.5 ? '很喜欢' : '谢谢你'
    const reaction = npc.礼物反馈?.[tier] ?? { text: FALLBACK_GIFT_TEXT[tier] }
    setNpcTalk({ npcId: id, topic: { id: `gift_${tier}`, say: reaction.text }, isGift: true })
    if (npc.动画.happy) setReactingNpc(id)
    giveGift(id, cap)
  }

  // 摆一会儿姿势就回到平时的样子。
  //
  // 进食是个例外:它要先游到海草床再低头犁一段,**总时长取决于她这会儿离床多远**,
  // React 算不出来。所以进食由渲染层犁完之后回头通知(onEatingChanged(false)),
  // 这里的定时器只当兜底 —— 万一那声通知没来,姿势也不能永远卡在啃。
  useEffect(() => {
    if (pose === 'idle') return
    const ms = pose === 'eating' ? EAT_MS + GRAZE_TRAVEL_CAP_MS : POSE_MS
    const timer = setTimeout(() => setPose('idle'), ms)
    return () => clearTimeout(timer)
  }, [pose])

  // 渲染层说「开吃了 / 吃完了」。吃完就把姿势收回来,不再等兜底定时器
  const handleEatingChanged = useCallback((active: boolean) => {
    setGrazing(active)
    if (!active) setPose((p) => (p === 'eating' ? 'idle' : p))
  }, [])

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

  // 复读动画自己会停。设这个状态和清它之间隔着的是一声朗读,不等也不行
  useEffect(() => {
    if (!recitingNpc) return
    const timer = setTimeout(() => setRecitingNpc(null), RECITE_MS)
    return () => clearTimeout(timer)
  }, [recitingNpc])

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
    // 先把这一棵造出来,再交给 update —— 这样起名字用的 id 和真正种下去的是同一个。
    // (写成在更新函数里赋值给外面的变量也能跑,但 TS 的控制流分析看不到回调里的赋值,
    //  会把它收窄成 never;何况那样也更难读)
    const fresh = plantSeagrass()
    const full = save.seagrass.length >= BED_LIMIT
    update((prev) =>
      prev.seagrass.length >= BED_LIMIT ? {} : { seagrass: [...prev.seagrass, fresh] },
    )
    remember('first_plant')
    showCard(knowledge.pickByEvent('种海草后', save.knowledgeSeen))
    // 刚种下就顺势让她起名字。这是对她动作的回应,不是横插一杠的弹窗;
    // 而且弹层上有「先不写」,不写照样种成(原则 1:没有失败态)
    if (!full && namingOn) setNoteFor({ key: `seagrass:${fresh.id}`, title: '给海草起名字' })
  }, [update, showCard, knowledge, save.knowledgeSeen, save.seagrass.length, remember, namingOn])

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

  const bookOn = featureOn('图鉴')

  // 推给 canvas 的一份快照。季节/月相/潮汐还没有真的算,先占位;
  // 天数、贝壳、海草棵数是存档里现成的真数据。见 ROADMAP S4「潮汐与月亮」
  const hudSnapshot: HudSnapshot = useMemo(() => {
    const slots: SlotSpec[] = [
      // 第一排 = 道具栏,永远不超过 4 格(CLAUDE.md 十六)
      { id: 'shell', icon: `${UI_DIR}/icon_shell.png`, label: '贝壳(长大了才有)', locked: true, tip: '长大了才有' },
      { id: 'gift', icon: `${UI_DIR}/icon_gift.png`, label: '礼物(长大了才有)', locked: true, tip: '长大了才有' },
      { id: 'backpack', icon: `${UI_DIR}/icon_backpack.png`, label: '背包(长大了才有)', locked: true, tip: '长大了才有' },
      // 关掉就是这一格空着。不做成灰格子 + 「长大了才有」—— 那句话是假的,
      // 它不是没长大,是爸爸关了(原则 4 那条「不撒谎」的延伸)
      bookOn
        ? { id: 'book', icon: `${UI_DIR}/icon_book.png`, label: '图鉴' }
        : { id: 'book', icon: '', label: '', empty: true },
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
      fullness: save.fullness,
      maxFullness: MAX_FULLNESS,
      slots,
      tip: hudTip,
    }
  }, [save.daysPlayed, save.fullness, grownCount, breath.phase, hudTip, bookOn])

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
          // 只有真正的外语(英语)才朗读。小金是「复读」,照旧会触发「外语朗读」把他
          // 的台词用 TTS 念成中文 —— 那是旧坑,这里一并堵上
          foreign: talkingNpc.语言 !== 'zh' && talkingNpc.语言 !== REPEAT_LANG,
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

  // ---- 推给渲染层的世界快照 --------------------------------------------
  // 换气浮上来(rising)/吐泡泡(popping)用 surfacing 那套上浮动作;
  // 到了水面等着(waiting)换成 holding——腮帮鼓起、嘴巴闭紧地安静漂着,
  // 不再靠头顶那句「我要换口气」的文字气泡提示,靠这个姿势本身就能看出她在等你
  const animKey =
    pose === 'eating' && grazing
      ? 'eating'
      : pose === 'sleeping'
        ? 'sleeping'
        : breath.phase === 'waiting'
          ? 'holding'
          : breath.atSurface
            ? 'surfacing'
            : 'swim'
  const petAnim = pet.animFor(animKey)

  const petView: PetView = {
    anim: petAnim,
    scale: stage.体型,
    tone: toneFilter(stage.体色),
    anchors: pet.spec?.锚点 ?? {},
    anchorNames: knowledge.anchors,
    atSurface: breath.atSurface,
    eating: pose === 'eating',
    showBubbles: breath.phase === 'waiting' || breath.phase === 'popping',
    popping: breath.phase === 'popping',
    popMs: POP_MS,
    tapLabel: breath.phase === 'waiting' ? '帮小爱心换气' : '摸摸小爱心',
  }

  // 邻居按住的地点落位。有 happy 动画的话,选中选项/收到礼物后短暂切过去演一下
  const npcViews: NpcView[] = placedNpcs.flatMap(({ id, npc, spotIndex, follow }) => {
    // 跟随者(小金)默认一直在游(swim),复读时切 talk;
    // 落地的邻居照旧:idle,选中选项有 happy 的话演一下
    const key = follow
      ? recitingNpc === id
        ? 'talk'
        : 'swim'
      : reactingNpc === id && npc.动画.happy
        ? 'happy'
        : 'idle'
    const anim = npc.动画[key]
    if (!anim) return []
    const [frameWidth, frameHeight] = frameSizeOf(npc)
    return [
      {
        id,
        name: npc.名字,
        leftPx: follow ? 0 : spotIndex * STAGE_WIDTH + STAGE_WIDTH * 0.65,
        src: `${npc.精灵}${anim.文件}`,
        frameWidth,
        frameHeight,
        frameCount: anim.帧数,
        fps: anim.fps,
        onSeabed: npc.落位 === '沙面',
        follow,
        // 跟随的邻居不摆「送礼 / 画画」按钮、不挂木板 —— 那两样得钉在一个地方,
        // 跟着宠物到处漂既不像样,还会跟宠物自己的交互抢热区
        canDraw: follow ? false : featureOn('画画送礼'),
        canGift: follow ? false : grownCount > 0 && save.giftedAt[id] !== new Date().toDateString(),
        hangings: follow
          ? []
          : (save.hangings[id] ?? [])
              .map((drawingId) => hangingUrls[drawingId])
              .filter((url): url is string => Boolean(url)),
      },
    ]
  })
  // 每次 App 重渲染都重新组一份推下去。这不贵 —— 重构之后 App 已经不再每帧重渲染了,
  // 位置和镜头都在渲染层的实例字段里(REFACTOR_PLAN §六:每帧 React 重渲染 60 次 → 0 次)
  const worldSnapshot: WorldSnapshot = {
    sea,
    clarity,
    surfaced: breath.atSurface,
    slotCount,
    spotIds,
    lockedBeyondEnd,
    lockedBeforeStart: false,
    pet: petView,
    seagrass: save.seagrass,
    npcs: npcViews,
    notes: noteViews,
    swimMs: SWIM_MS,
  }

  // 在水面等着的时候点她 = 帮她换气;其余时候点她 = 摸摸她
  const tapPet = useCallback(() => {
    if (breath.phase === 'waiting') {
      handleBreathe()
      return
    }
    playSfx('tap')
  }, [breath.phase, handleBreathe])

  // 点身体部位。这张卡还在冷却里就当作普通的摸一摸 —— 点下去永远要有反应
  const tapAnchor = useCallback(
    (name: string) => {
      if (breath.phase === 'waiting') {
        handleBreathe()
        return
      }
      if (showCard(knowledge.pickByAnchor(name, save.knowledgeSeen))) return
      playSfx('tap')
    },
    [breath.phase, handleBreathe, showCard, knowledge, save.knowledgeSeen],
  )

  return (
    <>
      <ScreenFrame>
        <WorldCanvas
          snapshot={worldSnapshot}
          onTapPet={tapPet}
          onTapAnchor={tapAnchor}
          onTapBed={() => showCard(knowledge.pickByEvent('点海草', save.knowledgeSeen))}
          onEatingChanged={handleEatingChanged}
          onTapNpc={(id) => {
            const npc = npcs?.[id]
            if (npc) handleNpcTapSprite(id, npc, save.familiarity[id] ?? 0)
          }}
          onTapGift={(id) => {
            const npc = npcs?.[id]
            const cap = config?.开放NPC.find((n) => n.id === id)?.熟悉度上限 ?? 5
            if (npc) handleNpcGift(id, npc, cap)
          }}
          onSpotChanged={handleSpotChanged}
          // 点空木牌 = 给这儿起个名字。写过的牌没有热区,点不到
          onTapNote={(key) => {
            if (sceneId) return
            setNpcTalk(null)
            setNoteFor({
              key,
              title: key.startsWith('seagrass:') ? '给海草起名字' : '给这里起名字',
            })
          }}
          // 邻居正说着话时点画画,**把话收起、照样打开画板** ——
          // 按钮明明在那儿、点下去却什么都不发生,是这个项目最忌讳的死点击。
          // 收话的写法和「她在说话时再点她」那条一致(handleNpcTapSprite)。
          // 只有剧本对话(sceneId)还挡着:那是一段有头有尾的话,不该被打断
          onTapDraw={(id) => {
            if (sceneId) return
            if (!npcs?.[id]) return
            setNpcTalk(null)
            setDrawingFor(id)
          }}
          hud={
            <>
              {card && <KnowledgeCard card={card} onDismiss={() => setCard(null)} />}
              <DialoguePanel content={panelContent} />
              {/* 对话面板从底部滑上来的时候,饱腹度条和 HUD 会被它盖住/撞在一起——
                  说话的时候先让它们让开,面板收起再回来 */}
              {page === 'sea' && !panelContent && (
                <HUD
                  snapshot={hudSnapshot}
                  onSlotTap={handleSlotTap}
                  onHoldTitle={() => setAdminGateOpen(true)}
                />
              )}
            </>
          }
        />
      </ScreenFrame>
      {page === 'book' && (
        <Book
          cards={knowledge.bookCards(save.knowledgeSeen)}
          drawings={Object.fromEntries(
            Object.entries(save.cardDrawings)
              .map(([cardId, id]) => [cardId, cardDrawingUrls[id]])
              .filter((pair): pair is [string, string] => Boolean(pair[1])),
          )}
          canDraw={featureOn('图鉴手绘页')}
          onDraw={setCardToDraw}
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
          drawings={albumDrawings}
          onClose={() => setPage('sea')}
        />
      )}
      {drawingFor &&
        npcs?.[drawingFor] &&
        (() => {
          const npc = npcs[drawingFor]
          const cap = config?.开放NPC.find((n) => n.id === drawingFor)?.熟悉度上限 ?? 5
          return (
            <DrawingOverlay
              title={`画给${npc.名字}`}
              confirmLabel="送给她"
              confirmIcon="🎨"
              closeLabel="先不画"
              onConfirm={(png) => void sendDrawing(drawingFor, npc, cap, png)}
              onClose={() => setDrawingFor(null)}
            />
          )
        })()}
      {noteFor && (
        <DrawingOverlay
          title={noteFor.title}
          confirmLabel="贴上去"
          confirmIcon="✏"
          onConfirm={(png) => void saveNote(noteFor.key, png)}
          onClose={() => setNoteFor(null)}
        />
      )}
      {cardToDraw && (
        <DrawingOverlay
          title={cardToDraw.childText}
          confirmLabel="画好了"
          confirmIcon="🎨"
          closeLabel="先不画"
          onConfirm={(png) => void saveCardDrawing(cardToDraw.id, png)}
          onClose={() => setCardToDraw(null)}
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
