import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  Project,
  Flowsheet,
  UnitNode,
  PipeEdge,
  SolverStatus,
  UnitSolveStatus,
  AuditEntry,
  SolverState,
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
  setProject: (project: Project) => void
  setProjectName: (name: string) => void
  setProjectDescription: (description: string) => void
  addFlowsheet: (flowsheet: Flowsheet) => void
  removeFlowsheet: (id: string) => void
  updateFlowsheet: (id: string, updates: Partial<Flowsheet>) => void
  addNode: (flowsheetId: string, node: UnitNode) => void
  removeNode: (flowsheetId: string, nodeId: string) => void
  updateNode: (flowsheetId: string, nodeId: string, updates: Partial<UnitNode>) => void
  addEdge: (flowsheetId: string, edge: PipeEdge) => void
  removeEdge: (flowsheetId: string, edgeId: string) => void
  updateEdge: (flowsheetId: string, edgeId: string, updates: Partial<PipeEdge>) => void
  touchModifiedAt: () => void
}

export const useProjectStore = create<ProjectStoreState>()(
  immer((set) => ({
    project: createDefaultProject(),

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

    touchModifiedAt: () =>
      set((state) => {
        state.project.modifiedAt = new Date().toISOString()
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

interface UIStoreState {
  leftNavTab: LeftNavTab
  rightPanelOpen: boolean
  rightPanelTab: RightPanelTab
  accessWindowUnitId: string | null
  setLeftNavTab: (tab: LeftNavTab) => void
  setRightPanelOpen: (open: boolean) => void
  toggleRightPanel: () => void
  setRightPanelTab: (tab: RightPanelTab) => void
  setAccessWindowUnitId: (id: string | null) => void
}

export const useUIStore = create<UIStoreState>()(
  immer((set) => ({
    leftNavTab: 'flowsheets',
    rightPanelOpen: false,
    rightPanelTab: 'properties',
    accessWindowUnitId: null,

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
  })),
)
