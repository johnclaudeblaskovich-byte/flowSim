import { describe, expect, test } from 'vitest'
import type { PipeEdge, Project, StreamData, UnitNode } from '@/types'
import { createDefaultProject } from '@/store'
import { buildFeederStream, mapStreamsToOutgoingEdges, serializeFlowsheetForSolve } from '@/services/solveProtocol'

function makeNode(overrides: Partial<UnitNode>): UnitNode {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    tag: overrides.tag ?? 'NODE_001',
    type: overrides.type ?? 'Feeder',
    label: overrides.label ?? overrides.tag ?? 'Node',
    position: overrides.position ?? { x: 0, y: 0 },
    symbolKey: overrides.symbolKey ?? (overrides.type ?? 'Feeder'),
    enabled: overrides.enabled ?? true,
    config: overrides.config ?? {},
    subModels: overrides.subModels ?? [],
    solveStatus: overrides.solveStatus ?? 'idle',
    errorMessages: overrides.errorMessages ?? [],
    ports: overrides.ports ?? [],
  }
}

function makeEdge(overrides: Partial<PipeEdge>): PipeEdge {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    tag: overrides.tag ?? 'EDGE_001',
    source: overrides.source ?? '',
    target: overrides.target ?? '',
    sourceHandle: overrides.sourceHandle,
    targetHandle: overrides.targetHandle,
    sourcePortKey: overrides.sourcePortKey,
    targetPortKey: overrides.targetPortKey,
    stream: overrides.stream,
    config: overrides.config ?? { simplified: true },
  }
}

describe('solveProtocol', () => {
  test('buildFeederStream preserves feeder composition and phases', () => {
    const feeder = makeNode({
      tag: 'FDR_001',
      type: 'Feeder',
      config: {
        massFlow: 10,
        temperature: 300,
        pressure: 200000,
        species: {
          Water: 0.7,
          SiO2: 0.3,
        },
        speciesPhases: {
          Water: 'Liquid',
          SiO2: 'Solid',
        },
      },
    })

    const stream = buildFeederStream(feeder, 'THKR_001')
    expect(stream.Qm).toBe(10)
    expect(stream.QmLiquid).toBeCloseTo(7, 6)
    expect(stream.QmSolid).toBeCloseTo(3, 6)
    expect(stream.destUnitTag).toBe('THKR_001')
    expect(stream.species.SiO2?.phase).toBe('Solid')
  })

  test('serializeFlowsheetForSolve injects feeder streams and route keys', () => {
    const project: Project = createDefaultProject()
    const feeder = makeNode({
      id: 'feeder',
      tag: 'FDR_001',
      type: 'Feeder',
      config: { massFlow: 5, species: { Water: 1 } },
    })
    const thickener = makeNode({
      id: 'thickener',
      tag: 'THKR_001',
      type: 'Thickener',
    })
    const edge = makeEdge({
      id: 'edge-1',
      tag: 'FDR_001_TO_THKR_001',
      source: feeder.id,
      target: thickener.id,
      sourcePortKey: 'overflow',
    })

    project.flowsheets[0]!.nodes = [feeder, thickener]
    project.flowsheets[0]!.edges = [edge]

    const serialized = serializeFlowsheetForSolve(project)
    expect(serialized).not.toBeNull()
    expect(serialized?.edges[0]?.sourcePortKey).toBe('overflow')
    expect(serialized?.edges[0]?.stream?.Qm).toBe(5)
  })

  test('mapStreamsToOutgoingEdges honors sourcePortKey before edge order', () => {
    const thickener = makeNode({ id: 'thickener', tag: 'THKR_001', type: 'Thickener' })
    const sink1 = makeNode({ id: 'sink-1', tag: 'SNK_001', type: 'FeederSink' })
    const sink2 = makeNode({ id: 'sink-2', tag: 'SNK_002', type: 'FeederSink' })
    const edges = [
      makeEdge({
        id: 'edge-overflow',
        tag: 'THKR_001_TO_SNK_001',
        source: thickener.id,
        target: sink1.id,
        sourcePortKey: 'overflow',
      }),
      makeEdge({
        id: 'edge-underflow',
        tag: 'THKR_001_TO_SNK_002',
        source: thickener.id,
        target: sink2.id,
        sourcePortKey: 'underflow',
      }),
    ]

    const stream = (tag: string, qm: number): StreamData => ({
      tag,
      Qm: qm,
      Qv: 0,
      QmSolid: 0,
      QmLiquid: qm,
      QmVapour: 0,
      T: 298.15,
      P: 101325,
      H: 0,
      rho: 1000,
      Cp: 4186,
      species: {},
      solidFraction: 0,
      liquidFraction: 1,
      vapourFraction: 0,
      sourceUnitTag: 'THKR_001',
      destUnitTag: '',
      solved: true,
      errors: [],
    })

    const mapped = mapStreamsToOutgoingEdges(
      {
        underflow: stream('underflow', 2),
        overflow: stream('overflow', 8),
      },
      edges,
      [thickener, sink1, sink2],
      'THKR_001',
    )

    expect(mapped.find((entry) => entry.edgeId === 'edge-overflow')?.stream.Qm).toBe(8)
    expect(mapped.find((entry) => entry.edgeId === 'edge-underflow')?.stream.Qm).toBe(2)
  })
})
