import { create } from 'zustand'
import { ipc } from '../lib/ipc'
import type { Todo } from '@shared/types'

interface TodosState {
  todos: Todo[]
  showDone: boolean
  load: (showDone?: boolean) => Promise<void>
  toggleDone: (t: Todo) => Promise<void>
  create: (t: Partial<Todo>) => Promise<void>
  update: (id: string, patch: Partial<Todo>) => Promise<void>
  remove: (id: string) => Promise<void>
  setShowDone: (v: boolean) => void
}

export const useTodosStore = create<TodosState>((set, get) => ({
  todos: [],
  showDone: false,
  load: async (showDone) => {
    const sd = showDone ?? get().showDone
    set({ todos: await ipc.todos.list(sd) })
  },
  toggleDone: async (t) => {
    await ipc.todos.update(t.id, { done: t.done ? 0 : 1 })
    await get().load()
  },
  create: async (t) => {
    await ipc.todos.create(t)
    await get().load()
  },
  update: async (id, patch) => {
    await ipc.todos.update(id, patch)
    await get().load()
  },
  remove: async (id) => {
    await ipc.todos.delete(id)
    await get().load()
  },
  setShowDone: (v) => {
    set({ showDone: v })
    get().load(v)
  }
}))
