import { create } from 'zustand'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'warning' | 'error' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  title: string
  message?: string
  detail?: string       // shown in error detail dialog
  persistent?: boolean  // error toasts are persistent by default
}

interface ToastStoreState {
  toasts: ToastItem[]
  addToast: (toast: Omit<ToastItem, 'id'>) => void
  removeToast: (id: string) => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

const MAX_TOASTS = 5

export const useToastStore = create<ToastStoreState>((set) => ({
  toasts: [],

  addToast: (toast) =>
    set((state) => {
      const newToast: ToastItem = { id: crypto.randomUUID(), ...toast }
      const toasts = [...state.toasts, newToast]
      // Keep newest MAX_TOASTS only
      return { toasts: toasts.slice(-MAX_TOASTS) }
    }),

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

// ─── Auto-dismiss durations ───────────────────────────────────────────────────

export const TOAST_DURATION: Record<ToastType, number> = {
  success: 4_000,
  info: 4_000,
  warning: 8_000,
  error: 9_999_999, // persistent — user must dismiss
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

function addToast(toast: Omit<ToastItem, 'id'>) {
  useToastStore.getState().addToast(toast)
}

export const toast = {
  success: (title: string, message?: string) =>
    addToast({ type: 'success', title, message }),

  info: (title: string, message?: string) =>
    addToast({ type: 'info', title, message }),

  warning: (title: string, message?: string) =>
    addToast({ type: 'warning', title, message }),

  error: (title: string, message?: string, detail?: string) =>
    addToast({ type: 'error', title, message, detail, persistent: true }),
}
