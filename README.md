# TodoMark

> 桌面记事本应用 — 看清时间花在哪，顺手记下想法与待办

核心功能：**应用使用时长统计看板**（亮屏时间 + 应用分布），辅以 Markdown 笔记与待办提醒。基于 Electron 30，纯本地运行，隐私安全。

---

## 功能

- **看板** — 30 天活跃热力图、KPI 卡片、时间河堆叠条形图、分类甜甜圈、应用排行、7 日趋势
- **笔记** — 分组管理、Markdown 编辑/预览、置顶、浮动便签
- **待办** — 截止时间/提醒、系统通知、关联笔记
- **设置** — 采样控制、分类规则编辑、隐私管理

## 截图

<!-- TODO: 补充截图 -->

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（HMR）
npm run dev

# 构建 + 打包安装包
npm run dist
```

> **Windows 原生模块**：`better-sqlite3` 和 `active-win` 需要 native 编译。
> 如遇编译失败，装 Visual Studio Build Tools（C++ 工作负载），或确保已安装 Python 3.x。

## 目录结构

```
时间管理/
├── src/
│   ├── main/          # Electron 主进程
│   │   ├── index.ts        # 窗口/托盘/生命周期
│   │   ├── db.ts           # better-sqlite3 初始化 + 迁移 + 查询
│   │   ├── usage-tracker.ts # 5s 前台应用采样器
│   │   ├── ipc.ts          # IPC handler 注册
│   │   ├── notifications.ts # 待办提醒检查
│   │   ├── sticky-notes.ts  # 浮动便签窗口管理
│   │   └── window-ipc.ts    # 窗口控制
│   ├── preload/       # contextBridge API
│   ├── renderer/      # React 渲染层
│   │   └── src/
│   │       ├── pages/       # Dashboard / Notes / Todos / Settings
│   │       ├── components/  # UI 基元 + 看板图表
│   │       ├── store/       # Zustand 状态管理
│   │       └── lib/         # 工具函数
│   └── shared/         # 跨层类型定义
├── resources/          # 应用图标
├── out/                # build 输出
├── dist/               # 安装包输出
├── DESIGN.md           # 视觉设计规范
└── AGENTS.md           # AI 开发指引
```

## 技术栈

| 层 | 选型 |
|---|---|
| 外壳 | Electron 30+ |
| 脚手架 | electron-vite |
| 渲染 | React 18 + TypeScript |
| 样式 | Tailwind v4 |
| 状态 | Zustand |
| 路由 | React Router v6 |
| 存储 | better-sqlite3 |
| 前台检测 | active-win |
| Markdown | @uiw/react-md-editor |
| 图表 | recharts (部分) / CSS Grid 热力图 |
| 打包 | electron-builder (NSIS) |

## 数据隐私

- 所有数据仅存储本地 SQLite 文件
- 顶栏常驻"暂停记录"开关
- 设置页提供清空历史功能
- 不联网、不上传任何数据

## 开发命令

```bash
npm run dev          # 开发模式 HMR
npm run build        # 构建渲染层
npm run typecheck    # 三端类型检查
npm run lint         # ESLint
npm run dist         # 构建 + NSIS 安装包
npm run rebuild      # 重新编译原生模块
```

## 发布

构建产物在 `dist/` 目录：

- `TodoMark Setup 0.1.0.exe` — NSIS 安装包（含自定义安装目录选项）
- `win-unpacked/` — 免安装绿色版

## 许可

MIT
