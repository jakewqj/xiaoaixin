export interface Seagrass {
  id: string
  plantedAt: string
  x: number
}

// 新芽长成要 3 天。这个等待本身就是内容 —— 她会学到有些事情快不了
export const GROW_MS = 3 * 24 * 60 * 60 * 1000

// 这片海最多种这么多棵。不是惩罚,只是种满了就够看了
export const BED_LIMIT = 12

// 长成这么多棵,水就完全清澈
const CLEAR_AT = 10

export function isGrown(plant: Seagrass, now = Date.now()) {
  return now - Date.parse(plant.plantedAt) >= GROW_MS
}

export function countGrown(bed: Seagrass[], now = Date.now()) {
  return bed.filter((plant) => isGrown(plant, now)).length
}

// 长成的海草越多,水越清。纯视觉,不影响任何玩法
export function clarityOf(bed: Seagrass[], now = Date.now()) {
  return Math.min(1, countGrown(bed, now) / CLEAR_AT)
}

// 高矮由 x 推出来,不额外存字段。同一棵海草每次打开都长得一样高
export function heightOf(plant: Seagrass) {
  return 0.85 + ((Math.round(plant.x * 10) % 4) * 0.12)
}

export function plantSeagrass(): Seagrass {
  return {
    id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    plantedAt: new Date().toISOString(),
    x: 6 + Math.random() * 88,
  }
}

// 开局这片海里本来就长着几棵海草,不是她种的,所以直接算长成。
// 这样喂食永远不会因为「没有长成的海草」而卡住 —— 那会变成一个失败态
export function starterBed(): Seagrass[] {
  const long_ago = new Date(Date.now() - GROW_MS - 60_000).toISOString()
  return [14, 38, 61, 84].map((x, i) => ({
    id: `starter-${i}`,
    plantedAt: long_ago,
    x,
  }))
}
