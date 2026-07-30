import { useCallback, useEffect, useState } from 'react'

const LOG_KEY = 'xiaoaixin_log'
const DEFAULT_LIMIT = 500

export interface LogEntry {
  time: string
  npcId: string
  npcName: string
  optionText: string
}

function isLogEntry(value: unknown): value is LogEntry {
  const e = value as Partial<LogEntry>
  return (
    typeof e?.time === 'string' &&
    typeof e.npcId === 'string' &&
    typeof e.npcName === 'string' &&
    typeof e.optionText === 'string'
  )
}

function readLog(): LogEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isLogEntry) : []
  } catch {
    return []
  }
}

function writeLog(entries: LogEntry[]) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(entries))
  } catch {
    // 存不下就算了,对话日志只是给爸爸看的辅助信息,不影响正常玩
  }
}

// 对话日志:谁在什么时候选了哪句话,只给控制后台看,不影响任何玩法。
// 超过上限(config.json 的「后台.对话日志上限」)就丢最旧的一条,不提醒、不用清空
export function useDialogueLog(limit: number = DEFAULT_LIMIT) {
  const [entries, setEntries] = useState<LogEntry[]>(() => readLog())

  useEffect(() => {
    writeLog(entries)
  }, [entries])

  // 后台把上限调小了,也把存量截掉,不留超出部分
  useEffect(() => {
    setEntries((prev) => (prev.length > limit ? prev.slice(prev.length - limit) : prev))
  }, [limit])

  const log = useCallback(
    (npcId: string, npcName: string, optionText: string) => {
      setEntries((prev) => {
        const next = [...prev, { time: new Date().toISOString(), npcId, npcName, optionText }]
        return next.length > limit ? next.slice(next.length - limit) : next
      })
    },
    [limit],
  )

  return { entries, log }
}
