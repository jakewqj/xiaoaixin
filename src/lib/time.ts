// 时间系统(ROADMAP 4-1)。**跟着这台机器的系统时间走**,不加速、不压缩 ——
// 她看到的天黑、月亮的圆缺、潮水的涨落,和窗外是同一个。
//
// 全部是纯函数:给一个时间戳,算出一份结果。**不存状态、不进存档**
// (SaveData 一个字段没加),所以换设备、清存档都不影响 —— 时间本来就不是玩家的进度。
//
// 出处(原则 9):
//   潮汐每天推迟约 50 分钟 —— facts.json `fact_tide_50min`,已核对
//   朔望月 29.530588853 天、太阴日 24.8412 小时 —— 基础天文常数
//
// **两处刻意的简化,如实记着:**
// 1. 日出日落写死 6:00 / 18:00,不按经纬度算真实日出。要算真实日出就得拿定位,
//    而这是个六岁孩子的离线游戏(宪法二:零账号、零服务器、不收集任何信息)。
//    广州一年里日出在 5:40–7:10 之间晃,6:00 落在中间,差的那点她看不出来。
// 2. 高潮出现在钟面上的哪一刻,真实世界里每个港口都不一样(取决于海岸地形)。
//    这里算的是**天文驱动**那一半:周期、每天推迟 50 分钟、满月新月大潮 —— 这几条是真的。

/** 一天里的四个时段 */
export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night'

export interface SkyState {
  phase: DayPhase
  /** 0 = 正午,1 = 深夜。tint 的强度直接用它,黄昏/黎明是连续过渡 */
  darkness: number
}

export interface MoonState {
  /** 0 = 新月,0.5 = 满月,1 = 又回到新月 */
  age: number
  /** 0–7,对应 8 张月亮图。0 是新月,4 是满月 */
  frame: number
  /** 给童童看的说法。**不用「盈凸月」「娥眉月」这类书面语和生僻字**(原则 2) */
  name: string
}

export interface TideState {
  /** -1 = 最低潮,+1 = 最高潮 */
  level: number
  rising: boolean
  /** 「涨潮」/「退潮」 */
  name: string
  /** 大潮 0.4–1:满月和新月最大(大潮),上下弦最小(小潮)。GDD §9.2 */
  range: number
}

// 朔望月。29.5 天这个数是真的,别四舍五入成 30 —— 一年会差掉 5 天多,
// 而月亮圆不圆她一抬头就看得见(GDD §9.2 写「30 天周期」是个约数)
const SYNODIC_DAYS = 29.530588853
// 太阴日:月亮连续两次上中天的间隔。24h50m28s —— 「潮汐每天晚约 50 分钟」就是从这来的
const LUNAR_DAY_MS = 24.8412 * 3600 * 1000
// 半日潮:一个太阴日里涨落两回
const TIDE_PERIOD_MS = LUNAR_DAY_MS / 2

// 基准新月:2000-01-06 18:14 UTC。标准天文历元,潮汐的相位也挂在它上面,
// 这样月亮和潮水永远是同一套时间,不会各走各的
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14, 0)

const DAY_MS = 24 * 3600 * 1000

function frac(x: number): number {
  return x - Math.floor(x)
}

function smooth(t: number): number {
  const k = Math.min(1, Math.max(0, t))
  return k * k * (3 - 2 * k)
}

// 一天里的明暗。日出日落写死 6:00 / 18:00(见文件头第 1 条简化),
// 前后各留一小时的黎明和黄昏 —— 天不是「啪」一下黑的,那一下比黑本身更吓人
const SUNRISE_H = 6
const SUNSET_H = 18
const TWILIGHT_H = 1

/** 这一刻的天色。用的是本地时间 —— 她在广州,看到的就该是广州的天 */
export function skyAt(now: number): SkyState {
  const d = new Date(now)
  const h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600
  if (h >= SUNRISE_H - TWILIGHT_H && h < SUNRISE_H + TWILIGHT_H) {
    const t = (h - (SUNRISE_H - TWILIGHT_H)) / (TWILIGHT_H * 2)
    return { phase: 'dawn', darkness: 1 - smooth(t) }
  }
  if (h >= SUNSET_H - TWILIGHT_H && h < SUNSET_H + TWILIGHT_H) {
    const t = (h - (SUNSET_H - TWILIGHT_H)) / (TWILIGHT_H * 2)
    return { phase: 'dusk', darkness: smooth(t) }
  }
  if (h >= SUNRISE_H + TWILIGHT_H && h < SUNSET_H - TWILIGHT_H) {
    return { phase: 'day', darkness: 0 }
  }
  return { phase: 'night', darkness: 1 }
}

// 月亮的说法。**一共只用五个词**,而且每个都是她嘴里说得出来的话 ——
// 「盈凸月」「娥眉月」「下弦月」是书面语和生僻字,原则 2 明令不用。
// 亏的那半个月复用同一批词:圆缺是不是在变大,看图就知道,不靠文字分
const MOON_NAMES = ['新月', '弯月亮', '半个月亮', '快圆了', '满月'] as const

/** 这一刻的月相 */
export function moonAt(now: number): MoonState {
  const age = frac((now - NEW_MOON_EPOCH) / (SYNODIC_DAYS * DAY_MS))
  // 8 张图:0 新月 → 4 满月 → 7 残月。round 之后要对 8 取模,0.95 会算成 8
  const frame = Math.round(age * 8) % 8
  // 名字按「离满月多远」取,所以上弦和下弦都叫「半个月亮」
  const fullness = 1 - Math.abs(age - 0.5) * 2
  const name = MOON_NAMES[Math.min(MOON_NAMES.length - 1, Math.round(fullness * 4))]
  return { age, frame, name }
}

/** 这一刻的潮水 */
export function tideAt(now: number): TideState {
  const phase = frac((now - NEW_MOON_EPOCH) / TIDE_PERIOD_MS)
  const angle = phase * Math.PI * 2
  const level = Math.cos(angle)
  // 导数为正就是在涨。sin 前面的负号来自 cos 的导数
  const rising = -Math.sin(angle) > 0
  // 大潮小潮:满月和新月时日月连成一线,潮差最大(GDD §9.2「满月 → 大潮」)。
  // 小潮不压到 0 —— 潮水从来不会停,压到 0 那天她会以为坏了
  const moonAngle = frac((now - NEW_MOON_EPOCH) / (SYNODIC_DAYS * DAY_MS)) * Math.PI * 2
  const range = 0.4 + 0.6 * Math.abs(Math.cos(moonAngle))
  return { level, rising, name: rising ? '涨潮' : '退潮', range }
}

// 北半球的四季,按月份分。她在广州,秋冬不明显,但「现在是什么季节」这句话
// 跟着日历走总不会错
const SEASONS = ['冬天', '冬天', '春天', '春天', '春天', '夏天', '夏天', '夏天', '秋天', '秋天', '秋天', '冬天'] as const

export function seasonAt(now: number): string {
  return SEASONS[new Date(now).getMonth()]
}
