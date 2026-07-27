// 播放短音效。音频文件缺失、格式不支持、浏览器拦截自动播放时一律静默,绝不抛错到界面上
export function playSfx(name: string) {
  try {
    const audio = new Audio(`/assets/sfx/${name}.mp3`)
    audio.volume = 0.6
    audio.play().catch(() => {})
  } catch {
    // 忽略
  }
}
