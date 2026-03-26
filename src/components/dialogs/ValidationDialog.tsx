// ─── Pre-Solve Validation Dialog ──────────────────────────────────────────────
// Shows validation errors and warnings before solving.

import * as Dialog from '@radix-ui/react-dialog'
import { useCanvasStore, useUIStore } from '@/store'
import type { ValidationResult } from '@/services/projectValidator'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ValidationDialogProps {
  open: boolean
  result: ValidationResult
  onClose: () => void
  onSolveAnyway: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ValidationDialog({ open, result, onClose, onSolveAnyway }: ValidationDialogProps) {
  const setActiveFlowsheetId = useCanvasStore((s) => s.setActiveFlowsheetId)
  const setSelectedNodeId = useCanvasStore((s) => s.setSelectedNodeId)
  const setSelectedEdgeId = useCanvasStore((s) => s.setSelectedEdgeId)
  const setRightPanelOpen = useUIStore((s) => s.setRightPanelOpen)
  const setAccessWindowUnitId = useUIStore((s) => s.setAccessWindowUnitId)
  const setAccessWindowEdgeId = useUIStore((s) => s.setAccessWindowEdgeId)

  function handleGoToIssue(flowsheetId: string, nodeId?: string, edgeId?: string) {
    if (flowsheetId) setActiveFlowsheetId(flowsheetId)
    if (nodeId) {
      setSelectedNodeId(nodeId)
      setAccessWindowUnitId(nodeId)
      setAccessWindowEdgeId(null)
      setRightPanelOpen(true)
    }
    if (edgeId) {
      setSelectedEdgeId(edgeId)
      setAccessWindowEdgeId(edgeId)
      setAccessWindowUnitId(null)
      setRightPanelOpen(true)
    }
    onClose()
  }

  const hasErrors = result.errors.length > 0
  const hasWarnings = result.warnings.length > 0

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] max-h-[70vh] bg-white rounded-lg shadow-xl z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-none">
            <Dialog.Title className="text-base font-semibold text-gray-900">
              Pre-Solve Validation
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
            {/* Errors */}
            {hasErrors && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-red-600 font-semibold text-sm">
                    {result.errors.length} Error{result.errors.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-gray-500">— must be fixed before solving</span>
                </div>
                <div className="space-y-1.5">
                  {result.errors.map((e, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 bg-red-50 border border-red-200 rounded px-3 py-2"
                    >
                      <span className="text-red-500 font-bold text-sm flex-none">✗</span>
                      <div className="flex-1 min-w-0">
                        {e.unitTag && (
                          <span className="text-xs font-mono font-medium text-red-700 mr-2">
                            [{e.unitTag}]
                          </span>
                        )}
                        <span className="text-xs text-red-800">{e.msg}</span>
                      </div>
                      {(e.nodeId || e.edgeId) && (
                        <button
                          onClick={() => handleGoToIssue(e.flowsheetId, e.nodeId, e.edgeId)}
                          className="text-xs text-red-600 hover:underline flex-none"
                        >
                          {e.edgeId ? 'Go to stream' : 'Go to unit'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {hasWarnings && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-amber-600 font-semibold text-sm">
                    {result.warnings.length} Warning{result.warnings.length !== 1 ? 's' : ''}
                  </span>
                  {!hasErrors && (
                    <span className="text-xs text-gray-500">— you can still solve</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {result.warnings.map((w, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded px-3 py-2"
                    >
                      <span className="text-amber-500 font-bold text-sm flex-none">!</span>
                      <div className="flex-1 min-w-0">
                        {w.unitTag && (
                          <span className="text-xs font-mono font-medium text-amber-700 mr-2">
                            [{w.unitTag}]
                          </span>
                        )}
                        <span className="text-xs text-amber-800">{w.msg}</span>
                      </div>
                      {(w.nodeId || w.edgeId) && (
                        <button
                          onClick={() => handleGoToIssue(w.flowsheetId, w.nodeId, w.edgeId)}
                          className="text-xs text-amber-600 hover:underline flex-none"
                        >
                          {w.edgeId ? 'Go to stream' : 'Go to unit'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Clean */}
            {!hasErrors && !hasWarnings && (
              <div className="text-center py-4 text-green-600 text-sm">
                ✓ No issues found
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 flex-none">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
            >
              Cancel
            </button>
            {!hasErrors && hasWarnings && (
              <button
                onClick={onSolveAnyway}
                className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded hover:bg-amber-600"
              >
                Solve Anyway
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
