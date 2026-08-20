// 绘画画布验证页的挂载入口(ROADMAP S2-2)。和 drawings-test.html 一样只在 dev 下存在:
// vite 的构建入口只有 index.html,根目录其它 html 不进 dist,童童看不到这一页。
//
// 这里**故意**引 index.css:它把 image-rendering: pixelated 钉在 :root 上,
// 而那是可继承属性 —— 不引进来,DrawingCanvas 要躲的那个坑就不会出现,等于没测。

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { DrawTestPage } from './DrawTestPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DrawTestPage />
  </StrictMode>,
)
