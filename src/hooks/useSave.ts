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
          ? (s.knowledgeSeen as Record<string, string>)
          : {},
      // 海域是后来加的字段。旧存档没有就默认回红海浅滩,不因此作废整份档
      sea: typeof s.sea === 'string' ? s.sea : 'redsea',
      // 熟悉度是 S1 才加的字段,老存档没有就当作谁都还没升过级
      familiarity:
        typeof s.familiarity === 'object' && s.familiarity !== null
          ? (s.familiarity as Record<string, number>)
          : {},
      familiarityLastAt:
        typeof s.familiarityLastAt === 'object' && s.familiarityLastAt !== null
          ? (s.familiarityLastAt as Record<string, string>)
          : {},
      // 送礼也是 S1 才加的字段,老存档没有就当作谁都还没送过
      giftedAt:
        typeof s.giftedAt === 'object' && s.giftedAt !== null
          ? (s.giftedAt as Record<string, string>)
          : {},
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
