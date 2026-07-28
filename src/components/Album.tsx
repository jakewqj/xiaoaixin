import { PET_DIR, toneFilter } from '../lib/pet'
import type { GrowthStage } from '../lib/pet'
import type { usePet } from '../hooks/usePet'
import type { AlbumTitles, Memory } from '../hooks/useAlbum'

interface AlbumProps {
  pet: ReturnType<typeof usePet>
  stages: GrowthStage[]
  memories: Memory[]
  titles: AlbumTitles
  events: Record<string, string>
  metAt: string
  onClose: () => void
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
    <div className="absolute inset-0 z-10 overflow-y-auto bg-sand">
      <div className="sticky top-0 bg-sand/95 px-5 py-4 backdrop-blur-sm">
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-14 cursor-pointer items-center gap-2 rounded-3xl bg-white/85 px-6 py-3 shadow-lg transition-transform active:scale-95 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-heart"
        >
          <span className="text-3xl leading-none" aria-hidden="true">
            🌊
          </span>
          <span className="font-kuaile text-2xl text-ink">回海里</span>
        </button>
      </div>

      <div className="mx-auto flex max-w-2xl flex-col gap-7 px-5 pt-2 pb-16">
        <section className="flex flex-col gap-3">
          <h2 className="font-kuaile text-xl text-ink/45">{titles.成长}</h2>
          {/* 顶对齐:有的阶段有日期有的没有,底对齐会让照片高低不齐 */}
          <div className="flex flex-wrap items-start gap-4">
            {stages.map((stage, index) => {
              const file = pet.fileFor('idle', stage)
              const day = stageDay(stage, index)
              return (
                <figure key={stage.id} className="flex flex-col items-center gap-1">
                  <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-water-shallow/60 shadow-sm">
                    {file && (
                      <img
                        src={`${PET_DIR}/${file}`}
                        alt=""
                        draggable={false}
                        className="select-none"
                        style={{
                          width: `${(stage.体型 / biggest) * 92}%`,
                          filter: toneFilter(stage.体色),
                        }}
                      />
                    )}
                  </div>
                  <figcaption className="text-center">
                    <p className="font-kuaile text-xl text-ink">{stage.名字}</p>
                    {stage.en && (
                      <p className="font-wenkai text-sm text-ink/50">{stage.en}</p>
                    )}
                    {day && <p className="font-wenkai text-sm text-ink/40">{day}</p>}
                  </figcaption>
                </figure>
              )
            })}
          </div>
        </section>

        {shown.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="font-kuaile text-xl text-ink/45">{titles.回忆}</h2>
            {shown.map((memory) => (
              <article
                key={memory.id}
                className="flex items-center gap-4 rounded-3xl bg-white/80 px-5 py-4 shadow-sm"
              >
                <span className="text-4xl leading-none" aria-hidden="true">
                  {memory.icon}
                </span>
                <div className="min-w-0">
                  <p className="font-kuaile text-2xl leading-snug text-ink">
                    {memory.text}
                  </p>
                  {memory.en && (
                    <p className="font-wenkai text-base leading-snug text-ink/50">
                      {memory.en}
                    </p>
                  )}
                </div>
                <p className="font-wenkai ml-auto shrink-0 text-base text-ink/40">
                  {dayLabel(events[memory.id])}
                </p>
              </article>
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

export default Album
