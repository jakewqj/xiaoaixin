import Sprite from './Sprite'
import PixelIcon from './PixelIcon'
import { FRAME_HEIGHT, FRAME_WIDTH, toneFilter } from '../lib/pet'
import type { GrowthStage } from '../lib/pet'
import type { usePet } from '../hooks/usePet'
import type { AlbumTitles, Memory } from '../hooks/useAlbum'

/** 相册里的一张画(ROADMAP 2-8)。`from` 已经是给她看的那句来处,解析在 App 里做 */
export interface AlbumDrawing {
  id: string
  url: string
  from: string
}

interface AlbumProps {
  pet: ReturnType<typeof usePet>
  stages: GrowthStage[]
  memories: Memory[]
  titles: AlbumTitles
  events: Record<string, string>
  metAt: string
  /** 她画过的全部,按画下来的先后排 */
  drawings: AlbumDrawing[]
  onClose: () => void
}

// 画的 id 是 `drawing_{毫秒}`(lib/drawings.ts 的 nextId),日期直接从 id 里读 ——
// 不用在存档里再存一份「画于何时」,少一个会和 id 对不上的字段
function drawnAt(id: string) {
  const ms = Number(id.slice('drawing_'.length))
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined
}

// 只写「几月几日」。年份对她还没有意义,而且写上年份会让相册看起来像账本
function dayLabel(iso?: string) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

// 相册。只摆发生过的事,不显示总数、不显示没发生的、没有任何「还差几个」——
// 这是回忆,不是成就墙。她翻到哪一页都不会看到自己缺了什么
function Album({
  pet,
  stages,
  memories,
  titles,
  events,
  metAt,
  drawings,
  onClose,
}: AlbumProps) {
  const biggest = Math.max(...stages.map((stage) => stage.体型), 0.01)

  // 成长照片的日期:第一张就是认识那天,后面几张是那天陪她长大的日子
  const stageDay = (stage: GrowthStage, index: number) =>
    dayLabel(index === 0 ? (events.first_meet ?? metAt) : events[`grow_${stage.id}`])

  const shown = memories
    .filter((memory) => events[memory.id])
    .sort((a, b) => Date.parse(events[a.id]) - Date.parse(events[b.id]))

  return (
    <div className="fixed inset-0 z-20 overflow-y-auto bg-parchment">
      <div className="sticky top-0 border-b-4 border-wood-dark bg-wood px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          className="hud-panel-lg flex min-h-14 cursor-pointer items-center gap-2 px-4 py-2 transition-transform active:translate-y-px focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-heart"
        >
          <PixelIcon emoji="🌊" scaled />
          <span className="ui-text font-kuaile text-[#f8e8c8]">回海里</span>
        </button>
      </div>

      <div className="mx-auto flex max-w-2xl flex-col gap-7 px-5 pt-2 pb-16">
        <section className="flex flex-col gap-3">
          <h2 className="ui-text font-kuaile text-wood-dark/80">{titles.成长}</h2>
          {/* 顶对齐:有的阶段有日期有的没有,底对齐会让照片高低不齐 */}
          <div className="flex flex-wrap items-start gap-4">
            {stages.map((stage, index) => {
              const anim = pet.animFor('idle')
              const day = stageDay(stage, index)
              // 圆框(h-28 w-28 = 112px)里留 92% 当最大宽度,和以前 <img width:92%> 的观感一致,
              // 只是现在精灵表要显式给宽高,不能只设宽度靠浏览器按原图比例自动算高度了
              const scale = (stage.体型 / biggest) * ((112 * 0.92) / FRAME_WIDTH)
              return (
                <figure key={stage.id} className="flex flex-col items-center gap-1">
                  {/* 原来是 rounded-full 的圆相框:圆角在像素风里没法成立(边缘必然抗锯齿),
                      改成方形奶白板 —— 参考图的相框本来也都是方的 */}
                  <div className="sv-plate-lg flex h-28 w-28 items-center justify-center overflow-hidden bg-water-shallow/60">
                    {anim && (
                      <Sprite
                        src={anim.src}
                        frame={0}
                        frameWidth={FRAME_WIDTH * scale}
                        frameHeight={FRAME_HEIGHT * scale}
                        frameCount={anim.frameCount}
                        fps={anim.fps}
                        style={{ filter: toneFilter(stage.体色) }}
                      />
                    )}
                  </div>
                  <figcaption className="text-center">
                    <p className="ui-text font-kuaile text-ink">{stage.名字}</p>
                    {stage.en && (
                      <p className="ui-text-tight font-wenkai text-ink/50">{stage.en}</p>
                    )}
                    {day && <p className="ui-text-tight font-wenkai text-ink/40">{day}</p>}
                  </figcaption>
                </figure>
              )
            })}
          </div>
        </section>

        {shown.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="ui-text font-kuaile text-wood-dark/80">{titles.回忆}</h2>
            {shown.map((memory) => (
              <article
                key={memory.id}
                className="sv-plate-lg flex items-center gap-4 px-5 py-4"
              >
                <PixelIcon emoji={memory.icon} scaled />
                <div className="min-w-0">
                  <p className="ui-text font-kuaile text-ink">{memory.text}</p>
                  {memory.en && (
                    <p className="ui-text-tight font-wenkai text-ink/50">{memory.en}</p>
                  )}
                </div>
                <p className="ui-text-tight font-wenkai ml-auto shrink-0 text-ink/40">
                  {dayLabel(events[memory.id])}
                </p>
              </article>
            ))}
          </section>
        )}

        {drawings.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="ui-text font-kuaile text-wood-dark/80">{titles.画画}</h2>
            {/* 这一句是写给爸爸看的,不是给她的操作提示 —— 所以放在标题下面一行、
                用和日期一样的浅色小字,不做成按钮 */}
            <p className="ui-text-tight font-wenkai text-ink/40">长按存到相册</p>
            <div className="flex flex-wrap items-start gap-4">
              {drawings.map((drawing) => (
                <figure key={drawing.id} className="flex w-40 flex-col gap-1">
                  {/* 普通 <img> + object URL:iPad 上长按它会出系统的「存储到照片」。
                      别改成 canvas 或者 background-image,那两样长按都没有这个菜单;
                      也别给它加 -webkit-touch-callout: none */}
                  <img
                    src={drawing.url}
                    alt={drawing.from}
                    className="hud-panel-lg block aspect-[4/3] w-full object-cover"
                  />
                  <figcaption className="text-center">
                    <p className="ui-text-tight font-kuaile text-ink">{drawing.from}</p>
                    <p className="ui-text-tight font-wenkai text-ink/40">
                      {dayLabel(drawnAt(drawing.id))}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export default Album
