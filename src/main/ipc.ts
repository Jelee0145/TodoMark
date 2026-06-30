import { ipcMain } from 'electron'
import * as db from './db'

export function registerIpc(): void {
  // ---------- 采样控制 ----------
  ipcMain.handle('tracking:isPaused', () => db.getSetting('paused') === '1')
  ipcMain.handle('tracking:setPaused', (_e, paused: boolean) => {
    db.setSetting('paused', paused ? '1' : '0')
    return db.getSetting('paused') === '1'
  })

  // ---------- 聚合查询 ----------
  ipcMain.handle('usage:kpi', () => db.getKpi())
  ipcMain.handle('usage:heatmap', (_e, range) => db.getHeatmap(range))
  ipcMain.handle('usage:timeRiver', (_e, date: string) => db.getTimeRiver(date))
  ipcMain.handle('usage:categories', (_e, range) => db.getCategories(range))
  ipcMain.handle('usage:ranking', (_e, range, limit) => db.getRanking(range, limit))
  ipcMain.handle('usage:trend', (_e, days: number) => db.getTrend(days))

  // ---------- 分组 ----------
  ipcMain.handle('groups:list', () => db.listGroups())
  ipcMain.handle('groups:create', (_e, name: string, color: string) =>
    db.createGroup(name, color)
  )
  ipcMain.handle('groups:update', (_e, id: string, name?: string, color?: string) =>
    db.updateGroup(id, name, color)
  )
  ipcMain.handle('groups:delete', (_e, id: string) => db.deleteGroup(id))

  // ---------- 笔记 ----------
  ipcMain.handle('notes:list', (_e, groupId?: string | null) => db.listNotes(groupId))
  ipcMain.handle('notes:get', (_e, id: string) => db.getNote(id))
  ipcMain.handle('notes:create', (_e, groupId: string | null) => db.createNote(groupId))
  ipcMain.handle('notes:update', (_e, id: string, patch) => db.updateNote(id, patch))
  ipcMain.handle('notes:delete', (_e, id: string) => db.deleteNote(id))

  // ---------- 待办 ----------
  ipcMain.handle('todos:list', (_e, includeDone = false) => db.listTodos(includeDone))
  ipcMain.handle('todos:create', (_e, t) => db.createTodo(t))
  ipcMain.handle('todos:update', (_e, id: string, patch) => db.updateTodo(id, patch))
  ipcMain.handle('todos:delete', (_e, id: string) => db.deleteTodo(id))
  ipcMain.handle('todoGroups:list', (_e, includeDone = false) => db.listTodoGroups(includeDone))
  ipcMain.handle('todoGroups:create', (_e, title: string) => db.createTodoGroup(title))
  ipcMain.handle('todoGroups:update', (_e, id: string, patch) => db.updateTodoGroup(id, patch))
  ipcMain.handle('todoGroups:delete', (_e, id: string) => db.deleteTodoGroup(id))

  // ---------- 分类规则 ----------
  ipcMain.handle('rules:list', () => db.listRules())
  ipcMain.handle('rules:upsert', (_e, rule) => db.upsertRule(rule))
  ipcMain.handle('rules:delete', (_e, id: number) => db.deleteRule(id))
  ipcMain.handle('rules:reclassifyUsage', () => db.reclassifyUsageCategories())

  // ---------- 设置 ----------
  ipcMain.handle('settings:get', (_e, key: string) => db.getSetting(key))
  ipcMain.handle('settings:set', (_e, key: string, value: string) => db.setSetting(key, value))
  ipcMain.handle('settings:all', () => db.getAllSettings())
}
