# 幕布 · Mubu

## 源码版使用说明 · 2026-11-05

Node.js 20+、pnpm：`pnpm install --frozen-lockfile`，`pnpm dev`；发布构建用 `pnpm build`。

浏览器本地存储；首启包含演示想法。清除浏览器数据会删除记录，请先在设置页导出。此仓库是 Web 版；iOS 版单独维护。

本次检查：类型检查和 Vite 生产构建通过。 详细范围见 [验证与后续工作](RELEASE_CHECK.md)。敏感信息规则见 [SECURITY.md](SECURITY.md)。

> 记录一个点，连接一条线，最终形成一张属于自己的思想之网。
>
> Where thoughts connect.

不是笔记软件，也不是思维导图。它只做四件事：

```
Capture → Connect → Explore → Develop
```

想法从 **灵感 → 记录 → 连接 → 主题 → 项目 → 文章 / 产品 / 一本书** 一路长出来。

---

## 运行

```bash
pnpm install
pnpm dev        # http://127.0.0.1:5173
pnpm build      # tsc --noEmit && vite build
pnpm typecheck
```

首启会写入一批示例内容（20 条真实密度的想法、16 条带备注的连接、3 个项目、
一份书稿大纲），方便直接看到排版、连接线与 Focus Mode。设置页可一键清空。

冒烟测试（零依赖，直接驱动系统 Chrome）：

```bash
pnpm dev                    # 另一个终端
node .smoke/run.mjs         # 50 项断言 + 24 张截图到 .smoke/shots/
node .smoke/graph-check.mjs # 图的专用体检：缩放 / 分块 / 交叉 / 间距
```

---

## 页面

| 路由 | 说明 |
| --- | --- |
| `/` | **今日** —— 问候 + 快速输入 + 信息流 + Rediscover |
| `/ideas` | 所有灵感，本地模糊搜索 + 标签 / 收藏过滤 |
| `/graph` | **思维网络** —— 按主题分块的无限画布，见下文 |
| `/topics` `/topics/:id` | 主题 / Cluster，Stream · Graph · Timeline 三视图 |
| `/projects` `/projects/:id` | 项目：Overview · Ideas · Canvas · Outline |
| `/timeline` | 按月 / 日回看自己的思考 |
| `/settings` | 主题、数据导入导出、快捷键、关于 |

### 几个刻意的产品选择

**Quick Capture 是产品的核心指标** —— 从「想到」到「留下」必须在 3 秒内完成。
任意页面 `C` 或 `⌘⇧Space` 唤起，自动聚焦，`Enter` 存下，`Esc` 收起。
录入时就地识别 `#标签` 与粘贴的 URL（自动记为来源），不再弹第二个表单。

**Connection Note 是这个产品的特色** —— 点击图上任意连线，
写下「为什么我当时把它们连起来？」。关系类型（延伸 / 启发 / 支持 / 冲突 / 来源 / 相关）
是可选的，可以只连上不解释。

**Focus Mode 是阅读模式** —— 点击节点，无关节点淡出到 0.12，
只留当前 + 1-hop + 2-hop，右侧栏可以顺着连接一直走下去。
双击节点则「只看这一系列」，放大到它的邻域。

**Outline 是从想法到作品的那一步** —— 建章节、把想法拖进章节、拖拽排序。
《人与 AI 共生之后》的示例大纲就是这么长出来的。

**两栏都能拖拽伸缩** —— 左栏 196–320px，右详情栏 320–720px，
贴边 7px 命中区，靠近才浮出细条；`←/→` 微调、双击在窄/宽两档间切换，
宽度写进 settings，刷新保持。标题与正文都是自动增高的 textarea ——
`<input>` 不会换行，长标题会被直接裁掉看不见。

**没有未读数字、没有红色提醒、没有 Dashboard KPI。**
视觉注意力永远是 `内容 → 关系 → 导航 → 控件`。

---

## 思维网络：排布算法

这是整个产品最有辨识度的部分，约束有四条，全部可量化：

> 按主题分块 · 块与块物理分开 · 线与线尽量不相交 · 放大到能看清关系，且保留线条的美感

实现分三层（`src/lib/forceLayout.ts`）：

**1 · 力模型** —— Fruchterman & Reingold (1991) 的 `k²/d` 斥力 · `d²/k` 引力 + 降温退火，
配合 ForceAtlas2 式向心力（度数越大拉得越紧，簇不会散架）。
所有边共用一个理想长度 `k`（按节点实际尺寸推导），间距才会均匀。

**2 · 碰撞 + 紧缩** —— 借 d3-force 的 `forceCollide`：不重叠是一等约束。
节点是卡片不是圆点，所以用 AABB + padding 沿穿透量最小的轴推开；
求解完成后向质心匀速收拢，直到挤到 `padding` 允许的最密。
**这道紧缩只在块内做** —— 放到全局会把块间留白压到同一档，块就糊在一起了。

**3 · 分块与装箱**
- 分块依据是 `clusterKeyFor()`：沿主题树上溯到根主题，
  `Agent` / `LLM` / `Context Engineering` / `Human-AI` 都归到 **AI**。
  不按连通分量分 —— 同一个主题的想法未必互相连着，那样会散在各处。
- 块间留白 `blockGap = 96px`，块内约 `11px`，**8.8 倍差**，肉眼一眼分得出。
- 装箱按目标宽高比「搜」行宽（9 档候选），让结果贴近画布比例，fitView 的缩放比最大。
- **块的排列顺序也参与优化**：生成 7 种候选（高度降序 / 逆序 / 索引 / 按块间连线密度贪心 ×2 …），
  逐个装箱后数交叉，挑交叉最少的。关联紧密的块挨着放，跨块连线就短，不必绕过别的块。
- 最后一道**局部搜索**：同块内互换邻近节点，交叉数变小才留下，
  碰撞约束一票否决 —— 所以交叉数只降不升，也不会压出重叠。

**4 · 分块的表达刻意不画方框** —— 画框就从「思想之网」变成流程图分区。
分块只靠空间聚拢、块间留白、一行极淡的块名（`产品 8` / `AI 6`）读出来，
连线始终是柔和的贝塞尔曲线。

### 实测

```
跨块间距 96px      同块间距 11px        →  8.8 倍，物理分开
交叉数   3 / 104 对                      →  2.9%
默认视图 zoom 1.05  正文 14.2px          →  打开就能读关系
全图视图 zoom 0.68  正文  9.1px          →  当地图用
```

关系标签是**缩放感知**的：`< 0.85` 隐藏（6px 的字只是噪点），`≥ 0.85` 出现。

顶部有主题块导航 `全部 · 产品 8 · AI 6 · 生活 3 · 写作 2 · 阅读 2`，
点一块就放大到它；`重排` 每次换一个 seed，换一套同样整洁的排布。

### 一个明确的取舍

**块物理分开与全图 zoom 互斥** —— 块间要 96px，全图 bbox 必然变大，
zoom 就下来。当前取舍是**分离 > 全图缩放**：读关系走默认的单块视图，
全图只当地图。想让全图大一点，把 `src/lib/layout.ts` 里的 `blockGap` 调小即可，
代价是块的边界变糊。

---

## 结构

```
src/
  types/            数据模型（Idea / Connection / Project / Topic / Outline / Canvas）
  repositories/     存储层：localStorage 适配器 + 八个 Repository 接口
  stores/           Zustand：useWorkspace（数据编排）· useUI（界面状态）
  lib/              forceLayout · layout · search · suggestions · capture · time · selectors
  hooks/            useHotkey · useDebounced · useMediaQuery
  data/             种子内容与首次写入
  components/
    ui/             Button · Tooltip · Dialog · Menu · Popover · Toast · PanelResizer · AutoTextarea
    layout/         AppShell · Sidebar · TopBar · Brand · Welcome · GlobalHotkeys
    ideas/          IdeaCard · IdeaStream · TodayView · QuickCapture · IdeaDetailDrawer
    graph/          GraphCanvas · PaperNode · BlockLabel · RelationPicker · EdgeNoteEditor · FocusPanel
    projects/       ProjectCanvas · OutlineEditor
    command/        CommandPalette
  pages/            Today · Ideas · Graph · Topics · TopicDetail · Projects · ProjectDetail · Timeline · Settings
```

组件保持单一职责，最大的文件也在 400 行以内。

### 技术栈

Vite · React 18 · TypeScript(strict) · Tailwind v4 · Zustand · Framer Motion ·
`@xyflow/react` · Radix 原语（可访问性）· Lucide

设计令牌全部在 `src/index.css`：纸面色 `#F7F7F5` / 墨色 `#1D1D1F` /
唯一强调色墨绿 `#556B5D`，暗色 `#171716` / `#F2F2EE` / `#8FA893`。
圆角 6–12px，动画 150–300ms，只用 fade / scale 0.98→1 / blur→clear。

### 两个容易踩的坑（已修，记下来免得再犯）

- **折叠侧栏时图标会挤成一坨** —— Radix `Tooltip asChild` 的 `Slot` 合并
  `NavLink` 的**函数型 `className`** 时会把它弄坏，导航项因此丢掉布局类。
  `SideLink` 改成自己用 `matchPath` 算 `isActive`，交给 `NavLink` 静态 className。
- **防闪烁脚本读不到主题** —— `<head>` 里的脚本读 `mubu.theme`，
  但设置写在 `mubu.settings` 里，键根本不存在。现在 `applyTheme` 额外同步一份纯字符串键。

---

## 状态与持久化

**Local First。** 数据只存在浏览器 `localStorage`，不上传。

页面组件从不直接碰存储 —— 全部经由 `repositories/`：

```ts
IdeaRepository        createIdea · updateIdea · deleteIdea · getIdea · listIdeas · searchIdeas
ConnectionRepository  createConnection · updateConnection · deleteConnection · getConnections · getLinkedIds
ProjectRepository     createProject · updateProject · deleteProject · setProjectIdeas · toggleProjectIdea
TopicRepository       createTopic · updateTopic · deleteTopic · getSubtreeIds
OutlineRepository     appendNode · updateNode · reorder · removeNode
CanvasRepository      saveItem · updateItem · removeItem · saveEdge · removeEdge
WorkspaceRepository   exportSnapshot · importSnapshot · reset        // 整库 JSON 导入导出
GraphLayoutRepository setPosition(s) · clear                        // 图上节点坐标单独存
SettingsRepository    theme · sidebarWidth · detailWidth · collapsed
```

底层是 `KeyValueStore`（`get/set/remove/keys`），现在指向 `LocalStorageStore`。
Repository 全部返回 `Promise`，调用方写法与接真后端时完全一致。

Zustand 只做状态编排：`useWorkspace` 持有实体并调用 repository，
`useUI` 持有主题 / 两栏宽度 / 浮层 / Toast 等界面状态。刷新后由 `init()` 重新水合。

---

## 验证

`node .smoke/run.mjs` —— **50 项断言，覆盖**：

```
欢迎页 · 录入解析 · 刷新持久化 · 详情抽屉 · 自动保存 · 关系建议
命令面板 · 全局搜索分组 · 快速记录快捷键 · 6 条路由
Graph 节点/连线 · Connection 创建+持久化 · Focus 模式淡化
项目四分页 · Canvas · Outline · 主题三视图 · 深浅色 + 刷新保持 · 删除
左栏 300px 伸缩 · 右栏 340px 伸缩 · 窄宽度下长标题不裁切
重排零重叠 · 默认可读缩放 ≥0.9 · 关系标签可见 · 主题分块可导航
块物理分离（跨块 > 同块 ×2） · 地图视图隐藏标签 · 无横向溢出 · 控制台无错误/无 React 告警
```

---

## 接下来从哪里扩展

**换成真后端** —— 只需给 `KeyValueStore` 或八个 Repository 换实现。
接口已经是异步的，页面与 store 一行不用改。建议保持 `WorkspaceSnapshot`
作为导入导出与迁移的契约。

**接 AI / 语义检索** —— 关系建议已经抽象成：

```ts
interface SuggestionProvider {
  suggest(ideaId: string, limit?: number): Promise<ConnectionSuggestion[]>
}
```

现在跑的是 `createLocalSuggestionProvider`（标签重合 / 主题重合 / 词面重合，
拆成三个可解释的分量，`reason` 会写成「同属 AI / Agent」这类人话）。
接 embedding 时实现一个新的 provider 即可，`IdeaDetailDrawer` 里的
「可能的连接」UI 不用改 —— `score` 与 `reason` 的形状已经定了。

`lib/search.ts` 同理：`searchItems()` 是纯函数，换成向量检索只需替换实现。

**布局算法** —— `forceLayoutDetailed()` 是纯函数（节点 + 边 → 坐标），
调参点集中在 `src/lib/layout.ts`：`blockGap`（块间距）、`aspect`（画布比例）、
`padding`（块内留白）。若想换成分层/正交布局（`dagre` / `elkjs`），
只需替换这一个模块 —— 但那会牺牲贝塞尔连线的观感，是明确的取舍。

**协作 / 多端同步** —— 数据模型是扁平实体 + 显式 id，适合接 CRDT
（Automerge / Yjs）或简单的 last-write-wins 同步。`Connection` 是一等实体，
同步冲突比嵌套文档好处理。

**导出成作品** —— `OutlineNode` 已经是 `chapter / section / idea` 的树，
按章节展开 idea 内容就是一篇初稿，接 Pandoc 或导出 Markdown 即可。
