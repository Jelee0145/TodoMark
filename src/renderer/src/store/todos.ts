import { create } from 'zustand'
import { ipc } from '../lib/ipc'
import type { Todo, TodoGroup } from '@shared/types'

interface TodosState {
  todos: Todo[]
  groups: TodoGroup[]
  showDone: boolean
  load: (showDone?: boolean) => Promise<void>
  createGroup: (title: string) => Promise<TodoGroup>
  updateGroup: (id: string, patch: Partial<TodoGroup>) => Promise<void>
  toggleGroup: (group: TodoGroup) => Promise<void>
  removeGroup: (id: string) => Promise<void>
  createTodo: (groupId: string, title: string) => Promise<Todo>
  updateTodo: (id: string, patch: Partial<Todo>) => Promise<void>
  toggleTodo: (todo: Todo) => Promise<void>
  removeTodo: (id: string) => Promise<void>
  setShowDone: (value: boolean) => void
}

export const useTodosStore = create<TodosState>((set, get) => ({
  todos: [],
  groups: [],
  showDone: false,
  load: async (showDone) => {
    const includeDone = showDone ?? get().showDone
    const [todos, groups] = await Promise.all([
      ipc.todos.list(includeDone),
      ipc.todoGroups.list(includeDone)
    ])
    set({ todos, groups })
  },
  createGroup: async (title) => {
    const group = await ipc.todoGroups.create(title)
    set((state) => ({ groups: [group, ...state.groups] }))
    return group
  },
  updateGroup: async (id, patch) => {
    await ipc.todoGroups.update(id, patch)
    set((state) => ({
      groups: state.groups.map((group) => (group.id === id ? { ...group, ...patch } : group))
    }))
  },
  toggleGroup: async (group) => {
    await ipc.todoGroups.update(group.id, { done: group.done ? 0 : 1 })
    await get().load()
  },
  removeGroup: async (id) => {
    await ipc.todoGroups.delete(id)
    set((state) => ({
      groups: state.groups.filter((group) => group.id !== id),
      todos: state.todos.filter((todo) => todo.groupId !== id)
    }))
  },
  createTodo: async (groupId, title) => {
    const todo = await ipc.todos.create({ groupId, title })
    await get().load()
    return todo
  },
  updateTodo: async (id, patch) => {
    await ipc.todos.update(id, patch)
    if (patch.done !== undefined) {
      await get().load()
      return
    }
    set((state) => ({
      todos: state.todos.map((todo) => (todo.id === id ? { ...todo, ...patch } : todo))
    }))
  },
  toggleTodo: async (todo) => {
    await ipc.todos.update(todo.id, { done: todo.done ? 0 : 1 })
    await get().load()
  },
  removeTodo: async (id) => {
    await ipc.todos.delete(id)
    await get().load()
  },
  setShowDone: (value) => {
    set({ showDone: value })
    get().load(value)
  }
}))
