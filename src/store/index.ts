import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  Project,
  Flowsheet,
  UnitNode,
  PipeEdge,
  Annotation,
  SolverStatus,
  UnitSolveStatus,
  AuditEntry,
  SolverState,
  UnitPreferences,
} from '@/types'

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createDefaultProject(): Project {
  const now = new Date().toISOString()
  const defaultFlowsheet: Flowsheet = {
    id: crypto.randomUUID(),
    name: 'Flowsheet 1',
    order: 0,
    nodes: [],
    edges: [],
    annotations: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }
  return {
    id: crypto.randomUUID(),
    name: 'Untitled Project',
    description: '',
    createdAt: now,
    modifiedAt: now,
    solveMode: 'ProBal',
    heatMode: 'MassBalance',
    selectedSpecies: [],
    flowsheets: [defaultFlowsheet],
    solverSettings: {
      maxIterations: 200,
      convergenceTolerance: 1e-6,
      dampingFactor: 0.5,
      tearMethod: 'DirectSubstitution',
    },
  }
}

// ─── Project Store ────────────────────────────────────────────────────────────

interface ProjectStoreState {
  project: Project
  pgmSources: Record<string, string>
  reactionFiles: Record<string, string>
  setProject: (project: Project) => void
  setProjectName: (name: string) => void
  setProjectDescription: (description: string) => void
  addFlowsheet: (flowsheet: Flowsheet) => void
  removeFlowsheet: (id: string) => void
  updateFlowsheet: (id: string, updates: Partial<Flowsheet>) => void
  renameFlowsheet: (id: string, name: string) => void
  duplicateFlowsheet: (id: string) => string | null
  reorderFlowsheet: (id: string, direction: 'left' | 'right') => void
  addNode: (flowsheetId: string, node: UnitNode) => void
  removeNode: (flowsheetId: string, nodeId: string) => void
  updateNode: (flowsheetId: string, nodeId: string, updates: Partial<UnitNode>) => void
  addEdge: (flowsheetId: string, edge: PipeEdge) => void
  removeEdge: (flowsheetId: string, edgeId: string) => void
  updateEdge: (flowsheetId: string, edgeId: string, updates: Partial<PipeEdge>) => void
  addAnnotation: (flowsheetId: string, annotation: Annotation) => void
  updateAnnotation: (flowsheetId: string, id: string, updates: Partial<Annotation>) => void
  removeAnnotation: (flowsheetId: string, id: string) => void
  touchModifiedAt: () => void
  toggleUnitEnabled: (flowsheetId: string, nodeId: string) => void
  setPGMSource: (filename: string, src: string) => void
  removePGMSource: (filename: string) => void
  setPGMSources: (sources: Record<string, string>) => void
  setReactionFile: (filename: string, src: string) => void
  removeReactionFile: (filename: string) => void
  setReactionFiles: (files: Record<string, string>) => void
}

export const useProjectStore = create<ProjectStoreState>()(
  immer((set) => ({
    project: createDefaultProject(),
    pgmSources: {},
    reactionFiles: {},

    setProject: (project) =>
      set((state) => {
        state.project = project
      }),

    setProjectName: (name) =>
      set((state) => {
        state.project.name = name
        state.project.modifiedAt = new Date().toISOString()
      }),

    setProjectDescription: (description) =>
      set((state) => {
        state.project.description = description
        state.project.modifiedAt = new Date().toISOString()
      }),

    addFlowsheet: (flowsheet) =>
      set((state) => {
        state.project.flowsheets.push(flowsheet)
        state.project.modifiedAt = new Date().toISOString()
      }),

    removeFlowsheet: (id) =>
      set((state) => {
        state.project.flowsheets = state.project.flowsheets.filter(
          (fs) => fs.id !== id,
        )
        state.project.modifiedAt = new Date().toISOString()
      }),

    updateFlowsheet: (id, updates) =>
      set((state) => {
        const fs = state.project.flowsheets.find((f) => f.id === id)
        if (fs) Object.assign(fs, updates)
        state.project.modifiedAt = new Date().toISOString()
      }),

    renameFlowsheet: (id, name) =>
      set((state) => {
        const fs = state.project.flowsheets.find((f) => f.id === id)
        if (fs) fs.name = name.trim()
        state.project.modifiedAt = new Date().toISOString()
      }),

    duplicateFlowsheet: (id) => {
      let newId: string | null = null
      set((state) => {
        const fs = state.project.flowsheets.find((f) => f.id === id)
        if (!fs) return
        newId = crypto.randomUUID()
        const maxOrder = Math.max(...state.project.flowsheets.map((f) => f.order))
        const newFs: Flowsheet = {
          ...fs,
          id: newId,
          name: `${fs.name} (copy)`,
          order: maxOrder + 1,
          nodes: fs.nodes.map((n) => ({ ...n, id: crypto.randomUUID() })),
          edges: [],
          annotations: fs.annotations.map((a) => ({ ...a, id: crypto.randomUUID() })),
        }
        state.project.flowsheets.push(newFs)
        state.project.modifiedAt = new Date().toISOString()
      })
      return newId
    },

    reorderFlowsheet: (id, direction) =>
      set((state) => {
        const sorted = [...state.project.flowsheets].sort((a, b) => a.order - b.order)
        const idx = sorted.findIndex((f) => f.id === id)
        if (idx === -1) return
        const swapIdx = direction === 'left' ? idx - 1 : idx + 1
        if (swapIdx < 0 || swapIdx >= sorted.length) return
        // Swap order values
        const a = state.project.flowsheets.find((f) => f.id === sorted[idx].id)!
        const b = state.project.flowsheets.find((f) => f.id === sorted[swapIdx].id)!
        const tmp = a.order
        a.order = b.order
        b.order = tmp
        state.project.modifiedAt = new Date().toISOString()
      }),

    addNode: (flowsheetId, node) =>
      set((state) => {
        const fs = state.project.flowsheets.find((f) => f.id === flowsheetId)
        if (fs) fs.nodes.push(node)
        state.project.modifiedAt = new Date().toISOString()
      }),

    removeNode: (flowsheetId, nodeId) =>
      set((state) => {
        const fs = state.project.flowsheets.find((f) => f.id === flowsheetId)
        if (fs) fs.nodes = fs.nodes.filter((n) => n.id !== nodeId)
        state.project.modifiedAt = new Date().toISOString()
      }),

    updateNode: (flowsheetId, nodeId, updates) =>
      set((state) => {
        const fs = state.project.flowsheets.find((f) => f.id === flowsheetId)
        if (fs) {
          const node = fs.nodes.find((n) => n.id === nodeId)
          if (node) Object.assign(node, updates)
        }
        state.project.modifiedAt = new Date().toISOString()
      }),

    addEdge: (flowsheetId, edge) =>
      set((state) => {
        const fs = state.project.flowsheets.find((f) => f.id === flowsheetId)
        if (fs) fs.edges.push(edge)
        state.project.modifiedAt = new Date().toISOString()
      }),

    removeEdge: (flowsheetId, edgeId) =>
      set((state) => {
        const fs = state.project.flowsheets.find((f) => f.id === flowsheetId)
        if (fs) fs.edges = fs.edges.filter((e) => e.id !== edgeId)
        state.project.modifiedAt = new Date().toISOString()
      }),

    updateEdge: (flowsheetId, edgeId, updates) =>
      set((state) => {
        const fs = state.project.flowsheets.find((f) => f.id === flowsheetId)
        if (fs) {
          const edge = fs.edges.find((e) => e.id === edgeId)
          if (edge) Object.assign(edge, updates)
        }
        state.project.modifiedAt = new Date().toISOString()
      }),

    addAnnotation: (flowsheetId, annotation) =>
      set((state) => {
        const fs = state.project.flowsheets.find((f) => f.id === flowsheetId)
        if (fs) fs.annotations.push(annotation)
        state.project.modifiedAt = new Date().toISOString()
      }),

    updateAnnotation: (flowsheetId, id, updates) =>
      set((state) => {
        const fs = state.project.flowsheets.find((f) => f.id === flowsheetId)
        if (fs) {
          const ann = fs.annotations.find((a) => a.id === id)
          if (ann) Object.assign(ann, updates)
        }
        state.project.modifiedAt = new Date().toISOString()
      }),

    removeAnnotation: (flowsheetId, id) =>
      set((state) => {
        const fs = state.project.flowsheets.find((f) => f.id === flowsheetId)
        if (fs) fs.annotations = fs.annotations.filter((a) => a.id !== id)
        state.project.modifiedAt = new Date().toISOString()
      }),

    toggleUnitEnabled: (flowsheetId, nodeId) =>
      set((state) => {
        const fs = state.project.flowsheets.find((f) => f.id === flowsheetId)
        if (fs) {
          const node = fs.nodes.find((n) => n.id === nodeId)
          if (node) node.enabled = !node.enabled
        }
        state.project.modifiedAt = new Date().toISOString()
      }),

    touchModifiedAt: () =>
      set((state) => {
        state.project.modifiedAt = new Date().toISOString()
      }),

    setPGMSource: (filename, src) =>
      set((state) => {
        state.pgmSources[filename] = src
      }),

    removePGMSource: (filename) =>
      set((state) => {
        delete state.pgmSources[filename]
      }),

    setPGMSources: (sources) =>
      set((state) => {
        state.pgmSources = sources
      }),

    setReactionFile: (filename, src) =>
      set((state) => {
        state.reactionFiles[filename] = src
      }),

    removeReactionFile: (filename) =>
      set((state) => {
        delete state.reactionFiles[filename]
      }),

    setReactionFiles: (files) =>
      set((state) => {
        state.reactionFiles = files
      }),
  })),
)

// ─── Canvas Store ─────────────────────────────────────────────────────────────

interface CanvasStoreState {
  activeFlowsheetId: string | null
  selectedNodeId: string | null
  selectedEdgeId: string | null
  setActiveFlowsheetId: (id: string | null) => void
  setSelectedNodeId: (id: string | null) => void
  setSelectedEdgeId: (id: string | null) => void
  clearSelection: () => void
}

export const useCanvasStore = create<CanvasStoreState>()(
  immer((set) => ({
    activeFlowsheetId: null,
    selectedNodeId: null,
    selectedEdgeId: null,

    setActiveFlowsheetId: (id) =>
      set((state) => {
        state.activeFlowsheetId = id
        state.selectedNodeId = null
        state.selectedEdgeId = null
      }),

    setSelectedNodeId: (id) =>
      set((state) => {
        state.selectedNodeId = id
        state.selectedEdgeId = null
      }),

    setSelectedEdgeId: (id) =>
      set((state) => {
        state.selectedEdgeId = id
        state.selectedNodeId = null
      }),

    clearSelection: () =>
      set((state) => {
        state.selectedNodeId = null
        state.selectedEdgeId = null
      }),
  })),
)

// ─── Solver Store ─────────────────────────────────────────────────────────────

interface SolverStoreState {
  solverState: SolverState
  startSolve: () => void
  pauseSolve: () => void
  stopSolve: () => void
  setSolverStatus: (status: SolverStatus) => void
  setUnitStatus: (unitTag: string, status: UnitSolveStatus) => void
  addAuditEntry: (entry: AuditEntry) => void
  clearAudit: () => void
  updateSolverProgress: (iteration: number, maxError: number, elapsedMs: number) => void
}

const defaultSolverState: SolverState = {
  status: 'idle',
  iteration: 0,
  maxError: 0,
  elapsedMs: 0,
  unitStatuses: {},
  auditErrors: [],
}

export const useSolverStore = create<SolverStoreState>()(
  immer((set) => ({
    solverState: { ...defaultSolverState },

    startSolve: () =>
      set((state) => {
        state.solverState.status = 'solving'
        state.solverState.iteration = 0
        state.solverState.maxError = 0
        state.solverState.elapsedMs = 0
        state.solverState.auditErrors = []
      }),

    pauseSolve: () =>
      set((state) => {
        if (state.solverState.status === 'solving') {
          state.solverState.status = 'paused'
        }
      }),

    stopSolve: () =>
      set((state) => {
        state.solverState.status = 'idle'
        state.solverState.unitStatuses = {}
      }),

    setSolverStatus: (status) =>
      set((state) => {
        state.solverState.status = status
      }),

    setUnitStatus: (unitTag, status) =>
      set((state) => {
        state.solverState.unitStatuses[unitTag] = status
      }),

    addAuditEntry: (entry) =>
      set((state) => {
        state.solverState.auditErrors.push(entry)
      }),

    clearAudit: () =>
      set((state) => {
        state.solverState.auditErrors = []
      }),

    updateSolverProgress: (iteration, maxError, elapsedMs) =>
      set((state) => {
        state.solverState.iteration = iteration
        state.solverState.maxError = maxError
        state.solverState.elapsedMs = elapsedMs
      }),
  })),
)

// ─── UI Store ─────────────────────────────────────────────────────────────────

type LeftNavTab = 'flowsheets' | 'units' | 'species' | 'reactions' | 'controls'
type RightPanelTab = 'properties' | 'streams' | 'results' | 'audit'

const DEFAULT_UNIT_PREFERENCES: UnitPreferences = {
  temperature: '°C',
  pressure: 'kPa',
  flow: 't/h',
}

interface UIStoreState {
  leftNavTab: LeftNavTab
  rightPanelOpen: boolean
  rightPanelTab: RightPanelTab
  accessWindowUnitId: string | null
  trendPanelOpen: boolean
  resultsPanelOpen: boolean
  reportBuilderOpen: boolean
  unitPreferences: UnitPreferences
  newProjectWizardOpen: boolean
  setLeftNavTab: (tab: LeftNavTab) => void
  setRightPanelOpen: (open: boolean) => void
  toggleRightPanel: () => void
  setRightPanelTab: (tab: RightPanelTab) => void
  setAccessWindowUnitId: (id: string | null) => void
  setTrendPanelOpen: (open: boolean) => void
  toggleTrendPanel: () => void
  setResultsPanelOpen: (open: boolean) => void
  toggleResultsPanel: () => void
  setReportBuilderOpen: (open: boolean) => void
  setUnitPreferences: (prefs: UnitPreferences) => void
  setNewProjectWizardOpen: (open: boolean) => void
  setupWindowOpen: boolean
  setSetupWindowOpen: (open: boolean) => void
  exampleProjectDialogOpen: boolean
  setExampleProjectDialogOpen: (open: boolean) => void
}

export const useUIStore = create<UIStoreState>()(
  immer((set) => ({
    leftNavTab: 'flowsheets',
    rightPanelOpen: false,
    rightPanelTab: 'properties',
    accessWindowUnitId: null,
    trendPanelOpen: false,
    resultsPanelOpen: false,
    reportBuilderOpen: false,
    unitPreferences: { ...DEFAULT_UNIT_PREFERENCES },
    newProjectWizardOpen: false,
    setupWindowOpen: false,
    exampleProjectDialogOpen: false,

    setLeftNavTab: (tab) =>
      set((state) => {
        state.leftNavTab = tab
      }),

    setRightPanelOpen: (open) =>
      set((state) => {
        state.rightPanelOpen = open
      }),

    toggleRightPanel: () =>
      set((state) => {
        state.rightPanelOpen = !state.rightPanelOpen
      }),

    setRightPanelTab: (tab) =>
      set((state) => {
        state.rightPanelTab = tab
      }),

    setAccessWindowUnitId: (id) =>
      set((state) => {
        state.accessWindowUnitId = id
      }),

    setTrendPanelOpen: (open) =>
      set((state) => {
        state.trendPanelOpen = open
      }),

    toggleTrendPanel: () =>
      set((state) => {
        state.trendPanelOpen = !state.trendPanelOpen
      }),

    setResultsPanelOpen: (open) =>
      set((state) => {
        state.resultsPanelOpen = open
      }),

    toggleResultsPanel: () =>
      set((state) => {
        state.resultsPanelOpen = !state.resultsPanelOpen
      }),

    setReportBuilderOpen: (open) =>
      set((state) => {
        state.reportBuilderOpen = open
      }),

    setUnitPreferences: (prefs) =>
      set((state) => {
        state.unitPreferences = prefs
      }),

    setNewProjectWizardOpen: (open) =>
      set((state) => {
        state.newProjectWizardOpen = open
      }),

    setSetupWindowOpen: (open) =>
      set((state) => {
        state.setupWindowOpen = open
      }),

    setExampleProjectDialogOpen: (open) =>
      set((state) => {
        state.exampleProjectDialogOpen = open
      }),
  })),
)

// ─── Trend Store ───────────────────────────────────────────────────────────────

const TREND_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
]

export interface TrendTag {
  tagPath: string
  color: string
  min?: number
  max?: number
}

interface TrendStoreState {
  trackedTags: TrendTag[]
  logScale: boolean
  addTag: (tagPath: string, color?: string) => void
  removeTag: (tagPath: string) => void
  updateTag: (tagPath: string, updates: Partial<TrendTag>) => void
  clearTags: () => void
  setLogScale: (v: boolean) => void
}

export const useTrendStore = create<TrendStoreState>()(
  immer((set) => ({
    trackedTags: [],
    logScale: false,

    addTag: (tagPath, color) =>
      set((state) => {
        if (state.trackedTags.some((t) => t.tagPath === tagPath)) return
        const autoColor = TREND_COLORS[state.trackedTags.length % TREND_COLORS.length]
        state.trackedTags.push({ tagPath, color: color ?? autoColor })
      }),

    removeTag: (tagPath) =>
      set((state) => {
        state.trackedTags = state.trackedTags.filter((t) => t.tagPath !== tagPath)
      }),

    updateTag: (tagPath, updates) =>
      set((state) => {
        const tag = state.trackedTags.find((t) => t.tagPath === tagPath)
        if (tag) Object.assign(tag, updates)
      }),

    clearTags: () =>
      set((state) => {
        state.trackedTags = []
      }),

    setLogScale: (v) =>
      set((state) => {
        state.logScale = v
      }),
  })),
)
