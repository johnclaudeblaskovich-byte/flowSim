import { useEffect } from 'react'
import { useCanvasStore, useUIStore, useSolverStore } from '@/store'
import { useHistoryStore } from '@/store/historyStore'

interface KeyboardShortcutOptions {
  onFindOpen: () => void
  onSave: () => void
  onOpen?: () => void
}

/**
 * Global keyboard shortcut handler.
 * Mount once in App.tsx.
 * React Flow handles Delete/Backspace for selected nodes/edges internally.
 */
export function useKeyboardShortcuts({ onFindOpen, onSave, onOpen }: KeyboardShortcutOptions) {
  const { undo, redo } = useHistoryStore()
  const { clearSelection } = useCanvasStore()
  const { setRightPanelOpen } = useUIStore()
  const { startSolve, pauseSolve, stopSolve, solverState } = useSolverStore()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Escape in inputs to blur
        if (e.key === 'Escape') target.blur()
        return
      }

      const ctrl = e.ctrlKey || e.metaKey

      // ── Undo / Redo ────────────────────────────────────────────────────────
      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
        return
      }

      // ── Save ──────────────────────────────────────────────────────────────
      if (ctrl && e.key === 's') {
        e.preventDefault()
        onSave()
        return
      }

      // ── Open ──────────────────────────────────────────────────────────────
      if (ctrl && e.key === 'o') {
        e.preventDefault()
        onOpen?.()
        return
      }

      // ── Solver controls ───────────────────────────────────────────────────
      if (e.key === 'F5') {
        e.preventDefault()
        if (solverState.status === 'idle' || solverState.status === 'converged' || solverState.status === 'error') {
          startSolve()
        }
        return
      }
      if (e.key === 'F6') {
        e.preventDefault()
        if (solverState.status === 'solving') pauseSolve()
        return
      }
      if (e.key === 'F7') {
        e.preventDefault()
        stopSolve()
        return
      }

      // ── Find ──────────────────────────────────────────────────────────────
      if (ctrl && e.key === 'f') {
        e.preventDefault()
        onFindOpen()
        return
      }

      // ── Select all ────────────────────────────────────────────────────────
      // (React Flow handles Ctrl+A internally when canvas is focused)

      // ── Escape: deselect & close panels ──────────────────────────────────
      if (e.key === 'Escape') {
        clearSelection()
        setRightPanelOpen(false)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, onSave, onOpen, onFindOpen, clearSelection, setRightPanelOpen,
      startSolve, pauseSolve, stopSolve, solverState.status])
}
