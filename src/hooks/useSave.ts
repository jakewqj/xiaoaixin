import { useCallback, useEffect, useState } from 'react'
import { countGrown, starterBed } from '../lib/seagrass'
import type { Seagrass } from '../lib/seagrass'

const SAVE_KEY = 'xiaoaixin_save'
const SAVE_VERSION = 2

export const MAX_FULLNESS = 5

// 饱食度每隔这么久掉一格
export const HUNGER_STEP_MS = 5 * 60 * 1000

// 不在的这段时间最多补掉这么多格。隔一周回来和隔一小时回来看到的差不多,
// 不会出现「我把它饿了一个星期」这种画面
const MAX_OFFLINE_DROP = 2

// 一个邻居身边最多挂 3 张(ROADMAP 2-4)。满了旧的自动退回相册,不是删掉
export const MAX_HANGING = 3

export interface SaveData {
  version: number
  createdAt: string
  lastPlayedAt: string
  daysPlayed: number
  fullness: number
  // 相册:回忆 id → 发生的那一天。只进不出,不会因为任何事被抹掉
  albumEvents: Record<string, string>
  // 上次已经陪她过的成长阶段 id。用来判断这次打开有没有长大一点
  stageSeen: string
  seenScenes: string[]
  // 知识卡 id → 上次出现的时间。用来做 24 小时冷却,不是进度记录
  knowledgeSeen: Record<string, string>
  seagrass: Seagrass[]
  // 上次已经告诉过她「长成了几棵」。用来判断这次打开有没有新长成的
  grownSeen: number
  // 当前在哪片海。三片海共享同一张海草床,换海只是换风景
  sea: string
  // 熟悉度:邻居 id → 等级。只增不减,永不衰减
  familiarity: Record<string, number>
  // 熟悉度每天最多涨一级。记的是上次涨级那天,不是上次说话那天
  familiarityLastAt: Record<string, string>
  // 送礼:邻居 id → 上次送礼的那天。每个邻居每天只能送 1 次
  giftedAt: Record<string, string>
  // 贝壳数量。2026-08-03 用户明确要求常驻 HUD 显示 —— 这一条与 CLAUDE.md 十六
  // 「❌ 常驻金钱 HUD(贝币只在「换一换」界面内显示)」冲突,宪法待修订,拟稿见 FORJake.md。
  // 捡贝壳/花贝壳的机制是 S5「贝壳当钱用」的事,这里只存数,不做任何加减规则
  shells: number
  // 童童画的画:**这里只存 id**,图片本体在 IndexedDB(见 lib/drawings.ts)。
  // CLAUDE.md 十四禁止 base64 图片进 localStorage —— 写爆是整份存档一起丢。
  // 按画下来的先后排。IndexedDB 里读不到某个 id 时当「这张没有」,不算坏档,
  // 也不要顺手把 id 从这里删掉(原则 10:她画的东西永远不被抹掉)
  drawings: string[]
  // 挂在邻居身边木板上的画:邻居 id → 画的 id,**最多 3 张,新的在后**。
  // 满了之后最旧的那张只是从这里挪走,**不删** —— 它仍然在 drawings 里,
  // 也就是仍然在相册里(原则 10:她画的永远不消失)。所以这里不需要额外的
  // 「已归档」列表,drawings 本身就是全集
  hangings: Record<string, string[]>
  // 童童手写的小纸条(ROADMAP 2-6):贴在哪 → 纸条那张图的 id。
  // key 是带前缀的位置串:`seagrass:<海草id>`、`place:<地点id>`。
  // 和 hangings 一样,图本体在 IndexedDB,这里只存 id;
  // 而且它同样在 drawings 里 —— 相册收的是全集(2-8)
  notes: Record<string, string>
  // 每张画是从哪来的(ROADMAP 2-8「标出每张的来处」):画的 id → 位置串。
  // 值和 hangings / notes / cardDrawings 用的是同一套 key 写法:
  // `npc:<邻居id>`、`seagrass:<海草id>`、`place:<地点id>`、`card:<知识卡id>`。
  //
  // **为什么不从那三张表反查**:挂满 3 张之后最旧那张会从 hangings 里挪走,
  // 挪走之后就再也查不出它当初是送给谁的了 —— 而它还在相册里,总不能写「不知道哪来的」。
  // 存的是 key 不是现成的句子:邻居/地点的名字将来改了,相册里跟着改
  drawingOrigins: Record<string, string>
  // 图鉴手绘页(ROADMAP 2-7):知识卡 id → 她给那张卡画的画的 id。
  // 一张卡一张画,画过就不再给「我来画」那个按钮 —— 原则 10:她画的不许被改掉,
  // 也就没有「重画一张」。和 notes / hangings 一样,图本体在 IndexedDB,这里只存 id,
  // 而且它同样在 drawings 里 —— 相册收的是全集(2-8)
  cardDrawings: Record<string, string>
  // 她真的游到过的地点 id。**只用来决定「起名字的木牌」出不出现** ——
  // 没去过的地方不该先摆一块空牌在那儿等她。只增不减,和熟悉度一个道理
  visited: string[]
}

function createSave(): SaveData {
  const now = new Date().toISOString()
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastPlayedAt: now,
    daysPlayed: 1,
    fullness: MAX_FULLNESS,
    albumEvents: {},
    stageSeen: '',
    seenScenes: [],
    knowledgeSeen: {},
    seagrass: starterBed(),
    grownSeen: starterBed().length,
    sea: 'redsea',
    familiarity: {},
    familiarityLastAt: {},
    giftedAt: {},
    shells: 0,
    drawings: [],
    hangings: {},
    notes: {},
    cardDrawings: {},
    drawingOrigins: {},
    visited: [],
  }
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isSeagrass(value: unknown): value is Seagrass {
  const p = value as Partial<Seagrass>
  return (
    typeof p?.id === 'string' && isTimestamp(p.plantedAt) && isCount(p.x)
  )
}

// 第 3 周之前相册只存了 id 列表,没存日期。老存档里的那几条按「认识那天」算,
// 而不是丢掉 —— 相册里的东西一旦记下来就不该消失
function withAlbum(s: Partial<SaveData>): Record<string, string> {
  const raw = s.albumEvents as unknown
  if (Array.isArray(raw)) {
    const day = isTimestamp(s.createdAt) ? s.createdAt : new Date().toISOString()
    return Object.fromEntries(
      raw.filter((id) => typeof id === 'string').map((id: string) => [id, day]),
    )
  }
  if (typeof raw !== 'object' || raw === null) return {}
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(
      (entry): entry is [string, string] => isTimestamp(entry[1]),
    ),
  )
}

// 老存档里没有海草床,补一片开局的给它,而不是判定成损坏。
// grownSeen 缺失时按当前已长成的数量算,免得一上来就误报「海草长大啦」
function withBed(s: Partial<SaveData>) {
  const seagrass = Array.isArray(s.seagrass)
    ? s.seagrass.filter(isSeagrass)
    : starterBed()
  return {
    seagrass,
    grownSeen: isCount(s.grownSeen)
      ? Math.max(0, Math.floor(s.grownSeen))
      : countGrown(seagrass),
  }
}

// 存档只要有一处不对就整份作废重建。宁可从头开始,也不能让坏数据把界面卡住
function parseSave(raw: string | null): SaveData | null {
  if (!raw) return null
  try {
    const data: unknown = JSON.parse(raw)
    if (typeof data !== 'object' || data === null) return null
    const s = data as Partial<SaveData>
    if (
      !isTimestamp(s.createdAt) ||
      !isTimestamp(s.lastPlayedAt) ||
      !isCount(s.daysPlayed) ||
      !isCount(s.fullness)
    ) {
      return null
    }
    return {
      version: SAVE_VERSION,
      createdAt: s.createdAt,
      lastPlayedAt: s.lastPlayedAt,
      daysPlayed: Math.max(1, Math.floor(s.daysPlayed)),
      fullness: Math.min(MAX_FULLNESS, Math.max(0, s.fullness)),
      albumEvents: withAlbum(s),
      // stageSeen 留空表示这份存档还没记过成长阶段。开局那次不当成「长大了」,
      // 免得老存档一打开就误报一句「我长大一点了」
      stageSeen: typeof s.stageSeen === 'string' ? s.stageSeen : '',
      // 这几个字段是后来加的。旧存档里没有不算损坏,给个默认值就行,不要因此把整份档丢掉
      seenScenes: Array.isArray(s.seenScenes)
        ? s.seenScenes.filter((id) => typeof id === 'string')
        : [],
      knowledgeSeen:
        typeof s.knowledgeSeen === 'object' && s.knowledgeSeen !== null
          ? s.knowledgeSeen
          : {},
      // 海域是后来加的字段。旧存档没有就默认回红海浅滩,不因此作废整份档
      sea: typeof s.sea === 'string' ? s.sea : 'redsea',
      // 熟悉度是 S1 才加的字段,老存档没有就当作谁都还没升过级
      familiarity:
        typeof s.familiarity === 'object' && s.familiarity !== null
          ? s.familiarity
          : {},
      familiarityLastAt:
        typeof s.familiarityLastAt === 'object' && s.familiarityLastAt !== null
          ? s.familiarityLastAt
          : {},
      // 送礼也是 S1 才加的字段,老存档没有就当作谁都还没送过
      giftedAt:
        typeof s.giftedAt === 'object' && s.giftedAt !== null
          ? s.giftedAt
          : {},
      // 贝壳是后加的字段。老存档没有就当作 0,不因此把整份档判成损坏 ——
      // 童童现在存档里的天数、海草、相册、熟悉度必须原样继承
      shells: isCount(s.shells) ? Math.max(0, Math.floor(s.shells)) : 0,
      // 画是 S2 才加的字段。老存档没有就当作还没画过
      drawings: Array.isArray(s.drawings)
        ? s.drawings.filter((id): id is string => typeof id === 'string')
        : [],
      // 挂画同理,老存档没有就是还没挂过。逐个邻居校验成字符串数组并砍到 3 张 ——
      // 存档是可以被爸爸手改的,读进来的东西一律不当真
      // s 已经是 Partial<SaveData>,s.hangings 本来就有类型 —— 别再往
      // Record<string, unknown> 上强转,那一转就退化成 any,白白多一条 lint。
      // Array.isArray 那层看着多余,但存档是可以被爸爸手改的,运行时仍要挡一下
      hangings:
        s.hangings && typeof s.hangings === 'object'
          ? Object.fromEntries(
              Object.entries(s.hangings)
                .map(([npcId, ids]): [string, string[]] => [
                  npcId,
                  Array.isArray(ids)
                    ? ids.filter((id): id is string => typeof id === 'string').slice(-MAX_HANGING)
                    : [],
                ])
                .filter(([, ids]) => ids.length > 0),
            )
          : {},
      // 纸条同理:老存档没有就是还没写过。逐条校验成字符串,手改过的存档不当真
      notes:
        s.notes && typeof s.notes === 'object'
          ? Object.fromEntries(
              Object.entries(s.notes).filter(
                (pair): pair is [string, string] => typeof pair[1] === 'string',
              ),
            )
          : {},
      // 来处表是 2-8 才加的。老存档里的画没有来处,相册就只写日期,不写来处
      drawingOrigins:
        s.drawingOrigins && typeof s.drawingOrigins === 'object'
          ? Object.fromEntries(
              Object.entries(s.drawingOrigins).filter(
                (pair): pair is [string, string] => typeof pair[1] === 'string',
              ),
            )
          : {},
      // 图鉴手绘页也是后加的,老存档没有就是还没在图鉴里画过
      cardDrawings:
        s.cardDrawings && typeof s.cardDrawings === 'object'
          ? Object.fromEntries(
              Object.entries(s.cardDrawings).filter(
                (pair): pair is [string, string] => typeof pair[1] === 'string',
              ),
            )
          : {},
      visited: Array.isArray(s.visited)
        ? s.visited.filter((id): id is string => typeof id === 'string')
        : [],
      ...withBed(s),
    }
  } catch {
    return null
  }
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

// 打开时把存档对齐到「现在」:记一次时间、跨自然日就把累计天数 +1、补掉不在时掉的饱食度。
// 三件事必须一次算完 —— 只要 lastPlayedAt 还停在旧值,饱食度就有被重复补掉的机会
function restore(save: SaveData): SaveData {
  const nowMs = Date.now()
  const now = new Date(nowMs).toISOString()
  const awayMs = nowMs - Date.parse(save.lastPlayedAt)
  const dropped =
    awayMs > 0 ? Math.min(MAX_OFFLINE_DROP, Math.floor(awayMs / HUNGER_STEP_MS)) : 0

  return {
    ...save,
    lastPlayedAt: now,
    daysPlayed: isSameDay(save.lastPlayedAt, now)
      ? save.daysPlayed
      : save.daysPlayed + 1,
    fullness: Math.max(0, save.fullness - dropped),
  }
}

// awayMs 是这次打开距离上次玩过隔了多久,用来决定要不要说「你每天都来」那句
function readSave(): { save: SaveData; awayMs: number } {
  try {
    const stored = parseSave(localStorage.getItem(SAVE_KEY)) ?? createSave()
    const awayMs = Math.max(0, Date.now() - Date.parse(stored.lastPlayedAt))
    return { save: restore(stored), awayMs }
  } catch {
    return { save: createSave(), awayMs: 0 }
  }
}

function writeSave(save: SaveData) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save))
  } catch {
    // 无痕模式或存储写满:这次没存上,但游戏照玩,不打扰
  }
}

// 全局唯一的存档读写口。组件不要自己碰 localStorage
export function useSave() {
  const [loaded] = useState(readSave)
  const [save, setSave] = useState<SaveData>(loaded.save)

  useEffect(() => {
    writeSave(save)
  }, [save])

  // 传函数的形式是给定时器用的:隔几分钟才跑一次的回调不能依赖闭包里的旧存档
  const update = useCallback(
    (patch: Partial<SaveData> | ((prev: SaveData) => Partial<SaveData>)) => {
      setSave((prev) => ({
        ...prev,
        ...(typeof patch === 'function' ? patch(prev) : patch),
      }))
    },
    [],
  )

  return { save, update, awayMs: loaded.awayMs }
}
