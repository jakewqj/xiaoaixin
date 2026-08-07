// 双存储验证页(ROADMAP S2-1:「写一个测试页验证存 20 张图不爆配额」)。
//
// 只在 dev 下能打开:vite 的构建入口只有 index.html,根目录其它 html 不进 dist,
// 所以这一页不会跟着上线,童童看不到它。
//
// 它验的是三件事:
//   1. 20 张 1024×768 的 PNG 存进 IndexedDB 不爆配额,还能原样读回来
//   2. 同一批画按 base64 塞进 localStorage 会是多大 —— 也就是 CLAUDE.md 十四
//      为什么把那条列为硬性禁止(只算不写,绝不真的去撑爆童童的存档)
//   3. 存不上/读不到时静默降级,不抛错
//
// 跑完默认把自己造的 20 张删干净。**不碰 xiaoaixin_save,也不碰跑之前就存在的画。**

import {
  deleteDrawing,
  listDrawings,
  loadDrawing,
  saveDrawing,
} from '../lib/drawings'

const COUNT = 20
const W = 1024
const H = 768
const SCRATCH_KEY = 'xiaoaixin_drawings_test'

const out = document.getElementById('out') as HTMLPreElement
const shelf = document.getElementById('shelf') as HTMLDivElement
const runBtn = document.getElementById('run') as HTMLButtonElement
const keepBox = document.getElementById('keep') as HTMLInputElement

let failures = 0

function log(line: string) {
  out.textContent += line + '\n'
  out.scrollTop = out.scrollHeight
}

function check(label: string, pass: boolean, detail = '') {
  if (!pass) failures += 1
  log(`${pass ? '✓' : '✗'} ${label}${detail ? '  ' + detail : ''}`)
}

function kb(bytes: number) {
  return (bytes / 1024).toFixed(1) + ' KB'
}

function mb(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

// 造一张「像童童画的」PNG:白底 + 几十道随机粗线。
// 随机线条压缩率低,是接近最坏情况的体积,比画个圆更有参考价值
function fakeDrawing(seed: number): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, H)

  // 和 2-3 定的「只给 4 种颜色」对齐
  const colors = ['#243642', '#FF8FA3', '#6FA84B', '#2E8B9B']
  let rnd = seed * 9301 + 49297
  const next = () => {
    rnd = (rnd * 9301 + 49297) % 233280
    return rnd / 233280
  }

  for (let i = 0; i < 60; i += 1) {
    ctx.strokeStyle = colors[i % colors.length]
    ctx.lineWidth = 2 + next() * 10
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(next() * W, next() * H)
    for (let p = 0; p < 6; p += 1) {
      ctx.lineTo(next() * W, next() * H)
    }
    ctx.stroke()
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

async function quota() {
  try {
    if (!navigator.storage?.estimate) return null
    const est = await navigator.storage.estimate()
    return { usage: est.usage ?? 0, quota: est.quota ?? 0 }
  } catch {
    return null
  }
}

async function main() {
  runBtn.disabled = true
  out.textContent = ''
  shelf.innerHTML = ''
  failures = 0

  // ---- 0. 先记下跑之前已经有什么,后面一张都不许碰 ----
  const before = await listDrawings()
  log(`跑之前数据库里已有 ${before.length} 张画,这些一张都不会动。\n`)

  const q0 = await quota()
  if (q0) log(`存储用量(全站):${mb(q0.usage)} / 配额 ${mb(q0.quota)}\n`)

  // ---- 1. 造 20 张,一张张存 ----
  const mine: string[] = []
  let totalBytes = 0
  const t0 = performance.now()

  for (let i = 0; i < COUNT; i += 1) {
    const png = await fakeDrawing(i + 1)
    if (!png) {
      check(`第 ${i + 1} 张:生成 PNG`, false, 'toBlob 返回空')
      continue
    }
    const id = await saveDrawing(png)
    if (id) {
      mine.push(id)
      totalBytes += png.size
    } else {
      check(`第 ${i + 1} 张:存进 IndexedDB`, false, 'saveDrawing 返回 null')
    }
  }
  const elapsed = performance.now() - t0

  check(
    `存了 ${COUNT} 张 ${W}×${H} 的 PNG`,
    mine.length === COUNT,
    `实存 ${mine.length} 张,共 ${kb(totalBytes)},平均 ${kb(totalBytes / Math.max(1, mine.length))}/张,耗时 ${elapsed.toFixed(0)} ms`,
  )
  check('id 互不重复', new Set(mine).size === mine.length)

  // ---- 2. list 出来的应该正好多这 20 张,顺序按画下来的先后 ----
  const after = await listDrawings()
  const added = after.filter((id) => !before.includes(id))
  check(
    'list 出来的数量对得上',
    after.length === before.length + mine.length,
    `${before.length} + ${mine.length} = ${after.length}`,
  )
  check('原有的画一张没丢', before.every((id) => after.includes(id)))
  check(
    'list 的顺序 = 画下来的先后',
    added.join(',') === mine.join(','),
  )

  // ---- 3. 读回来:大小一致,而且真的能显示 ----
  const first = await loadDrawing(mine[0])
  check('读得回第 1 张', first instanceof Blob, first ? kb(first.size) : '')
  check('读回来是 PNG', first?.type === 'image/png', first?.type ?? '')

  const last = await loadDrawing(mine[mine.length - 1])
  check('读得回第 20 张', last instanceof Blob)

  for (const blob of [first, last]) {
    if (!blob) continue
    const img = document.createElement('img')
    img.src = URL.createObjectURL(blob)
    img.width = 160
    img.onload = () => URL.revokeObjectURL(img.src)
    shelf.appendChild(img)
  }

  const missing = await loadDrawing('drawing_不存在的')
  check('读一个不存在的 id 返回 null,不抛错', missing === null)

  // ---- 4. 配额:20 张之后用了多少 ----
  const q1 = await quota()
  if (q0 && q1) {
    const grew = q1.usage - q0.usage
    check(
      '20 张之后没有逼近配额',
      q1.quota === 0 || q1.usage < q1.quota * 0.5,
      `多用了 ${mb(grew)},现在 ${mb(q1.usage)} / ${mb(q1.quota)}(占 ${((q1.usage / Math.max(1, q1.quota)) * 100).toFixed(1)}%)`,
    )
  } else {
    log('（这个浏览器不给查配额,跳过用量统计）')
  }

  // ---- 5. 对照:同一批画如果按 base64 进 localStorage ----
  // 只算,不写。真去写就是拿童童的存档做实验
  const b64Bytes = Math.ceil(totalBytes / 3) * 4
  const LS_LIMIT = 5 * 1024 * 1024
  log('')
  log(`对照 · 如果按 base64 塞进 localStorage:`)
  log(`   ${kb(totalBytes)} 的 PNG → 约 ${mb(b64Bytes)} 的字符串(base64 涨 4/3)`)
  log(
    `   localStorage 约 ${mb(LS_LIMIT)} 上限 → 第 ${Math.max(1, Math.floor(LS_LIMIT / (b64Bytes / Math.max(1, mine.length))))} 张左右写爆,` +
      `爆的时候 xiaoaixin_save 整份一起丢`,
  )

  // id 引用有多小:量一下就知道为什么主存档里只放 id
  try {
    localStorage.setItem(SCRATCH_KEY, JSON.stringify(mine))
    const idBytes = new Blob([localStorage.getItem(SCRATCH_KEY) ?? '']).size
    localStorage.removeItem(SCRATCH_KEY)
    check(
      '主存档只存 id:20 个 id 的体积可以忽略',
      idBytes < 2048,
      `${idBytes} 字节,是图片本体的 1/${Math.round(totalBytes / Math.max(1, idBytes))}`,
    )
  } catch {
    log('（localStorage 写不了,跳过 id 体积对照）')
  }
  check(
    '全程没碰真存档 xiaoaixin_save',
    localStorage.getItem(SCRATCH_KEY) === null,
  )

  // ---- 6. 删一张 ----
  const victim = mine[mine.length - 1]
  const removed = await deleteDrawing(victim)
  const afterDel = await listDrawings()
  check('删得掉一张', removed && !afterDel.includes(victim))
  check(
    '删一张只少一张',
    afterDel.length === after.length - 1,
    `${after.length} → ${afterDel.length}`,
  )
  check('删过的 id 读回来是 null', (await loadDrawing(victim)) === null)

  // ---- 7. 收尾:把自己造的清掉,跑之前的原样留着 ----
  if (keepBox.checked) {
    log(`\n按你的选择留着这 ${mine.length - 1} 张没删,自己去 DevTools → Application 看。`)
  } else {
    for (const id of mine) await deleteDrawing(id)
    const end = await listDrawings()
    check(
      '收尾:造出来的全删了,原有的一张没动',
      end.length === before.length && before.every((id) => end.includes(id)),
      `剩 ${end.length} 张`,
    )
  }

  log('')
  log(failures === 0 ? `全部通过。` : `${failures} 项没过。`)
  runBtn.disabled = false
}

runBtn.addEventListener('click', () => {
  void main()
})
