import type { Project, UnitModelType, UnitNode } from '@/types'
import { MULTI_OUTPUT_UNIT_ROUTES } from '@/lib/routing'

export interface ValidationError {
  unitTag: string
  nodeId: string
  flowsheetId: string
  edgeId?: string
  edgeTag?: string
  msg: string
}

export interface ValidationWarning {
  unitTag: string
  nodeId: string
  flowsheetId: string
  edgeId?: string
  edgeTag?: string
  msg: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

const NO_STREAM_UNITS = new Set<UnitModelType>([
  'GeneralController',
  'PIDController',
  'SetTagController',
  'MakeupSource',
])

function getAllNodes(project: Project): Array<{ node: UnitNode; flowsheetId: string }> {
  return project.flowsheets.flatMap((fs) => fs.nodes.map((node) => ({ node, flowsheetId: fs.id })))
}

export function validateProject(project: Project): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  if (!project.flowsheets || project.flowsheets.length === 0) {
    errors.push({
      unitTag: '',
      nodeId: '',
      flowsheetId: '',
      msg: 'No flowsheets defined. Add at least one flowsheet.',
    })
    return { valid: false, errors, warnings }
  }

  if (!project.selectedSpecies || project.selectedSpecies.length === 0) {
    errors.push({
      unitTag: '',
      nodeId: '',
      flowsheetId: '',
      msg: 'No species selected. Add species via File > New Project wizard.',
    })
  }

  const tagSeen = new Map<string, { nodeId: string; flowsheetId: string }>()
  for (const { node, flowsheetId } of getAllNodes(project)) {
    const prev = tagSeen.get(node.tag)
    if (prev) {
      errors.push({
        unitTag: node.tag,
        nodeId: node.id,
        flowsheetId,
        msg: `Duplicate tag "${node.tag}" is also used in another unit.`,
      })
    } else {
      tagSeen.set(node.tag, { nodeId: node.id, flowsheetId })
    }
  }

  for (const { node, flowsheetId } of getAllNodes(project)) {
    if (node.type !== 'Feeder') continue

    const fracs = node.config as Record<string, unknown>
    const specFracs = fracs.species as Record<string, number> | undefined
    if (specFracs && Object.keys(specFracs).length > 0) {
      const sum = Object.values(specFracs).reduce((acc, value) => acc + (value ?? 0), 0)
      if (Math.abs(sum - 1.0) > 1e-4) {
        errors.push({
          unitTag: node.tag,
          nodeId: node.id,
          flowsheetId,
          msg: `Species fractions sum to ${sum.toFixed(6)}, but must equal 1.0.`,
        })
      }
    } else {
      warnings.push({
        unitTag: node.tag,
        nodeId: node.id,
        flowsheetId,
        msg: 'Feeder has no explicit component composition. Default fallback composition will be used.',
      })
    }
  }

  for (const fs of project.flowsheets) {
    const nodeById = new Map(fs.nodes.map((node) => [node.id, node]))
    const connectedNodeIds = new Set<string>()

    for (const edge of fs.edges) {
      const sourceNode = nodeById.get(edge.source)
      const targetNode = nodeById.get(edge.target)

      if (!sourceNode || !targetNode) {
        errors.push({
          unitTag: sourceNode?.tag ?? targetNode?.tag ?? '',
          nodeId: '',
          flowsheetId: fs.id,
          edgeId: edge.id,
          edgeTag: edge.tag,
          msg: `Stream "${edge.tag}" is connected to a missing unit. Delete and recreate the connection.`,
        })
        continue
      }

      connectedNodeIds.add(edge.source)
      connectedNodeIds.add(edge.target)
    }

    for (const node of fs.nodes) {
      const incomingEdges = fs.edges.filter((edge) => edge.target === node.id)
      const outgoingEdges = fs.edges.filter((edge) => edge.source === node.id)

      if (!connectedNodeIds.has(node.id)) {
        warnings.push({
          unitTag: node.tag,
          nodeId: node.id,
          flowsheetId: fs.id,
          msg: `Unit "${node.tag}" has no connections.`,
        })
      }

      if (!node.enabled || NO_STREAM_UNITS.has(node.type)) continue

      if (node.type === 'Feeder') {
        if (outgoingEdges.length === 0) {
          warnings.push({
            unitTag: node.tag,
            nodeId: node.id,
            flowsheetId: fs.id,
            msg: `Feeder "${node.tag}" is not connected to any downstream unit.`,
          })
        }
        continue
      }

      if (node.type === 'FeederSink') {
        if (incomingEdges.length === 0) {
          warnings.push({
            unitTag: node.tag,
            nodeId: node.id,
            flowsheetId: fs.id,
            msg: `Sink "${node.tag}" is not receiving any inlet stream.`,
          })
        }
        continue
      }

      if (incomingEdges.length === 0) {
        errors.push({
          unitTag: node.tag,
          nodeId: node.id,
          flowsheetId: fs.id,
          msg: `Unit "${node.tag}" has no inlet stream connected.`,
        })
      }

      if (outgoingEdges.length === 0) {
        errors.push({
          unitTag: node.tag,
          nodeId: node.id,
          flowsheetId: fs.id,
          msg: `Unit "${node.tag}" has no outlet stream connected.`,
        })
      }
    }
  }

  for (const fs of project.flowsheets) {
    for (const node of fs.nodes) {
      const expectedRoutes = MULTI_OUTPUT_UNIT_ROUTES[node.type]
      if (!expectedRoutes) continue

      const outgoingEdges = fs.edges.filter((edge) => edge.source === node.id)
      if (outgoingEdges.length <= 1) continue

      if (outgoingEdges.length > expectedRoutes.length) {
        errors.push({
          unitTag: node.tag,
          nodeId: node.id,
          flowsheetId: fs.id,
          msg: `Unit "${node.tag}" has ${outgoingEdges.length} outlet streams but only ${expectedRoutes.length} supported route(s): ${expectedRoutes.join(', ')}.`,
        })
      }

      const assignedRoutes = outgoingEdges.map((edge) => edge.sourcePortKey).filter(Boolean) as string[]

      for (const edge of outgoingEdges) {
        if (!edge.sourcePortKey) {
          warnings.push({
            unitTag: node.tag,
            nodeId: node.id,
            flowsheetId: fs.id,
            edgeId: edge.id,
            edgeTag: edge.tag,
            msg: `Stream "${edge.tag}" is missing an explicit output routing assignment from "${node.tag}".`,
          })
        }
      }

      for (const edge of outgoingEdges) {
        if (!edge.sourcePortKey) continue
        if (!expectedRoutes.includes(edge.sourcePortKey)) {
          errors.push({
            unitTag: node.tag,
            nodeId: node.id,
            flowsheetId: fs.id,
            edgeId: edge.id,
            edgeTag: edge.tag,
            msg: `Stream "${edge.tag}" uses unknown output route "${edge.sourcePortKey}". Expected one of: ${expectedRoutes.join(', ')}.`,
          })
        }
      }

      const routeCounts = new Map<string, number>()
      for (const route of assignedRoutes) {
        routeCounts.set(route, (routeCounts.get(route) ?? 0) + 1)
      }
      for (const edge of outgoingEdges) {
        if (!edge.sourcePortKey) continue
        if ((routeCounts.get(edge.sourcePortKey) ?? 0) > 1) {
          warnings.push({
            unitTag: node.tag,
            nodeId: node.id,
            flowsheetId: fs.id,
            edgeId: edge.id,
            edgeTag: edge.tag,
            msg: `Stream "${edge.tag}" duplicates output route "${edge.sourcePortKey}" on unit "${node.tag}". Downstream results may be ambiguous.`,
          })
        }
      }

      if (outgoingEdges.length === expectedRoutes.length) {
        const missingRoutes = expectedRoutes.filter((route) => !assignedRoutes.includes(route))
        if (missingRoutes.length > 0) {
          warnings.push({
            unitTag: node.tag,
            nodeId: node.id,
            flowsheetId: fs.id,
            msg: `Unit "${node.tag}" is missing explicit assignment for output route(s): ${missingRoutes.join(', ')}.`,
          })
        }
      }
    }
  }

  const NON_NEGATIVE_KEYS = ['solidRecovery', 'moistureContent', 'washEfficiency', 'cutSize', 'efficiency']
  for (const { node, flowsheetId } of getAllNodes(project)) {
    const cfg = node.config as Record<string, unknown>
    for (const key of NON_NEGATIVE_KEYS) {
      const value = cfg[key]
      if (typeof value === 'number' && value < 0) {
        warnings.push({
          unitTag: node.tag,
          nodeId: node.id,
          flowsheetId,
          msg: `Config "${key}" = ${value} is negative, which may cause solver errors.`,
        })
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
