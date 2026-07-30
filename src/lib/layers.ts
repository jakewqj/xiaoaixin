// 九层图层的 z-index,顺序写死不能乱。见 CLAUDE.md 十二 / ROADMAP.md §1.2
export const LAYER_Z = {
  sky: 0,
  farIsland: 1,
  waterSurface: 2,
  underwaterFar: 3,
  underwaterMid: 4,
  seabed: 5,
  actors: 6,
  bubbles: 7,
  hud: 8,
} as const

export type LayerName = keyof typeof LAYER_Z
