import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Project } from '@/types'
import { useProjectStore } from './index'

const MAX_HISTORY = 50

interface HistoryStoreState {
  past: Project[]
  future: Project[]
  canUndo: boolean
  canRedo: boolean
  pushHistory: () => void
  undo: () => void
  redo: () => void
  clearHistory: () => void
}

export const useHistoryStore = create<HistoryStoreState>()(
  immer((set, get) => ({
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,

    // Call this BEFORE making a change to snapshot current state
    pushHistory: () => {
      const current = useProjectStore.getState().project
      // Deep clone via JSON round-trip (project is serializable)
      const snapshot: Project = JSON.parse(JSON.stringify(current))
      set((state) => {
        state.past.push(snapshot)
        if (state.past.length > MAX_HISTORY) {
          state.past.splice(0, state.past.length - MAX_HISTORY)
        }
        state.future = []
        state.canUndo = state.past.length > 0
        state.canRedo = false
      })
    },

    undo: () => {
      const { past } = get()
      if (past.length === 0) return

      const current = useProjectStore.getState().project
      const currentSnapshot: Project = JSON.parse(JSON.stringify(current))

      const previous = past[past.length - 1]
      set((state) => {
        state.past.pop()
        state.future.unshift(currentSnapshot)
        if (state.future.length > MAX_HISTORY) {
          state.future.splice(MAX_HISTORY)
        }
        state.canUndo = state.past.length > 0
        state.canRedo = state.future.length > 0
      })

      useProjectStore.getState().setProject(JSON.parse(JSON.stringify(previous)))
    },

    redo: () => {
      const { future } = get()
      if (future.length === 0) return

      const current = useProjectStore.getState().project
      const currentSnapshot: Project = JSON.parse(JSON.stringify(current))

      const next = future[0]
      set((state) => {
        state.future.shift()
        state.past.push(currentSnapshot)
        if (state.past.length > MAX_HISTORY) {
          state.past.splice(0, state.past.length - MAX_HISTORY)
        }
        state.canUndo = state.past.length > 0
        state.canRedo = state.future.length > 0
      })

      useProjectStore.getState().setProject(JSON.parse(JSON.stringify(next)))
    },

    clearHistory: () =>
      set((state) => {
        state.past = []
        state.future = []
        state.canUndo = false
        state.canRedo = false
      }),
  })),
)
