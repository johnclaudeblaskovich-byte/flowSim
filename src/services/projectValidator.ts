// ─── Project Validator ────────────────────────────────────────────────────────
// Runs pre-solve checks on the project and returns errors + warnings.
// Errors block solving; warnings allow "Solve Anyway".

import type { Project, UnitNode } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidationError {
  unitTag: string
  nodeId: string
  flowsheetId: string
  msg: string
}

export interface ValidationWarning {
  unitTag: string
  nodeId: string
  flowsheetId: string
  msg: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAllNodes(project: Project): Array<{ node: UnitNode; flowsheetId: string }> {
  return project.flowsheets.flatMap((fs) =>
    fs.nodes.map((node) => ({ node, flowsheetId: fs.id })),
  )
}

// ─── Validator ────────────────────────────────────────────────────────────────

export function validateProject(project: Project): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  // 1. Must have at least one flowsheet
  if (!project.flowsheets || project.flowsheets.length === 0) {
    errors.push({
      unitTag: '',
      nodeId: '',
      flowsheetId: '',
      msg: 'No flowsheets defined. Add at least one flowsheet.',
    })
    return { valid: false, errors, warnings }
  }

  // 2. Must have species selected
  if (!project.selectedSpecies || project.selectedSpecies.length === 0) {
    errors.push({
      unitTag: '',
      nodeId: '',
      flowsheetId: '',
      msg: 'No species selected. Add species via File → New Project wizard.',
    })
  }

  // 3. Duplicate tags across all flowsheets
  const tagSeen = new Map<string, { nodeId: string; flowsheetId: string }>()
  for (const { node, flowsheetId } of getAllNodes(project)) {
    const prev = tagSeen.get(node.tag)
    if (prev) {
      errors.push({
        unitTag: node.tag,
        nodeId: node.id,
        flowsheetId,
        msg: `Duplicate tag "${node.tag}" — also used in another unit.`,
      })
    } else {
      tagSeen.set(node.tag, { nodeId: node.id, flowsheetId })
    }
  }

  // 4. Feeder species fractions
  for (const { node, flowsheetId } of getAllNodes(project)) {
    if (node.type === 'Feeder') {
      const fracs = node.config as Record<string, unknown>
      const specFracs = fracs['speciesFractions'] as Record<string, number> | undefined
      if (specFracs && Object.keys(specFracs).length > 0) {
        const sum = Object.values(specFracs).reduce((acc, v) => acc + (v ?? 0), 0)
        if (Math.abs(sum - 1.0) > 1e-4) {
          errors.push({
            unitTag: node.tag,
            nodeId: node.id,
            flowsheetId,
            msg: `Species fractions sum to ${sum.toFixed(6)}, must equal 1.0.`,
          })
        }
      }
    }
  }

  // 5. Disconnected units (islands) — warning
  for (const fs of project.flowsheets) {
    const connectedNodeIds = new Set<string>()
    for (const edge of fs.edges) {
      connectedNodeIds.add(edge.source)
      connectedNodeIds.add(edge.target)
    }
    for (const node of fs.nodes) {
      if (!connectedNodeIds.has(node.id)) {
        warnings.push({
          unitTag: node.tag,
          nodeId: node.id,
          flowsheetId: fs.id,
          msg: `Unit "${node.tag}" has no connections (disconnected island).`,
        })
      }
    }
  }

  // 6. Negative numeric config values where non-negative is expected — warning
  const NON_NEGATIVE_KEYS = ['solidRecovery', 'moistureContent', 'washEfficiency', 'cutSize', 'efficiency']
  for (const { node, flowsheetId } of getAllNodes(project)) {
    const cfg = node.config as Record<string, unknown>
    for (const key of NON_NEGATIVE_KEYS) {
      const val = cfg[key]
      if (typeof val === 'number' && val < 0) {
        warnings.push({
          unitTag: node.tag,
          nodeId: node.id,
          flowsheetId,
          msg: `Config "${key}" = ${val} is negative, which may cause solver errors.`,
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
