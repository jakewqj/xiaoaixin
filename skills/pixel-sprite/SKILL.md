---
name: pixel-sprite
description: >-
  生成游戏用像素风精灵表 (pixel art sprite sheet)。当用户要求制作像素动画帧序列图时使用——尤其是带精确规格的：帧尺寸(如 192x64/112x48)、每套动画帧数与 fps、固定调色板色号(16 色以内)、锚点坐标、透明背景、无抗锯齿、Stardew Valley 风格、电子宠物/NPC 的 idle/swim/eat/sleep 等动画。也适用于用户说"按之前的流程/参数再画一个类似角色"的场景。Use for pixel sprite sheet generation with exact specs (frame size, frame counts, fixed palette, anchor coordinates).
---

# Pixel Sprite 生成流程

## 核心决策

规格精确(帧宽整数倍、固定色号、锚点坐标、<=16 色) -> **手写参数化生成器**(Node 脚本逐像素绘制 + 原生写 PNG, 零依赖), 不要走 AI 生图。AI 生图无法保证像素级规格, 此路已验证失败。

## 流程(6 步)

1. **提取规格表**。从用户 prompt 填出下表, 缺关键项先问:
   - 帧尺寸(宽 x 高 px)、朝向
   - 动画清单: 每套 文件名 / 帧数 / fps / 动作描述
   - 调色板: 固定色号(描边/主体/腹部/眼睛等), 上限 16 色
   - 锚点: 名称 + 帧内坐标。**以游戏配置文件(如 pet.json)为准**, 不以 prompt 表格为准——先读配置
   - 硬性特征: 必须画对和绝不能画错的点(如分叉尾 != 桨状尾、无背鳍)
   - 输出目录(如 public/assets/pet/pixel/)

2. **写生成器**。复制 [scripts/draw-template.mjs](scripts/draw-template.mjs) 到目标仓库根目录, 改名 `draw-<角色>.mjs`, 按文件内 5 处「改这里」注释修改(规格/调色板/锚点/造型/动画)。造型方法论:
   - 身体: 上缘 U(x)/下缘 L(x) 控制点线性插值出轮廓, 腹部只画下缘窄带
   - 尾巴、鳍等子部件放独立 mask, 每帧用 partDY 单独偏移
   - 眼/嘴/鼻孔等特征最后按锚点坐标逐像素点上去
   - 描边不手画: 用统一后处理(实心像素 8 邻域的空白处补描边色)
   - 动画用每帧变换参数(dy 整体浮沉 / pitchK 前倾 / liftK 抬头 / tailDY 尾部摆动 / headDropK 低头), 不重画像素

3. **生成 + 视觉检查**:
   - `cmd /c "cd /d <repo> && node draw-<角色>.mjs 2>&1"`
   - `cmd /c "cd /d <repo> && node draw-<角色>.mjs --debug 2>&1"` 输出每套第 0 帧的 2x 调试图(带红色锚点标记)
   - 用 view_image 看调试图。**只看单帧小图**(192x64 这类), 宽长条整图会被缩略到看不清
   - 对照硬性特征和锚点逐条检查, 不对就调参数重跑, 直到对为止

4. **自动校验**(必须 ALL OK):
   ```
   node <skill目录>/scripts/verify-sheet.mjs <图片目录> --frame 192x64 --sheets idle:4,swim:6 --max-colors 16
   ```
   校验: 尺寸 == 帧宽 x 帧数、每帧都有足够内容、调色板色号枚举且不超标。

5. **浏览器测试页**:
   ```
   node <skill目录>/scripts/make-test-page.mjs --out public/test_<角色>.html --title "标题" \
     --dir assets/pet/pixel --frame 192x64 --scale 2 \
     --sheets idle:4:8,swim:6:8 --anchors eye:144:24,tailTip:19:32
   ```
   dev server 用提权 Start-Process 启动; 验证用 `http://localhost:端口` 不用 127.0.0.1(vite 可能只绑 IPv6)。把 URL 给用户验收。

6. **交付汇报**: 文件清单 + 尺寸表 + 调色板 + 锚点核对结果。提醒: 热区小偏差改游戏配置 JSON 的锚点数值, 不重新生成图。

## 踩坑清单

遇到环境报错先读 [references/pitfalls.md](references/pitfalls.md)(PowerShell 续行、inline node、预览图缩放、沙箱进程回收、IPv6 localhost 等实测坑)。
