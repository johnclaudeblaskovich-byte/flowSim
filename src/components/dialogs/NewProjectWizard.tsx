import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronRight, ChevronLeft, X, Check } from 'lucide-react'
import { useProjectStore, useUIStore, createDefaultProject } from '@/store'
import { useCanvasStore } from '@/store'
import type { SolveMode, HeatMode, UnitPreferences } from '@/types'
import { cn } from '@/lib/utils'

// ─── Common species list (used until a master DB exists) ──────────────────────

interface SpeciesEntry {
  id: string
  name: string
  formula: string
  phase: string
  category: string
}

const COMMON_SPECIES: SpeciesEntry[] = [
  { id: 'Water',    name: 'Water',               formula: 'H₂O',        phase: 'Liquid',  category: 'Water' },
  { id: 'Steam',    name: 'Steam',               formula: 'H₂O',        phase: 'Vapour',  category: 'Water' },
  { id: 'H2SO4',   name: 'Sulfuric Acid',        formula: 'H₂SO₄',      phase: 'Aqueous', category: 'Acids' },
  { id: 'HCl',     name: 'Hydrochloric Acid',    formula: 'HCl',        phase: 'Aqueous', category: 'Acids' },
  { id: 'HNO3',    name: 'Nitric Acid',          formula: 'HNO₃',       phase: 'Aqueous', category: 'Acids' },
  { id: 'NaOH',    name: 'Sodium Hydroxide',     formula: 'NaOH',       phase: 'Aqueous', category: 'Bases' },
  { id: 'Ca(OH)2', name: 'Lime',                 formula: 'Ca(OH)₂',    phase: 'Solid',   category: 'Bases' },
  { id: 'ZnSO4',   name: 'Zinc Sulfate',         formula: 'ZnSO₄',      phase: 'Aqueous', category: 'Metals' },
  { id: 'CuSO4',   name: 'Copper Sulfate',       formula: 'CuSO₄',      phase: 'Aqueous', category: 'Metals' },
  { id: 'Fe2SO43', name: 'Iron(III) Sulfate',    formula: 'Fe₂(SO₄)₃', phase: 'Aqueous', category: 'Metals' },
  { id: 'Zn',      name: 'Zinc',                 formula: 'Zn',         phase: 'Solid',   category: 'Metals' },
  { id: 'Cu',      name: 'Copper',               formula: 'Cu',         phase: 'Solid',   category: 'Metals' },
  { id: 'Fe',      name: 'Iron',                 formula: 'Fe',         phase: 'Solid',   category: 'Metals' },
  { id: 'Pb',      name: 'Lead',                 formula: 'Pb',         phase: 'Solid',   category: 'Metals' },
  { id: 'SiO2',    name: 'Silica',               formula: 'SiO₂',       phase: 'Solid',   category: 'Minerals' },
  { id: 'CaCO3',   name: 'Limestone',            formula: 'CaCO₃',      phase: 'Solid',   category: 'Minerals' },
  { id: 'Al2O3',   name: 'Alumina',              formula: 'Al₂O₃',      phase: 'Solid',   category: 'Minerals' },
  { id: 'FeS2',    name: 'Pyrite',               formula: 'FeS₂',       phase: 'Solid',   category: 'Minerals' },
  { id: 'O2',      name: 'Oxygen',               formula: 'O₂',         phase: 'Vapour',  category: 'Gases' },
  { id: 'N2',      name: 'Nitrogen',             formula: 'N₂',         phase: 'Vapour',  category: 'Gases' },
  { id: 'CO2',     name: 'Carbon Dioxide',       formula: 'CO₂',        phase: 'Vapour',  category: 'Gases' },
  { id: 'CH4',     name: 'Methane',              formula: 'CH₄',        phase: 'Vapour',  category: 'Gases' },
  { id: 'SO2',     name: 'Sulfur Dioxide',       formula: 'SO₂',        phase: 'Vapour',  category: 'Gases' },
  { id: 'NaCl',    name: 'Sodium Chloride',      formula: 'NaCl',       phase: 'Aqueous', category: 'Salts' },
  { id: 'Ethanol', name: 'Ethanol',              formula: 'C₂H₅OH',     phase: 'Liquid',  category: 'Organics' },
  { id: 'Acetone', name: 'Acetone',              formula: 'C₃H₆O',      phase: 'Liquid',  category: 'Organics' },
]

const CATEGORIES = [...new Set(COMMON_SPECIES.map((s) => s.category))]

// ─── Wizard state ─────────────────────────────────────────────────────────────

interface WizardState {
  name: string
  description: string
  solveMode: SolveMode
  heatMode: HeatMode
  selectedSpecies: Set<string>
  unitPreferences: UnitPreferences
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-full transition-all',
            i + 1 === current
              ? 'w-6 h-2 bg-blue-500'
              : i + 1 < current
              ? 'w-2 h-2 bg-blue-300'
              : 'w-2 h-2 bg-gray-200',
          )}
        />
      ))}
    </div>
  )
}

// ─── Step 1: Name & Mode ──────────────────────────────────────────────────────

function Step1({ state, onChange }: { state: WizardState; onChange: (updates: Partial<WizardState>) => void }) {
  const solveModes: { value: SolveMode; label: string; desc: string }[] = [
    { value: 'ProBal', label: 'ProBal', desc: 'Steady-state mass & energy balance' },
    { value: 'DynamicTransfer', label: 'Dynamic Transfer', desc: 'Dynamic with transfer functions' },
    { value: 'DynamicFull', label: 'Dynamic Full', desc: 'Full dynamic simulation' },
  ]
  const heatModes: { value: HeatMode; label: string }[] = [
    { value: 'MassBalance', label: 'Mass Balance' },
    { value: 'EnergyBalance', label: 'Energy Balance' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Project Name *</label>
        <input
          autoFocus
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="My FlowSim Project"
          value={state.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
        <textarea
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
          rows={2}
          placeholder="Optional project description"
          value={state.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-2">Solve Mode</label>
        <div className="flex flex-col gap-2">
          {solveModes.map(({ value, label, desc }) => (
            <label
              key={value}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                state.solveMode === value
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300',
              )}
            >
              <input
                type="radio"
                name="solveMode"
                value={value}
                checked={state.solveMode === value}
                onChange={() => onChange({ solveMode: value })}
                className="mt-0.5 accent-blue-500"
              />
              <div>
                <div className="text-sm font-medium text-gray-700">{label}</div>
                <div className="text-xs text-gray-500">{desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-2">Heat Mode</label>
        <div className="flex gap-3">
          {heatModes.map(({ value, label }) => (
            <label
              key={value}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm transition-colors',
                state.heatMode === value
                  ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              <input
                type="radio"
                name="heatMode"
                value={value}
                checked={state.heatMode === value}
                onChange={() => onChange({ heatMode: value })}
                className="accent-blue-500"
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: Species Selection ────────────────────────────────────────────────

function Step2({ state, onChange }: { state: WizardState; onChange: (updates: Partial<WizardState>) => void }) {
  const [query, setQuery] = useState('')

  const filtered = query
    ? COMMON_SPECIES.filter(
        (s) =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          s.formula.toLowerCase().includes(query.toLowerCase()) ||
          s.id.toLowerCase().includes(query.toLowerCase()),
      )
    : COMMON_SPECIES

  const byCategory = CATEGORIES.reduce<Record<string, SpeciesEntry[]>>((acc, cat) => {
    acc[cat] = filtered.filter((s) => s.category === cat)
    return acc
  }, {})

  function toggleSpecies(id: string) {
    const next = new Set(state.selectedSpecies)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange({ selectedSpecies: next })
  }

  function toggleCategory(_cat: string, entries: SpeciesEntry[]) {
    const next = new Set(state.selectedSpecies)
    const allSelected = entries.every((s) => next.has(s.id))
    for (const s of entries) {
      if (allSelected) next.delete(s.id)
      else next.add(s.id)
    }
    onChange({ selectedSpecies: next })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <input
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm outline-none focus:border-blue-500 w-48"
          placeholder="Search species…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="text-xs text-gray-500">
          {state.selectedSpecies.size} species selected
        </span>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-y-auto max-h-[360px]">
        {CATEGORIES.map((cat) => {
          const entries = byCategory[cat]
          if (!entries?.length) return null
          const allSelected = entries.every((s) => state.selectedSpecies.has(s.id))
          const someSelected = entries.some((s) => state.selectedSpecies.has(s.id))
          return (
            <div key={cat}>
              <div
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 sticky top-0"
                onClick={() => toggleCategory(cat, entries)}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
                  onChange={() => toggleCategory(cat, entries)}
                  className="accent-blue-500"
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-xs font-semibold text-gray-600">{cat}</span>
                <span className="text-xs text-gray-400 ml-auto">
                  {entries.filter((s) => state.selectedSpecies.has(s.id)).length}/{entries.length}
                </span>
              </div>
              {entries.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 px-5 py-1.5 text-xs hover:bg-blue-50 cursor-pointer border-b border-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={state.selectedSpecies.has(s.id)}
                    onChange={() => toggleSpecies(s.id)}
                    className="accent-blue-500 flex-none"
                  />
                  <span className="flex-1 text-gray-700">{s.name}</span>
                  <span className="text-gray-400 font-mono">{s.formula}</span>
                  <span
                    className={cn(
                      'text-[10px] px-1.5 rounded',
                      s.phase === 'Solid' ? 'bg-amber-100 text-amber-700' :
                      s.phase === 'Liquid' ? 'bg-blue-100 text-blue-700' :
                      s.phase === 'Vapour' ? 'bg-purple-100 text-purple-700' :
                      'bg-teal-100 text-teal-700',
                    )}
                  >
                    {s.phase}
                  </span>
                </label>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 3: Unit Preferences ─────────────────────────────────────────────────

function Step3({ state, onChange }: { state: WizardState; onChange: (updates: Partial<WizardState>) => void }) {
  function setPrefs(updates: Partial<UnitPreferences>) {
    onChange({ unitPreferences: { ...state.unitPreferences, ...updates } })
  }

  const tempOptions: Array<UnitPreferences['temperature']> = ['°C', 'K', '°F']
  const pressOptions: Array<UnitPreferences['pressure']> = ['kPa', 'bar', 'psi', 'atm']
  const flowOptions: Array<UnitPreferences['flow']> = ['t/h', 'kg/s', 't/d']

  function RadioGroup<T extends string>({
    label,
    value,
    options,
    onChange: onCh,
  }: {
    label: string
    value: T
    options: T[]
    onChange: (v: T) => void
  }) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-700 w-28 font-medium">{label}</span>
        <div className="flex gap-2 flex-wrap">
          {options.map((opt) => (
            <label
              key={opt}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm cursor-pointer transition-colors',
                value === opt
                  ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              <input
                type="radio"
                name={label}
                value={opt}
                checked={value === opt}
                onChange={() => onCh(opt)}
                className="accent-blue-500"
              />
              {opt}
            </label>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-gray-500">Select how values are displayed throughout the application.</p>
      <RadioGroup label="Temperature" value={state.unitPreferences.temperature} options={tempOptions} onChange={(v) => setPrefs({ temperature: v })} />
      <RadioGroup label="Pressure" value={state.unitPreferences.pressure} options={pressOptions} onChange={(v) => setPrefs({ pressure: v })} />
      <RadioGroup label="Flow Rate" value={state.unitPreferences.flow} options={flowOptions} onChange={(v) => setPrefs({ flow: v })} />
    </div>
  )
}

// ─── Step 4: Summary ──────────────────────────────────────────────────────────

function Step4({ state }: { state: WizardState }) {
  const rows = [
    { label: 'Name', value: state.name },
    { label: 'Solve Mode', value: state.solveMode },
    { label: 'Heat Mode', value: state.heatMode },
    { label: 'Species', value: `${state.selectedSpecies.size} selected` },
    { label: 'Temperature', value: state.unitPreferences.temperature },
    { label: 'Pressure', value: state.unitPreferences.pressure },
    { label: 'Flow Rate', value: state.unitPreferences.flow },
  ]
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500">Review your settings before creating the project.</p>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={cn('flex px-4 py-2.5 text-sm', i % 2 === 1 ? 'bg-gray-50' : 'bg-white')}
          >
            <span className="w-36 text-gray-500 font-medium">{r.label}</span>
            <span className="text-gray-800">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── NewProjectWizard ─────────────────────────────────────────────────────────

const TOTAL_STEPS = 4

const STEP_TITLES = ['Name & Mode', 'Species', 'Unit Preferences', 'Summary']

export function NewProjectWizard() {
  const { newProjectWizardOpen, setNewProjectWizardOpen, setUnitPreferences } = useUIStore()
  const { setProject, setPGMSources, setReactionFiles } = useProjectStore()
  const { setActiveFlowsheetId } = useCanvasStore()

  const [step, setStep] = useState(1)
  const [state, setState] = useState<WizardState>({
    name: '',
    description: '',
    solveMode: 'ProBal',
    heatMode: 'MassBalance',
    selectedSpecies: new Set(),
    unitPreferences: { temperature: '°C', pressure: 'kPa', flow: 't/h' },
  })

  function handleChange(updates: Partial<WizardState>) {
    setState((s) => ({ ...s, ...updates }))
  }

  function handleClose() {
    setNewProjectWizardOpen(false)
    setStep(1)
    setState({
      name: '',
      description: '',
      solveMode: 'ProBal',
      heatMode: 'MassBalance',
      selectedSpecies: new Set(),
      unitPreferences: { temperature: '°C', pressure: 'kPa', flow: 't/h' },
    })
  }

  function handleCreate() {
    const base = createDefaultProject()
    const project = {
      ...base,
      name: state.name.trim() || 'Untitled Project',
      description: state.description,
      solveMode: state.solveMode,
      heatMode: state.heatMode,
      selectedSpecies: Array.from(state.selectedSpecies),
    }
    setProject(project)
    setPGMSources({})
    setReactionFiles({})
    setUnitPreferences(state.unitPreferences)
    setActiveFlowsheetId(project.flowsheets[0]?.id ?? null)
    handleClose()
  }

  const canNext = step === 1 ? state.name.trim().length > 0 : true

  return (
    <Dialog.Root open={newProjectWizardOpen} onOpenChange={(o) => !o && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-2xl w-[520px] max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 flex-none">
            <div>
              <Dialog.Title className="text-base font-semibold text-gray-800">New Project</Dialog.Title>
              <p className="text-xs text-gray-500 mt-0.5">Step {step} of {TOTAL_STEPS} — {STEP_TITLES[step - 1]}</p>
            </div>
            <Dialog.Close asChild>
              <button className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <X size={14} />
              </button>
            </Dialog.Close>
          </div>

          {/* Step indicator */}
          <div className="px-6 pt-4 flex-none">
            <StepDots current={step} total={TOTAL_STEPS} />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            {step === 1 && <Step1 state={state} onChange={handleChange} />}
            {step === 2 && <Step2 state={state} onChange={handleChange} />}
            {step === 3 && <Step3 state={state} onChange={handleChange} />}
            {step === 4 && <Step4 state={state} />}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 flex-none">
            <button
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 1}
            >
              <ChevronLeft size={14} /> Back
            </button>

            {step < TOTAL_STEPS ? (
              <button
                className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-200 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext}
              >
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button
                className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                onClick={handleCreate}
              >
                <Check size={14} /> Create Project
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
