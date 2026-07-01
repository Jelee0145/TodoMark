# Agent Update Log

## 2026-07-01 — Session 1: Crepe 统一 + Documents 只读 + 分组栏收起

### 目标

将笔记编辑器从 `@uiw/react-md-editor` 切换到 `@milkdown/crepe`（与 Documents 统一），Documents 去掉窄屏模式改为默认只读，Notes 分组栏默认收起并持久化。

### 涉及文件

- `src/renderer/src/components/notes/NotesToolbar.tsx` — 新增，17 个命令按钮
- `src/renderer/src/components/notes/NotesToolbarIcons.tsx` — 新增，Feather 风格图标
- `src/renderer/src/pages/Notes.tsx` — 改 Crepe + 自定义工具栏 + 分组栏收起
- `src/renderer/src/pages/Documents.tsx` — 改默认只读 + editMode 切换 + 去窄屏
- `src/renderer/src/pages/StickyNote.tsx` — 改 Crepe 只读
- `src/renderer/src/styles.css` — 大量 Crepe CSS 覆盖，清旧 w-md-editor 规则
- `src/renderer/src/components/ui/Icon.tsx` — 新增 chevron-left
- `AGENTS.md` — 同步架构决策第 9 条、路由描述、技术栈
- `package.json` — 去 `@uiw/react-md-editor`

### 实现方式

1. 三处 Crepe 统一关闭自带 Toolbar/TopBar/BlockEdit/AI
2. Notes/Documents 复用 `NotesToolbar` 组件，StickyNote 只读无工具栏
3. `.crepeRef` 模式：`MilkdownEditor` 挂实例到 ref，父组件调命令
4. Documents 新增 `OpenDocument.editMode` 字段，默认 false
5. 分组栏 localStorage 记忆收起状态

### 风险与注意

- Crepe CSS 覆盖必须写进 `styles.css` 顶部 `/* md-editor 浅底适配 */` 段，类前缀按 `.document-crepe` / `.notes-crepe` / `.sticky-crepe` 隔离
- `.ProseMirror` 的 `padding: 60px 120px` 库默认值必须 `padding: 0 !important`
- Electron 无 `window.prompt`，图片/链接用自定义 React 模态框
- preload 入口必须是 `.cjs`

### 验证

- `npm run typecheck` — 通过
- `npm run build` — 通过
- `npm run lint` — 通过（eslint 9 flat config）

### 后续

- 暂无

---

## 2026-07-01 — Session 2: 构建产物目录改回 /dist

### 目标

把 electron-vite 构建输出从默认的 `out/` 改到 `dist/`，更新所有引用路径。

### 涉及文件

- `electron.vite.config.ts` — main/preload/renderer 三端加 `build.outDir`
- `package.json` — `main` 字段从 `./out/main/index.js` 改为 `./dist/main/index.js`
- `electron-builder.yml` — `files` 从 `out/**/*` 改为 `dist/**/*`，`directories.output` 从 `dist` 改为 `dist_installer` 避免冲突
- `AGENTS.md` — 无变更（不记录构建路径）
- `docs/agent-update-log.md` — 本条目

### 实现方式

1. 分别设置三端 `outDir` 为 `dist/main`、`dist/preload`、`dist/renderer`
2. electron-builder 打包输出独立到 `dist_installer`，不与 vite 产物混淆
3. 清掉旧 `dist/` 中的 installer 产物后，用新 build 生成

### 风险与注意

- `dist/` 和 `dist_installer/` 都已加入 `.gitignore`
- electron-builder 的 `files` 从 `out/**/*` 改为 `dist/**/*`，需确认打包时不会把 `dist_installer` 目录也打包进去（当前 `directories.output` 是 `dist_installer`，不在 `dist/` 下，安全）
- 老 `out/` 目录仍保留，可手动清理

### 验证

- `npm run build` — 通过，产物输出到 `dist/main/index.js`、`dist/preload/index.cjs`、`dist/renderer/...`
- `npm run typecheck` — 通过
