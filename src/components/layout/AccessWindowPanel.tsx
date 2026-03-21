import { useState } from 'react'
import { X } from 'lucide-react'
import { useUIStore } from '@/store'
import { useProjectStore } from '@/store'
import { useCanvasStore } from '@/store'
import { cn } from '@/lib/utils'
import { FilterAccessWindow } from '@/components/accessWindow/FilterAccessWindow'
import { ThickenerAccessWindow } from '@/components/accessWindow/ThickenerAccessWindow'
import { SizeDistributionTab } from '@/components/accessWindow/SizeDistributionTab'

type Tab = 'config' | 'dsz' | 'ports'

export function AccessWindowPanel() {
  const { rightPanelOpen, accessWindowUnitId, setRightPanelOpen, setAccessWindowUnitId } =
    useUIStore()
  const activeFlowsheetId = useCanvasStore((s) => s.activeFlowsheetId)
  const project = useProjectStore((s) => s.project)

  const [activeTab, setActiveTab] = useState<Tab>('config')

  const activeFlowsheet = project.flowsheets.find(
    (f) => f.id === activeFlowsheetId,
  )
  const unit = accessWindowUnitId
    ? activeFlowsheet?.nodes.find((n) => n.id === accessWindowUnitId)
    : null

  const hasUnitConfig = unit?.type === 'Filter' || unit?.type === 'Thickener'
  const hasStzeDistribution = unit?.type === 'Feeder'

  function handleClose() {
    setRightPanelOpen(false)
    setAccessWindowUnitId(null)
  }

  const allTabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'config', label: 'Config', show: hasUnitConfig },
    { id: 'dsz', label: 'DSz', show: hasStzeDistribution },
    { id: 'ports', label: 'Ports', show: true },
  ]
  const tabs = allTabs.filter((t) => t.show)

  const showTabs = tabs.length > 1

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

      {/* Tab bar */}
      {unit && showTabs && (
        <div className="flex border-b border-gray-200 flex-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {unit ? (
          <>
            {/* Unit-specific config tabs */}
            {activeTab === 'config' && unit.type === 'Filter' && (
              <FilterAccessWindow unit={unit} />
            )}
            {activeTab === 'config' && unit.type === 'Thickener' && (
              <ThickenerAccessWindow unit={unit} />
            )}

            {/* Size distribution tab (Feeder) */}
            {activeTab === 'dsz' && unit.type === 'Feeder' && (
              <div className="p-2">
                <SizeDistributionTab unit={unit} />
              </div>
            )}

            {/* Ports / generic properties */}
            {(activeTab === 'ports' || (!hasUnitConfig && !hasStzeDistribution)) && (
              <div className="p-4 space-y-3">
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
                {unit.ports.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Ports</p>
                    <div className="space-y-1">
                      {unit.ports.map((port) => (
                        <div key={port.id} className="flex items-center gap-2 text-xs">
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded font-medium',
                              port.type === 'inlet'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-orange-100 text-orange-700',
                            )}
                          >
                            {port.type}
                          </span>
                          <span className="text-gray-600">{port.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="p-4">
            <p className="text-sm text-gray-400 text-center mt-8">
              Select a unit to view properties
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
