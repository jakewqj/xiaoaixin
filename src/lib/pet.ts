export interface GrowthStage {
  id: string
  名字: string
  en?: string
  天数: number
  体型: number
  体色: number
  文件?: Record<string, string>
}

export interface SpriteAnim {
  文件: string
  帧数: number
  fps: number
  循环?: boolean
}

export interface PetSpec {
  动画: Record<string, SpriteAnim>
  锚点: Record<string, [number, number]>
  成长缩放?: Record<string, number>
  皮肤?: Record<string, { 路径: string }>
  手稿?: { 已替换?: boolean; 画的人?: string }
  // 旧存档系统按天数分阶段的字段。新 pet.json 已经不提供了,stagesOf
  // 会因此一直落回默认阶段——这是已知缺口,留给专门做成长系统的 Season
  // 处理,这里先不碰
  成长?: { 阶段?: GrowthStage[] }
}

export const PET_DIR = '/assets/pet'
export const DEFAULT_SKIN_DIR = '/assets/pet/pixel/'

// 精灵表每一帧的基准像素尺寸(成年基准),和 pet.json 的「规格」保持一致
export const FRAME_WIDTH = 192
export const FRAME_HEIGHT = 64

// pet.json 里没写成长阶段时用这一个:不变大、不变色,和第 3 周长得一模一样
const ONLY_STAGE: GrowthStage = {
  id: 'default',
  名字: '小爱心',
  天数: 0,
  体型: 1,
  体色: 1,
}

function isStage(value: unknown): value is GrowthStage {
  const s = value as Partial<GrowthStage>
  return (
    typeof s?.id === 'string' &&
    typeof s.名字 === 'string' &&
    typeof s.天数 === 'number' &&
    typeof s.体型 === 'number' &&
    typeof s.体色 === 'number'
  )
}

// 成长阶段按天数从小到大排。第一段永远算已经到了 —— 一开局就得有个样子
export function stagesOf(spec: PetSpec | null): GrowthStage[] {
  const list = (spec?.成长?.阶段 ?? []).filter(isStage)
  if (list.length === 0) return [ONLY_STAGE]
  return [...list].sort((a, b) => a.天数 - b.天数)
}

// 已经长到的所有阶段。看的是「一共来过多少天」,不是连续多少天 ——
// 隔多久回来都不会退回去,也不会因为没来而错过
export function stagesReached(spec: PetSpec | null, daysPlayed: number) {
  const all = stagesOf(spec)
  const reached = all.filter((stage) => daysPlayed >= stage.天数)
  return reached.length > 0 ? reached : [all[0]]
}

export function currentStage(spec: PetSpec | null, daysPlayed: number) {
  const reached = stagesReached(spec, daysPlayed)
  return reached[reached.length - 1]
}

// 体色 0 = 幼崽的淡奶油色,1 = 长大后的石板灰。素材只有一张,深浅靠滤镜调 ——
// 童童以后要是分阶段画了不同的图,阶段里写上「文件」就会盖掉这里
export function toneFilter(体色: number) {
  const young = Math.min(1, Math.max(0, 1 - 体色))
  if (young === 0) return undefined
  return `sepia(${(young * 0.6).toFixed(2)}) saturate(${(1 - young * 0.35).toFixed(2)}) brightness(${(1 + young * 0.22).toFixed(2)})`
}

// 这只小爱心是不是童童画的。pet.json 里把「手稿.已替换」改成 true 就算
export function isHanddrawn(spec: PetSpec | null) {
  return spec?.手稿?.已替换 === true
}

// 当前皮肤的素材目录。config.json 的皮肤开关还没接进来,先固定用像素风
export function skinDir(spec: PetSpec | null) {
  return spec?.皮肤?.pixel?.路径 ?? DEFAULT_SKIN_DIR
}
