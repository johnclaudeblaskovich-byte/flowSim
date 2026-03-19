import { X } from 'lucide-react'
import { useUIStore } from '@/store'
import { useProjectStore } from '@/store'
import { useCanvasStore } from '@/store'
import { cn } from '@/lib/utils'

export function AccessWindowPanel() {
  const { rightPanelOpen, accessWindowUnitId, setRightPanelOpen, setAccessWindowUnitId } =
    useUIStore()
  const activeFlowsheetId = useCanvasStore((s) => s.activeFlowsheetId)
  const project = useProjectStore((s) => s.project)

  const activeFlowsheet = project.flowsheets.find(
    (f) => f.id === activeFlowsheetId,
  )
  const unit = accessWindowUnitId
    ? activeFlowsheet?.nodes.find((n) => n.id === accessWindowUnitId)
    : null

  function handleClose() {
    setRightPanelOpen(false)
    setAccessWindowUnitId(null)
  }

  return (
    <div
      className={cn(
        'transition-all duration-200 bg-white border-l border-gray-200 overflow-hidden flex-none flex flex-col',
        rightPanelOpen ? 'w-96' : 'w-0',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-10 border-b border-gray-200 flex-none">
        <div className="flex items-center gap-2 min-w-0">
          {unit ? (
            <>
              <span className="text-sm font-semibold text-gray-800 truncate">
                {unit.tag}
              </span>
              <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-100 text-blue-700 font-medium flex-none">
                {unit.type}
              </span>
            </>
          ) : (
            <span className="text-sm font-medium text-gray-600">
              Properties
            </span>
          )}
        </div>
        <button
          onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex-none"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {unit ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">Tag</p>
              <p className="text-sm text-gray-700 font-mono">{unit.tag}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Type</p>
              <p className="text-sm text-gray-700">{unit.type}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Status</p>
              <p className="text-sm text-gray-700 capitalize">{unit.solveStatus}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Enabled</p>
              <p className="text-sm text-gray-700">{unit.enabled ? 'Yes' : 'No'}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center mt-8">
            Select a unit to view properties
          </p>
        )}
      </div>
    </div>
  )
}
