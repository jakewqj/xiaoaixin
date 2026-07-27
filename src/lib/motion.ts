// 用来让 JS 里的时长和 CSS 里的动画保持一致:开了「减弱动态效果」就不要让她干等一段看不见的动画
export function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
