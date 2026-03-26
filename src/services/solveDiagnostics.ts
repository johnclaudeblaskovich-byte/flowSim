import type { Project, SolverUnitSummary } from '@/types'

export function buildUnitSummaries(project: Project, solveId: string): SolverUnitSummary[] {
  const summaries: SolverUnitSummary[] = []

  for (const flowsheet of project.flowsheets) {
    for (const unit of flowsheet.nodes) {
      const incoming = flowsheet.edges.filter((edge) => edge.target === unit.id)
      const outgoing = flowsheet.edges.filter((edge) => edge.source === unit.id)
      const incomingSolved = incoming.filter((edge) => edge.stream)
      const outgoingSolved = outgoing.filter((edge) => edge.stream)

      const incomingMassFlowTph = incomingSolved.reduce((sum, edge) => sum + ((edge.stream?.Qm ?? 0) * 3.6), 0)
      const outgoingMassFlowTph = outgoingSolved.reduce((sum, edge) => sum + ((edge.stream?.Qm ?? 0) * 3.6), 0)
      const massDeltaTph = outgoingMassFlowTph - incomingMassFlowTph
      const massClosurePercent =
        incomingMassFlowTph > 1e-10
          ? (Math.abs(massDeltaTph) / incomingMassFlowTph) * 100
          : null

      summaries.push({
        id: crypto.randomUUID(),
        solveId,
        flowsheetId: flowsheet.id,
        unitId: unit.id,
        unitTag: unit.tag,
        unitType: unit.type,
        incomingCount: incoming.length,
        outgoingCount: outgoing.length,
        incomingMassFlowTph,
        outgoingMassFlowTph,
        massDeltaTph,
        massClosurePercent,
        routes: [
          ...incoming.map((edge) => ({
            edgeId: edge.id,
            edgeTag: edge.tag,
            routeKey: edge.targetPortKey,
            massFlowTph: edge.stream ? edge.stream.Qm * 3.6 : null,
            direction: 'inlet' as const,
          })),
          ...outgoing.map((edge) => ({
            edgeId: edge.id,
            edgeTag: edge.tag,
            routeKey: edge.sourcePortKey,
            massFlowTph: edge.stream ? edge.stream.Qm * 3.6 : null,
            direction: 'outlet' as const,
          })),
        ],
      })
    }
  }

  return summaries
}
