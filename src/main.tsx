import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 注册离线缓存,这样断网时童童也能继续玩。
//
// **只在生产注册。** sw.js 对静态资源走「先给缓存里的旧的,后台再悄悄换新」,
// 这在线上是对的(离线能玩,新版本下次访问到位),开发时却会让人以为改了没生效:
// 改完美术第一次刷新,页面拿到的必然是上一版,第二次才对。
// 2026-09-08 重画绿绿时就撞了这一下,查了半天发现服务端和磁盘都是新的。
// 生产行为一个字没变,只是 dev 不再注册 —— 并且要把以前那些 dev 会话留下的
// SW 拆掉:光「不再注册」不够,已经装上的那个会继续接管、继续拿旧缓存伺服。
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  } else {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((reg) => reg.unregister())))
      .catch(() => undefined)
    if ('caches' in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .catch(() => undefined)
    }
  }
}
