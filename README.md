# 小爱心

一只雌性儒艮(dugong dugon),住在一片浅海里。爸爸做给童童玩的电子宠物网页。

设计原则、禁止清单、语言规范全部写在 [`CLAUDE.md`](./CLAUDE.md) —— 动手之前先读那份。

## 跑起来

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 静态产物在 dist/,直接丢 Cloudflare Pages
```

零后端、零账号、零网络请求。存档是浏览器里的一个 `localStorage` 键:`xiaoaixin_save`。
想从头开始就在浏览器控制台里 `localStorage.clear()`,不需要任何「重置」按钮。

## 内容都在 JSON 里,不在代码里

改内容不用改代码,改完刷新就生效:

| 文件 | 装的是什么 |
|---|---|
| `public/content/dialogue.json` | 小爱心说的每一句话 |
| `public/content/knowledge.json` | 知识白名单。`已核对: false` 的一律不进游戏 |
| `public/content/whitelist.json` | 允许用的成语和英语 |
| `public/content/album.json` | 相册里的回忆文字 |
| `public/assets/pet/pet.json` | 形象的文件名、锚点、成长阶段、手稿标记 |

## 手稿替换仪式

现在游戏里的小爱心是占位 SVG。童童画好了以后:

1. 童童画 4 张:静止漂浮 / 开心 / 吃海草 / 睡觉
2. 扫描或拍照,抠掉背景
3. 缩放到 512×512,主体朝右、水平居中、占约 70%
4. 命名为 `idle.png` / `happy.png` / `eating.png` / `sleeping.png`
5. 拖进 `public/assets/pet/`,把 `pet.json` 里「文件」字段的 `.svg` 改成 `.png`
6. 把 `pet.json` 里的 `"手稿": { "已替换": false }` 改成 `true`
7. 打开浏览器看一眼泡泡是不是从鼻孔冒出来的。偏了就只调 `pet.json` 的锚点数值,**不要改代码**

第 6 步是仪式那一步:改成 `true` 之后,小爱心下次打开会说一句「这是你画的我」,
并把这天记进相册。只说一次,以后不再提。

只画了其中一两张也没关系 —— 缺的那张会自动退回 `idle`,不会白屏。

## 成长

小爱心按「一共打开过多少天」慢慢长大:小时候 → 长大一点 → 长大了。
体型变大一点、体色从淡奶油色变成石板灰,除此之外什么都不变。

不要求连着来,隔多久回来都不会退回去,也不会因为没来而错过 ——
她哪天回来,长大都在前面等着。阶段、天数、体型、体色全部写在 `pet.json` 的「成长」里,
想改直接改那儿。
