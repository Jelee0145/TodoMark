# PREFERENCES

> 从多轮迭代沉淀的个人设计/工程偏好。`DESIGN.md` 定义 Steep 的硬性 token；本文档定义 token 之外**怎么做**。
> 跟 DESIGN.md 冲突时以 DESIGN.md 为准（token 是底线）。本文是经验和判断的速记。

## 1. 交互模式

### 1.1 卡片 / 列表项的「更多操作」

- **popout 默认收起**。点卡片自身才展开，点卡片外任何位置自动收起。
- **不要覆盖原有展开/收拢功能**。如果卡片本身有 chevron 之类的展开控件，那是另一个语义，popout 是 actions 面板。
- **popout 内容** = 当前项可执行的动作（置顶/删除/添加子项/提醒等），不是子内容。子内容走 chevron 展开。
- **check / toggle 类操作**：`stopPropagation`，不能因为点 checkbox 把 popout 弹出来。

### 1.2 列表项点击

- 选中态用浅底色 + 1px 边或细阴影，不要用粗描边或强色块。
- 列表项 hover 边框要**完整可见**，不能被相邻的 icon 按钮 / 浮动元素盖住。

### 1.3 编辑态

- 进入编辑用 `focus()`，**不要** `input.select()`。全选文本是反直觉的"接管"。
- 提交用 blur / Enter；Esc 取消。

## 2. 层级（z-index）

DOM 自然层级不够时才动用 z-index。一旦动用，**全站统一一档语义**，别到处发明。

| 层级 | 值 | 用在哪 |
|---|---|---|
| 卡片 hover ring | `z-20` | 卡片 `::after` 伪元素画 hover 边框，必须盖在卡片内的 icon 按钮之上 |
| 行内菜单 | `z-20` | 卡片内弹出的 actions 面板 |
| 顶栏 | `z-50` | 顶部导航 / window controls |
| Portal 菜单 | `z-[100]` | `createPortal` 到 body 的下拉，必须脱离滚动容器 / overflow 裁剪 |
| Toast / 全局提示 | `z-[200]` | 永远在顶栏之上 |

**铁律**：
- **凡是要被遮挡覆盖的视觉态（hover 边框、focus ring、菜单阴影），用 `::after` 伪元素或 portal 元素，不要把 z-index 堆在主元素上**——主元素的 z-index 改了会带飞整个组件树。
- **滚动容器**（`overflow: auto/scroll`）会按可视区裁剪**子元素的外溢绘制**（包括 box-shadow、::after）。要么加 padding 给装饰物留位，要么用 portal。
- **下拉菜单永远 portal 到 body**，不要挂在滚动容器里——下边界被裁、点击穿透到下层卡片、是同一根因的三个症状。

## 3. Hover / Focus

- **hover 边框用伪元素画**，主元素本身不带 box-shadow。原因见 §2。
- 伪元素 `pointer-events: none`、`inset: -1px`、`border-radius` 比主元素大 2px，把圆角段也包住。
- hover 过渡用 `transition: opacity`，**不要** `transition: box-shadow`——后者会触发 paint，开销大且部分浏览器抖。
- focus ring 不和 hover 边框合并画在同一元素上：focus 是 a11y 必须，hover 是装饰；分开才能独立开关。

## 4. 滚动容器装饰物留位

凡是滚动容器里有任何 `inset: -Npx` / `box-shadow` / `::after` 外溢绘制的子元素：

- 容器要预留 `pt-N + N px` 内边距，否则**首项的外溢顶部**会被裁。
- 容器底部同理（末项的 drop shadow 下沿），预留 `pb` = 最大 drop spread + 余量。

不要靠 `overflow: visible` 解决——会破坏滚动。

## 5. 状态过渡（动画）

### 5.1 列表项的完成/取消完成

- **完成的子项** → 划掉 + **沉到底部**。FLIP 处理重排，320ms `cubic-bezier(0.22, 1, 0.36, 1)`。
- **整组完成** → **子项从底往上逐个划掉**（reverse iterate），每项间隔 ~120ms，最后 title 划掉，再 fade 整卡。
- 整组完成过程中**锁定 group 自身的 check 按钮**，避免重复触发。

### 5.2 反向迭代优先于「抑制排序」

- 整组完成的视觉稳定性靠"从底往上敲"自然达成：刚敲完的项落到当前 done 区底部 = 原位置 = FLIP dy=0 自动 no-op。
- 比"完成期间冻结 sort"那种方案省事，**覆盖 90% 场景**（全未完成 → 全完成）。只有"组里已有部分 done，新完成一项"是边缘场景，FLIP 微抖一下可接受。

### 5.3 showDone 开关

- 双向 fade 动画，**关比开略快**（off 350ms / on 400ms），符合"撤掉比展开更利落"的肌肉记忆。
- 关闭时**保留已 done 的组在 DOM 里**直到动画结束再 unmount，filter 不能在动画期间把组过滤掉。

### 5.4 弹层 / popout

- 展开用 `data-open` 属性 + CSS transition 驱动，**不要**用 framer-motion / react-spring 之类——本项目刻意保持纯 CSS + Tailwind。
- `panel-open-dur` / `panel-close-dur` 写到 `:root` CSS 变量里，跨组件统一调。

## 6. 视觉硬规则（从这系列 hover 边框事件里）

- **任何"X 被遮挡"的反馈，第一反应是查 z-index 和滚动容器的 overflow**，不要先去调颜色 / 透明度。
- 1px 描边是装饰底线，**不允许被任何 z-index < 自身的元素盖住**。
- 阴影、描边、focus ring 一律画在**伪元素或 portal 元素**上，主体元素 z-index 保持 auto，避免带飞其他子元素。

## 7. 工作流

### 7.1 改动流程

- **非平凡改动先 Plan**：用 plan 模式读代码、出方案、等用户确认再执行。单文件单行 hotfix 不需要。
- 方案要列：根因、备选方案、推荐、验收清单、风险。**不要列超过 3 个备选**——多了用户也选不过来。

### 7.2 验证

- 改完代码：**先 typecheck 三端全过**（`tsconfig.json` / `tsconfig.node.json` / `tsconfig.web.json`），再 `npm run dist`。
- 不跑 lint——本项目没装 eslint。
- 视觉验证靠**用户截图**反馈，不靠 e2e / 单元测试。截图说明问题比 log 准。

### 7.3 提交

- 每次视觉/交互迭代**一个 commit**，标题前缀用 `fix(notes):` / `feat(todos):` / `chore:` 之类。
- **不提交构建产物**（`dist/` `dist2/` `release*/`），不提交 `electron-builder.yml` 的 output 改动。
- commit message 用英文，简洁说动机+做法，不写 "what changed"（diff 自己会说）。

### 7.4 构建目录被锁

- `dist\win-unpacked\resources\app.asar` 经常被 `OpenChamber.exe`（Windows Defender 组件）锁住几分钟。
- **不要 kill OpenChamber**（是系统组件）。直接改 `electron-builder.yml` 的 `output` 到新目录（`dist2` / `release3` / ...），构建完提交代码后**把 yml 还原回 `dist`** 并 `git restore --staged`（不提交 yml）。
- 等锁自然释放后再 `npm run dist` 验证能正常出 `dist/`，但不一定每次都跑——能 build 就行，产物用户自己装。

### 7.5 工具使用

- **代码定位优先用 codebase-memory-mcp 图谱**（`search_graph` / `get_code_snippet` / `trace_path`），不要无脑 `grep + read`。
  - 适用：大文件（>500 行）、跨多文件的改动、想了解某函数所有调用方
  - 不适用：<200 行小文件改动、精确字符串定位（grep 仍更准）
- **不主动加 README / 文档**，除非用户明确要。`AGENTS.md` / `DESIGN.md` / `PREFERENCES.md` 是仅有的项目文档。

## 8. 沟通

- 中文交流，简短直接。**单条回复 < 4 行文本**（不含工具调用 / 代码生成）。
- 不用 emoji（用户没要求）。
- 改完一段给个**简短报告**：改了什么、验了什么、没验什么、风险。
- 用户用截图反馈时，**先复述自己看到的现象**（"你看到的是 X 被 Y 遮挡"），再给方案——别上来就猜根因。
