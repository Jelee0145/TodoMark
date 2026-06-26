# 时间管理 — 详细实施计划

> 桌面记事本应用，核心功能是**应用使用时长统计看板**，辅以 Markdown 笔记与待办提醒。
> UI 遵循 `DESIGN.md`（Notion 风：午夜深蓝舞台 + 暖白纸面）。

---

## 一、产品定位

一句话：**看清时间花在哪，顺手记下想法与待办。**

- **核心卖点**：应用使用时长看板（亮屏时间 + 应用分布，漂亮图表）
- **辅助功能**：Markdown 笔记（含分组）、待办提醒（系统通知）
- **桌面常驻**：托盘后台运行，持续采样前台窗口

---

## 二、技术栈（最终确定）

| 层 | 选型 | 用途 / 理由 |
|---|---|---|
| 外壳 | Electron 30+ | 主进程：窗口、托盘、原生通知、采样 |
| 脚手架 | electron-vite | 主/preload/renderer 三端一体，HMR |
| 渲染 | React 18 + Vite + TypeScript | 渲染层 |
| 样式 | Tailwind v4 | 直接消费 `DESIGN.md` 的 `@theme` tokens |
| 状态 | Zustand | 轻量，无需 Redux 样板 |
| 路由 | React Router v6 | 看板/笔记/待办/设置 四个主视图 |
| 存储 | better-sqlite3 | 本地单一库，结构化聚合查询高效 |
| 亮屏检测 | Electron `powerMonitor.getSystemIdleTime()` | 内置 API，无需装包 |
| 前台应用 | active-win | 抓窗口标题/进程路径 |
| Markdown | @uiw/react-md-editor | 编辑/预览分屏，开箱即用 |
| 图表 | recharts | 堆叠条形/甜甜圈/横向条/面积 |
| 热力图 | CSS Grid 手搓 | 贴 Notion 极简风，色阶可控 |
| 构建/打包 | electron-builder | 出 Windows NSIS 安装包 |

---

## 三、核心设计决策

### 3.1 双轨时间模型（最重要）

区分**亮屏时间**与**应用时间**：

```
亮屏时间 = 电脑实际被使用的总时长（含所有前台应用，排除锁屏/长时间离开）
应用时间 = 亮屏时间里每个前台应用的构成分布
```

采样逻辑（主进程，每 5 秒）：

```ts
setInterval(async () => {
  const idleSec = powerMonitor.getSystemIdleTime();   // 系统空闲秒数
  const isScreenOn = systemPreferences.... && idleSec < IDLE_THRESHOLD; // 2 分钟阈值
  if (!isScreenOn) return;                             // 屏不亮/人不在，不记
  const win = await activeWin();                       // 抓前台应用
  db.insert('app_usage', {
    sampleTs: Date.now(),
    appName: win?.owner.name ?? 'Unknown',
    windowTitle: win?.title ?? '',
    exePath: win?.owner.path ?? '',
    category: classifyApp(win?.owner.path),            // 规则引擎分类
    active: 1,
  });
}, SAMPLE_INTERVAL_MS); // 5000
```

时长换算：`时长 = 采样次数 × 5s`。

### 3.2 应用分类规则引擎

- 内置常见规则（按 exePath / appName 模糊匹配）：
  - 开发：`code`, `devenv`, `idea`, `webstorm`, `cmd`, `powershell`, `git`, `node`, `vim`
  - 办公：`WINWORD`, `EXCEL`, `POWERPNT`, `OUTLOOK`, `wps`, `dingtalk`, `wxwork`
  - 社交：`WeChat`, `QQ`, `Telegram`, `Discord`, `Slack`
  - 浏览器：`chrome`, `msedge`, `firefox`, `brave`
  - 娱乐：`steam`, `Spotify`, `vlc`, 游戏 exe
  - 其他：兜底
- 规则存 SQLite `app_rules` 表，用户可在设置页新增/改分类
- 未知应用首次出现 → 自动归"其他"，设置页可批量改

### 3.3 看板英雄区 = 30 天热力图

进入看板**第一眼**是热力图（GitHub 贡献图风格的 30 天 × 24 小时密度图）：
- X 轴：日期（往前推 30 天，含今天）
- Y 轴：24 个时段（每格 1 小时）
- 颜色：从 Midnight Ink `#02093a`（无使用）→ Royal Violet → Periwinkle → Signal Blue（高强度）四级渐变
- hover：`周二 14:00 · 亮屏 1h25m · VS Code 为主`
- 统计的是**亮屏时间**（电脑被使用的总时长），不是单个工作应用

---

## 四、数据模型

SQLite 单库，启动时自动建表迁移。

```sql
-- 分组
CREATE TABLE groups (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  color     TEXT DEFAULT '#0075de',
  sort      INTEGER DEFAULT 0,
  createdAt INTEGER NOT NULL
);

-- 笔记（Markdown 内容）
CREATE TABLE notes (
  id        TEXT PRIMARY KEY,
  groupId   TEXT REFERENCES groups(id) ON DELETE SET NULL,
  title     TEXT NOT NULL DEFAULT '无标题',
  content   TEXT DEFAULT '',            -- markdown 源文
  pinned    INTEGER DEFAULT 0,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE INDEX idx_notes_group ON notes(groupId);
CREATE INDEX idx_notes_updated ON notes(updatedAt DESC);

-- 待办 + 提醒
CREATE TABLE todos (
  id        TEXT PRIMARY KEY,
  title     TEXT NOT NULL,
  noteId    TEXT REFERENCES notes(id) ON DELETE SET NULL, -- 可关联笔记
  done      INTEGER DEFAULT 0,
  dueAt     INTEGER,                    -- 截止时间
  remindAt  INTEGER,                    -- 提醒时间
  createdAt INTEGER NOT NULL
);
CREATE INDEX idx_todos_remind ON todos(remindAt) WHERE done = 0;

-- 亮屏与应用采样（核心表）
CREATE TABLE app_usage (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sampleTs    INTEGER NOT NULL,          -- 采样时刻(ms)
  appName     TEXT,
  windowTitle TEXT,
  exePath     TEXT,
  category    TEXT,                      -- 开发/办公/社交/浏览器/娱乐/其他
  active      INTEGER DEFAULT 1          -- 1=亮屏使用中
);
CREATE INDEX idx_usage_ts ON app_usage(sampleTs);
CREATE INDEX idx_usage_app ON app_usage(appName);
CREATE INDEX idx_usage_cat ON app_usage(category);

-- 应用分类规则（可编辑）
CREATE TABLE app_rules (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern  TEXT NOT NULL,                -- 匹配 exePath/appName 的子串/正则
  category TEXT NOT NULL,
  enabled  INTEGER DEFAULT 1
);

-- 设置（键值对）
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
```

聚合查询示例：

```sql
-- 今日亮屏时长 = 今日 active=1 采样数 × 5s
SELECT COUNT(*) * 5 AS seconds FROM app_usage
WHERE active=1 AND sampleTs >= strftime('%s','now','start of day')*1000;

-- 今日应用排行
SELECT appName, COUNT(*)*5 AS seconds FROM app_usage
WHERE active=1 AND sampleTs >= strftime('%s','now','start of day')*1000
GROUP BY appName ORDER BY seconds DESC LIMIT 10;

-- 热力图：近30天每(日期,小时)的亮屏时长
SELECT strftime('%Y-%m-%d', sampleTs/1000,'unixepoch','localtime') AS d,
       strftime('%H', sampleTs/1000,'unixepoch','localtime') AS h,
       COUNT(*)*5 AS seconds
FROM app_usage WHERE active=1
  AND sampleTs >= strftime('%s','now','-30 day')*1000
GROUP BY d, h;
```

---

## 五、界面布局

### 5.1 全局结构

```
┌──────────────────────────────────────────────────┐
│ 顶栏 (Midnight Ink #02093a)                        │
│ [📊看板] [📝笔记] [✓待办]    今日6h42m ⏸暂停 [⚙]   │
├──────────────────────────────────────────────────┤
│                                                    │
│              主内容区 (Paper White #f6f5f4)          │
│              随顶部 tab 切换                        │
│                                                    │
└──────────────────────────────────────────────────┘
```

- 默认落地**看板**页（核心功能优先曝光）
- 顶栏常驻：今日亮屏时长徽章、暂停/恢复采样开关、设置入口

### 5.2 看板页（核心）

```
┌─ KPI 行（4 张数字卡，Pure White, 12px 圆角）─────────┐
│ 今日亮屏 │ 最专注应用 │ 峰值时段 │ 本周累计           │
├─ 日期范围 tab：[今日][本周][本月] ──────────────────┤
│                                                      │
│ 🌟 英雄区 · 活跃热力图（30天×24小时，亮屏时长）       │
│   深底泛蓝光，hover 显示该时段明细                    │
├────────────────────────┬────────────────────────────┤
│ 今日时间河（堆叠条形图）│ 分类甜甜圈（开发/办公/社交） │
│ 24h X轴，按应用分层着色  │ 中心显示总时长              │
├────────────────────────┴────────────────────────────┤
│ 应用排行 Top 10（横向条形，可点击下钻明细）            │
├──────────────────────────────────────────────────────┤
│ 7 日亮屏趋势（渐变面积图，上周对比虚线）              │
└──────────────────────────────────────────────────────┘
```

- 日期范围切换：今日→当日小时条；本周→7天×24h；本月→30天×24h
- 所有图表点击 → 下钻到该应用/时段的采样明细列表

### 5.3 笔记页（辅助）

```
┌──────────┬─────────────────────┬──────────────┐
│ 左侧栏     │  笔记列表            │ 编辑器/预览    │
│ (纸面)     │  (按 updatedAt 排)   │              │
│ 📁全部分组 │  📌置顶笔记          │ MD编辑/预览   │
│  ├ 工作   │  ─────              │ 切换按钮      │
│  ├ 学习   │  · 笔记标题          │              │
│  └ 生活   │    摘要预览...        │              │
│ +新建分组 │    时间 · 分组标签    │              │
│ +新建笔记 │                     │              │
└──────────┴─────────────────────┴──────────────┘
```

### 5.4 待办页（辅助）

- 单栏列表：未完成（按 remindAt 排序） / 已完成（折叠）
- 每项：复选框、标题、截止时间、关联笔记链接、提醒时间
- 新增/编辑：标题 + 可选截止/提醒时间 + 可选关联笔记
- 到点 → 系统通知（点击跳回应用并定位待办）+ 应用内顶部 toast 横幅

---

## 六、模块结构

```
时间管理/
├─ DESIGN.md                 # 设计系统源（勿改）
├─ AGENTS.md                 # agent 指引
├─ PLAN.md                   # 本文档
├─ package.json
├─ electron.vite.config.ts
├─ electron-builder.yml
├─ src/
│  ├─ main/                  # Electron 主进程
│  │  ├─ index.ts            # 窗口/托盘/生命周期/单实例锁
│  │  ├─ db.ts               # better-sqlite3 初始化 + 迁移 + 查询封装
│  │  ├─ usage-tracker.ts    # powerMonitor + active-win 5s 采样器
│  │  ├─ classifier.ts       # 应用分类规则引擎
│  │  ├─ notifications.ts    # 定时检查 todo.remindAt → Notification
│  │  └─ ipc.ts              # IPC handler 注册（CRUD + 聚合查询）
│  ├─ preload/
│  │  └─ index.ts            # contextBridge 暴露类型化 API
│  └─ renderer/
│     ├─ index.html
│     ├─ src/
│     │  ├─ main.tsx
│     │  ├─ App.tsx          # 路由 + 顶栏
│     │  ├─ styles.css       # Tailwind v4 + @theme tokens
│     │  ├─ pages/
│     │  │  ├─ Dashboard.tsx # 看板（核心）
│     │  │  ├─ Notes.tsx
│     │  │  ├─ Todos.tsx
│     │  │  └─ Settings.tsx
│     │  ├─ components/
│     │  │  ├─ dashboard/
│     │  │  │  ├─ KpiRow.tsx
│     │  │  │  ├─ Heatmap.tsx        # 英雄区热力图(CSS Grid)
│     │  │  │  ├─ TimeRiver.tsx      # 堆叠条形
│     │  │  │  ├─ CategoryDonut.tsx  # 甜甜圈
│     │  │  │  ├─ AppRanking.tsx     # 横向条形
│     │  │  │  └─ TrendChart.tsx     # 面积图
│     │  │  ├─ notes/ ...
│     │  │  ├─ todos/ ...
│     │  │  └─ ui/ (Button, Card, Pill, Toast…)
│     │  ├─ store/           # Zustand stores
│     │  │  ├─ usage.ts
│     │  │  ├─ notes.ts
│     │  │  └─ todos.ts
│     │  └─ lib/
│     │     ├─ ipc.ts        # 调 preload API
│     │     └─ format.ts     # 时长/日期格式化
│     └─ vite.config.ts
└─ resources/
   └─ icon.ico
```

---

## 七、IPC API 契约（preload 暴露）

```ts
// window.api
interface Api {
  // 采样控制
  tracking: {
    isPaused(): Promise<boolean>;
    setPaused(p: boolean): Promise<void>;
  };
  // 聚合查询
  usage: {
    kpi(): Promise<{ todaySec; weekSec; topApp; peakHour }>;
    heatmap(range: 'today'|'week'|'month'): Promise<{date,hour,sec}[]>;
    timeRiver(date: string): Promise<{hour, apps:{name,sec}[]}[]>;
    categories(range): Promise<{category, sec}[]>;
    ranking(range, limit?): Promise<{app, sec}[]>;
    trend(days: number): Promise<{date, sec, prevSec}[]>;
  };
  // 笔记 + 分组
  notes: { list(); create(); update(); delete(); pin() };
  groups: { list(); create(); update(); delete() };
  // 待办
  todos: { list(); create(); update(); delete(); done() };
  // 分类规则
  rules: { list(); upsert(); delete(); classify(path): string };
  // 设置
  settings: { get(key); set(key, val); getAll() };
}
```

主进程在 `notifications.ts` 内每 30s 扫描 `todos WHERE remindAt <= now AND done=0 AND notified=0`，触发 `new Notification()`，并经 IPC 推送 toast 到渲染进程。

---

## 八、UI 落地要点（严格遵循 DESIGN.md）

- **两段式深→浅**：顶栏 Midnight Ink `#02093a`；内容区 Paper White `#f6f5f4`；卡片 Pure White。
- **唯一强调色**：Signal Blue `#0075de`（新建按钮、激活 tab、链接、图表主色）。
- **圆角**：卡片 12px、按钮/输入 8px、徽章/tag 9999px、小元素 5px。
- **间距**：段落间 80px；卡片内边距 24px；元素间 16px；基准 4px。
- **字体**：系统 Inter 替代 NotionInter；权重 500 主导 UI，600 标题，700 仅 hero 数字。
- **图表配色**（应用色由 Signal Blue 系派生 + 按 appName hash 稳定分配）：
  `#0075de #455dd3 #62aef0 #097fe8 #2537b1` 循环。
- **热力图色阶**：`#02093a` → `#2537b1` → `#455dd3` → `#0075de`。
- **不要**：纯黑背景、渐变文字、多色按钮、5px 以下卡片圆角。

---

## 九、实施阶段（建议按顺序，每阶段可独立验证）

### 阶段 1 · 脚手架与设计令牌
- electron-vite 建项目（React + TS）
- 装 Tailwind v4，把 `DESIGN.md` 的 `@theme` 块搬入 `styles.css`
- 三页 tab 骨架 + 顶栏 + 亮屏徽章占位
- **验证**：`npm run dev` 起得来，三页能切，配色与 DESIGN.md 一致

### 阶段 2 · 数据层与采样器
- better-sqlite3 初始化 + 建表迁移（第五节 SQL）
- `usage-tracker.ts`：powerMonitor idle + active-win 5s 采样入库
- preload `contextBridge` 暴露 API；主进程 IPC CRUD
- **验证**：跑几分钟，查 `app_usage` 表有数据；idle >2min 不写

### 阶段 3 · 看板英雄区热力图
- `Heatmap.tsx`：CSS Grid，按 (date,hour) 聚合，四级色阶
- hover tooltip；空格用 Midnight Ink
- **验证**：首屏即见热力图，颜色随数据深浅

### 阶段 4 · 看板其余图表
- KPI 行、时间河（堆叠条形）、分类甜甜圈、应用排行、7 日趋势
- 日期范围 tab 联动
- **验证**：切今日/周/月，各图数据正确联动

### 阶段 5 · 分类规则与设置
- 规则引擎 `classifier.ts` + 内置规则
- 设置页：分类规则 CRUD、采样间隔、idle 阈值、暂停开关
- **验证**：改规则后甜甜圈分类变化

### 阶段 6 · 笔记与分组（辅助）
- 分组树、笔记 CRUD、置顶、MD 编辑/预览切换
- **验证**：增删改查、分组归属正确

### 阶段 7 · 待办与提醒
- 待办 CRUD、关联笔记
- 主进程定时扫描 remindAt → 系统通知 + 渲染 toast
- 托盘：最小化到托盘常驻
- **验证**：设 1 分钟后提醒，能收到系统通知并跳转

### 阶段 8 · 打磨与打包
- 空状态、加载态、错误态
- 快捷键（新建笔记、搜索、切页）
- electron-builder 出 NSIS 安装包
- **验证**：打包后干净安装能跑，托盘/通知/采样正常

---

## 十、风险与对策

| 风险 | 对策 |
|---|---|
| better-sqlite3 / active-win 原生模块编译失败 | 装 VS Build Tools 或用 `@electron/rebuild` + 预编译二进制；AGENTS.md 记录 |
| 全系统窗口标题属敏感数据 | 默认仅本地、加"暂停记录"开关、设置页可清空历史 |
| idle 阈值不当（误判离开） | 默认 120s，设置页可调，热力图间隙可追溯 |
| 长期采样库膨胀 | 按 5s 采样，30 天约几万行，可接受；提供按月归档/清理 |
| 通知权限（Win） | Electron Notification 默认可用；首次提示授权 |

---

## 十一、验收标准（MVP）

- [ ] 打开即见 30 天热力图，颜色随亮屏时长正确变化
- [ ] KPI/时间河/甜甜圈/排行/趋势数据自洽，可切日期范围
- [ ] 采样器持续运行，idle >2min 不计，暂停开关生效
- [ ] 笔记增删改查 + 分组 + 置顶 + MD 预览
- [ ] 待办到点收到系统通知 + 应用内横幅
- [ ] 托盘常驻，最小化后台运行
- [ ] UI 严格符合 DESIGN.md 配色/圆角/间距
