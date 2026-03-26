import type { Phase, PipeEdge, Project, ReadinessReport, SolveHistoryEntry } from '@/types'

export const CURRENT_PROJECT_SCHEMA_VERSION = 4

type UnknownRecord = Record<string, unknown>

function normalizeSpeciesPhases(config: UnknownRecord): UnknownRecord {
  const phases = (config.speciesPhases ?? {}) as Record<string, Phase>
  return {
    ...config,
    speciesPhases: phases,
  }
}

function migrateEdge(edge: UnknownRecord): PipeEdge {
  return {
    id: String(edge.id ?? crypto.randomUUID()),
    tag: String(edge.tag ?? ''),
    source: String(edge.source ?? ''),
    target: String(edge.target ?? ''),
    sourceHandle: edge.sourceHandle ? String(edge.sourceHandle) : undefined,
    targetHandle: edge.targetHandle ? String(edge.targetHandle) : undefined,
    sourcePortKey: edge.sourcePortKey ? String(edge.sourcePortKey) : undefined,
    targetPortKey: edge.targetPortKey ? String(edge.targetPortKey) : undefined,
    stream: edge.stream as PipeEdge['stream'],
    config: {
      simplified: Boolean((edge.config as UnknownRecord | undefined)?.simplified ?? true),
      length: typeof (edge.config as UnknownRecord | undefined)?.length === 'number'
        ? ((edge.config as UnknownRecord).length as number)
        : undefined,
      diameter: typeof (edge.config as UnknownRecord | undefined)?.diameter === 'number'
        ? ((edge.config as UnknownRecord).diameter as number)
        : undefined,
      roughness: typeof (edge.config as UnknownRecord | undefined)?.roughness === 'number'
        ? ((edge.config as UnknownRecord).roughness as number)
        : undefined,
      dZ: typeof (edge.config as UnknownRecord | undefined)?.dZ === 'number'
        ? ((edge.config as UnknownRecord).dZ as number)
        : undefined,
      kMinorLoss: typeof (edge.config as UnknownRecord | undefined)?.kMinorLoss === 'number'
        ? ((edge.config as UnknownRecord).kMinorLoss as number)
        : undefined,
    },
  }
}

function migrateSolveHistory(entries: unknown): SolveHistoryEntry[] {
  if (!Array.isArray(entries)) return []
  return entries
    .map((entry) => {
      const raw = entry as UnknownRecord
      const startedAt = typeof raw.startedAt === 'string' ? raw.startedAt : new Date().toISOString()
      const completedAt = typeof raw.completedAt === 'string' ? raw.completedAt : startedAt
      const status = raw.status === 'error' ? 'error' : 'converged'
      return {
        id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
        solveId: typeof raw.solveId === 'string' ? raw.solveId : 'unknown',
        startedAt,
        completedAt,
        status,
        iteration: typeof raw.iteration === 'number' ? raw.iteration : 0,
        maxError: typeof raw.maxError === 'number' ? raw.maxError : 0,
        elapsedMs: typeof raw.elapsedMs === 'number' ? raw.elapsedMs : 0,
        solvedUnits: typeof raw.solvedUnits === 'number' ? raw.solvedUnits : 0,
        diagnosticsCount: typeof raw.diagnosticsCount === 'number' ? raw.diagnosticsCount : 0,
        unitSummaryCount: typeof raw.unitSummaryCount === 'number' ? raw.unitSummaryCount : 0,
        summary: typeof raw.summary === 'string' ? raw.summary : `Solve ${status}`,
      } satisfies SolveHistoryEntry
    })
    .slice(0, 25)
}

function migrateReadinessReports(entries: unknown): ReadinessReport[] {
  if (!Array.isArray(entries)) return []
  return entries
    .map((entry) => {
      const raw = entry as UnknownRecord
      return {
        id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
        generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : new Date().toISOString(),
        overallStatus:
          raw.overallStatus === 'blocked' || raw.overallStatus === 'warnings'
            ? raw.overallStatus
            : 'ready',
        totalIssues: typeof raw.totalIssues === 'number' ? raw.totalIssues : 0,
        errorCount: typeof raw.errorCount === 'number' ? raw.errorCount : 0,
        warningCount: typeof raw.warningCount === 'number' ? raw.warningCount : 0,
        unitIssueCount: typeof raw.unitIssueCount === 'number' ? raw.unitIssueCount : 0,
        streamIssueCount: typeof raw.streamIssueCount === 'number' ? raw.streamIssueCount : 0,
        projectIssueCount: typeof raw.projectIssueCount === 'number' ? raw.projectIssueCount : 0,
        missingRouteCount: typeof raw.missingRouteCount === 'number' ? raw.missingRouteCount : 0,
        assignedRouteCount: typeof raw.assignedRouteCount === 'number' ? raw.assignedRouteCount : 0,
        flowsheets: Array.isArray(raw.flowsheets) ? (raw.flowsheets as ReadinessReport['flowsheets']) : [],
        issues: Array.isArray(raw.issues) ? (raw.issues as ReadinessReport['issues']) : [],
      } satisfies ReadinessReport
    })
    .slice(0, 20)
}

export function migrateProject(rawProject: unknown): Project {
  const input = rawProject as UnknownRecord
  const schemaVersion = typeof input.schemaVersion === 'number' ? input.schemaVersion : 1

  const project = {
    ...input,
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    solveHistory: migrateSolveHistory(input.solveHistory),
    readinessReports: migrateReadinessReports(input.readinessReports),
    flowsheets: Array.isArray(input.flowsheets)
      ? input.flowsheets.map((flowsheet) => {
          const fs = flowsheet as UnknownRecord
          return {
            ...fs,
            nodes: Array.isArray(fs.nodes)
              ? fs.nodes.map((node) => {
                  const n = node as UnknownRecord
                  return {
                    ...n,
                    config: normalizeSpeciesPhases((n.config ?? {}) as UnknownRecord),
                  }
                })
              : [],
            edges: Array.isArray(fs.edges)
              ? fs.edges.map((edge) => migrateEdge(edge as UnknownRecord))
              : [],
          }
        })
      : [],
  } as Project

  if (schemaVersion < 2) {
    for (const flowsheet of project.flowsheets) {
      for (const edge of flowsheet.edges) {
        if (!edge.sourcePortKey && edge.sourceHandle) edge.sourcePortKey = edge.sourceHandle
        if (!edge.targetPortKey && edge.targetHandle) edge.targetPortKey = edge.targetHandle
      }
    }
  }

  if (schemaVersion < 3 && !Array.isArray(project.solveHistory)) {
    project.solveHistory = []
  }

  if (schemaVersion < 4 && !Array.isArray(project.readinessReports)) {
    project.readinessReports = []
  }

  return project
}
