# AGENTS.md

> 给后续 OpenCode 会话的高信号指引。每条都是"没它容易踩坑"的硬信息。
>
> 三份配套文档，按用途分工：
>
> - [`DESIGN.md`](./DESIGN.md) — Steep 设计系统硬性 token（颜色/字体/间距/阴影/组件规范）。**唯一源**。写代码不要在别处造 token。
> - [`PREFERENCES.md`](./PREFERENCES.md) — 交互模式、z-index 层级、hover/focus 渲染规则、状态过渡、工作流。**怎么做**的速记。
> - 本文 — 项目本身（是什么、栈、架构、路由、数据库、坑）。**是什么**的速记。

## 项目是什么

**TodoMark** — Windows 桌面应用（工作目录 `D:\project\时间管理`，appId `com.tomark.app`）。
核心功能是**应用使用时长统计看板**（亮屏时间 + 应用分布），辅以 Markdown 笔记、分组待办提醒、便签、独立 Markdown 文档工作台。

**项目状态**：已实现并打包过 NSIS 安装包，~30 个 commit，单一 `main` 分支。**不是绿地**。

## 技术栈（不要换）

Electron 30+ · electron-vite · React 18 · Vite · TypeScript · Tailwind v4 · Zustand · React Router v6 · better-sqlite3 · active-win · @milkdown/crepe · electron-builder。

**注**：所有图表都是**纯 SVG 自绘**（热力图 CSS Grid 手搓，其他用 SVG）。**别引 recharts**。

## 关键架构决策（容易做错）

1. **三种窗口并存**，共用一份 preload：
   - **主窗口**（`mainWindow`）：`/dashboard` `/notes` `/todos` `/settings` 四个主视图，frameless + transparent + 4px inset 圆角。
   - **便签窗口**（`sticky-notes.ts`）：每条 note 独立 BrowserWindow，alwaysOnTop，360×440，路由 `/sticky-note/:noteId`。
   - **文档窗口**（`documents-window.ts`）：独立 BrowserWindow，1360×880，路由 `/documents`，处理 `.md`/`.markdown` 文件关联与单实例 argv 转发。
   - 窗口控制 IPC（`window-ipc.ts`）用 `BrowserWindow.fromWebContents(event.sender)` 定位调用方，三种窗口通用。
2. **双轨时间模型**：`亮屏时间 ≠ 应用时间`。`usage-tracker.ts` 每 5s 采样：先看 `powerMonitor.getSystemIdleTime()`，>= `idleThreshold`（默认 120s）不写；否则抓 `activeWindow()` 写 `app_usage` 行。锁屏/拿不到窗口时只写 `active=1` 但 appName=null。**热力图统计亮屏时间，排行/甜甜圈统计应用分布**，别混。
3. **时长 = 采样行数 × 5**。SQL 端用 `COUNT(*) * 5 AS sec` 折算。`SAMPLE_SEC = 5` 写死在 `db.ts`。
4. **看板是首页**，默认落地 `/dashboard`，第一眼必须是 30 天热力图（`components/dashboard/Heatmap.tsx`）。
5. **待办是分组（todo_groups）嵌套子项（todos）的二层结构**，不是平铺 todo。`todo_groups_inline_v2_migrated` 迁移标志位在 settings 表里，老数据已迁完。子项完成、整组 done、提醒触发都在 `todo_groups` 行上。
6. **应用分类规则引擎**：`db.ts` 内 `classifyByRules(path, name)` 按 `appName+exePath` 拼接字符串，对启用的 `app_rules` 子串匹配。规则变更后 `reclassifyUsageCategories()` 回溯重打 `app_usage.category`。默认 30 条规则覆盖开发/办公/社交/浏览器/娱乐。
7. **文档工作台有授权边界**：`documents.ts` 所有读写都校验 `isWithin(workspace.rootPath, path)`，**仅授权工作区内或已显式 import 的 `.md`/`.markdown` 可读写**。`fs.watch` 监听工作区，外部修改推 `documents:externalChanged` 事件；保存用 optimistic concurrency（`expectedMtimeMs`），冲突返回 `{ ok: false, conflict }`。
8. **托盘常驻**：`mainWindow.close` 不真退出，而是 `hide()` 到托盘。`isQuitting` 标志位区分"点关闭按钮"与"托盘 → 退出"。
9. **WYSIWYG 编辑器 = Milkdown Crepe**：笔记主编辑器（`/notes`）、独立便签（`/sticky-note/:noteId`）、文档工作台（`/documents`）**三处都用 `@milkdown/crepe`**，不引 `react-markdown` / `@uiw/react-md-editor` 之类。
   - **三处 Crepe 都关掉自带 `Toolbar` / `TopBar` / `BlockEdit` / `AI`**，改用各自页面的自定义 UI：
      - `/notes` 用 `src/renderer/src/components/notes/NotesToolbar.tsx`（Steep 风格，Feather 细描边 14px，17 个命令按钮，命令走 `crepe.editor.action(ctx => commands.call(key))`）；图片/链接用自定义 React 模态框（Electron 禁了 `window.prompt`）
     - `/documents` 复用 `NotesToolbar`，嵌进原 h-14 操作栏左侧，工具栏和操作组视觉同源
     - `/sticky-note/:noteId` 只读，无 toolbar
   - **`.crepeRef` 模式**：`MilkdownEditor` 组件在 `crepe.create().then(() => crepeRef.current = crepe)` 里把实例挂出去，父组件通过 `crepeRef` 调命令；卸载时 `crepeRef.current = null` 防泄漏。
   - **Crepe CSS 默认值要覆盖**：`reset.css` 给 `.ProseMirror` 设了 `padding: 60px 120px`，必须 `padding: 0 !important`；`frame.css` 给 `.milkdown-code-block` 加了厚底色 + toolbar，要去重（圆角 6、padding 10/14、CodeMirror/gutter 透明、语言选择器 `:has(.cm-editor.cm-focused)` 才出现）。所有覆盖写在 `src/renderer/src/styles.css` 顶部 `/* md-editor 浅底适配 */` 段，类前缀是 `.document-crepe` 或 `.notes-crepe` / `.sticky-crepe`。
   - **Documents 默认只读**：`MilkdownEditor` 的 `readOnly` prop = `document.readOnly || !active.editMode`。打开文档默认 `editMode: false`（存在 `OpenDocument` 上），操作栏"编辑/完成"按钮切换。`readOnly` 文档（如回收站文件）不渲染该按钮。`key={path:revision:editMode}` 让 Crepe 销毁重建。

## 路由

```
/dashboard           默认主页，KPI + 热力图 + 时间河 + 甜甜圈 + 排行 + 趋势
/notes               三栏：分组（48px 图标列可收起，默认收起 + localStorage 记忆，chevron 切换）/ 笔记列表 / WYSIWYG 编辑器（@milkdown/crepe + 自定义 NotesToolbar）
/todos               内联分组 + 子待办（FLIP 动画、收展、提醒、关联笔记）
/settings            分类规则 CRUD、idle 阈值、清空
/sticky-note/:noteId 独立便签窗口（alwaysOnTop，无顶栏，Crepe 只读）
/documents           独立 Markdown 文档工作台（880px 居中，Crepe + 自定义 NotesToolbar，默认只读，操作栏"编辑/完成"切换，无窄/宽屏概念）
```

`App.tsx` 用 `useMatch` 检测 `/sticky-note/*` 和 `/documents`，命中则整窗渲染对应 page，不套顶栏/Toast/WindowControls。

## 数据库

better-sqlite3 单库，路径 `app.getPath('userData') + '/timemanager.db'`，启动时建表 + 迁移。

**实际表**（`db.ts` migrate 段）：
- `groups` / `notes` — 笔记分组与笔记
- `todos` / `todo_groups` — 内联分组的二层待办
- `app_usage` / `app_rules` — 采样与分类规则
- `settings` — 键值对（`paused` / `idleThreshold` / `markdownDocumentSession` / 迁移标志等）
- `markdown_workspaces` / `markdown_documents` / `document_tags` / `document_tag_map` / `markdown_search` — 文档库

**主进程同步执行 better-sqlite3**，无异步 ORM。`createRequire(import.meta.url)` 引 `better-sqlite3`（因 `package.json` 是 `type: module`）。**别引 Prisma/Drizzle**。

聚合查询用 `strftime('%Y-%m-%d', sampleTs/1000, 'unixepoch', 'localtime')` 与 `localtime` 修饰符，**别用 UTC**。

## 进程边界

- **主进程**（`src/main/`）：DB、采样器、通知、托盘、IPC handler、便签/文档窗口生命周期、文件系统监听。
- **preload**（`src/preload/`）：`contextBridge` 暴露 `window.api`。**注意**：preload 编译目标 `format: 'cjs'` + 输出 `[name].cjs`，`webPreferences.preload` 必须写 `index.cjs` 不是 `.js`。
- **渲染层**（`src/renderer/`）：永不直接 `require('better-sqlite3')` 或 `active-win`，只走 `window.api`。
- **shared**（`src/shared/types.ts`）：主/preload/renderer 三端共享类型契约。

## 设计系统（DESIGN.md — Steep）

> "Soft dawn on a marble dashboard" — 一个白与暖灰的近无色画布，配上克制单一的 rust-peach 强调色，编辑化的衬线 + 无衬线双字族。整套系统把颜色当标点：chrome 是单色的，可视化只给两个有色声部（rust 暖 + cool blue 冷），且只允许一个深色填充按钮承担主行动。

### 配色 tokens

| Name | Value | Token | 用途 |
|---|---|---|---|
| Ink | `#17191c` | `--color-ink` | 主文字、filled CTA、深色面 |
| Pure White | `#ffffff` | `--color-pure-white` | 页面画布、卡片面、按钮文字 |
| Fog | `#f7f7f8` | `--color-fog` | 次级画布、分区底、侧栏 |
| Ash | `#4c4c4c` | `--color-ash` | 次要文字、次级描边 |
| Graphite | `#777b86` | `--color-graphite` | 三级文字、图标描边、未激活链接 |
| Dove | `#a3a6af` | `--color-dove` | 1px 边线、占位、低权重分隔 |
| Slate | `#8b8c8d` | `--color-slate` | 低权重语境下的图标 / 链接边 |
| Obsidian | `#000000` | `--color-obsidian` | 极细硬边、深描边（慎用） |
| **Rust** | `#5d2a1a` | `--color-rust` | **唯一暖色强调**：甜甜圈描边、chart 折线、激活态左侧 3px 内阴影 `inset 3px 0 0 var(--color-rust)`、hero glow tint |
| Apricot Wash | `#fbe1d1` | `--color-apricot-wash` | 暖色数据卡片底、hero 暖光 |
| Sky Wash | `#d3e3fc` | `--color-sky-wash` | 冷色数据卡片底、对话气泡 |
| Cool Blue | `#4a90e2` | `--color-cool-blue` | 冷色图表主色（DESIGN.md 指名的第二色相） |

**只有 Rust + 两个 wash + cool blue 四种有色声部**，其他 UI 一律单色。

### 字体（双字族）

- **Display 衬线**（`--font-serif`）：`Source Serif Pro` / `GT Sectra` / `Tiempos Headline` / 兜底 `Georgia, serif`。**只用于 44px 以上的 hero / 区块大标题**，**绝不**小于 40px。
- **UI 无衬线**（`--font-sans`）：`Inter` / `Untitled Sans` / 兜底 `system-ui`。承担导航、按钮、表单、表格、说明文。
- **权重**：UI 用 430/450/480/500 的微层级，**不要 bold**（用 480/500 替代）。
- **字距**：所有 Sohne 类文字 `-0.009em`；Signifier 64px+ 用 `-0.025em`。

### 字号 scale

| 角色 | Size | Line Height | Letter Spacing | Token |
|---|---|---|---|---|
| caption | 14px | 1.5 | -0.13px | `--text-caption` |
| body | 16px | 1.38 | -0.14px | `--text-body` |
| body-lg | 18px | 1.35 | -0.16px | `--text-body-lg` |
| subheading | 22px | 1.25 | -0.2px | `--text-subheading` |
| heading-sm | 26px | 1.18 | -0.23px | `--text-heading-sm` |
| heading | 44px | 1.1 | -0.66px | `--text-heading` |
| heading-lg | 64px | 1.1 | -1.6px | `--text-heading-lg` |
| display | 90px | 1.1 | -2.25px | `--text-display` |

### 间距 & 圆角 & 阴影

- **基准** 4px；段落 80px；卡片内边距 20-24px；元素间距 8px；页面最大宽 1200px。
- **圆角**：tag / 按钮 / 头像 9999px（pill），卡片 24px（`--radius-3xl`），输入 16px（`--radius-2xl`），图片 12px（`--radius-xl`）。**任何角不能 < 12px**。
- **签名阴影**（`--shadow-subtle` / `--shadow-lift`）= 三层叠加：
  ```
  1px ink-tinted border
  + 20px/25px drop
  + 8px/10px micro drop
  ```
  完整值见 `src/renderer/src/styles.css` 的 `@theme` 块。**别再在别处造 box-shadow**。

### 表面层级（Surfaces）

| Level | Name | Value | 用途 |
|---|---|---|---|
| 1 | Canvas | `#ffffff` | 页面底、hero 底 |
| 2 | Fog | `#f7f7f8` | 分区底、侧栏、product shell |
| 3 | Card | `#ffffff` | 24px 圆角、签名阴影的内容卡 |
| 4 | Warm Tint | `#fbe1d1` | 暖色数据卡 |
| 5 | Cool Tint | `#d3e3fc` | 冷色数据卡、对话气泡 |
| 6 | Ink | `#17191c` | filled CTA、深色块 |

### 组件规范

| 组件 | 形态 | 关键参数 |
|---|---|---|
| **Filled Dark CTA** | 主行动按钮 | 9999px pill · Ink 底 · 白字 · Sohne 15px/450 · 8px 20px padding · -0.009em tracking。**一屏只能有一个** |
| **Text Link Button** | 次行动 | Ink 文字 · Sohne 15px/450 · 无边框无底 · 紧跟 filled CTA 右侧 |
| **Top Bar** | 全局导航 | 白底 · 无阴影 · Ink logo 左 · 链接 Ink 色 Sohne 15px · 右侧 text-link + filled CTA 组 · sticky 64-72px · 1px Dove 底边可选 |
| **Product Dashboard Card** | 数据卡 | 白底 · 24px 圆角 · 20-24px padding · 签名阴影 |
| **Warm Data Card** | 暖数据卡 | Apricot Wash 底 · 24px 圆角 · Rust 描边甜甜圈 / 折线 |
| **Cool Data Card** | 冷数据卡 | Sky Wash 底 · 24px 圆角 · Cool Blue 柱/折线 |
| **Sidebar Navigation** | 侧栏 | Fog 底 · 240px · 无边 · 16px 线条图标 + 15px Sohne/450 Ink 文字 · 激活态白底浅 tint |
| **Input Field** | 输入 | 白底 · 16-20px 圆角 · 1px Dove 边 · 15px Sohne 占位 Graphite |
| **Avatar Badge** | 头像 | 32-40px 圆 · 9999px · 薄荷/天蓝/桃色 pastel 底 · 2 字母 monogram Ink 13px/500 |
| **Stat Card** | 紧凑表 | 白底 · 24px 圆角 · 20px padding · 标题 Sohne 15px/500 Ink · 行 14px · 12px 行距 |
| **Floating Hero Card** | 装饰卡 | 白底 · 24px 圆角 · 签名阴影 · 绝对定位 hero 大字周围 |
| **Stat Card w/ Delta** | KPI | 白底 · 24px 圆角 · 26-44px Sohne/480 或 Signifier 数字 Ink · Graphite 13px 标签 · 12px 涨跌箭头 |

### Do

- Signifier **仅**用于 44-90px hero / 区块大标题，**绝不**低于 40px
- Filled CTA 用 9999px pill + Ink 底，一屏一个，右侧紧跟 text-link 次行动
- 所有内容卡 24px 圆角、内 padding 20px、产品图 12px 圆角
- Hero 暖色径向渐变**只**出现在 hero 区，product UI 留白 / Fog 画布
- Apricot Wash / Sky Wash **只**用作数据卡底，不当装饰 wash
- Sohne 文字一律 `-0.009em`；Signifier 64px+ 用 `-0.025em`
- 卡阴影**必须**三层叠加（见上）

### Don't

- Signifier 用于正文 / 标签 / 导航 / 任何 < 40px 的地方
- 给 UI chrome 引入饱和蓝 / 绿 / 红——只有 Rust + 两个 wash + cool blue
- 任何角的圆角 < 12px
- 把暖色径向渐变放到 hero 之外
- 边线粗过 1px；分层靠 surface tint + 圆角
- Ink 填充用除主 CTA 和深色文字以外的地方
- 一屏 > 1 个 filled 按钮；次行动是 text-link，不是 ghost 按钮
- 给 UI chrome 引入新颜色 token；色板见上，**别再造**

### 在代码里落地

- Tailwind v4 的 `@theme` 块在 `src/renderer/src/styles.css` 顶部已搬好（含 `--color-cool-blue` 这个原 DESIGN.md 没显式命名但 styles.css 实际加的扩展色），**别再在别处造 token**。
- 形状 / 阴影 / 间距全部用 CSS 变量（`--radius-3xl` / `--shadow-subtle` / `--spacing-24`），不要硬编码 px。

## 代码约定

- TypeScript strict；新文件必带类型。
- 组件：函数组件 + hooks，域内组件放 `src/renderer/src/components/{domain}/`，UI 基元放 `components/ui/`。
- 状态：Zustand store 分域（`store/usage.ts` `store/notes.ts` `store/todos.ts`），不放全局大 store。
- 查询：渲染层只调 `window.api.*`（统一封装在 `lib/ipc.ts`），聚合在主进程 SQL 完成，渲染层不做大数据计算。
- 时间戳统一 ms（`Date.now()`），DB 列 `INTEGER`。
- 渲染层用 `react-router-dom` 的 `Routes` / `useNavigate` / `useMatch`，**别引其他路由库**。
- 不写注释除非解释非显然意图；不主动加 README/文档除非要求。

## 开发命令

```bash
npm run dev          # electron-vite HMR，三端同时起
npm run build        # 类型检查 + 打包渲染
npm run typecheck    # tsc --noEmit，root + node + web 三份 tsconfig
npm run lint         # eslint 9 flat config
npm run rebuild      # npx electron-rebuild -f -w better-sqlite3
npm run dist         # electron-vite build && electron-builder 出 NSIS 安装包
```

**顺序要求**：改完代码先 `typecheck` 再 `build`；提 PR 前必须 typecheck + lint 都过。

## 原生模块坑（Windows 重灾区）

- `better-sqlite3` 是原生模块，Electron 版本升级后**必须 rebuild**：
  ```bash
  npx electron-rebuild -f -w better-sqlite3
  ```
- `postinstall` 钩子是 `electron-builder install-app-deps`，**别改**。
- 首次安装若编译失败 → 装 **Visual Studio Build Tools**（C++ 工作负载），或换 better-sqlite3 预编译版本。
- `active-win` 同为原生，但锁版本一般能直接用。

## 打包与文件关联

- `electron-builder.yml` 已配 NSIS 输出 `dist/`、`runAfterFinish: true`、`.md`/`.markdown` 文件关联（图标用 `icon.ico`）。
- `extraResources` 把 `icon.png` + `icon.ico` 拷到 `resources/`，主进程/便签/文档窗口都从 `process.resourcesPath` 取图标。
- 装好后双击 `.md` → 单实例锁的 `second-instance` 监听 `argv` 里的 `.md`/`.markdown` → `openDocumentWindow(paths)` 派发到文档窗口。

## 隐私底线

`activeWindow()` 会拿到所有前台窗口的标题，属敏感数据。务必：
- 默认仅本地 SQLite，无任何上传。
- 顶栏常驻"暂停记录"开关（`settings:paused`），采样器 tick 时检查。
- 设置页提供清空/导出（`db.reclassifyUsageCategories` 仅重打 category，不删行；如需清空走 `app_usage` DELETE）。
- 便签窗口里展示的笔记内容也是本地，不出网。

## 容易踩的坑清单

- preload 入口**必须**是 `index.cjs`（不是 `.js`）—— `electron.vite.config.ts` 的 rollup 配置把输出强制成 cjs。
- 渲染层用 `import type { ... } from '@shared/types'`（vite alias 已配），主进程用相对路径 `../shared/types`。
- 主进程的 `db.ts` 用 `createRequire` 引 `better-sqlite3`，**别改成 `import`**。
- 便签窗口 `close` 不会真关闭（`event.preventDefault()` + `hide`？当前是 `alwaysOnTop: true` 不 hide 关闭，看实现）。新增便签销毁逻辑要参考 `sticky-notes.ts` 现有模式。
- 文档窗口 `close` 走 `flushRequested` 事件给渲染层保存机会，**别直接 destroy**。
- `electron-vite preview` 不带 HMR，开发必须用 `dev`。
- `tsconfig.json` / `tsconfig.node.json` / `tsconfig.web.json` 三份独立，typecheck 走所有。

## 设计 / 交互规范（去 PREFERENCES.md 查）

本文档只写"是什么"。下列"怎么做"统一在 [`PREFERENCES.md`](./PREFERENCES.md)：

- **z-index 层级表**（卡片 hover ring `z-20`、行内菜单 `z-20`、顶栏 `z-50`、portal 菜单 `z-[100]`、toast `z-[200]`）— PREFERENCES §2
- **hover 边框 / focus ring 画在 `::after` 伪元素上**，不在主元素上 — PREFERENCES §3
- **滚动容器要给 `inset:-Npx` / drop shadow 留 padding** — PREFERENCES §4
- **列表项完成 = 划掉 + 沉底（FLIP）；整组完成 = 子项从底往上逐个划** — PREFERENCES §5
- **下拉菜单永远 `createPortal` 到 body** — PREFERENCES §2 / §5.4
- **工作流**：plan-first、typecheck 三端、`dist` 锁时 yml 改新目录、**不杀 OpenChamber** — PREFERENCES §7
