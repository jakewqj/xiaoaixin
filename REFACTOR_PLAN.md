# REFACTOR_PLAN · 渲染层剥离与多层 Canvas 重构

> 目标：把现有 DOM/CSS 渲染层整体换成多层 Canvas（Parallax 背景层 + 角色动画层 + 九宫格 UI 层），
> **游戏核心数据逻辑（State）100% 不变**。
> 依据：`CLAUDE.md` 二十一（Stardew 级渲染松绑）、十二（480×270 / 整数倍缩放）、十三（像素美术）、十九（每次只做一件事）。
>
> 状态：**规划文件，尚未动任何代码。** 每个阶段单独确认后才开工。

---

## 〇、已决议（2026-08-03，用户确认）

| # | 议题 | 决议 |
|---|---|---|
| 1 | 金币 / 心情 | **不加。** 全项目零货币字段、零心情值，`SaveData` 一个字段都不新增。你原话提到的这两样在代码里本来就不存在（详见 1.3），这次不借重构之名引入 |
| 2 | 九宫格 UI 层 | **进 canvas。** HUD 从 DOM 迁到 canvas 绘制 —— 这条推翻 `CLAUDE.md` 二十一·4「HUD 仍然是最上层 DOM，不进 canvas」，宪法需要相应修订（修订稿见 §九，**等你点头我再动 CLAUDE.md**） |
| 3 | 视差 | **确认放阶段 5。** 前四个阶段做到画面像素级不变，你确认没画歪之后再上视差 |

### 决议 2 带来的两个后果，先说在前面

**后果 A：文字会糊——所以 UI canvas 必须用设备分辨率的后备缓冲区。**

世界层的后备缓冲区是 480×270，靠 `scale(n)` 整数倍放大，像素画正是要这个效果。但同一套做法用在文字上是灾难：`DialoguePanel` 现在的正文是 `text-2xl`（24 逻辑 px，正好卡在宪法四的底线上），由浏览器在**设备分辨率**下渲染，iPad ×2 时实际是 48 设备 px 的清晰字。搬进 480×270 的 canvas 就变成 24px 画完再最近邻放大 2–4 倍 —— 中文笔画会碎成马赛克。童童正在识字，这个不能接受。

解法（Stardew 自己就是这么干的，UI 分辨率高于世界分辨率）：

```ts
// 世界三层：后备缓冲区 = 逻辑分辨率，整数倍放大
world.width = 480; world.height = 270
// UI 层：后备缓冲区 = 设备分辨率，绘制时整体 ctx.scale(n)
ui.width = 480 * n; ui.height = 270 * n
ui.style.width = `${480 * n}px`                  // CSS 尺寸与缓冲区 1:1，不再二次放大
uiCtx.scale(n, n)                                 // 之后所有绘制仍用逻辑坐标写
uiCtx.imageSmoothingEnabled = false               // 九宫格木框、图标仍是最近邻，保持像素感
uiCtx.font = '24px "ZCOOL KuaiLe"'                // 文字按原生分辨率栅格化，清晰
```
九宫格框和 16px 图标在整数倍 `n` 下最近邻放大，视觉与现在完全一致；只有文字变清晰（其实是"维持现状"）。`n` 变化（转屏、窗口 resize）时重建缓冲区。

**后果 B：canvas 里没有 `<button>`，必须补一层不可见的 DOM 语义层。**

现在每个 HUD 按钮都是真的 `<button>`，带 `aria-label`（"帮小爱心换气"、"送海草给 Dolly"）、`focus-visible:outline-4` 焦点框、`min-h-14` 触摸下限。画进 canvas 后这些全没了 —— 撞 `CLAUDE.md` 四「键盘焦点可见」。

方案：**canvas 出所有像素，DOM 出所有语义。** UI canvas 之上铺一层透明的 `<button>` 热区，位置由同一份布局数据驱动。这层不画任何东西（`opacity:0` 但不是 `visibility:hidden`，否则读屏器读不到），只负责接点击、进 Tab 顺序、显示焦点框（焦点框由 canvas 那边画，热区拿到 `:focus-visible` 时置一个标志位）。这层不可省。

**例外：爸爸的后台不进 canvas。** `AdminPanel`（343 行表单：开关、数字输入、下拉、日志列表、导出 txt）和 `AdminGate`（4 位密码键盘）留 DOM。它们是给你用的工具，不是游戏画面的一部分，画进 canvas 只有坏处没有好处。如果你要的是"连后台也进 canvas"，说一声，但我建议不要。

---

## 一、现状盘点

### 1.1 目录与规模

```
src/
├── App.tsx                 606 行  ← 唯一的状态总装配点
├── components/  (18 个)    1786 行  ← 渲染层，本次要动其中 12 个
├── hooks/       (11 个)     887 行  ← 状态层，本次 100% 不动
└── lib/         ( 7 个)     343 行  ← 纯函数 + 常量
```

依赖只有 react / react-dom / tailwind。**本次不新增任何 npm 包**（宪法二十一：不引入 Phaser/PixiJS/Three.js）。

### 1.2 游戏循环（Game Loop）——现在是散的，一共 5 套计时器

**项目没有统一的游戏循环。** 时间推进散在五个互不相干的机制里：

| # | 位置 | 机制 | 周期 | 推进什么 |
|---|---|---|---|---|
| 1 | `App.tsx:189` | `setInterval` | 5 min | 饱食度 −1（唯一一条写进存档的定时逻辑） |
| 2 | `useBreath.ts:28` | `setTimeout` 链式状态机 | 3 min / 8 s / 600 ms | 换气五相 `submerged→rising→waiting→popping→sinking`。**`waiting` 不自动前进** —— 她不来点就一直等，这是"没有失败态"的实现细节 |
| 3 | `usePetSwim.ts:39` | **`requestAnimationFrame`** | 60 fps | 小爱心水平位置。**当前每帧 `setX()`，即每帧触发一次 React 全树重渲染** —— 现在最贵的一处，也是本次收益最大的一处 |
| 4 | `App.tsx` × 5 处 | `setTimeout` | 0.3–15 s | 姿势复位(2.5s/4.2s)、NPC 反应(1.8s)、送礼反馈(3s)、知识卡(15s)、点击回弹(0.3s) |
| 5 | `index.css` | CSS `@keyframes` × 10 | 各自 | 云飘 46s / 水面 3s steps(24) / 海带摇 5s / 环境泡泡 3.6s / 精灵翻帧 `steps()` / 上下浮 4s / 进食下潜 4.2s / 镜头摇移 400ms / 对话面板滑入 320ms / 知识卡滑入 400ms |

**结论**：第 3、5 类是"每帧要画的东西"，本次全部收进新的 rAF 主循环。第 1、2、4 类是**事件与数值结算**，宪法二十一明令「rAF 循环里不做任何游戏逻辑数值结算」—— 原样留在 React，一行不改。

### 1.3 状态管理——三份存储 + 若干瞬时 state

**持久层（`localStorage`，`useSave.ts` 是唯一读写口）**

```ts
interface SaveData {
  version, createdAt, lastPlayedAt      // 时间锚点
  daysPlayed        // 累计打开天数 → 成长阶段的唯一输入（不是连续天数，隔多久回来都不退）
  fullness          // 饥饿度 0–5，每 5 分钟 −1，离线最多补掉 2 格
  seagrass[]        // 海草床：{id, plantedAt, x}，长成要 3 天，上限 12 棵
  grownSeen         // 上次告诉过她"长成了几棵"
  stageSeen         // 上次陪她过的成长阶段 id
  albumEvents{}     // 相册：事件 id → 首次发生日期，只进不出
  seenScenes[]      // 说过的剧本
  knowledgeSeen{}   // 知识卡 id → 上次出现时间（24h 冷却，不是进度）
  sea               // 当前海域 id
  familiarity{}     // 邻居 id → 熟悉度 0–5，只增不减
  familiarityLastAt{} // 每人每天最多涨一级
  giftedAt{}        // 每人每天最多送一次礼
}
```
另有 `xiaoaixin_config`（`useConfig`，后台覆盖层）、`xiaoaixin_log`（`useDialogueLog`，上限 500 条）。

**你提到但不存在的两样**：
- **金币** —— 全项目零货币字段。贝壳是 ROADMAP S5 的计划，且宪法十六明令「❌ 常驻金钱 HUD」。`ActionBar` 里的贝壳格是灰的占位。
- **心情** —— 没有持久化的心情值。最接近的是 `pose`（`idle`/`happy`/`eating`/`sleeping`，瞬时 React state，2.5 秒回 idle，不存档）和 `familiarity`（那是"关系"不是"心情"，且只增不减）。

**派生值（纯函数，不存档）**：`countGrown()` / `clarityOf()` / `currentStage()` / `stagesReached()` / `unlockedTopics()`。

**瞬时 UI state（App.tsx 内，刷新即失）**：`pose` / `sceneId` / `npcTalk` / `reactingNpc` / `answered` / `card` / `page` / 两个弹层开关。

**渲染态（本次要搬走的）**：`usePetSwim` 的 `x` / `facingLeft` / `target`，以及 `App.tsx:111` 由 x 算出的 `cameraX`。

### 1.4 UI 渲染逻辑——DOM + CSS，九层用 z-index 叠

`Scene.tsx`（391 行）是渲染核心，`lib/layers.ts` 定义 z 序：

```
z:0 sky        <div> 平铺 sky.png + 每格 2 张云 <img>（CSS 46s 横移）
z:1 farIsland  每格 2 座岛 <img>，位置 (i*97)%120 确定性摆放
z:2 waterSurface  平铺 surface.png，CSS steps(24) 硬切横移
z:3 underwaterFar  三层水色 linear-gradient（读 seas.ts）+ far.png 剪影 + 浑浊度雾遮罩
z:4 underwaterMid  DECOR_VARIANTS 三套排布轮换，每套 9–14 个 <img>，部分带 .decor-sway
z:5 seabed     平铺 sand.png + 每格 6 个散落物 <img>
z:6 actors     ← 海草床(SVG) / NPC / 影子 / 小爱心
z:7 bubbles    每格 5 个环境泡泡 <img>
z:8 hud        ← GameHud / DialoguePanel / ActionBar / FullnessMeter / KnowledgeCard
```

镜头 = 两层嵌套 `transform`：外层 `translateX(-cameraX)`（无缓动），内层 `.camera-world` `translateY(0 或 -86)`（400ms 缓动，换气时露天空）。

角色侧：`Sprite.tsx` 用 CSS `steps()` 切背景图翻帧；`Pet.tsx` 176 行套 6 层 div（swim 定位 → bob 浮动 → dip 进食 → tap 回弹 → 精灵 → 锚点热区）；`Seagrass.tsx` 是 SVG 描边；`Bubbles.tsx` 是 5 个 CSS 动画 span。

HUD 侧：`.hud-panel` 用 `border-image: url(panel.png) 6 fill`（**这本来就是九宫格**，切片 6px），`.ui-slot` 是 26×26 整张背景图。

**一格实测的 DOM 量** ≈ 32 个元素，6 个地点全开约 190 个动画元素同时跑。这是掉帧主因，也是 canvas 化的主收益。

### 1.5 状态层 ↔ 渲染层的真实接缝

接缝比想象中干净。`petSwim.x` 只被三处消费 —— `cameraX`、影子的 `left`、`Pet` 的 `worldX` —— **重构后这三处全在 canvas 里**。也就是说 `usePetSwim` 可以整体搬出 React，**没有任何 React 组件还需要知道她游到哪**。这是"State 零改动"能成立的关键。

需要留的双向接口都是低频事件，不是每帧数据：

| 方向 | 内容 | 频率 |
|---|---|---|
| React → 渲染层 | 海域主题、清澈度、地点格数、精灵表与锚点、`pose`、`breath.phase`、成长阶段体型/体色、海草床数组、NPC 摆位、**HUD 全部内容**（天数/月相/潮汐/体长体重/饱食度/对话内容与选项/按钮可用态/知识卡） | 状态变化时 |
| 渲染层 → React | `onWorldTap(x)`、`onTapPet()`、`onTapAnchor(name)`、`onTapNpc(id)`、`onTapSeagrass()`、`onTapGift(id)`、`onHudAction(id)`、`onChooseOption(i)`、`onHoldTitle()` | 用户操作时 |

---

## 二、重构后的架构

```
┌───────────────────────────────────────────────────────────┐
│ React 层（状态 + 数据）                  ★ 本次 100% 不改  │
│   hooks/useSave useConfig useBreath usePet useNpcs …      │
│   lib/ seagrass pet seas layers                           │
│   仍留 DOM 的组件：AdminPanel AdminGate（爸爸的工具）      │
└──────────────┬──────────────────────────▲─────────────────┘
      状态变化时 push 一份快照             │ 语义事件
               ▼                          │
┌───────────────────────────────────────────────────────────┐
│ 渲染桥 <WorldCanvas>  ← 唯一的新组件，React 只认识它       │
│   同步 props → renderer，管生命周期，托管 a11y 热区层      │
└──────────────┬────────────────────────────────────────────┘
               ▼
┌───────────────────────────────────────────────────────────┐
│ 渲染运行时（纯 TS，零 React）  src/render/                 │
│   loop.ts      rAF 主循环，唯一的 tick                     │
│   camera.ts    镜头（跟随 + easing + lookahead）           │
│   swim.ts      小爱心位移（从 usePetSwim 搬来的算法）      │
│   particles.ts 泡泡 / 浮尘                                 │
│   assets.ts    图片预载 + 缓存 + 失败降级                  │
│   text.ts      字体就绪检测 + 中文换行 + 描边文字          │
│   nineSlice.ts 九宫格绘制（世界内 UI 和 HUD 共用）         │
│   hit.ts       世界↔屏幕变换 + 热区矩形派发                │
│   layers/  background.ts  actors.ts  overlay.ts  ui.ts    │
│   ui/      hud.ts  dialogue.ts  actionbar.ts  card.ts …   │
└───────────────────────────────────────────────────────────┘
```

### 2.1 四块 Canvas

宪法二十一放宽了「允许多层合并进同一块 canvas 内部绘制」。九层保留为**绘制顺序**，物理 canvas 四块 —— 分块标准是"重绘频率 + 分辨率"，不是"图层数"：

| Canvas | 装原九层的 | 后备缓冲区 | 重绘策略 | 视差 |
|---|---|---|---|---|
| **① bg** 背景/视差层 | z0 天空 · z1 远岛 · z2 水面 · z3 水下远景 · z4 中景 · z5 沙底 | 480×270 | 镜头没动且摇摆没到下一帧时**跳过重绘** | ✅ 每层独立 factor |
| **② actors** 角色层 | z6 角色 · z7 泡泡 | 480×270 | 每帧（只有小爱心+几个 NPC+粒子，很便宜） | 1.0 |
| **③ overlay** 前景/光照层 | 新增：前景遮挡礁石、水下光柱、昼夜 tint（S4 用） | 480×270 | 按需 | ≥1.0 |
| **④ ui** 九宫格 UI 层 | z8 HUD 全部 | **480n×270n（设备分辨率）** | **事件驱动**：内容变了才重绘，不进每帧循环 | 不跟镜头 |

①②③ 共用同一套设置：

```ts
canvas.width = 480; canvas.height = 270    // 后备缓冲区永远是逻辑分辨率
ctx.imageSmoothingEnabled = false          // 宪法二十一 · 1
// CSS transform: scale(n)，n 由 ScreenFrame 现有的 floor(min(vw/480, vh/270)) 给
```
④ 按 §〇 后果 A 的写法：缓冲区 = 设备分辨率，`ctx.scale(n)` 之后仍用逻辑坐标写代码。

**④ 不进 rAF 循环。** HUD 一秒钟变不了几次（天数、饱食度格数、对话内容），每帧重绘一次全屏 UI 是纯浪费。改成脏标记：`ui.markDirty()` 被 React 侧的 props 变化或 hover/press 状态变化调用，循环末尾看到脏了才重绘一次。对话面板滑入滑出（320ms）和知识卡滑入（400ms）这类有动画的，动画期间才逐帧。

### 2.2 主循环（唯一一个 rAF）

```ts
// src/render/loop.ts
// 唯一的游戏渲染循环。这里只画，不结算任何游戏数值——宪法二十一配套约束第 4 条
function tick(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000)   // 沿用 usePetSwim 现有的 100ms 上限
  swim.update(dt)
  camera.update(dt, swim.x)
  particles.update(dt)
  frames.advance(now)                              // 精灵翻帧：8fps 节拍器，与 rAF 解耦
  if (camera.dirty || frames.bgDirty) drawBackground()
  drawActors()
  drawOverlay()
  if (ui.dirty || ui.animating) drawUi()           // 事件驱动，不是每帧
  hit.syncHotspots()                               // 节流 100ms，同步透明 DOM 热区位置
}
```

**低帧率翻帧 + 高帧率位移**必须守住（宪法十三 + 二十一·2）：`frames.advance()` 内按 `Math.floor(now / (1000/fps)) % frameCount` 取帧，fps 读 `pet.json` / `npc.json`。翻帧提速 = 毁掉 Stardew 观感。

**位置/相机/粒子全部放类实例字段，不进 React state**（宪法二十一配套约束第 2 条）。重构后 React 每帧重渲染次数：**0**。

### 2.3 九宫格 UI 层的绘制模型

一份声明式的布局数据 → 一个绘制器 → 一组热区。三者由同一份数据生成，不会对不上。

```ts
// src/render/ui/types.ts
interface UiNode {
  id: string                       // 热区 id，也是事件回调的 key
  rect: { x: number; y: number; w: number; h: number }   // 逻辑坐标
  frame?: 'panel' | 'slot' | 'slot_red'                  // 九宫格底
  icon?: string                    // /assets/world/ui/ 下的图标路径
  text?: { value: string; font: 'kuaile' | 'wenkai'; size: number; color: string }
  badge?: number
  disabled?: boolean               // 灰态（贝壳/礼物/背包"长大了才有"）
  a11yLabel: string                // 透明 <button> 的 aria-label，一个都不能少
  onTap?: () => void
}
```

- `nineSlice(ctx, img, x, y, w, h, slice=6)` —— 九块分别 `drawImage`，边角不拉伸，中间平铺。切片参数 6px 与现在 `border-image: … 6 fill` 完全一致，视觉不变。
  - **金币栏那类只横向拉伸的要另一个函数** `threeSliceX(ctx, img, x, y, w, slice)`：垂直切片是 0，套 `nineSlice` 会除零。
  - 参考图的 9-slice 规格、实测尺寸、切片纹理已提取完毕：`wiki/graphic/hud-9slice.json`（含 CSS 与 canvas 两种调用）、`wiki/graphic/palette.json`（Pillow 量化取样的真色值）、`wiki/graphic/ui-proto/`（1:1 重绘的纹理）、`wiki/graphic/hud-prototype.html`（可开的预览页）。**注意参考图实测边框是 4px、道具格 20×20，与现行的 6px / 26×26 不一致 —— 按宪法七 S1 备注，这次不动，留到本阶段统一处理。**
- `text.ts` 负责中文换行（按字符宽度断行，不是按空格）、`document.fonts.ready` 之前先用系统字兜底（和现在 CSS `font-family` 的 fallback 链同样的行为，**不留白**）。
- 布局常量从现有 Tailwind 类翻译过来并**集中写在 `ui/layout.ts`**：对话面板 `max-w-[420px]`、正文 24px、说话人 9px、道具格 26×26、HUD 面板 `top-2 left-2` 等。翻译时数值照抄，不趁机调整（宪法七 S1 备注：按钮尺寸留到统一 UI 阶段，不要在没被要求时碰）。

### 2.4 视差因子（阶段 5 才启用，先全填 1.0）

```ts
const PARALLAX = {
  sky: 0.15, farIsland: 0.30, waterSurface: 0.60,
  underwaterFar: 0.75, underwaterMid: 0.92,
  seabed: 1.00, actors: 1.00, bubbles: 1.00, overlay: 1.08,
}
const offset = Math.round(camera.x * PARALLAX[layer])   // 必须取整，否则像素画半像素撕裂
```
海草床固定在第一格、NPC 按地点格摆放，都在 actors 层（factor 1.0），位置算法完全不变。

### 2.5 素材可替换性（宪法五 / 十三，canvas 化最容易偷偷违反的一条）

- `assets.ts` 只按**路径字符串**加载，路径来自 `pet.json` / `npc.json` / `WORLD_DIR`。canvas 代码里不许出现新的图形绘制原语（用 `arc`/`bezierCurveTo` 画生物），只许 `drawImage`。
- 锚点（气泡从鼻孔冒、热区位置）继续读 `spec.锚点`，不许硬编码坐标。
- `Scene.tsx` 的 `DECOR_VARIANTS` / `SCATTER` 两张表 **原样搬进 `render/decor-data.ts` 当纯数据**，数值一个不改 —— 这是"同一个地点永远长同一个样"的保证，改了她会发现珊瑚换位置了。
- 换手稿仍然是"往 `/assets/pet/pixel/` 拖 4 个 PNG，不改一行代码"。
- 加载失败**静默降级**（跳过该层继续画），**绝不白屏**。`usePet` 现有的指数退避重试留在 React 侧。

### 2.6 `prefers-reduced-motion`

现在靠 `index.css` 末尾的媒体查询关掉所有 CSS 动画，canvas 化后 CSS 管不着了，必须在运行时实现（宪法二十一配套约束第 3 条）：

```ts
if (reduced) {
  particles.enabled = false        // 粒子停
  camera.easing = 0                // 镜头瞬移
  frames.frozen = true             // 精灵停在第一帧
  ui.animating = false             // 面板不滑入，直接就位
}
```
**但换气泡泡必须还看得见** —— `index.css:289` 的注释写得很清楚：泡泡是"该换气了"的唯一提示，不能一起关掉。运行时保留同样的例外：泡泡不动，但要画出来。

---

## 三、分阶段执行（每阶段一次交付，做完停）

按宪法十九·1「每个 Season 只做一个新系统，做完停下」。**阶段 1–4 的验收标准是"画面看不出区别"**，不是"效果更好"。

### 阶段 0 · 立基线（不改任何现有渲染）
1. 新建 `src/render/`：`assets.ts`（预载+缓存+降级）、`loop.ts`（空转 rAF + FPS 计数）、`text.ts` 骨架。
2. 新建 `<WorldCanvas>`，先只铺四块空 canvas，什么都不画。
3. 临时开关 `?canvas=1`，**新旧渲染并存**，随时切回去对比。

**验收**：`npm run dev` 正常进游戏，画面一模一样；`?canvas=1` 时四块空 canvas 就位，控制台无报错；UI canvas 的缓冲区尺寸随窗口缩放正确重建。
**改动**：新增 4 个文件，`App.tsx` 加 3 行开关。

### 阶段 1 · 背景层进 Canvas（视差先不开）
1. `Scene.tsx` 的 6 个背景函数逐个翻译成 `layers/background.ts`。
2. `DECOR_VARIANTS` / `SCATTER` 原样搬进 `decor-data.ts`。
3. 云横移、水面 steps 漂移、海带摇摆，用 8fps 节拍器复刻，**参数照抄 CSS 数值**（46s / 3s·24 步 / 5s）。
4. 水色渐变改 `createLinearGradient`，色值继续读 `seas.ts`；浑浊度雾照旧 `(1-clarity)*0.34`。

**验收**：`?canvas=1` 与旧渲染并排截图，背景像素级一致（重点看水面线是否还在 y=86、沙底是否还是 40 高、珊瑚是否还在原位）。
**风险**：坐标系翻转 —— `Scene` 里大量用 `bottom: SAND_H - 6 + lift`，canvas 是 top-down，需要 `bottomToTop()` 工具，不要每处手算。

### 阶段 2 · 角色层进 Canvas + 位移搬出 React
1. `swim.ts`：`usePetSwim` 的算法**原样搬过来**（SWIM_SPEED=90、EDGE_MARGIN=80、`Math.min(0.1, dt)`、世界缩小时的夹取），只把 `setX` 换成写实例字段。
2. `camera.ts`：先复刻现有行为（水平无缓动 + 垂直 400ms），easing/lookahead 留到阶段 5。
3. `layers/actors.ts`：小爱心（精灵 + bob + dip + tap 回弹 + 体型缩放 + 体色）、影子、NPC、海草床、换气泡泡。
   - 体色 `toneFilter()` 现在是 CSS filter → 改成离屏 canvas 预染色缓存（每个成长阶段一张，不是每帧算）。
   - 海草床现在是 SVG 描边 → canvas 里用 `quadraticCurveTo` 画同样的草叶。**这是唯一一处"非 drawImage"的例外**，因为它本来就是矢量的。要不要顺手烘成像素 PNG，届时问你。
4. 铺透明 DOM 热区层，`Pet.tsx` 的锚点热区代码搬过来。
5. 删除 `usePetSwim.ts`，`App.tsx` 去掉 `cameraX` 计算和影子 `<img>`。

**验收**：游一格 480px ≈ 5.3 秒（速度没变）；换气镜头下摇露天空；进食下潜在；泡泡从鼻孔冒且转身镜像；Tab 能依次聚焦小爱心和 5 个锚点、焦点框可见；React DevTools 里游动全程 **App 重渲染 0 次**（旧版每帧一次）。
**改动**：新增 3 个，删除 `usePetSwim.ts` `Pet.tsx` `Npc.tsx` `Seagrass.tsx` `Bubbles.tsx`，`App.tsx` 精简约 40 行。

### 阶段 3 · 九宫格 UI 层进 Canvas ★ 决议 2 的主体
1. `nineSlice.ts` + `text.ts` 落地，切片参数 6px 与 `border-image` 一致。
2. `ui/layout.ts`：把 `GameHud` / `ActionBar` / `FullnessMeter` / `DialoguePanel` / `KnowledgeCard` 的 Tailwind 尺寸翻译成布局常量，数值照抄。
3. `layers/ui.ts` 绘制这五样；设备分辨率缓冲区 + 脏标记重绘。
4. 透明 `<button>` 热区层扩展到 HUD：每个 `UiNode` 一个，`aria-label` 逐条对照现有代码搬过来（"帮小爱心换气"、"贝壳(长大了才有)"、"小爱心的肚子" …一个不能漏）。
5. `GameHud` 的长按 5 秒进后台：`pointerdown/up/leave/cancel` 逻辑搬到热区上，5000ms 不变。
6. `Book` / `Album` / `SeaPicker`（童童面向的全屏弹层）也进 canvas；`AdminPanel` / `AdminGate` 留 DOM。
7. 语音朗读（`speak()`）挂在对话热区上，行为不变。

**验收**：24px 中文正文在 ×2 / ×3 缩放下都清晰不发糊（拿 iPad 实机看，这是本阶段的头号验收项）；对话面板滑入 320ms 手感不变；选项按钮按下有缩放反馈；Tab 顺序与现在一致；VoiceOver 能念出每个按钮的名字；长按 5 秒仍能进后台，短按不会误入。
**改动**：删 5 个组件，新增 `render/ui/` 一批，`index.css` 删掉 `.hud-panel` `.ui-slot` 等已被取代的规则。

### 阶段 4 · 拆掉旧渲染
1. 删 `Scene.tsx`，删 `index.css` 里已被 canvas 取代的 keyframes（保留 `AdminPanel` 用的）。
2. 去掉 `?canvas=1`，canvas 成为唯一渲染路径。
3. 运行时 `prefers-reduced-motion` 实现（含泡泡例外）。

**验收**：八件套跑一遍 —— 首次见面对话、喂食、种海草、换气、点邻居聊天、送礼、开相册/图鉴、进后台。零控制台报错，竖屏提示仍在。

### 阶段 5 · 新效果（视差 + 光照 + 镜头 easing）★ 这一阶段才"变好看"
1. 启用 2.4 的视差因子（记得 `Math.round`）。
2. `overlay`：水下光柱、前景遮挡礁石（小爱心游到礁石后面）。
3. 镜头 easing + lookahead（宪法十二已放宽，**缩放仍然禁止**）。
4. 浮尘 / 光斑粒子。

**验收**：录一段游动，和 `wiki/graphic/stardew参考/` 并排看。这一阶段允许画面变化，但每一项改完停下来给你看，不要一口气全上。

---

## 四、State 零改动的保证措施

四道闸，不能打折：

1. **`src/hooks/` 和 `src/lib/seagrass.ts` `pet.ts` `seas.ts` 全程只读。** 任何阶段的 diff 里出现这几个文件的修改（除删掉 `usePetSwim.ts` 这个纯渲染 hook 外），就是走错路了。
2. **`SaveData` 一个字段都不加。** 存档格式不动 → `SAVE_VERSION` 保持 2 → 童童现在存档里的天数、海草、相册、熟悉度全部无缝继承。重构前后各导一次 `localStorage.getItem('xiaoaixin_save')`，字符串应当只有 `lastPlayedAt` 不同。
3. **渲染运行时只读不写。** `render/` 下不许 import 任何 hook，不许碰 `localStorage`，不许调 `update()`。状态变更依旧只能由 React 侧的事件处理器发起。
4. **数值结算不进 rAF。** 饱食度 5 分钟 `setInterval`、换气状态机、成长阶段判定全部留在 React。canvas 只知道"现在 fullness 是 3"，不知道它为什么是 3。

---

## 五、风险清单

| 风险 | 后果 | 对策 |
|---|---|---|
| **UI canvas 文字发糊** | 24px 中文变马赛克，正在识字的孩子读不了 | §〇 后果 A 的设备分辨率缓冲区；阶段 3 头号验收项，iPad 实机看 |
| **HUD 可访问性丢失** | 焦点框、读屏器、Tab 顺序全没了，撞宪法四 | §〇 后果 B 的透明 DOM 热区层，**不可省**；`aria-label` 逐条搬 |
| 中文字体未就绪时画字 | 首帧糊字或空白 | `document.fonts.ready` + 系统字兜底，与现在 CSS fallback 行为一致 |
| 坐标系翻转（CSS bottom → canvas top） | 珊瑚沙底错位几像素，还原度掉 | 统一走 `bottomToTop()`，阶段 1 逐层截图比对 |
| 素材路径被硬编码进 canvas | 手稿替换仪式失效（第 4 周已交付的功能） | `assets.ts` 只吃路径参数；阶段 2 验收时实测替换一张 PNG |
| 精灵翻帧被 rAF 带成 60fps | Stardew 顿挫感消失，宪法十三红线 | 独立 8fps 节拍器；阶段 2 录屏数帧 |
| UI 每帧重绘 | 设备分辨率下全屏重绘很贵，反而更卡 | 脏标记事件驱动，只有动画期间逐帧 |
| `prefers-reduced-motion` 漏实现 | 违反宪法四；换气提示消失她就永远不知道该点 | 阶段 4 强制项，泡泡例外单独测 |
| 视差和"确定性摆放"打架 | 同一地点每次进来长得不一样，破坏空间记忆 | 摆放算法（`(i*97)%120` 那套）原样保留，视差只改绘制偏移不改数据 |
| 一次性重写全部 | 出问题没法二分定位 | 阶段 0 的 `?canvas=1` 双轨，阶段 4 才拆 |
| 加载失败白屏 | 孩子看不懂 error（宪法十四） | `assets.ts` 逐张 try/catch，缺图跳过该层继续画 |

---

## 六、性能预期

| 指标 | 现在 | 目标 |
|---|---|---|
| 每帧 React 重渲染 | 游动时 60 次/秒（全树） | **0** |
| 同时跑动画的 DOM 元素 | ~32/地点格（6 格约 190） | ~12（透明热区，不绘制） |
| 每帧 `drawImage` | — | 背景约 40（镜头不动时整层跳过）+ 角色约 15 + UI 仅脏时 |
| 目标帧率 | iPad 6 格全开掉到 30–40 | 稳定 60 |

---

## 七、明确不做的事

- ❌ 不引入任何 npm 包（Phaser / PixiJS / Three.js / 状态库一律不装）
- ❌ 不改 `SaveData`，不加金币、不加心情值
- ❌ 不做 canvas 缩放（宪法十二"不做缩放"这半句没被松绑）
- ❌ `AdminPanel` / `AdminGate` 不进 canvas（爸爸的工具，需要表单输入和导出）
- ❌ 不动任何游戏机制、文案、知识卡、熟悉度规则
- ❌ 不趁重构调按钮尺寸和布局数值（宪法七 S1 备注：留到统一 UI 阶段）

---

## 八、CLAUDE.md 需要的修订（等你点头我再改）

决议 2 推翻了宪法二十一·4 的半句话。按十九·3「不要自己修订宪法」，下面是拟稿，**你同意了我才写进 `CLAUDE.md`**：

> **二十一 · 4 修订（2026-08-03，用户授权）**
>
> 原文「HUD 仍然是最上层 DOM，不进 canvas」**已作废**。现在 HUD 也走 canvas 绘制，但附带两条不可省的配套约束：
>
> 1. **UI canvas 的后备缓冲区必须是设备分辨率**（`480n × 270n` + `ctx.scale(n)`），不是 480×270。世界层的逻辑分辨率整数倍放大是为了像素画，同样的做法用在中文文字上会把笔画糊成马赛克 —— 24px 正文的清晰度是宪法四的底线，不因为 canvas 化而放弃。九宫格框和图标仍关闭平滑、整数倍最近邻，像素感不变。
> 2. **canvas 上方必须铺一层透明的 DOM 热区**，每个可点元素一个 `<button>`，带 `aria-label`，进 Tab 顺序，焦点可见。canvas 出像素，DOM 出语义 —— 宪法四「键盘焦点可见」不因为 canvas 化而失效。
>
> 例外：`AdminPanel` / `AdminGate`（爸爸的控制后台）继续用 DOM，不进 canvas。

---

## 九、下一步

阶段 0：新建 `src/render/` 骨架 + `<WorldCanvas>` 四块空 canvas + `?canvas=1` 双轨开关，不动任何现有渲染。做完停下给你验。
