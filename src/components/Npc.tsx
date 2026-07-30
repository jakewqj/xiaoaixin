import Sprite from './Sprite'
import { frameSizeOf } from '../hooks/useNpcs'
import type { NpcSpec } from '../hooks/useNpcs'

interface NpcProps {
  npc: NpcSpec
  // 地点里的大致落点(那个地点占的 480 宽范围内的百分比),互动点还没有真坐标,先给个合理位置
  leftPercent: number
  // 现在是不是该演一下开心反应——由 App 统一管理,因为送礼/选中选项都要触发它
  reacting?: boolean
  // 点了她的精灵。挑话题、判断谁在说话都交给 App(唯一一份对话状态在那边,不然会撞出两个对话框)
  onTapSprite: () => void
  // 今天还能不能送礼(有没有长成的海草、今天送过没有),由外面算好传进来——
  // 这里不判断资格,只负责按了之后的反应
  canGift?: boolean
  // 送出一次礼物,通知外面记一笔「今天送过了」并按熟悉度规则涨一级
  onGift?: () => void
}

// 邻居:idle 待机,点一下由 App 决定说什么、要不要理这次点击。
// 有 happy 动画的话,App 会在选中选项/收到礼物后短暂把 reacting 设成 true
function Npc({ npc, leftPercent, reacting = false, onTapSprite, canGift = false, onGift }: NpcProps) {
  const [frameWidth, frameHeight] = frameSizeOf(npc)
  const animKey = reacting && npc.动画.happy ? 'happy' : 'idle'
  const anim = npc.动画[animKey]
  if (!anim) return null

  return (
    // bottom-40(160px):游在中上层水域,一来符合海豚的习性,二来错开小爱心的漂移带(y157-221)
    // 和右下角按钮区(y162 以下)——S1 验收时 NPC 被按钮区盖住点不到的坑,靠高度差解决
    <div className="absolute bottom-40 -translate-x-1/2" style={{ left: `${leftPercent}%` }}>
      <button
        type="button"
        onClick={onTapSprite}
        aria-label={npc.名字}
        className="pointer-events-auto block min-h-14 min-w-14 cursor-pointer"
      >
        <Sprite
          src={`${npc.精灵}${anim.文件}`}
          frameWidth={frameWidth}
          frameHeight={frameHeight}
          frameCount={anim.帧数}
          fps={anim.fps}
        />
      </button>
      {canGift && (
        <button
          type="button"
          onClick={onGift}
          aria-label={`送海草给${npc.名字}`}
          className="pointer-events-auto absolute -top-8 -right-2 flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border-2 border-wood-dark bg-parchment text-lg shadow-sm transition-transform active:scale-95 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
        >
          <span aria-hidden="true">🌱</span>
        </button>
      )}
    </div>
  )
}

export default Npc
