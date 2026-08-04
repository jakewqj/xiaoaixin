// 舞台缩放。绝不用非整数缩放去填满屏幕,宁可留边(CLAUDE.md 十二)。
//
// 单独放一个文件是因为它同时被 ScreenFrame(组件)和 UI canvas(渲染层)用。
// 放在 ScreenFrame.tsx 里会让那个文件既导出组件又导出函数,Fast Refresh 会退化成整页刷新
import { STAGE_HEIGHT, STAGE_WIDTH } from '../components/ScreenFrame'

export function stageScale(width: number, height: number): number {
  return Math.max(1, Math.floor(Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT)))
}
