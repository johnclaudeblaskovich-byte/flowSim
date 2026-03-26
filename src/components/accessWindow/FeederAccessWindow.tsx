import { useMemo, useState, type ChangeEvent } from 'react'
import type { Phase, UnitNode } from '@/types'
import { useProjectStore, useCanvasStore } from '@/store'
import { cn } from '@/lib/utils'
import { COMMON_SPECIES, getSpeciesCatalogEntry, guessSpeciesPhase } from '@/lib/speciesCatalog'

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
    if (Number.isNaN(n)) {
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
      <div className="flex items-center justify-between text-sm gap-2">
        <span className="text-gray-700 truncate">{label}</span>
        <div className="flex items-center gap-1 flex-none">
          <input
            type="number"
            defaultValue={value}
            min={min}
            max={max}
            step={step ?? 'any'}
            onChange={handleChange}
            className={cn(
              'text-sm border rounded px-1 py-0.5 bg-white text-gray-700 w-24 font-mono text-right',
              error ? 'border-red-500' : 'border-gray-200',
            )}
          />
          {unitLabel && <span className="text-gray-400 text-xs w-8">{unitLabel}</span>}
        </div>
      </div>
      {error && <p className="text-red-500 text-xs mt-0.5 text-right pr-9">{error}</p>}
    </div>
  )
}

const PHASE_OPTIONS: Phase[] = ['Solid', 'Liquid', 'Aqueous', 'Vapour']

function phaseBadgeClass(phase: Phase): string {
  switch (phase) {
    case 'Solid':
      return 'bg-amber-100 text-amber-700'
    case 'Liquid':
      return 'bg-blue-100 text-blue-700'
    case 'Aqueous':
      return 'bg-teal-100 text-teal-700'
    case 'Vapour':
      return 'bg-purple-100 text-purple-700'
  }
}

export function FeederAccessWindow({ unit }: Props) {
  const activeFlowsheetId = useCanvasStore((s) => s.activeFlowsheetId)
  const project = useProjectStore((s) => s.project)
  const updateNode = useProjectStore((s) => s.updateNode)

  const [selectedSpeciesId, setSelectedSpeciesId] = useState('')
  const [customSpeciesId, setCustomSpeciesId] = useState('')
  const [customSpeciesPhase, setCustomSpeciesPhase] = useState<Phase>('Liquid')

  const cfg = unit.config as {
    massFlow?: number
    temperature?: number
    pressure?: number
    solidFraction?: number
    species?: Record<string, number>
    speciesPhases?: Record<string, Phase>
  }

  const massFlow = cfg.massFlow ?? 27.78
  const temperatureK = cfg.temperature ?? 298.15
  const pressurePa = cfg.pressure ?? 101325.0
  const fallbackSolidFraction = cfg.solidFraction ?? 0.0
  const speciesMap = cfg.species ?? {}
  const speciesPhases = cfg.speciesPhases ?? {}

  const temperatureC = temperatureK - 273.15
  const pressureKPa = pressurePa / 1000
  const speciesEntries = Object.entries(speciesMap)
  const compositionTotal = speciesEntries.reduce((sum, [, fraction]) => sum + fraction, 0)
  const inferredSolidFraction = speciesEntries.reduce((sum, [speciesId, fraction]) => {
    const phase = speciesPhases[speciesId] ?? guessSpeciesPhase(speciesId)
    return phase === 'Solid' ? sum + fraction : sum
  }, 0)
  const availableSelectedSpecies = project.selectedSpecies.filter((speciesId) => !(speciesId in speciesMap))

  const customSuggestions = useMemo(
    () => COMMON_SPECIES.filter((species) => !(species.id in speciesMap)),
    [speciesMap],
  )

  function patchConfig(updates: Record<string, unknown>) {
    if (!activeFlowsheetId) return
    updateNode(activeFlowsheetId, unit.id, {
      config: { ...unit.config, ...updates },
    })
  }

  function updateSpecies(species: Record<string, number>, phases: Record<string, Phase>) {
    patchConfig({
      species,
      speciesPhases: phases,
      solidFraction: Object.entries(species).reduce((sum, [speciesId, fraction]) => {
        const phase = phases[speciesId] ?? guessSpeciesPhase(speciesId)
        return phase === 'Solid' ? sum + fraction : sum
      }, 0),
    })
  }

  function updateConfig(key: string, value: unknown) {
    patchConfig({ [key]: value })
  }

  function updateSpeciesFraction(speciesId: string, fraction: number) {
    updateSpecies({ ...speciesMap, [speciesId]: fraction }, { ...speciesPhases })
  }

  function updateSpeciesPhase(speciesId: string, phase: Phase) {
    updateSpecies({ ...speciesMap }, { ...speciesPhases, [speciesId]: phase })
  }

  function addSpecies(speciesId: string, phase?: Phase) {
    if (!speciesId.trim()) return
    const normalizedId = speciesId.trim()
    if (speciesMap[normalizedId] !== undefined) return

    const nextSpecies = { ...speciesMap, [normalizedId]: 0 }
    const nextPhases = {
      ...speciesPhases,
      [normalizedId]: phase ?? getSpeciesCatalogEntry(normalizedId)?.phase ?? guessSpeciesPhase(normalizedId),
    }
    updateSpecies(nextSpecies, nextPhases)
  }

  function removeSpecies(speciesId: string) {
    const nextSpecies = { ...speciesMap }
    const nextPhases = { ...speciesPhases }
    delete nextSpecies[speciesId]
    delete nextPhases[speciesId]
    updateSpecies(nextSpecies, nextPhases)
  }

  function normalizeComposition() {
    if (compositionTotal <= 0) return
    const nextSpecies = Object.fromEntries(
      Object.entries(speciesMap).map(([speciesId, fraction]) => [speciesId, fraction / compositionTotal]),
    )
    updateSpecies(nextSpecies, { ...speciesPhases })
  }

  return (
    <div className="space-y-0">
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
        value={(speciesEntries.length > 0 ? inferredSolidFraction : fallbackSolidFraction) * 100}
        unit="%"
        min={0}
        max={100}
        step={0.1}
        onChange={(v) => updateConfig('solidFraction', v / 100)}
      />

      <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 border-b border-gray-200 border-t uppercase tracking-wide mt-2">
        Stream Components
      </div>

      <div className="p-2 space-y-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <select
            value={selectedSpeciesId}
            onChange={(e) => setSelectedSpeciesId(e.target.value)}
            className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs bg-white text-gray-700"
          >
            <option value="">Add project component…</option>
            {availableSelectedSpecies.map((speciesId) => {
              const entry = getSpeciesCatalogEntry(speciesId)
              return (
                <option key={speciesId} value={speciesId}>
                  {entry ? `${entry.name} (${speciesId})` : speciesId}
                </option>
              )
            })}
          </select>
          <button
            type="button"
            onClick={() => {
              if (!selectedSpeciesId) return
              addSpecies(selectedSpeciesId)
              setSelectedSpeciesId('')
            }}
            className="px-2 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 disabled:bg-blue-200"
            disabled={!selectedSpeciesId}
          >
            Add
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            list="feeder-species-suggestions"
            value={customSpeciesId}
            onChange={(e) => setCustomSpeciesId(e.target.value)}
            placeholder="Custom component ID"
            className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs bg-white text-gray-700"
          />
          <datalist id="feeder-species-suggestions">
            {customSuggestions.map((species) => (
              <option key={species.id} value={species.id} />
            ))}
          </datalist>
          <select
            value={customSpeciesPhase}
            onChange={(e) => setCustomSpeciesPhase(e.target.value as Phase)}
            className="border border-gray-200 rounded px-2 py-1 text-xs bg-white text-gray-700"
          >
            {PHASE_OPTIONS.map((phase) => (
              <option key={phase} value={phase}>
                {phase}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              if (!customSpeciesId.trim()) return
              addSpecies(customSpeciesId, customSpeciesPhase)
              setCustomSpeciesId('')
            }}
            className="px-2 py-1 text-xs rounded bg-gray-800 text-white hover:bg-gray-900 disabled:bg-gray-300"
            disabled={!customSpeciesId.trim()}
          >
            Add Custom
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span className={cn('font-medium', Math.abs(compositionTotal - 1) < 1e-6 ? 'text-green-600' : 'text-amber-600')}>
            Composition total: {(compositionTotal * 100).toFixed(2)}%
          </span>
          <button
            type="button"
            onClick={normalizeComposition}
            disabled={compositionTotal <= 0}
            className="text-blue-600 hover:text-blue-700 disabled:text-gray-300"
          >
            Normalize to 100%
          </button>
        </div>
      </div>

      {speciesEntries.length === 0 ? (
        <div className="px-3 py-4 text-xs text-gray-400">
          Add one or more components to define this feeder stream composition.
        </div>
      ) : (
        <div className="space-y-0">
          {speciesEntries.map(([speciesId, fraction]) => {
            const entry = getSpeciesCatalogEntry(speciesId)
            const phase = speciesPhases[speciesId] ?? guessSpeciesPhase(speciesId)
            return (
              <div key={speciesId} className="border-b border-gray-100 px-2 py-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-700 truncate">
                      {entry?.name ?? speciesId}
                    </p>
                    <p className="text-[11px] text-gray-400 font-mono truncate">{speciesId}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-none">
                    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', phaseBadgeClass(phase))}>
                      {phase}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSpecies(speciesId)}
                      className="text-[11px] text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <ConfigRow
                      label="Mass Fraction"
                      value={fraction * 100}
                      unit="%"
                      min={0}
                      max={100}
                      step={0.1}
                      onChange={(v) => updateSpeciesFraction(speciesId, v / 100)}
                    />
                  </div>
                  <select
                    value={phase}
                    onChange={(e) => updateSpeciesPhase(speciesId, e.target.value as Phase)}
                    className="border border-gray-200 rounded px-2 py-1 text-xs bg-white text-gray-700 self-start mt-1"
                  >
                    {PHASE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
