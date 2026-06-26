import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type {
  CategorySlice,
  Group,
  HeatmapCell,
  Kpi,
  Note,
  RangeKey,
  RankItem,
  ReclassifyResult,
  Todo,
  TrendPoint,
  TimeRiverPoint,
  AppRule,
  ToastPayload,
  NoteOpenPayload
} from '../shared/types'

const api = {
  tracking: {
    isPaused: (): Promise<boolean> => ipcRenderer.invoke('tracking:isPaused'),
    setPaused: (paused: boolean): Promise<boolean> =>
      ipcRenderer.invoke('tracking:setPaused', paused)
  },
  usage: {
    kpi: (): Promise<Kpi> => ipcRenderer.invoke('usage:kpi'),
    heatmap: (range: RangeKey): Promise<HeatmapCell[]> =>
      ipcRenderer.invoke('usage:heatmap', range),
    timeRiver: (date: string): Promise<TimeRiverPoint[]> =>
      ipcRenderer.invoke('usage:timeRiver', date),
    categories: (range: RangeKey): Promise<CategorySlice[]> =>
      ipcRenderer.invoke('usage:categories', range),
    ranking: (range: RangeKey, limit?: number): Promise<RankItem[]> =>
      ipcRenderer.invoke('usage:ranking', range, limit),
    trend: (days: number): Promise<TrendPoint[]> => ipcRenderer.invoke('usage:trend', days)
  },
  groups: {
    list: (): Promise<Group[]> => ipcRenderer.invoke('groups:list'),
    create: (name: string, color: string): Promise<Group> =>
      ipcRenderer.invoke('groups:create', name, color),
    update: (id: string, name?: string, color?: string): Promise<void> =>
      ipcRenderer.invoke('groups:update', id, name, color),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('groups:delete', id)
  },
  notes: {
    list: (groupId?: string | null): Promise<Note[]> =>
      ipcRenderer.invoke('notes:list', groupId),
    get: (id: string): Promise<Note | null> => ipcRenderer.invoke('notes:get', id),
    create: (groupId: string | null): Promise<Note> =>
      ipcRenderer.invoke('notes:create', groupId),
    update: (
      id: string,
      patch: Partial<Pick<Note, 'title' | 'content' | 'groupId' | 'pinned'>>
    ): Promise<void> => ipcRenderer.invoke('notes:update', id, patch),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('notes:delete', id)
  },
  todos: {
    list: (includeDone?: boolean): Promise<Todo[]> =>
      ipcRenderer.invoke('todos:list', includeDone),
    create: (t: Partial<Todo>): Promise<Todo> => ipcRenderer.invoke('todos:create', t),
    update: (id: string, patch: Partial<Todo>): Promise<void> =>
      ipcRenderer.invoke('todos:update', id, patch),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('todos:delete', id)
  },
  rules: {
    list: (): Promise<AppRule[]> => ipcRenderer.invoke('rules:list'),
    upsert: (rule: Partial<AppRule>): Promise<number> =>
      ipcRenderer.invoke('rules:upsert', rule),
    delete: (id: number): Promise<void> => ipcRenderer.invoke('rules:delete', id),
    reclassifyUsage: (): Promise<ReclassifyResult> =>
      ipcRenderer.invoke('rules:reclassifyUsage')
  },
  settings: {
    get: (key: string): Promise<string | null> => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string): Promise<void> =>
      ipcRenderer.invoke('settings:set', key, value),
    all: (): Promise<Record<string, string>> => ipcRenderer.invoke('settings:all')
  },
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    maximize: (): Promise<boolean> => ipcRenderer.invoke('window:maximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
    onMaximizeChange: (cb: (maximized: boolean) => void): (() => void) => {
      const handler = (_e: IpcRendererEvent, maximized: boolean) => cb(maximized)
      ipcRenderer.on('window:maximizeChanged', handler)
      return () => ipcRenderer.removeListener('window:maximizeChanged', handler)
    }
  },
  stickyNotes: {
    open: (noteId: string): Promise<void> => ipcRenderer.invoke('stickyNotes:open', noteId),
    close: (noteId: string): Promise<void> => ipcRenderer.invoke('stickyNotes:close', noteId),
    edit: (noteId: string): Promise<void> => ipcRenderer.invoke('stickyNotes:edit', noteId),
    setAlwaysOnTop: (noteId: string, pinned: boolean): Promise<boolean> =>
      ipcRenderer.invoke('stickyNotes:setAlwaysOnTop', noteId, pinned)
  },
  onToast: (cb: (payload: ToastPayload) => void): (() => void) => {
    const handler = (_e: IpcRendererEvent, payload: ToastPayload) => cb(payload)
    ipcRenderer.on('toast:show', handler)
    return () => ipcRenderer.removeListener('toast:show', handler)
  },
  onTodoReminderOpen: (cb: (payload: ToastPayload) => void): (() => void) => {
    const handler = (_e: IpcRendererEvent, payload: ToastPayload) => cb(payload)
    ipcRenderer.on('todos:open', handler)
    return () => ipcRenderer.removeListener('todos:open', handler)
  },
  onNoteOpen: (cb: (payload: NoteOpenPayload) => void): (() => void) => {
    const handler = (_e: IpcRendererEvent, payload: NoteOpenPayload) => cb(payload)
    ipcRenderer.on('notes:open', handler)
    return () => ipcRenderer.removeListener('notes:open', handler)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (err) {
    console.error('preload expose failed:', err)
  }
} else {
  // @ts-ignore allow direct attach when not isolated
  window.api = api
}

export type Api = typeof api
