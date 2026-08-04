import { iconSrc } from '../lib/icons'

interface PixelIconProps {
  /** content/*.json 里写的那个 emoji。没有对应像素素材时原样显示它,不会变裂图 */
  emoji: string
  /** 全屏弹层用 —— 它们在舞台缩放之外,尺寸要乘 --ui-scale(见 index.css) */
  scaled?: boolean
}

// 把台词/回忆/话题旁边的系统彩色 emoji 换成像素图标。
// emoji 有抗锯齿、有渐变、还随系统字体版本变样,在像素界面里是异物。
// 一律 aria-hidden:图标是文字的装饰,读屏器念旁边那句话就够了,
// 念一遍「海豚」再念一遍「Hello!」反而啰嗦
function PixelIcon({ emoji, scaled = false }: PixelIconProps) {
  const src = iconSrc(emoji)
  if (!src) {
    return (
      <span className={scaled ? 'ui-text-tight' : 'text-xs leading-none'} aria-hidden="true">
        {emoji}
      </span>
    )
  }
  return <img src={src} alt="" aria-hidden="true" className={scaled ? 'ui-icon' : undefined} />
}

export default PixelIcon
