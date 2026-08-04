// emoji → 像素图标的映射。素材由 draw-icons.mjs 生成,落在 /assets/world/ui/icons/。
//
// 为什么保留 emoji 当 key、而不是把 content/*.json 里的图标字段直接改成文件名:
//   1. 数据文件一个字不用动(album/dialogue/npc 三份,几十处 icon 字段)
//   2. 以后新写一句台词,顺手打个 emoji 就能用 —— 没配像素素材时原样显示 emoji,
//      不会变成裂图。等哪天补了素材,加一行映射就自动升级
//
// 素材是可替换资源(CLAUDE.md 五/十三):这里只出路径,不内联任何图形。
// 换成童童的手绘稿 = 往 icons/ 里拖同名 PNG,这个文件一行都不用改。

export const ICON_DIR = '/assets/world/ui/icons'

// key 一律不带变体选择符 U+FE0F(❤️ ☺️ 这类在 JSON 里是带的,查表前统一剥掉)
const MAP: Record<string, string> = {
  '\u{1F30A}': 'wave', // 🌊
  '\u{1FAE7}': 'bubbles', // 🫧
  '\u{1F319}': 'moon', // 🌙
  '\u{1F331}': 'sprout', // 🌱
  '\u{1F33F}': 'herb', // 🌿
  '\u{1FAB8}': 'coral', // 🪸
  '\u{1F3A8}': 'palette', // 🎨
  '\u{1F422}': 'turtle', // 🐢
  '\u{1F42C}': 'dolphin', // 🐬
  '\u{1F40B}': 'whale', // 🐋
  '\u{263A}': 'face_smile', // ☺
  '\u{1F440}': 'eyes', // 👀
  '\u{1F44B}': 'wave_hand', // 👋
  '\u{1F44F}': 'cheer', // 👏 Yay!
  '\u{1F64F}': 'flower', // 🙏 Thank you!
  '\u{1F90F}': 'size_small', // 🤏 Small!
  '\u{1F4CF}': 'size_big', // 📏 Big!
  '\u{1F522}': 'count_four', // 🔢 Four!
  '\u{2764}': 'heart', // ❤
  '\u{1F497}': 'heart_pink', // 💗
  '\u{2753}': 'question', // ❓
}

/** 变体选择符:让 ❤ ☺ 这类字符按彩色 emoji 而不是黑白符号渲染。
 *  JSON 里的 ❤️ ☺️ 都带着它,查表前要剥掉 */
const VARIATION_SELECTOR_16 = 0xfe0f

/**
 * 查这个 emoji 有没有对应的像素素材。没有就返回 null,由调用方原样渲染 emoji。
 *
 * 用按码点过滤而不是正则:U+FE0F 在编辑器里完全不可见,写进正则字面量的话
 * 下一个人看到的是 `replace(//g, '')`,根本看不出在删什么。
 * 展开成数组还顺带正确处理了代理对(🫧 🪸 这些都在 BMP 之外)。
 */
export function iconSrc(emoji: string): string | null {
  const key = [...emoji].filter((c) => c.codePointAt(0) !== VARIATION_SELECTOR_16).join('')
  const name = MAP[key.trim()]
  return name ? `${ICON_DIR}/${name}.png` : null
}
