<picture>
  <img alt="TodoMark" src="todomark_logo.png" width="100%" />
</picture>

<br />

**TodoMark** — 你在 Windows 上的时间观察者、笔记簿与待办司令台。

每 5 秒采样一次前台窗口，用量化的方式回答"今天我到底在电脑上做了什么"；辅以 WYSIWYG Markdown 笔记、分组待办、浮动便签和独立的文档工作台，把时间追踪、知识记录和任务管理收进一个窗口。

> 全部数据只存本地。不上传，不联网，没有云账号。

<br />

***

## 功能一览

***

### 看板 — 你的时间画像

打开 TodoMark 的第一眼：**30 天活跃热力图**，以小时为粒度，往下翻，五组可视化串起完整的时间叙事：

* **KPI 卡片** — 今日/本周时长、最活跃应用、峰值时段，一眼看清当天的节奏

* **活跃矩阵** — 7 日 × 24 小时热力图，暖色越深越专注（纯 CSS Grid 手绘，零第三方依赖）

* **时间河** — 逐小时应用分布堆叠条形图，看"上午写代码、下午开会、晚上刷网页"如何交替

* **分类甜甜圈** — 开发 / 办公 / 社交 / 浏览器 / 娱乐 / 其他，六类占比（纯 SVG 自绘）

* **应用排行** — 谁占了最多时间，一目了然

* **7 日趋势** — 今日 vs 昨日同比，周间节奏有没有变化

> 所有图表都是**纯 CSS Grid + SVG 手绘**。不引 recharts，不拖第三方图表库。

***

### 笔记 — 三栏 WYSIWYG

左栏是 48px 图标列（可收起，状态记在 localStorage），中栏是笔记列表，右栏是编辑器。

* 编辑器用 **Milkdown Crepe**，所见即所得。不渲染原生 Toolbar/TopBar，用自定义 NotesToolbar 提供 17 个命令按钮：标题、粗斜体、列表、引用、代码块、表格、图片、链接……

* 图片和链接用自定义 React 模态框填写（Electron 禁了 `window.prompt`）

* 笔记可以**置顶**，重要的永远在上面

* 右键笔记 → 打开**浮动便签**：独立 alwaysOnTop 窗口，360×440，只读模式，适合做临时的参考浮窗

***

### 待办 — 分组嵌套 + 动画交付

二层结构：**待办分组**（带截止/提醒/关联笔记）→ **子待办**。

* 完成单个子项 → 划掉 + **FLIP 动画沉到底部**（320ms ease-out）

* 完成整组 → 子项**从底往上逐个划掉**，交错 120ms，最后标题划掉，卡片淡出

* 截止时间 + 系统通知（每 30 秒轮询一次），弹窗点击跳回对应待办

* 已完成组可整体收起/展开，也可隐藏所有已完成的组

***

### 文档工作台 — 独立的 Markdown IDE

注册本地文件夹作为**工作区**，所有读写都受路径授权保护。支持：

* **标签系统** — 给文档打标签，按标签筛选

* **全文搜索** — 跨工作区的 `.md` / `.markdown` 内文检索

* **文件关联** — 安装后双击 `.md` 文件 → 自动在文档窗口打开（单实例 argv 转发 + 二级实例监听）

* **外部变更检测** — `fs.watch` 监听工作区，外部修改推送到编辑器，保存时**乐观并发控制**，冲突可感知

* **回收站保护** — 删除进回收站，回收站中文档只读不可编辑

* 默认只读，点"编辑"才进入编辑模式，避免误改

***

### 便签窗口

从笔记列表点击"浮动便签"即可打开：独立窗口，alwaysOnTop，360×440，只读展示笔记内容。适合边写代码边参考。

***

### 设置

* **分类规则** — 30 条默认规则（按 appName+exePath 子串匹配），覆盖开发 / 办公 / 社交 / 浏览器 / 娱乐；可增删改，变更后自动回溯重打所有历史采样

* **空闲阈值** — 自定义多少秒空闲视为"不在场"（默认 120s）

* **暂停/恢复** — 顶栏常驻暂停开关，一键暂停所有采样

* **清空数据** — 一键清除全部采样历史

***

## 设计系统 — Steep

TodoMark 的界面遵循 **Steep** 设计语言："Soft dawn on a marble dashboard"——白与暖灰的近无色画布，rust-peach 强调色做标点，衬线 + 无衬线双字族的编辑感搭配。

* **字形**：UI 无衬线（Inter）用于导航/按钮/表格；Display 衬线（Source Serif Pro / Georgia）仅用于 44px+ 大标题

* **配色**：只有 Rust (#5d2a1a) + Cool Blue (#4a90e2) 两个色相，其余 UI 皆为单色

* **圆角**：卡片 24px、输入 16px、按钮 9999px——任何角不低于 12px

* **阴影**：三层签名阴影叠加（1px ink-tinted border + 20px/25px drop + 8px/10px micro drop）

* **全图表**：纯 CSS Grid + SVG 手绘，不依赖 recharts 等第三方图表库

详见 [`DESIGN.md`](./DESIGN.md)（完整 token 表与组件规范）。

***

## 为什么是本地优先

TodoMark 的核心原则：**你的数据是你的**。

* 全部采样记录、笔记、待办存在本地 SQLite 文件，路径 `userData/timemanager.db`

* `activeWindow()` 会读到所有前台窗口标题——这是敏感信息，所以默认不进任何网络请求

* 顶栏常驻暂停开关，一键停掉所有采样

* 设置页提供清空全部数据

* 开源（MIT 许可），你可以审查每一行代码在做什么

***

## 技术栈

| 层    | 选型                                   |
| ---- | ------------------------------------ |
| 外壳   | Electron 30+，frameless + transparent |
| 脚手架  | electron-vite                        |
| 渲染   | React 18 + TypeScript（strict）        |
| 样式   | Tailwind v4 + Steep 设计 token         |
| 状态   | Zustand（按域拆分 store）                  |
| 路由   | React Router v6                      |
| 数据库  | better-sqlite3（主进程同步，无 ORM）          |
| 前台检测 | active-win（5s 轮询）                    |
| 编辑器  | @milkdown/crepe（三处复用）                |
| 图表   | 纯 SVG 自绘（热力图 CSS Grid）               |
| 打包   | electron-builder → NSIS              |

***

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（HMR，三端同时热重载）
npm run dev

# 类型检查（三端 tsconfig 全部通过）
npm run typecheck

# 构建 + NSIS 安装包
npm run dist
```

> **Windows 原生模块**：`better-sqlite3` 和 `active-win` 需要 native 编译。
> 如遇编译失败，安装 **Visual Studio Build Tools**（C++ 工作负载），或确保已安装 Python 3.x。
>
> ```bash
> npm run rebuild  # 重新编译原生模块
> ```

## 开发命令

| 命令                  | 说明                               |
| ------------------- | -------------------------------- |
| `npm run dev`       | 开发模式，三端同时 HMR                    |
| `npm run build`     | electron-vite 构建渲染层              |
| `npm run typecheck` | 三端 TypeScript 类型检查               |
| `npm run lint`      | ESLint 检查                        |
| `npm run rebuild`   | 重新编译 better-sqlite3 等原生模块        |
| `npm run dist`      | 构建 + electron-builder 出 NSIS 安装包 |

## 架构概要

```
src/
├── main/              # Electron 主进程
│   ├── index.ts            # 窗口/托盘/生命周期
│   ├── db.ts               # better-sqlite3 初始化/迁移/查询
│   ├── usage-tracker.ts    # 5s 前台采样器（双轨：亮屏 ≠ 应用时间）
│   ├── ipc.ts              # IPC handler 注册
│   ├── notifications.ts    # 待办提醒检查
│   ├── sticky-notes.ts     # 浮动便签窗口管理
│   ├── documents.ts        # 文档工作区/授权/文件系统监听
│   ├── documents-window.ts # 独立文档窗口生命周期
│   └── window-ipc.ts       # 窗口控制 IPC
├── preload/           # contextBridge API（编译输出 .cjs）
│   └── index.ts
├── renderer/src/      # React 渲染层
│   ├── pages/              # Dashboard / Notes / Todos / Settings / Documents / StickyNote
│   ├── components/         # UI 基元 + 领域组件
│   ├── store/              # Zustand 状态（usage / notes / todos）
│   └── lib/                # 工具函数 + ipc 封装
└── shared/            # 跨层类型契约
    └── types.ts
```

### 三种窗口

1. **主窗口** — frameless + transparent，四个主视图（仪表盘/笔记/待办/设置）
2. **便签窗口** — 独立 BrowserWindow，alwaysOnTop，360×440，路由 `/sticky-note/:noteId`
3. **文档窗口** — 独立 BrowserWindow，1360×880，路由 `/documents/read`

三种窗口共用同一份 preload，窗口控制 IPC 通过 `BrowserWindow.fromWebContents(event.sender)` 定位调用方。

### 双轨时间模型

* **亮屏时间**：`powerMonitor.getSystemIdleTime()` < 空闲阈值（默认 120s）→ 亮屏活跃

* **应用时间**：同时抓取 `activeWindow()` 写入 `appName` 和 `category`

* 锁屏/无法获取窗口时仅记 active=1 不计应用

* 时长 = 采样行数 × 5 秒（`SAMPLE_SEC` 常量）

### 数据隐私

* 全部数据仅存储本地 SQLite（路径 `userData/timemanager.db`）

* 顶栏常驻暂停记录开关

* 设置页提供清空全部数据

* **不联网、不上传任何数据**

## 打包安装

```bash
npm run dist
```

产物在 `dist/` 目录：

* `TodoMark Setup {version}.exe` — NSIS 安装包（自定义安装目录、桌面/开始菜单快捷方式）

* `win-unpacked/` — 免安装绿色版（便携使用）

安装包附带 `.md` / `.markdown` 文件关联：装完后双击任意 Markdown 文件，TodoMark 的文档工作台会自动打开。单实例锁防止重复启动，已运行的实例通过 argv 转发接收文件路径。

***

## 许可

MIT — 自由使用、修改、分发。如果你用得上，欢迎提 Issue 或 PR。
