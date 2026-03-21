import { type ChangeEvent } from 'react'
import type { UnitNode } from '@/types'
import { useProjectStore, useCanvasStore } from '@/store'

interface Props {
  unit: UnitNode
}

function ConfigRow({
  label,
  value,
  unit: unitLabel,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  unit?: string
  min?: number
  max?: number
  step?: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between py-1 px-2 text-sm">
      <span className="text-gray-700 truncate mr-2">{label}</span>
      <div className="flex items-center gap-1 flex-none">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step ?? 'any'}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const n = parseFloat(e.target.value)
            if (!isNaN(n)) onChange(n)
          }}
          className="text-sm border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-700 w-24 font-mono text-right"
        />
        {unitLabel && <span className="text-gray-400 text-xs w-12">{unitLabel}</span>}
      </div>
    </div>
  )
}

export function ThickenerAccessWindow({ unit }: Props) {
  const activeFlowsheetId = useCanvasStore((s) => s.activeFlowsheetId)
  const updateNode = useProjectStore((s) => s.updateNode)

  const cfg = unit.config as {
    solid_recovery?: number
    underflow_density?: number
  }

  const solidRecovery = cfg.solid_recovery ?? 0.98
  const underflowDensity = cfg.underflow_density ?? 1400.0

  function updateConfig(key: string, value: number) {
    if (!activeFlowsheetId) return
    updateNode(activeFlowsheetId, unit.id, {
      config: { ...unit.config, [key]: value },
    })
  }

  return (
    <div className="space-y-0">
      <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 border-b border-gray-200 uppercase tracking-wide">
        Thickening
      </div>
      <ConfigRow
        label="Solid Recovery"
        value={solidRecovery * 100}
        unit="%"
        min={0}
        max={100}
        onChange={(v) => updateConfig('solid_recovery', v / 100)}
      />
      <ConfigRow
        label="Underflow Density"
        value={underflowDensity}
        unit="kg/m³"
        min={1000}
        max={3000}
        step={10}
        onChange={(v) => updateConfig('underflow_density', v)}
      />
    </div>
  )
}
