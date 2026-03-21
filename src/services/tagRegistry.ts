import type { Project, UnitNode, PipeEdge } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TagDefinition {
  tagPath: string      // e.g. "TK_001.T"
  displayName: string  // e.g. "Temperature"
  unit?: string        // e.g. "°C"
  valueType: 'number' | 'string' | 'boolean'
  flowsheetId: string
  flowsheetName: string
  parentTag: string    // "TK_001" or "P_001"
  parentType: string   // "Feeder" | "Pipe" | etc.
  category: string     // "Properties" | "Species" | "Status"
}

// ─── Stream field metadata ─────────────────────────────────────────────────────

const STREAM_FIELDS: { key: string; name: string; unit: string }[] = [
  { key: 'Qm',         name: 'Mass Flow',         unit: 'kg/s' },
  { key: 'Qv',         name: 'Volumetric Flow',    unit: 'm³/s' },
  { key: 'T',          name: 'Temperature',        unit: 'K' },
  { key: 'P',          name: 'Pressure',           unit: 'Pa' },
  { key: 'H',          name: 'Specific Enthalpy',  unit: 'J/kg' },
  { key: 'rho',        name: 'Density',            unit: 'kg/m³' },
  { key: 'QmSolid',    name: 'Solid Flow',         unit: 'kg/s' },
  { key: 'QmLiquid',   name: 'Liquid Flow',        unit: 'kg/s' },
  { key: 'QmVapour',   name: 'Vapour Flow',        unit: 'kg/s' },
]

// ─── TagRegistry ──────────────────────────────────────────────────────────────

export class TagRegistry {
  buildTagList(project: Project): TagDefinition[] {
    const defs: TagDefinition[] = []
    for (const fs of project.flowsheets) {
      for (const node of fs.nodes) {
        defs.push(...this.getUnitTags(node, fs.id, fs.name))
      }
      for (const edge of fs.edges) {
        defs.push(...this.getPipeTags(edge, project, fs.id, fs.name))
      }
    }
    return defs
  }

  getUnitTags(unit: UnitNode, fsId: string, fsName: string): TagDefinition[] {
    const base = { flowsheetId: fsId, flowsheetName: fsName, parentTag: unit.tag, parentType: unit.type }
    return [
      {
        ...base,
        tagPath: `${unit.tag}.On`,
        displayName: 'Enabled',
        valueType: 'boolean',
        category: 'Status',
      },
      {
        ...base,
        tagPath: `${unit.tag}.T`,
        displayName: 'Temperature',
        unit: 'K',
        valueType: 'number',
        category: 'Properties',
      },
      {
        ...base,
        tagPath: `${unit.tag}.P`,
        displayName: 'Pressure',
        unit: 'Pa',
        valueType: 'number',
        category: 'Properties',
      },
    ]
  }

  getPipeTags(pipe: PipeEdge, project: Project, fsId: string, fsName: string): TagDefinition[] {
    const base = { flowsheetId: fsId, flowsheetName: fsName, parentTag: pipe.tag, parentType: 'Pipe' }
    const defs: TagDefinition[] = []

    // Standard stream fields
    for (const f of STREAM_FIELDS) {
      defs.push({
        ...base,
        tagPath: `${pipe.tag}.${f.key}`,
        displayName: f.name,
        unit: f.unit,
        valueType: 'number',
        category: 'Properties',
      })
    }

    // Per-species tags
    for (const speciesId of project.selectedSpecies) {
      defs.push(
        {
          ...base,
          tagPath: `${pipe.tag}.Sp.${speciesId}.MassFlow`,
          displayName: `${speciesId} Mass Flow`,
          unit: 'kg/s',
          valueType: 'number',
          category: 'Species',
        },
        {
          ...base,
          tagPath: `${pipe.tag}.Sp.${speciesId}.MassFraction`,
          displayName: `${speciesId} Mass Fraction`,
          valueType: 'number',
          category: 'Species',
        },
      )
    }

    return defs
  }

  resolveTagValue(tagPath: string, project: Project): number | string | boolean | null {
    const parts = tagPath.split('.')
    if (parts.length < 2) return null
    const [parentTag, field, ...rest] = parts

    for (const fs of project.flowsheets) {
      // Check edges (pipes/streams)
      for (const edge of fs.edges) {
        if (edge.tag !== parentTag) continue
        const s = edge.stream
        if (!s) return null

        if (field === 'Sp' && rest.length >= 2) {
          const [speciesId, speciesField] = rest
          const sp = s.species[speciesId]
          if (!sp) return null
          if (speciesField === 'MassFlow') return sp.massFlow
          if (speciesField === 'MassFraction') return sp.massFraction
          if (speciesField === 'MoleFlow') return sp.moleFlow
          if (speciesField === 'MoleFraction') return sp.moleFraction
          return null
        }

        // Direct stream fields
        const streamVal = (s as unknown as Record<string, unknown>)[field]
        if (typeof streamVal === 'number') return streamVal
        if (typeof streamVal === 'string') return streamVal
        if (typeof streamVal === 'boolean') return streamVal
        return null
      }

      // Check units
      for (const node of fs.nodes) {
        if (node.tag !== parentTag) continue
        if (field === 'On') return node.enabled
        // Unit-level T/P not stored on node directly — return null until solver populates config
        const cfgVal = (node.config as Record<string, unknown>)[field]
        if (typeof cfgVal === 'number') return cfgVal
        if (typeof cfgVal === 'string') return cfgVal
        if (typeof cfgVal === 'boolean') return cfgVal
        return null
      }
    }

    return null
  }
}

export const tagRegistry = new TagRegistry()
