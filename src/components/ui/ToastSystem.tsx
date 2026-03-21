// ─── Toast Notification System ────────────────────────────────────────────────
// Radix Toast-based notification stack. Mount once in App.tsx.

import { useState } from 'react'
import * as Toast from '@radix-ui/react-toast'
import * as Dialog from '@radix-ui/react-dialog'
import { useToastStore, TOAST_DURATION } from '@/hooks/useToastStore'
import type { ToastItem, ToastType } from '@/hooks/useToastStore'

// ─── Colour config ────────────────────────────────────────────────────────────

const STYLES: Record<
  ToastType,
  { border: string; icon: string; iconColor: string; bg: string }
> = {
  success: { border: 'border-l-4 border-l-green-500', icon: '✓', iconColor: 'text-green-600', bg: 'bg-white' },
  info:    { border: 'border-l-4 border-l-blue-500',  icon: 'ℹ', iconColor: 'text-blue-600',  bg: 'bg-white' },
  warning: { border: 'border-l-4 border-l-amber-400', icon: '!', iconColor: 'text-amber-600', bg: 'bg-white' },
  error:   { border: 'border-l-4 border-l-red-500',   icon: '✗', iconColor: 'text-red-600',   bg: 'bg-white' },
}

// ─── Single toast item ────────────────────────────────────────────────────────

function ToastEntry({ item, onRemove }: { item: ToastItem; onRemove: () => void }) {
  const [detailOpen, setDetailOpen] = useState(false)
  const style = STYLES[item.type]

  return (
    <>
      <Toast.Root
        duration={item.persistent ? TOAST_DURATION.error : TOAST_DURATION[item.type]}
        onOpenChange={(open) => { if (!open) onRemove() }}
        className={`${style.bg} ${style.border} rounded shadow-lg pointer-events-auto
          flex items-start gap-3 p-3 w-80 animate-in slide-in-from-right-2`}
      >
        {/* Icon */}
        <span className={`font-bold text-lg leading-none mt-0.5 ${style.iconColor}`}>
          {style.icon}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Toast.Title className="text-sm font-semibold text-gray-900 leading-snug">
            {item.title}
          </Toast.Title>
          {item.message && (
            <Toast.Description className="text-xs text-gray-600 mt-0.5 leading-snug">
              {item.message}
            </Toast.Description>
          )}

          {/* View Details (error only) */}
          {item.detail && (
            <button
              onClick={() => setDetailOpen(true)}
              className="text-xs text-red-600 hover:underline mt-1 text-left"
            >
              View details
            </button>
          )}
        </div>

        {/* Dismiss */}
        <Toast.Action altText="Dismiss" asChild>
          <button
            onClick={onRemove}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none flex-none"
          >
            ×
          </button>
        </Toast.Action>
      </Toast.Root>

      {/* Error detail dialog */}
      {item.detail && (
        <Dialog.Root open={detailOpen} onOpenChange={setDetailOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/30 z-[200]" />
            <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] bg-white rounded-lg shadow-xl z-[201] p-6">
              <Dialog.Title className="text-base font-semibold text-gray-900 mb-3">
                Error Details
              </Dialog.Title>
              <pre className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded p-3 overflow-auto max-h-60 whitespace-pre-wrap">
                {item.detail}
              </pre>
              <div className="mt-4 flex justify-end">
                <Dialog.Close asChild>
                  <button className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">
                    Close
                  </button>
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  )
}

// ─── Toast system root ────────────────────────────────────────────────────────

export function ToastSystem() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  return (
    <Toast.Provider swipeDirection="right">
      {toasts.map((item) => (
        <ToastEntry key={item.id} item={item} onRemove={() => removeToast(item.id)} />
      ))}

      {/* Viewport — fixed top-right stack */}
      <Toast.Viewport
        className="fixed top-4 right-4 z-[150] flex flex-col gap-2 pointer-events-none w-80"
      />
    </Toast.Provider>
  )
}
