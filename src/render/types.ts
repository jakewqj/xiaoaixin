// 渲染层与 DOM 之间唯一的契约。
//
// canvas 里没有 <button>,焦点框、aria-label、Tab 顺序、读屏器全得靠上面那层透明 DOM 撑住。
// 每个绘制器画完自己那一层就顺手把可点区域交出来 —— 热区是像素的副产物,不是另抄一份坐标,
// 所以永远不会和画面对不上(CLAUDE.md 四「键盘焦点可见」/ REFACTOR_PLAN §〇 后果 B)。

/** 舞台坐标(480x270)里的一块可点区域 */
export interface Hotspot {
  id: string
  x: number
  y: number
  w: number
  h: number
  label: string
}
