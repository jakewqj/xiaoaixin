import type { ReactNode } from 'react'
import type { ConfigOverride, ConfigSpec } from '../hooks/useConfig'
import type { WorldSpec } from '../hooks/useWorld'
import type { NpcMap } from '../hooks/useNpcs'
import type { LogEntry } from '../hooks/useDialogueLog'

interface AdminPanelProps {
  config: ConfigSpec
  world: WorldSpec | null
  npcs: NpcMap | null
  logEntries: LogEntry[]
  onUpdate: (patch: ConfigOverride) => void
  onReset: () => void
  onResetToOnlyPet: () => void
  onClose: () => void
}

// 导出成 txt,一行一条:时间 / NPC / 选了哪句话
function exportLogTxt(entries: LogEntry[]) {
  const lines = entries
    .map((e) => `${new Date(e.time).toLocaleString()}\t${e.npcName}\t${e.optionText}`)
    .join('\n')
  const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `xiaoaixin_log_${new Date().toISOString().slice(0, 10)}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

const STAGE_OPTIONS = ['幼年', '少年', '亚成年', '成年']

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2">
      <span className="font-wenkai text-sm text-ink">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 cursor-pointer"
      />
    </label>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-kuaile text-base text-ink/60">{title}</h2>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  )
}

// 爸爸的控制后台:可视化编辑 config.json 全部字段,改动叠加存 localStorage,不碰文件本身。
// 这里给爸爸用,不是给童童用,所以没有按 56px/24px 那套儿童可用性标准做
function AdminPanel({
  config,
  world,
  npcs,
  logEntries,
  onUpdate,
  onReset,
  onResetToOnlyPet,
  onClose,
}: AdminPanelProps) {
  const seaNames = Object.keys(world?.海域 ?? {})
  const allSpots = Object.values(world?.海域 ?? {}).flatMap((sea) => sea.地点)
  const npcEntries = Object.entries(npcs ?? {})

  function toggleInList(list: string[], value: string, on: boolean) {
    return on ? [...list, value] : list.filter((v) => v !== value)
  }

  function toggleNpc(id: string, on: boolean) {
    if (on) {
      const spec = npcs?.[id]
      onUpdate({
        开放NPC: [
          ...config.开放NPC,
          { id, 语言: spec?.语言, 熟悉度上限: spec?.熟悉度上限 ?? 5 },
        ],
      })
    } else {
      onUpdate({ 开放NPC: config.开放NPC.filter((n) => n.id !== id) })
    }
  }

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-sand">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-sand/95 px-4 py-3 backdrop-blur-sm">
        <p className="font-kuaile text-lg text-ink">控制后台</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-white/85 px-4 py-2 font-wenkai text-sm text-ink shadow-sm active:scale-95"
        >
          关闭
        </button>
      </div>

      <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 pt-2 pb-16">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onReset}
            className="flex-1 rounded-xl bg-white/85 px-3 py-2 font-wenkai text-sm text-ink shadow-sm active:scale-95"
          >
            恢复默认
          </button>
          <button
            type="button"
            onClick={onResetToOnlyPet}
            className="flex-1 rounded-xl bg-white/85 px-3 py-2 font-wenkai text-sm text-ink shadow-sm active:scale-95"
          >
            一键回到只有小爱心
          </button>
        </div>

        <Section title="开放海域">
          {seaNames.map((name) => (
            <Toggle
              key={name}
              label={name}
              checked={config.开放海域.includes(name)}
              onChange={(v) => onUpdate({ 开放海域: toggleInList(config.开放海域, name, v) })}
            />
          ))}
        </Section>

        <Section title="开放地点">
          {allSpots.map((spot) => (
            <Toggle
              key={spot.id}
              label={spot.名字}
              checked={config.开放地点.includes(spot.名字)}
              onChange={(v) => onUpdate({ 开放地点: toggleInList(config.开放地点, spot.名字, v) })}
            />
          ))}
        </Section>

        <Section title="开放NPC">
          {npcEntries.map(([id, npc]) => (
            <Toggle
              key={id}
              label={npc.名字}
              checked={config.开放NPC.some((n) => n.id === id)}
              onChange={(v) => toggleNpc(id, v)}
            />
          ))}
        </Section>

        <Section title="系统开关">
          {Object.entries(config.系统开关).map(([key, value]) => (
            <Toggle
              key={key}
              label={key}
              checked={value}
              onChange={(v) => onUpdate({ 系统开关: { [key]: v } })}
            />
          ))}
        </Section>

        <Section title="语言设置">
          <Toggle
            label="拼音"
            checked={config.语言设置.拼音}
            onChange={(v) => onUpdate({ 语言设置: { 拼音: v } })}
          />
          <Toggle
            label="英语朗读"
            checked={config.语言设置.英语朗读}
            onChange={(v) => onUpdate({ 语言设置: { 英语朗读: v } })}
          />
          <label className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2">
            <span className="font-wenkai text-sm text-ink">英语选项数量(2-3)</span>
            <input
              type="number"
              min={2}
              max={3}
              value={config.语言设置.英语选项数量}
              onChange={(e) =>
                onUpdate({
                  语言设置: {
                    英语选项数量: Math.min(3, Math.max(2, Number(e.target.value) || 2)),
                  },
                })
              }
              className="w-16 rounded-md border border-ink/20 bg-white px-2 py-1 text-right font-wenkai text-sm"
            />
          </label>
        </Section>

        <Section title="成长设置">
          <label className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2">
            <span className="font-wenkai text-sm text-ink">阶段推进速度</span>
            <input
              type="number"
              step={0.1}
              min={0.1}
              value={config.成长设置.阶段推进速度}
              onChange={(e) =>
                onUpdate({ 成长设置: { 阶段推进速度: Number(e.target.value) || 1 } })
              }
              className="w-20 rounded-md border border-ink/20 bg-white px-2 py-1 text-right font-wenkai text-sm"
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2">
            <span className="font-wenkai text-sm text-ink">手动设置阶段(测试用)</span>
            <select
              value={config.成长设置.手动设置阶段 ?? ''}
              onChange={(e) =>
                onUpdate({ 成长设置: { 手动设置阶段: e.target.value || null } })
              }
              className="rounded-md border border-ink/20 bg-white px-2 py-1 font-wenkai text-sm"
            >
              <option value="">不锁定</option>
              {STAGE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </Section>

        <Section title="知识卡">
          <label className="flex flex-col gap-1 rounded-xl bg-white/70 px-3 py-2">
            <span className="font-wenkai text-sm text-ink">屏蔽的卡(逗号分隔 id)</span>
            <textarea
              value={config.知识卡.屏蔽.join(', ')}
              onChange={(e) =>
                onUpdate({
                  知识卡: {
                    屏蔽: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
              rows={2}
              className="rounded-md border border-ink/20 bg-white px-2 py-1 font-wenkai text-sm"
            />
          </label>
        </Section>

        <Section title="陪伴设置">
          <label className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2">
            <span className="font-wenkai text-sm text-ink">单次游玩软提示(分钟)</span>
            <input
              type="number"
              min={1}
              value={config.陪伴设置.单次游玩软提示分钟}
              onChange={(e) =>
                onUpdate({ 陪伴设置: { 单次游玩软提示分钟: Number(e.target.value) || 20 } })
              }
              className="w-16 rounded-md border border-ink/20 bg-white px-2 py-1 text-right font-wenkai text-sm"
            />
          </label>
        </Section>

        <Section title="小爱心皮肤">
          <select
            value={config.小爱心皮肤}
            onChange={(e) => onUpdate({ 小爱心皮肤: e.target.value })}
            className="rounded-md border border-ink/20 bg-white px-2 py-1 font-wenkai text-sm"
          >
            <option value="pixel">pixel(像素风)</option>
            <option value="tongtong">tongtong(童童手绘)</option>
          </select>
        </Section>

        <Section title="后台">
          <label className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2">
            <span className="font-wenkai text-sm text-ink">密码(4 位数字)</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              value={config.后台.密码}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
                onUpdate({ 后台: { 密码: digits } })
              }}
              className="w-20 rounded-md border border-ink/20 bg-white px-2 py-1 text-right font-wenkai text-sm"
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2">
            <span className="font-wenkai text-sm text-ink">对话日志上限(条)</span>
            <input
              type="number"
              min={1}
              value={config.后台.对话日志上限}
              onChange={(e) =>
                onUpdate({ 后台: { 对话日志上限: Number(e.target.value) || 500 } })
              }
              className="w-20 rounded-md border border-ink/20 bg-white px-2 py-1 text-right font-wenkai text-sm"
            />
          </label>
        </Section>

        <Section title="对话日志">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2">
            <span className="font-wenkai text-sm text-ink">共 {logEntries.length} 条</span>
            <button
              type="button"
              onClick={() => exportLogTxt(logEntries)}
              disabled={logEntries.length === 0}
              className="rounded-xl bg-white px-3 py-1.5 font-wenkai text-sm text-ink shadow-sm active:scale-95 disabled:opacity-40"
            >
              导出 txt
            </button>
          </div>
          {logEntries.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-xl bg-white/70 px-3 py-2">
              {[...logEntries]
                .reverse()
                .map((e, i) => (
                  <p key={i} className="font-wenkai text-xs leading-relaxed text-ink/80">
                    {new Date(e.time).toLocaleString()} · {e.npcName} · {e.optionText}
                  </p>
                ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

export default AdminPanel
