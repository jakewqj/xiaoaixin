# FORJake · 全项目改名 xiaoaixing → xiaoaixin

> 上一轮(宪法 §21 渲染松绑 + 首次上线)的复盘在 git 历史里,commit `afc5f24`。

## 我做了什么、为什么这么做

**第一步是确认"哪些名字动了会丢数据"。** 改名任务最怕的不是漏改,是改到了当数据键用的字符串。所以我先 grep 了 `src/`:

```
src/hooks/useSave.ts:5        const SAVE_KEY = 'xiaoaixin_save'
src/hooks/useConfig.ts:30     const OVERRIDE_KEY = 'xiaoaixin_config'
src/hooks/useDialogueLog.ts:3 const LOG_KEY = 'xiaoaixin_log'
```

**三个 localStorage key 本来就是 `xiaoaixin`,拼写从一开始就是对的。** 拼错的只是项目名、仓库名、部署名这一层。所以这次改名**零存档迁移风险**——代码一行没动,童童的存档不受任何影响。这是运气好,但先查一遍才敢下手。

**第二步是先做外部改名,再改文件。** 因为 GitHub 仓库名和 Vercel 项目名的改名结果决定了 package.json 和 CLAUDE.md 里该写什么地址。反过来做的话,万一 `xiaoaixin` 这个名字在 Vercel 上被占了,文件就得改两遍。

实际改了这些:

| 位置 | 动作 |
|---|---|
| GitHub 仓库 | `gh repo rename` → github.com/jakewqj/**xiaoaixin** |
| 本地 git remote | `git remote set-url` 指向新仓库 |
| Vercel 项目 | `vercel project rename` → heiyu/**xiaoaixin** |
| Vercel 域名 | 新增 xiaoaixin.vercel.app,删掉 3 个 xiaoaixing.* 旧 alias |
| package.json | name / repository / bugs / homepage 四处 |
| CLAUDE.md | §三 部署行的地址和项目名 |
| `.vercel/project.json` | projectName(本地 link 配置,gitignored) |

**正式地址现在是 https://xiaoaixin.vercel.app**

## 考虑过的替代方案

- **新建一个 Vercel 项目叫 xiaoaixin,把旧的删掉**:能达到一样的效果,但会丢掉部署历史和回滚能力。`vercel project rename` 是原地改,项目 ID 不变,历史全留着,明显更好。
- **只改 package.json,不动 GitHub 仓库名**:那 package.json 的 repository 字段就在撒谎,`npm` 系工具和 GitHub 页面上的链接都会指向不存在的地址。改名这种事要么不做,要么做干净。
- **顺手把存档 key 也统一**:一度想过"是不是该把所有名字统一成一种写法"。**幸好没做**——那三个 key 已经是对的,而且就算不对也不该动:改 localStorage key 等于把童童已有的存档变成孤儿。数据键的命名一旦上线就该冻结,难看也认了。

## 做出的取舍

- **删掉旧 alias,而不是留着做重定向**。这是本轮最需要想清楚的一条。Vercel 的 `.vercel.app` alias 删掉就是 404,不是 301 跳转,所以"留着更安全"的直觉在这里是错的——**留着的后果是两个地址都能玩,但存档不互通**(localStorage 按域名隔离)。童童在旧地址存的进度,在新地址看不见,反过来也一样。这种"两个平行世界"对 6 岁孩子是纯粹的伤害。宁可旧地址干脆打不开。
- **保留旧的那次 deployment 记录**(`xiaoaixing-9mkhn80mq-...`)。它的 URL 带旧名,但那是带 hash 的历史快照 URL,没人会去访问,留着是回滚资产。
- **FORJake.md 整篇重写而不是追加**。按你的规矩每轮任务生成一份,上一轮的内容 git 里有。

## 遇到的坑

1. **`vercel project rename` 不会改主域名。** 项目改完名了,`xiaoaixing.vercel.app` 还稳稳地指着新部署——因为那个域名是作为独立 alias 挂在项目上的,rename 只改项目标识。必须手动 `vercel alias set` 加新的、`vercel alias rm` 删旧的。**如果我只跑了 rename 就收工,你会看到项目叫 xiaoaixin 但网址还是 xiaoaixing,而且完全没有报错提示。**
2. **`vercel project rename` 不认 `--yes`**,加了直接报 unknown option。Vercel CLI 各子命令的 flag 支持度不统一。
3. **`gh repo rename` 成功后本地 remote 不会自动更新。** GitHub 那边会做旧名重定向(push 还能用),所以这个坑不会立刻报错,但 remote 里留着旧名迟早出事,要手动 `git remote set-url`。
4. **`vercel alias ls` 是团队级的**,会把 heiyu 下所有项目的 alias 都列出来(blast-donner、coverageclip、next-app…),得自己 grep 过滤。

## 你需要自己做的两件事

这两件我做不了,不是偷懒:

1. **本地目录还叫 `D:\xiaoaixing`。** 它是当前工作目录,Windows 会锁住正在使用的目录,而且改了会当场切断这个会话。你自己改的话:关掉编辑器和终端 → 重命名成 `D:\xiaoaixin` → 重新打开。git 仓库不受影响,`.git` 跟着走。
2. **改完目录名后,Claude Code 的记忆目录也要跟着改。** 它按项目路径建目录:`C:\Users\jakew\.claude\projects\D--xiaoaixing\` → 改成 `D--xiaoaixin`。不改的话下次在新路径打开,记忆是空的(旧记忆没丢,只是找不到)。

## 一个要留意的风险

**如果这 9 小时里有人在旧地址 `xiaoaixing.vercel.app` 上玩过并产生了存档,那份存档现在够不着了**(alias 已删)。localStorage 绑域名,换域名等于换了个世界。

不是不可逆——把旧 alias 加回来就能重新访问:

```
vercel alias set xiaoaixin-3txvhuszz-heiyu.vercel.app xiaoaixing.vercel.app --scope heiyu
```

但从时间线看风险很低:旧地址是上一轮会话结尾才发布的,你当时的反应是继续让我 commit,没提测试过。如果童童还没碰过,就当无事发生。

## 可迁移的经验

- **改名任务的第一步永远是分清"标识符"和"数据键"。** 标识符(项目名、仓库名、域名)随便改;数据键(localStorage key、数据库表名、缓存前缀)改了就是数据迁移,要单独设计。这次先 grep 一遍 `src/` 才动手,是最值的那 30 秒。
- **改名平台的行为不一致,不能类推**:GitHub 改仓库名会自动保留旧名重定向,Vercel 改项目名不动域名、删域名也不给重定向。每个平台的"改名"到底改了什么,要单独确认,不能假设。
- **删东西之前先问"留着会不会更糟"。** 这次删 alias 是对的,因为留着会造成存档分裂——一个比 404 更隐蔽也更伤人的后果。
