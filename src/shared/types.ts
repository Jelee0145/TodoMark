// 主进程与渲染层共享的类型契约

export type Category = '开发' | '办公' | '社交' | '浏览器' | '娱乐' | '其他'

export interface Group {
  id: string
  name: string
  color: string
  sort: number
  createdAt: number
}

export interface Note {
  id: string
  groupId: string | null
  title: string
  content: string
  pinned: number
  createdAt: number
  updatedAt: number
}

export interface Todo {
  id: string
  groupId: string | null
  sort: number
  title: string
  noteId: string | null
  done: number
  dueAt: number | null
  remindAt: number | null
  createdAt: number
}

export interface TodoGroup {
  id: string
  title: string
  noteId: string | null
  done: number
  dueAt: number | null
  remindAt: number | null
  notified: number
  createdAt: number
}

export interface AppRule {
  id: number
  pattern: string
  category: Category
  enabled: number
}

export interface ReclassifyResult {
  scanned: number
  updated: number
}

export interface Kpi {
  todaySec: number
  weekSec: number
  topApp: string | null
  topAppSec: number
  peakHour: number | null
}

export interface HeatmapCell {
  date: string // YYYY-MM-DD
  hour: number // 0-23
  sec: number
}

export interface TimeRiverPoint {
  hour: number
  apps: { name: string; sec: number }[]
}

export interface CategorySlice {
  category: string
  sec: number
}

export interface RankItem {
  app: string
  sec: number
}

export interface TrendPoint {
  date: string
  sec: number
  prevSec: number
}

export type RangeKey = 'today' | 'week' | 'month'

export interface ToastPayload {
  id: string
  title: string
  body?: string
  todoId?: string
}

export interface NoteOpenPayload {
  noteId: string
}
