// 离线缓存:同源静态资源用「先给旧的,后台悄悄换新」,页面本身优先要最新版,
// 拿不到网络时才退回缓存 —— 这样离线能玩,联网时又不会一直卡在旧版本
const CACHE = 'xiaoaixin-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

// 把响应存进缓存,并原样把它交还给调用方。
//
// clone() 必须在这里**同步**调用。之前写成了
//   caches.open(CACHE).then((cache) => cache.put(request, response.clone()))
// —— caches.open() 是异步的,轮到它的 then 执行时,response 的 body 已经被
// return 出去、被浏览器消费掉了,这时再 clone 就抛
// "Failed to execute 'clone' on 'Response': Response body is already used"。
// 后果不只是控制台刷红:cache.put 从来没跑成功过,离线缓存实际上一直是空的
function cacheAndReturn(event, request, response) {
  // 只缓存成功的响应。把 404 / 500 存进去,离线时会拿它当正经内容返回
  if (!response.ok) return response

  const copy = response.clone()
  // waitUntil:写缓存是异步的,不挂在 event 上的话 SW 可能在写完之前就被回收
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.put(request, copy))
      // 配额满或写失败:这次没存上,但页面照常拿到网络响应。不打扰
      .catch(() => undefined),
  )
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => cacheAndReturn(event, request, response))
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/'))),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => cacheAndReturn(event, request, response))
        .catch(() => cached)
      return cached || network
    }),
  )
})
