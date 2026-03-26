import type {
  Project,
  ReadinessFlowsheetSummary,
  ReadinessIssueSnapshot,
  ReadinessReport,
} from '@/types'
import { validateProject, type ValidationResult } from '@/services/projectValidator'

type IssueWithSeverity =
  | (ValidationResult['errors'][number] & { severity: 'error' })
  | (ValidationResult['warnings'][number] & { severity: 'warning' })

function inferIssueKind(issue: IssueWithSeverity): ReadinessIssueSnapshot['kind'] {
  if (issue.edgeId) return 'stream'
  if (issue.nodeId) return 'unit'
  return 'project'
}

export function buildReadinessReport(project: Project): ReadinessReport {
  const validation = validateProject(project)
  const flowsheetById = new Map(project.flowsheets.map((flowsheet) => [flowsheet.id, flowsheet]))
  const issues: IssueWithSeverity[] = [
    ...validation.errors.map((issue) => ({ ...issue, severity: 'error' as const })),
    ...validation.warnings.map((issue) => ({ ...issue, severity: 'warning' as const })),
  ]

  const issueSnapshots: ReadinessIssueSnapshot[] = issues.map((issue) => ({
    severity: issue.severity,
    flowsheetId: issue.flowsheetId,
    flowsheetName: flowsheetById.get(issue.flowsheetId)?.name ?? 'Project',
    nodeId: issue.nodeId || undefined,
    unitTag: issue.unitTag,
    edgeId: issue.edgeId,
    edgeTag: issue.edgeTag,
    kind: inferIssueKind(issue),
    message: issue.msg,
  }))

  const flowsheets: ReadinessFlowsheetSummary[] = project.flowsheets.map((flowsheet) => {
    const issueRows = issueSnapshots.filter((issue) => issue.flowsheetId === flowsheet.id)
    const missingRouteCount = issueRows.filter(
      (issue) => issue.kind === 'stream' && issue.message.toLowerCase().includes('missing an explicit output routing'),
    ).length
    const assignedRouteCount = flowsheet.edges.filter((edge) => Boolean(edge.sourcePortKey)).length

    return {
      flowsheetId: flowsheet.id,
      flowsheetName: flowsheet.name,
      unitCount: flowsheet.nodes.length,
      streamCount: flowsheet.edges.length,
      issueCount: issueRows.length,
      errorCount: issueRows.filter((issue) => issue.severity === 'error').length,
      warningCount: issueRows.filter((issue) => issue.severity === 'warning').length,
      missingRouteCount,
      assignedRouteCount,
    }
  })

  const errorCount = issueSnapshots.filter((issue) => issue.severity === 'error').length
  const warningCount = issueSnapshots.filter((issue) => issue.severity === 'warning').length

  return {
    id: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    overallStatus: errorCount > 0 ? 'blocked' : warningCount > 0 ? 'warnings' : 'ready',
    totalIssues: issueSnapshots.length,
    errorCount,
    warningCount,
    unitIssueCount: issueSnapshots.filter((issue) => issue.kind === 'unit').length,
    streamIssueCount: issueSnapshots.filter((issue) => issue.kind === 'stream').length,
    projectIssueCount: issueSnapshots.filter((issue) => issue.kind === 'project').length,
    missingRouteCount: flowsheets.reduce((sum, flowsheet) => sum + flowsheet.missingRouteCount, 0),
    assignedRouteCount: flowsheets.reduce((sum, flowsheet) => sum + flowsheet.assignedRouteCount, 0),
    flowsheets,
    issues: issueSnapshots,
  }
}
