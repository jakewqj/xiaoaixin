// 童童画的画和写的字存在 IndexedDB 里,localStorage 主存档只存 id。
//
// 为什么必须这样:一张 1024×768 的 PNG 大约 100–400 KB,localStorage 的配额只有 5 MB
// 左右,而且写爆的时候是**整份存档一起丢** —— 天数、海草、相册、熟悉度全没了。
// CLAUDE.md 十四把「base64 图片写进 localStorage」列为硬性禁止,这个文件就是那条的落地。
//
// 这里所有函数都不抛错:存不上、读不到、浏览器不给用,一律当作「这张没有」,
// 游戏照玩(宪法十四:失败时静默降级,绝不白屏,孩子看不懂 error)。

const DB_NAME = 'xiaoaixin'
const DB_VERSION = 1
const STORE = 'xiaoaixin_drawings'

// 无痕模式下 open() 可能既不 success 也不 error,一直挂着。挂着比失败更糟 ——
// 调用方会永远停在「正在存」。超时就当没有 IndexedDB
const OPEN_TIMEOUT_MS = 5000

export type DrawingId = string

type Done<T> = { ok: true; value: T } | { ok: false }

let dbPromise: Promise<IDBDatabase | null> | null = null

function openRaw(): Promise<IDBDatabase | null> {
  return new Promise<IDBDatabase | null>((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null)
        return
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      const timer = setTimeout(() => resolve(null), OPEN_TIMEOUT_MS)
      const settle = (db: IDBDatabase | null) => {
        clearTimeout(timer)
        resolve(db)
      }
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE)
        }
      }
      req.onsuccess = () => {
        const db = req.result
        // 另一个标签页要升级数据库时让路,否则那边会一直 blocked
        db.onversionchange = () => {
          db.close()
          dbPromise = null
        }
        settle(db)
      }
      req.onerror = () => settle(null)
      req.onblocked = () => settle(null)
    } catch {
      resolve(null)
    }
  })
}

function openDb(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = openRaw().then((db) => {
      // 打不开就不缓存这个结果。可能只是另一个标签页正占着,下次调用再试一次
      if (!db) dbPromise = null
      return db
    })
  }
  return dbPromise
}

// 一律等事务 complete 才算成功。put 的 onsuccess 在提交之前就会响,
// 配额不够是在 tx.onabort 上才报出来的 —— 只看 onsuccess 会把存满当成存上了
function run<T>(
  mode: IDBTransactionMode,
  body: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<Done<T>> {
  return openDb()
    .then((db) => {
      if (!db) return { ok: false as const }
      return new Promise<Done<T>>((resolve) => {
        try {
          const tx = db.transaction(STORE, mode)
          const req = body(tx.objectStore(STORE))
          let value: T
          req.onsuccess = () => {
            value = req.result
          }
          tx.oncomplete = () => resolve({ ok: true, value })
          tx.onabort = () => resolve({ ok: false })
          tx.onerror = () => resolve({ ok: false })
        } catch {
          resolve({ ok: false })
        }
      })
    })
    .catch(() => ({ ok: false as const }))
}

// key 用毫秒时间戳(CLAUDE.md 十四:`drawing_{timestamp}`)。
// 同一毫秒内连存两张也不会撞 id —— 撞了就是后一张把前一张盖掉,而画不许消失
let lastStamp = 0
function nextId(): DrawingId {
  const stamp = Math.max(Date.now(), lastStamp + 1)
  lastStamp = stamp
  return `drawing_${stamp}`
}

// 存一张画。返回它的 id,存不上返回 null(调用方要把 null 当「这次没存上」处理,不要报错)
export async function saveDrawing(png: Blob): Promise<DrawingId | null> {
  const id = nextId()
  const done = await run<IDBValidKey>('readwrite', (store) => store.put(png, id))
  return done.ok ? id : null
}

// 读一张画。id 不存在、或者数据库读不了,都返回 null
export async function loadDrawing(id: DrawingId): Promise<Blob | null> {
  const done = await run<unknown>(
    'readonly',
    (store) => store.get(id) as IDBRequest<unknown>,
  )
  if (!done.ok) return null
  return done.value instanceof Blob ? done.value : null
}

// 删一张画。返回删掉了没有。**这个函数只给爸爸的后台和「挂满了换下来」用,
// 童童自己没有任何入口能删掉她的画(宪法原则 10:永远不消失)**
export async function deleteDrawing(id: DrawingId): Promise<boolean> {
  const done = await run<undefined>('readwrite', (store) => store.delete(id))
  return done.ok
}

// 列出所有画的 id,按画下来的先后排(时间戳 key 天然有序)。读不了就返回空数组
export async function listDrawings(): Promise<DrawingId[]> {
  const done = await run<IDBValidKey[]>('readonly', (store) => store.getAllKeys())
  if (!done.ok) return []
  return done.value.filter((key): key is string => typeof key === 'string')
}
