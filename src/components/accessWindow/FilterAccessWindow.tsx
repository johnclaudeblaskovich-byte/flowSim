import { useState, type ChangeEvent } from 'react'
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
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const n = parseFloat(e.target.value)
    if (isNaN(n)) {
      setError('Must be a number')
      return
    }
    if (min !== undefined && n < min) {
      setError(`Must be ≥ ${min}`)
      return
    }
    if (max !== undefined && n > max) {
      setError(`Must be ≤ ${max}`)
      return
    }
    setError(null)
    onChange(n)
  }

  return (
    <div className="py-1 px-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700 truncate mr-2">{label}</span>
        <div className="flex items-center gap-1 flex-none">
          <input
            type="number"
            defaultValue={value}
            min={min}
            max={max}
            step={step ?? 'any'}
            onChange={handleChange}
            className={`text-sm border rounded px-1 py-0.5 bg-white text-gray-700 w-24 font-mono text-right ${
              error ? 'border-red-500' : 'border-gray-200'
            }`}
          />
          {unitLabel && <span className="text-gray-400 text-xs w-8">{unitLabel}</span>}
        </div>
      </div>
      {error && (
        <p className="text-red-500 text-xs mt-0.5 text-right pr-9">{error}</p>
      )}
    </div>
  )
}

export function FilterAccessWindow({ unit }: Props) {
  const activeFlowsheetId = useCanvasStore((s) => s.activeFlowsheetId)
  const updateNode = useProjectStore((s) => s.updateNode)

  const cfg = unit.config as {
    solid_recovery?: number
    moisture_content?: number
    wash_efficiency?: number
  }

  const solidRecovery = cfg.solid_recovery ?? 0.95
  const moistureContent = cfg.moisture_content ?? 0.15
  const washEfficiency = cfg.wash_efficiency ?? 0.80

  function updateConfig(key: string, value: number) {
    if (!activeFlowsheetId) return
    updateNode(activeFlowsheetId, unit.id, {
      config: { ...unit.config, [key]: value },
    })
  }

  return (
    <div className="space-y-0">
      <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 border-b border-gray-200 uppercase tracking-wide">
        Separation
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
        label="Moisture Content"
        value={moistureContent * 100}
        unit="%"
        min={0}
        max={100}
        onChange={(v) => updateConfig('moisture_content', v / 100)}
      />
      <ConfigRow
        label="Wash Efficiency"
        value={washEfficiency * 100}
        unit="%"
        min={0}
        max={100}
        onChange={(v) => updateConfig('wash_efficiency', v / 100)}
      />
    </div>
  )
}
