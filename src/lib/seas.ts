// 三片海对应儒艮的三大分布带:红海 / 印度洋 / 太平洋西岸(澳洲)。
// 换海只换视觉氛围,海草床、饱腹度、换气这些玩法在所有海里共享。
// 配色允许在 CLAUDE.md 十色之外,每片海再带 2-3 个装饰辅助色,全部收在这里,不写进组件。

export interface SeaTheme {
  id: string
  name: string
  // 三层水色:浅滩 / 中层 / 深水
  shallow: string
  mid: string
  deep: string
  // 光柱:亮度倍数和长短(1 是红海的基准)
  rayBoost: number
  rayHeight: number
  // 悬浮颗粒:数量(红海用基准的 8 颗)
  motes: number
  // 这片海的装饰层,纯 CSS 形状,没有素材文件
  decor: {
    coral?: { color: string }
    fish?: { count: number }
    seagrass?: { count: number; color: string }
    mangrove?: { color: string }
    shells?: { count: number; color: string }
    turtle?: { color: string }
  }
}

export const SEAS: SeaTheme[] = [
  {
    // 红海浅滩:2026-07-30 真美术二轮起,直接按参考图取色——底部保持明亮青绿,
    // 不再沉到深藏青(参考图的海底没有"越深越黑",整片都是饱和的 teal)
    id: 'redsea',
    name: '红海浅滩',
    shallow: '#38a8ac',
    mid: '#2a8e92',
    deep: '#1f7a7c',
    rayBoost: 1,
    rayHeight: 90,
    motes: 8,
    decor: {
      coral: { color: '#e8876a' },
      fish: { count: 5 },
    },
  },
  {
    // 印度海湾:马纳尔湾意象,水色偏青绿,光更柔更短,颗粒更密,一侧红树林根
    id: 'indian',
    name: '印度海湾',
    shallow: '#7ecdbc',
    mid: '#2f8f85',
    deep: '#124b45',
    rayBoost: 0.65,
    rayHeight: 62,
    motes: 14,
    decor: {
      seagrass: { count: 7, color: '#3e7d4e' },
      mangrove: { color: '#1e4d3a' },
    },
  },
  {
    // 澳洲浅海:鲨鱼湾 / 大堡礁意象,水色偏深蓝,光柱更长更亮,白贝壳,海龟路过
    id: 'pacific',
    name: '澳洲浅海',
    shallow: '#63b3d8',
    mid: '#1f6f9e',
    deep: '#0d3a5e',
    rayBoost: 1.35,
    rayHeight: 108,
    motes: 8,
    decor: {
      shells: { count: 5, color: '#f5f0e4' },
      turtle: { color: '#1e4a63' },
    },
  },
]

export const DEFAULT_SEA = SEAS[0]

// 老存档或写坏的值都落回红海,不让界面白掉
export function seaById(id: unknown): SeaTheme {
  return SEAS.find((sea) => sea.id === id) ?? DEFAULT_SEA
}

// 切海时给的知识卡挂在这些事件名上,和 knowledge.json 里的「事件」字段对应
export const SEA_CARD_EVENTS: Record<string, string> = {
  redsea: '到红海后',
  indian: '到印度洋后',
  pacific: '到澳洲后',
}
