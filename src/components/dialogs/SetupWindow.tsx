import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useProjectStore, useCanvasStore, useUIStore } from '@/store'
import { cn } from '@/lib/utils'

export function SetupWindow() {
  const setupWindowOpen = useUIStore((s) => s.setupWindowOpen)
  const setSetupWindowOpen = useUIStore((s) => s.setSetupWindowOpen)
  const activeFlowsheetId = useCanvasStore((s) => s.activeFlowsheetId)
  const project = useProjectStore((s) => s.project)
  const toggleUnitEnabled = useProjectStore((s) => s.toggleUnitEnabled)

  const activeFlowsheet =
    project.flowsheets.find((f) => f.id === activeFlowsheetId) ??
    project.flowsheets[0]

  const nodes = activeFlowsheet?.nodes ?? []

  return (
    <Dialog.Root open={setupWindowOpen} onOpenChange={setSetupWindowOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-lg shadow-xl w-[480px] max-h-[80vh] flex flex-col outline-none">
          {/* Header */}
          <div className="flex items-center justify-between px-5 h-11 border-b border-gray-200 flex-none">
            <Dialog.Title className="text-sm font-semibold text-gray-800">
              Setup — Flowsheet Components
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <X size={14} />
              </button>
            </Dialog.Close>
          </div>

          {/* Description */}
          <div className="px-5 py-2 border-b border-gray-100 flex-none">
            <p className="text-xs text-gray-500">
              Enable or disable individual units in the active flowsheet. Disabled units are
              skipped during solving.
            </p>
          </div>

          {/* Unit list */}
          <div className="flex-1 overflow-y-auto">
            {nodes.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">
                No units in the active flowsheet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Tag
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Type
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Label
                    </th>
                    <th className="text-center px-5 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Enabled
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((node) => (
                    <tr
                      key={node.id}
                      className={cn(
                        'border-b border-gray-100 hover:bg-gray-50 transition-colors',
                        !node.enabled && 'opacity-50',
                      )}
                    >
                      <td className="px-5 py-2 font-mono text-xs text-gray-700">{node.tag}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{node.type}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 truncate max-w-[120px]">
                        {node.label || '—'}
                      </td>
                      <td className="px-5 py-2 text-center">
                        <button
                          onClick={() => {
                            if (activeFlowsheet) {
                              toggleUnitEnabled(activeFlowsheet.id, node.id)
                            }
                          }}
                          className={cn(
                            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
                            node.enabled ? 'bg-blue-500' : 'bg-gray-300',
                          )}
                          aria-label={`${node.enabled ? 'Disable' : 'Enable'} ${node.tag}`}
                        >
                          <span
                            className={cn(
                              'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                              node.enabled ? 'translate-x-4' : 'translate-x-1',
                            )}
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-200 flex-none flex justify-end">
            <Dialog.Close asChild>
              <button className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                Close
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
