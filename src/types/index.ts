// ─── Solver ──────────────────────────────────────────────────────────────────
export type SolveMode = 'ProBal' | 'DynamicTransfer' | 'DynamicFull'
export type HeatMode = 'MassBalance' | 'EnergyBalance'
export type SolverStatus = 'idle' | 'solving' | 'converged' | 'error' | 'paused'
export type UnitSolveStatus = 'idle' | 'solving' | 'converged' | 'warning' | 'error' | 'disabled'

// ─── Species ──────────────────────────────────────────────────────────────────
export type Phase = 'Solid' | 'Liquid' | 'Vapour' | 'Aqueous'

export interface ThermoPolynomial {
  type: 'constant' | 'polynomial' | 'shomate'
  coefficients: number[]
  Tmin: number // K
  Tmax: number // K
}

export interface AntoineParams {
  A: number
  B: number
  C: number
  Tmin: number
  Tmax: number
  pressureUnit: 'mmHg' | 'kPa' | 'bar'
  tempUnit: 'C' | 'K'
}

export interface Species {
  id: string
  name: string
  formula: string
  CAS?: string
  phase: Phase
  molecularWeight: number // g/mol
  standardEnthalpy: number // J/mol at 298.15K
  standardEntropy: number // J/mol·K
  heatCapacity: ThermoPolynomial
  density: number | ThermoPolynomial // kg/m³
  vaporPressure?: AntoineParams
  references?: string[]
}

export interface SpeciesDatabase {
  version: string
  species: Species[]
}

// ─── Streams ──────────────────────────────────────────────────────────────────
export interface SpeciesFlow {
  speciesId: string
  massFlow: number // kg/s
  moleFlow: number // mol/s
  massFraction: number
  moleFraction: number
  phase: Phase
}

export interface StreamData {
  tag: string
  Qm: number // total mass flow kg/s
  Qv: number // volumetric flow m³/s
  QmSolid: number
  QmLiquid: number
  QmVapour: number
  T: number // K
  P: number // Pa
  H: number // specific enthalpy J/kg
  rho: number // density kg/m³
  Cp: number // specific heat J/kg·K
  species: Record<string, SpeciesFlow>
  solidFraction: number
  liquidFraction: number
  vapourFraction: number
  sourceUnitTag: string
  destUnitTag: string
  solved: boolean
  errors: string[]
}

// ─── Units ────────────────────────────────────────────────────────────────────
export type UnitModelType =
  | 'Feeder' | 'FeederSink' | 'Pipe'
  | 'Tank' | 'Tie' | 'Splitter'
  | 'FlashTank' | 'FlashTank2'
  | 'HeatExchanger' | 'Cooler' | 'Heater'
  | 'Filter' | 'Washer' | 'Thickener'
  | 'CrushingMill' | 'Screen' | 'Cyclone'
  | 'Pump' | 'Valve'
  | 'GeneralController' | 'PIDController' | 'SetTagController'
  | 'MakeupSource'

export interface PortDefinition {
  id: string
  label: string
  type: 'inlet' | 'outlet'
  required: boolean
  maxConnections: number
  position: 'top' | 'bottom' | 'left' | 'right'
}

export interface UnitNode {
  id: string
  tag: string
  type: UnitModelType
  label: string
  position: { x: number; y: number }
  symbolKey: string
  enabled: boolean
  config: Record<string, unknown>
  subModels: string[]
  solveStatus: UnitSolveStatus
  errorMessages: string[]
  ports: PortDefinition[]
}

// ─── Pipes ────────────────────────────────────────────────────────────────────
export interface PipeEdge {
  id: string
  tag: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  stream?: StreamData
  config: {
    simplified: boolean
    length?: number
    diameter?: number
    roughness?: number
    dZ?: number
    kMinorLoss?: number
  }
}

// ─── Flowsheet ────────────────────────────────────────────────────────────────
export interface Annotation {
  id: string
  type: 'text' | 'border' | 'titleblock'
  position: { x: number; y: number }
  size?: { width: number; height: number }
  content?: string
  style?: Record<string, string>
  // text annotation
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  textColor?: string
  // border annotation
  borderStyle?: 'solid' | 'dashed'
  borderColor?: string
  borderWidth?: number
  headerText?: string
  headerColor?: string
  // title block
  projectName?: string
  flowsheetName?: string
  revision?: string
  date?: string
  drawnBy?: string
  checkedBy?: string
  logoBase64?: string
}

export interface Flowsheet {
  id: string
  name: string
  order: number
  nodes: UnitNode[]
  edges: PipeEdge[]
  annotations: Annotation[]
  viewport: { x: number; y: number; zoom: number }
}

// ─── Project ──────────────────────────────────────────────────────────────────
export interface SolverSettings {
  maxIterations: number
  convergenceTolerance: number
  dampingFactor: number
  tearMethod: 'DirectSubstitution' | 'Wegstein' | 'Broyden'
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export interface ReportField {
  id: string
  tagPath: string
  displayName: string
  unit?: string
}

export interface ReportSection {
  id: string
  name: string
  fields: ReportField[]
}

export interface ReportConfig {
  id: string
  name: string
  sections: ReportSection[]
  createdAt: string
}

export interface Project {
  id: string
  name: string
  description: string
  createdAt: string
  modifiedAt: string
  solveMode: SolveMode
  heatMode: HeatMode
  selectedSpecies: string[]
  flowsheets: Flowsheet[]
  solverSettings: SolverSettings
  reports?: ReportConfig[]
}

// ─── Unit Preferences ─────────────────────────────────────────────────────────
export interface UnitPreferences {
  temperature: '°C' | 'K' | '°F'
  pressure: 'kPa' | 'bar' | 'psi' | 'atm'
  flow: 't/h' | 'kg/s' | 't/d'
}

// ─── Solver State ─────────────────────────────────────────────────────────────
export interface AuditEntry {
  id: string
  unitTag: string
  message: string
  severity: 'info' | 'warning' | 'error'
}

export interface SolverState {
  status: SolverStatus
  iteration: number
  maxError: number
  elapsedMs: number
  unitStatuses: Record<string, UnitSolveStatus>
  auditErrors: AuditEntry[]
}
