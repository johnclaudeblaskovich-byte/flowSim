import { guessSpeciesPhase } from '@/lib/speciesCatalog'
import type { Phase, PipeEdge, Project, SpeciesFlow, StreamData, UnitNode } from '@/types'

interface FeederConfig {
  massFlow?: number
  temperature?: number
  pressure?: number
  solidFraction?: number
  species?: Record<string, number>
  speciesPhases?: Record<string, Phase>
}

export interface SerializedSolveFlowsheet {
  nodes: Array<{
    tag: string
    type: string
    config: Record<string, unknown>
    enabled: boolean
  }>
  edges: Array<{
    sourceUnitTag: string
    destUnitTag: string
    sourcePortKey?: string
    targetPortKey?: string
    stream?: StreamData
  }>
}

export interface SolverErrorEvent {
  type: 'error'
  solveId?: string
  timestamp?: string
  message: string
  unitTag?: string
  detail?: string
}

export type ValidatedSolverMessage =
  | { type: 'status'; solveId?: string; timestamp?: string; message: string }
  | { type: 'done'; solveId?: string; timestamp?: string; iteration: number; maxError: number; solvedUnits: number }
  | { type: 'result'; solveId?: string; timestamp?: string; unitTag: string; streams: Record<string, StreamData> }
  | SolverErrorEvent

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStreamData(value: unknown): value is StreamData {
  if (!isRecord(value)) return false
  return (
    typeof value.tag === 'string' &&
    typeof value.Qm === 'number' &&
    typeof value.QmSolid === 'number' &&
    typeof value.QmLiquid === 'number' &&
    typeof value.QmVapour === 'number' &&
    typeof value.T === 'number' &&
    typeof value.P === 'number' &&
    isRecord(value.species) &&
    typeof value.solidFraction === 'number' &&
    typeof value.liquidFraction === 'number' &&
    typeof value.vapourFraction === 'number' &&
    typeof value.sourceUnitTag === 'string' &&
    typeof value.destUnitTag === 'string' &&
    typeof value.solved === 'boolean' &&
    Array.isArray(value.errors)
  )
}

function inferMolecularWeight(speciesId: string): number {
  return speciesId === 'Water' || speciesId === 'Steam' ? 0.018 : 0.1
}

export function buildFeederStream(unit: UnitNode, destUnitTag: string): StreamData {
  const cfg = unit.config as FeederConfig
  const massFlow = cfg.massFlow ?? 27.78
  const speciesFractions =
    cfg.species && Object.keys(cfg.species).length > 0
      ? cfg.species
      : {
          Water: 1.0 - (cfg.solidFraction ?? 0.0),
          Ore_Solid: cfg.solidFraction ?? 0.0,
        }
  const speciesPhases = cfg.speciesPhases ?? {}

  const speciesEntries = Object.entries(speciesFractions)
  const species: Record<string, SpeciesFlow> = {}
  let qmSolid = 0
  let qmLiquid = 0
  let qmVapour = 0

  for (const [speciesId, rawFraction] of speciesEntries) {
    const fraction = Number(rawFraction) || 0
    const phase = speciesPhases[speciesId] ?? guessSpeciesPhase(speciesId)
    const massFlowRate = massFlow * fraction
    const moleFlow = massFlowRate / inferMolecularWeight(speciesId)

    species[speciesId] = {
      speciesId,
      massFlow: massFlowRate,
      moleFlow,
      massFraction: fraction,
      moleFraction: 0,
      phase,
    }

    if (phase === 'Solid') qmSolid += massFlowRate
    else if (phase === 'Vapour') qmVapour += massFlowRate
    else qmLiquid += massFlowRate
  }

  return {
    tag: unit.tag,
    Qm: massFlow,
    Qv: 0,
    QmSolid: qmSolid,
    QmLiquid: qmLiquid,
    QmVapour: qmVapour,
    T: cfg.temperature ?? 298.15,
    P: cfg.pressure ?? 101325,
    H: 0,
    rho: 1000,
    Cp: 4186,
    species,
    solidFraction: massFlow > 0 ? qmSolid / massFlow : 0,
    liquidFraction: massFlow > 0 ? qmLiquid / massFlow : 0,
    vapourFraction: massFlow > 0 ? qmVapour / massFlow : 0,
    sourceUnitTag: unit.tag,
    destUnitTag,
    solved: true,
    errors: [],
  }
}

export function serializeFlowsheetForSolve(project: Project): SerializedSolveFlowsheet | null {
  const flowsheet = project.flowsheets[0]
  if (!flowsheet) return null

  const tagById = Object.fromEntries(flowsheet.nodes.map((node) => [node.id, node.tag]))
  const nodeById = Object.fromEntries(flowsheet.nodes.map((node) => [node.id, node]))

  return {
    nodes: flowsheet.nodes.map((node) => ({
      tag: node.tag,
      type: node.type,
      config: node.config,
      enabled: node.enabled,
    })),
    edges: flowsheet.edges.map((edge) => ({
      sourceUnitTag: tagById[edge.source] ?? edge.source,
      destUnitTag: tagById[edge.target] ?? edge.target,
      sourcePortKey: edge.sourcePortKey,
      targetPortKey: edge.targetPortKey,
      stream:
        nodeById[edge.source]?.type === 'Feeder'
          ? buildFeederStream(nodeById[edge.source], tagById[edge.target] ?? edge.target)
          : edge.stream,
    })),
  }
}

export function validateSerializedSolveFlowsheet(flowsheet: SerializedSolveFlowsheet): string[] {
  const errors: string[] = []
  const nodeTags = new Set(flowsheet.nodes.map((node) => node.tag))

  if (flowsheet.nodes.length === 0) errors.push('Flowsheet has no nodes.')

  for (const edge of flowsheet.edges) {
    if (!edge.sourceUnitTag || !nodeTags.has(edge.sourceUnitTag)) {
      errors.push(`Edge has unknown source unit "${edge.sourceUnitTag}".`)
    }
    if (!edge.destUnitTag || !nodeTags.has(edge.destUnitTag)) {
      errors.push(`Edge has unknown destination unit "${edge.destUnitTag}".`)
    }
    if (edge.stream && !isStreamData(edge.stream)) {
      errors.push(`Edge ${edge.sourceUnitTag} -> ${edge.destUnitTag} has invalid stream payload.`)
    }
  }

  return errors
}

export function validateSolverMessage(message: unknown): ValidatedSolverMessage | null {
  if (!isRecord(message) || typeof message.type !== 'string') return null

  if (message.type === 'status' && typeof message.message === 'string') {
    return {
      type: 'status',
      solveId: typeof message.solveId === 'string' ? message.solveId : undefined,
      timestamp: typeof message.timestamp === 'string' ? message.timestamp : undefined,
      message: message.message,
    }
  }

  if (
    message.type === 'done' &&
    typeof message.iteration === 'number' &&
    typeof message.maxError === 'number' &&
    typeof message.solvedUnits === 'number'
  ) {
    return {
      type: 'done',
      solveId: typeof message.solveId === 'string' ? message.solveId : undefined,
      timestamp: typeof message.timestamp === 'string' ? message.timestamp : undefined,
      iteration: message.iteration,
      maxError: message.maxError,
      solvedUnits: message.solvedUnits,
    }
  }

  if (
    message.type === 'error' &&
    typeof message.message === 'string'
  ) {
    return {
      type: 'error',
      solveId: typeof message.solveId === 'string' ? message.solveId : undefined,
      timestamp: typeof message.timestamp === 'string' ? message.timestamp : undefined,
      message: message.message,
      unitTag: typeof message.unitTag === 'string' ? message.unitTag : undefined,
      detail: typeof message.detail === 'string' ? message.detail : undefined,
    }
  }

  if (
    message.type === 'result' &&
    typeof message.unitTag === 'string' &&
    isRecord(message.streams)
  ) {
    const streamEntries = Object.entries(message.streams)
    if (streamEntries.every(([, value]) => isStreamData(value))) {
      return {
        type: 'result',
        solveId: typeof message.solveId === 'string' ? message.solveId : undefined,
        timestamp: typeof message.timestamp === 'string' ? message.timestamp : undefined,
        unitTag: message.unitTag,
        streams: Object.fromEntries(streamEntries) as Record<string, StreamData>,
      }
    }
  }

  return null
}

export function mapStreamsToOutgoingEdges(
  streams: Record<string, StreamData>,
  edges: PipeEdge[],
  nodes: UnitNode[],
  unitTag: string,
): Array<{ edgeId: string; stream: StreamData }> {
  const outgoingEdges = edges.filter((edge) => {
    const sourceNode = nodes.find((candidate) => candidate.id === edge.source)
    return sourceNode?.tag === unitTag
  })
  const streamEntries = Object.entries(streams).filter(([streamName]) => !streamName.startsWith('_'))

  return outgoingEdges.flatMap((edge, index) => {
    const sourceNode = nodes.find((candidate) => candidate.id === edge.source)
    const targetNode = nodes.find((candidate) => candidate.id === edge.target)
    const matchedEntry =
      (edge.sourcePortKey
        ? streamEntries.find(([streamName]) => streamName === edge.sourcePortKey)
        : undefined) ?? streamEntries[index]
    const [, stream] = matchedEntry ?? []
    if (!stream) return []

    return [{
      edgeId: edge.id,
      stream: {
        ...stream,
        tag: edge.tag,
        sourceUnitTag: sourceNode?.tag ?? stream.sourceUnitTag,
        destUnitTag: targetNode?.tag ?? stream.destUnitTag,
        errors: stream.errors ?? [],
      },
    }]
  })
}
