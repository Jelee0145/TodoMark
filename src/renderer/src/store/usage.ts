import { create } from 'zustand'
import { ipc } from '../lib/ipc'
import type { Kpi, RangeKey } from '@shared/types'

interface UsageState {
  range: RangeKey
  paused: boolean
  kpi: Kpi | null
  setRange: (r: RangeKey) => void
  setPaused: (p: boolean) => Promise<void>
  loadPaused: () => Promise<void>
  loadKpi: () => Promise<void>
}

export const useUsageStore = create<UsageState>((set) => ({
  range: 'month',
  paused: false,
  kpi: null,
  setRange: (r) => set({ range: r }),
  setPaused: async (p) => {
    const next = await ipc.tracking.setPaused(p)
    set({ paused: next })
  },
  loadPaused: async () => {
    set({ paused: await ipc.tracking.isPaused() })
  },
  loadKpi: async () => {
    set({ kpi: await ipc.usage.kpi() })
  }
}))
