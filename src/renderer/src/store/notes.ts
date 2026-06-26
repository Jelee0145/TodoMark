import { create } from 'zustand'
import { ipc } from '../lib/ipc'
import type { Group, Note } from '@shared/types'

interface NotesState {
  groups: Group[]
  notes: Note[]
  selectedGroupId: string | null | undefined // undefined = 全部
  activeNoteId: string | null
  loading: boolean

  loadGroups: () => Promise<void>
  loadNotes: (groupId?: string | null) => Promise<void>
  selectGroup: (id: string | null | undefined) => void
  selectNote: (id: string | null) => void
  createGroup: (name: string, color: string) => Promise<void>
  createNote: () => Promise<void>
  updateNote: (
    id: string,
    patch: Partial<Pick<Note, 'title' | 'content' | 'groupId' | 'pinned'>>
  ) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  sortNotes: (notes: Note[]) => Note[]
}

export const useNotesStore = create<NotesState>((set, get) => ({
  groups: [],
  notes: [],
  selectedGroupId: undefined,
  activeNoteId: null,
  loading: false,

  loadGroups: async () => {
    set({ groups: await ipc.groups.list() })
  },
  loadNotes: async (groupId) => {
    const g = groupId ?? get().selectedGroupId
    set({ loading: true })
    const notes = await ipc.notes.list(g === undefined ? undefined : (g ?? null))
    set({ notes, loading: false })
  },
  selectGroup: (id) => {
    set({ selectedGroupId: id })
    get().loadNotes(id)
  },
  selectNote: (id) => set({ activeNoteId: id }),
  createGroup: async (name, color) => {
    await ipc.groups.create(name, color)
    await get().loadGroups()
  },
  // 本地排序：pinned DESC, updatedAt DESC（与 SQL 一致）
  sortNotes(notes: Note[]): Note[] {
    return [...notes].sort((a, b) => {
      if (b.pinned !== a.pinned) return b.pinned - a.pinned
      return b.updatedAt - a.updatedAt
    })
  },
  createNote: async () => {
    const g = get().selectedGroupId
    const note = await ipc.notes.create(g === undefined ? null : g ?? null)
    // 乐观更新：新笔记置于顶部，不触发 loadNotes（避免 loading 切换导致列表动画重播）
    set((state) => ({ notes: [note, ...state.notes], activeNoteId: note.id }))
  },
  updateNote: async (id, patch) => {
    await ipc.notes.update(id, patch)
    // 乐观更新：仅就地更新字段，不调用 loadNotes。
    // 打字（title/content）只更新不重排，避免列表跳动；pinned/groupId 变化才重排或移除。
    set((state) => {
      const sel = state.selectedGroupId
      // 改分组且当前视图是特定分组 → 从当前列表移除
      if (patch.groupId !== undefined && sel !== undefined && sel !== null && patch.groupId !== sel) {
        return { notes: state.notes.filter((n) => n.id !== id) }
      }
      const next = state.notes.map((n) =>
        n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n
      )
      // pinned 变化需重排以反映置顶；其余保持原位（打字时不抖动）
      return { notes: patch.pinned !== undefined ? get().sortNotes(next) : next }
    })
  },
  deleteNote: async (id) => {
    await ipc.notes.delete(id)
    set((state) => ({
      notes: state.notes.filter((n) => n.id !== id),
      activeNoteId: state.activeNoteId === id ? null : state.activeNoteId
    }))
  }
}))
