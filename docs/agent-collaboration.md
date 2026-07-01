# Agent Collaboration

> 多会话/多角色协作约定。参见 `agent-update-log.md` 查看变更历史。

## 总则

- **入口必须是 AGENTS.md**：所有跨会话信号优先写进 `AGENTS.md`（硬信息、坑）。本文档只记录会话间协调状态。
- **每会话一个 update log 条目**：开始前读 log，结束后写 log。
- **工作流**：plan-first → typecheck 三端 → diff review → 更新 AGENTS.md（如新增架构决策）。

## 文件约定

- `docs/agent-collaboration.md` — 本文，协作规范本身。
- `docs/agent-update-log.md` — 变更日志，每条记录：任务目标、涉及文件、实现方式、风险、验证结果。
- `AGENTS.md` — 项目自身的硬信息（栈、架构、路由、DB、坑），**长期有效**。
- `DESIGN.md` — Steep 设计系统 token。
- `PREFERENCES.md` — 交互/渲染/z-index 等怎么做。

## 通信

- 更新 log 时顶部注明"截至 X session"。
- 发现新坑或新约定，写入 `AGENTS.md` 对应段落，同时在 log 条目里引用。
