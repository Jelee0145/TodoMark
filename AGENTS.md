# AGENTS.md

> 给后续 OpenCode 会话的高信号指引。每条都是"没它容易踩坑"的硬信息。
> 完整产品/技术计划见 [`PLAN.md`](./PLAN.md)；视觉规范唯一源是 [`DESIGN.md`](./DESIGN.md)。

## 项目是什么

桌面记事本应用（工作目录 `D:\project\时间管理`）。**核心卖点是应用使用时长统计看板**，辅以 Markdown 笔记与待办提醒。当前是**绿地项目**，仅 `DESIGN.md` + `PLAN.md`，尚未初始化代码。

## 技术栈（不要换）

Electron 30+ · electron-vite · React 18 · Vite · TypeScript · Tailwind v4 · Zustand · React Router v6 · better-sqlite3 · active-win · recharts · @uiw/react-md-editor · electron-builder。

理由都在 `PLAN.md` 第二节。已与用户确认，勿再讨论替代方案（包括 Tauri / Vue / Redux）。

## 关键架构决策（容易做错）

1. **双轨时间模型**：`亮屏时间 ≠ 应用时间`。亮屏时间用 Electron 内置 `powerMonitor.getSystemIdleTime()` 判断（idle < 120s 算亮屏），应用时间用 `active-win` 抓前台窗口。两者都写 `app_usage` 表，`active=1` 表示亮屏。**热力图统计亮屏时间，排行/甜甜圈统计应用分布。** 别混。
2. **采样间隔固定 5s**，`时长 = 采样行数 × 5s`。
3. **看板是首页**，默认落地 `/dashboard`，进入第一眼必须是 30 天热力图（英雄区）。
4. **热力图用 CSS Grid 手搓**，不用 recharts（recharts 无内置热力）。色阶 4 级：`#02093a → #2537b1 → #455dd3 → #0075de`。
5. **应用分类**：规则引擎按 `exePath`/`appName` 模糊匹配，规则存 `app_rules` 表可编辑，未匹配归"其他"。不是纯手动，不是纯自动。

## 数据库

better-sqlite3 单库，启动时自动建表迁移。表结构见 `PLAN.md` 第四节。聚合查询一律走 SQL `GROUP BY` + `strftime`（已有现成 SQL，照抄）。主进程同步执行，别引异步 ORM。

## 开发命令（脚手架后）

```bash
npm run dev          # electron-vite HMR，主+渲染同时起
npm run build        # 类型检查 + 打包渲染
npm run typecheck    # tsc --noEmit，主/preload/renderer 三端
npm run lint         # eslint（脚手架默认配置）
npm run dist         # electron-builder 出 NSIS 安装包
```

**顺序要求**：改完代码先 `typecheck` 再 `build`；提 PR 前必须 typecheck + lint 都过。

## 原生模块坑（Windows 重灾区）

- `better-sqlite3`、`active-win` 是原生模块，Electron 版本升级后**必须 rebuild**：
  ```bash
  npx electron-rebuild -f -w better-sqlite3
  ```
- 首次安装若编译失败 → 装 **Visual Studio Build Tools**（C++ 工作负载），或换 better-sqlite3 的预编译版本。
- `package.json` 里的 `postinstall` 要包含 `electron-rebuild`，别漏。

## 进程边界（别跨）

- **主进程**（`src/main/`）：DB、采样器、分类引擎、通知、托盘、IPC handler。
- **preload**（`src/preload/`）：`contextBridge` 暴露类型化 `window.api`，是渲染层唯一入口。
- **渲染层**（`src/renderer/`）：永不直接 `require('better-sqlite3')` 或 `active-win`，只调 `window.api`。
- 跨层数据走 IPC，契约见 `PLAN.md` 第七节。

## 设计规范（唯一源 DESIGN.md）

- **两段式**：顶栏 `#02093a`（Midnight Ink），内容区 `#f6f5f4`（Paper White），卡片 `#ffffff`。同一卡片内不混深浅。
- **唯一强调色** `#0075de`（Signal Blue）：CTA、激活态、链接、图表主色。不引入第二个彩色按钮。
- **圆角**：卡片 12px / 按钮&输入 8px / 徽章 9999px / 小元素 5px。
- **间距**：段落 80px / 卡片内边距 24px / 元素间 16px / 基准 4px。
- **字体**：系统 Inter 替代 NotionInter；权重 500 主导 UI，600 标题，700 仅 hero 数字（KPI、看板大数字）。
- **禁止**：纯黑背景、渐变文字、多色 CTA、<5px 卡片圆角、Tailwind 之外再造一套 token。
- Tailwind v4 的 `@theme` 直接搬 `DESIGN.md` 的 token 块（DESIGN.md 末尾已给现成代码）。

## 代码约定

- TypeScript strict；新文件必带类型。
- 组件：函数组件 + hooks，放 `src/renderer/src/components/{domain}/`，UI 基元放 `components/ui/`。
- 状态：Zustand store 分域（usage/notes/todos），不放全局大 store。
- 查询：渲染层只调 `window.api.*`，聚合在主进程 SQL 完成，渲染层不做大数据计算。
- 时间戳统一 ms（`Date.now()`），DB 列 `INTEGER`。
- 不写注释除非解释非显然意图；不主动加 README/文档除非要求。

## 顺序约束

实现按 `PLAN.md` 第九节八阶段顺序推进，每阶段有独立验证点，别跳。当前未启动代码，下一动作是**阶段 1：electron-vite 脚手架 + Tailwind v4 + DESIGN.md tokens + 三页骨架**。

## 隐私底线

记录全系统前台窗口标题属敏感数据。务必：默认仅本地存储；顶栏常驻"暂停记录"开关；设置页提供清空历史。未经用户同意不做任何上传。
