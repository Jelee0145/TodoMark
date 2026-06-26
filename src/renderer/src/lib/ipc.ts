// 渲染层统一 IPC 入口；所有对主进程的调用都走这里，类型来自 preload
export const ipc = window.api
