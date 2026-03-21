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
    if (isNaN(n)) { setError('Must be a number'); return }
    if (min !== undefined && n < min) { setError(`Must be ≥ ${min}`); return }
    if (max !== undefined && n > max) { setError(`Must be ≤ ${max}`); return }
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
      {error && <p className="text-red-500 text-xs mt-0.5 text-right pr-9">{error}</p>}
    </div>
  )
}

export function FeederAccessWindow({ unit }: Props) {
  const activeFlowsheetId = useCanvasStore((s) => s.activeFlowsheetId)
  const updateNode = useProjectStore((s) => s.updateNode)

  const cfg = unit.config as {
    massFlow?: number
    temperature?: number
    pressure?: number
    solidFraction?: number
    species?: Record<string, number>
  }

  const massFlow = cfg.massFlow ?? 27.78
  const temperatureK = cfg.temperature ?? 298.15
  const pressurePa = cfg.pressure ?? 101325.0
  const solidFraction = cfg.solidFraction ?? 0.0
  const speciesMap = cfg.species ?? {}

  // Display temperature in °C, store in K
  const temperatureC = temperatureK - 273.15
  // Display pressure in kPa, store in Pa
  const pressureKPa = pressurePa / 1000

  function updateConfig(key: string, value: unknown) {
    if (!activeFlowsheetId) return
    updateNode(activeFlowsheetId, unit.id, {
      config: { ...unit.config, [key]: value },
    })
  }

  function updateSpeciesFraction(speciesId: string, fraction: number) {
    if (!activeFlowsheetId) return
    const updatedSpecies = { ...speciesMap, [speciesId]: fraction }
    updateNode(activeFlowsheetId, unit.id, {
      config: { ...unit.config, species: updatedSpecies },
    })
  }

  const speciesEntries = Object.entries(speciesMap)

  return (
    <div className="space-y-0">
      {/* Feed Conditions */}
      <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 border-b border-gray-200 uppercase tracking-wide">
        Feed Conditions
      </div>
      <ConfigRow
        label="Mass Flow"
        value={massFlow}
        unit="kg/s"
        min={0}
        step={0.01}
        onChange={(v) => updateConfig('massFlow', v)}
      />
      <ConfigRow
        label="Temperature"
        value={temperatureC}
        unit="°C"
        min={-273.15}
        step={1}
        onChange={(v) => updateConfig('temperature', v + 273.15)}
      />
      <ConfigRow
        label="Pressure"
        value={pressureKPa}
        unit="kPa"
        min={0}
        step={1}
        onChange={(v) => updateConfig('pressure', v * 1000)}
      />
      <ConfigRow
        label="Solid Fraction"
        value={solidFraction * 100}
        unit="%"
        min={0}
        max={100}
        step={0.1}
        onChange={(v) => updateConfig('solidFraction', v / 100)}
      />

      {/* Species Composition */}
      {speciesEntries.length > 0 && (
        <>
          <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 border-b border-gray-200 border-t uppercase tracking-wide mt-2">
            Species Composition
          </div>
          {speciesEntries.map(([speciesId, fraction]) => (
            <ConfigRow
              key={speciesId}
              label={speciesId}
              value={(fraction as number) * 100}
              unit="%"
              min={0}
              max={100}
              step={0.1}
              onChange={(v) => updateSpeciesFraction(speciesId, v / 100)}
            />
          ))}
        </>
      )}
    </div>
  )
}
