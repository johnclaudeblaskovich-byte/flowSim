// ─── DXF Mapping Dialog ───────────────────────────────────────────────────────
// Maps DXF block names to FlowSim unit types before importing.

import * as Dialog from '@radix-ui/react-dialog'
import { useState, useEffect } from 'react'
import { AUTO_DETECT_MAP } from '@/services/dxfImport'
import type { DxfUnit } from '@/services/dxfImport'
import type { UnitModelType } from '@/types'
import { useProjectStore, useCanvasStore } from '@/store'
import { normalizeDXFPositions } from '@/services/dxfImport'
import { generateTag } from '@/lib/tagUtils'
import type { UnitNode } from '@/types'

// ─── All available unit model types ──────────────────────────────────────────

const ALL_UNIT_TYPES: UnitModelType[] = [
  'Feeder', 'FeederSink', 'Tank', 'Tie', 'Splitter',
  'FlashTank', 'FlashTank2', 'HeatExchanger', 'Cooler', 'Heater',
  'Filter', 'Washer', 'Thickener', 'CrushingMill', 'Screen', 'Cyclone',
  'Pump', 'Valve', 'GeneralController', 'PIDController', 'SetTagController',
  'MakeupSource', 'Pipe',
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface DxfMappingDialogProps {
  open: boolean
  units: DxfUnit[]
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DxfMappingDialog({ open, units, onClose }: DxfMappingDialogProps) {
  // Group by unique block name
  const uniqueBlockNames = [...new Set(units.map((u) => u.blockName))].sort()
  const countByBlock = uniqueBlockNames.reduce<Record<string, number>>((acc, name) => {
    acc[name] = units.filter((u) => u.blockName === name).length
    return acc
  }, {})

  const [mappings, setMappings] = useState<Record<string, UnitModelType | null>>({})
  const [skipUnmapped, setSkipUnmapped] = useState(true)

  const addNode = useProjectStore((s) => s.addNode)
  const project = useProjectStore((s) => s.project)
  const activeFlowsheetId = useCanvasStore((s) => s.activeFlowsheetId)

  // Reset when dialog opens with new units
  useEffect(() => {
    if (open) {
      setMappings({})
    }
  }, [open])

  function handleAutoDetect() {
    const detected: Record<string, UnitModelType | null> = {}
    for (const name of uniqueBlockNames) {
      // Try exact match, then prefix match
      const exact = AUTO_DETECT_MAP[name]
      if (exact) {
        detected[name] = exact
        continue
      }
      // Try if block name starts with a known key
      const partialKey = Object.keys(AUTO_DETECT_MAP).find(
        (k) => name.startsWith(k) || k.startsWith(name),
      )
      detected[name] = partialKey ? AUTO_DETECT_MAP[partialKey] : null
    }
    setMappings(detected)
  }

  function handleImport() {
    const fsId = activeFlowsheetId ?? project.flowsheets[0]?.id
    if (!fsId) return

    const fs = project.flowsheets.find((f) => f.id === fsId)
    if (!fs) return

    const normalizedUnits = normalizeDXFPositions(units)
    let currentNodes = [...fs.nodes]

    for (const u of normalizedUnits) {
      const unitType = mappings[u.blockName]
      if (!unitType && skipUnmapped) continue
      if (!unitType) continue

      const tag = generateTag(unitType, currentNodes)
      const node: UnitNode = {
        id: crypto.randomUUID(),
        tag,
        type: unitType,
        label: tag,
        position: { x: u.canvasX, y: u.canvasY },
        symbolKey: unitType,
        enabled: true,
        config: {},
        subModels: [],
        solveStatus: 'idle',
        errorMessages: [],
        ports: [],
      }
      addNode(fsId, node)
      currentNodes = [...currentNodes, node]
    }

    onClose()
  }

  const mappedCount = uniqueBlockNames.filter((n) => mappings[n] != null).length
  const totalUnits = skipUnmapped
    ? units.filter((u) => mappings[u.blockName] != null).length
    : units.length

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] max-h-[80vh] bg-white rounded-lg shadow-xl z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-none">
            <Dialog.Title className="text-base font-semibold text-gray-900">
              Import DXF — Map Blocks to Unit Types
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </Dialog.Close>
          </div>

          {/* Summary */}
          <div className="px-6 py-2 bg-gray-50 border-b border-gray-100 flex-none text-xs text-gray-600 flex items-center gap-4">
            <span>{units.length} INSERT entities found</span>
            <span>{uniqueBlockNames.length} unique block name{uniqueBlockNames.length !== 1 ? 's' : ''}</span>
            <span className="font-medium text-blue-700">{mappedCount}/{uniqueBlockNames.length} mapped</span>
            <button
              onClick={handleAutoDetect}
              className="ml-auto px-2 py-1 border border-blue-300 rounded text-blue-700 hover:bg-blue-50"
            >
              Auto-detect
            </button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">DXF Block Name</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 w-16">Count</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Map to FlowSim Type</th>
                </tr>
              </thead>
              <tbody>
                {uniqueBlockNames.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                      No INSERT entities found in DXF file
                    </td>
                  </tr>
                )}
                {uniqueBlockNames.map((name) => (
                  <tr key={name} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-800">{name}</td>
                    <td className="px-4 py-2 text-gray-500 text-center">{countByBlock[name]}</td>
                    <td className="px-4 py-2">
                      <select
                        value={mappings[name] ?? ''}
                        onChange={(e) =>
                          setMappings((prev) => ({
                            ...prev,
                            [name]: (e.target.value as UnitModelType) || null,
                          }))
                        }
                        className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                      >
                        <option value="">— Skip —</option>
                        {ALL_UNIT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 flex-none">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={skipUnmapped}
                onChange={(e) => setSkipUnmapped(e.target.checked)}
                className="rounded"
              />
              Skip unmapped blocks
            </label>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 mr-2">
                {totalUnits} unit{totalUnits !== 1 ? 's' : ''} will be placed
              </span>
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={totalUnits === 0}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Import
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
