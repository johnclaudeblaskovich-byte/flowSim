import type { Project, ReportConfig, ReportSection, ReportField } from '@/types'
import { tagRegistry } from '@/services/tagRegistry'

// ─── Output types ─────────────────────────────────────────────────────────────

export interface ReportRow {
  label: string
  value: string
  unit: string
}

export interface ReportSectionData {
  name: string
  rows: ReportRow[]
}

export interface ReportData {
  sections: ReportSectionData[]
}

// ─── Generator ────────────────────────────────────────────────────────────────

export function generateReport(config: ReportConfig, project: Project): ReportData {
  return {
    sections: config.sections.map((section) => ({
      name: section.name,
      rows: section.fields.map((field) => {
        const raw = tagRegistry.resolveTagValue(field.tagPath, project)
        let formatted = '—'
        if (typeof raw === 'number') {
          formatted = raw.toPrecision(4)
        } else if (typeof raw === 'boolean') {
          formatted = raw ? 'Yes' : 'No'
        } else if (typeof raw === 'string') {
          formatted = raw
        }
        return {
          label: field.displayName,
          value: formatted,
          unit: field.unit ?? '',
        }
      }),
    })),
  }
}

// ─── Pre-built templates ──────────────────────────────────────────────────────

export function templateMassBalance(project: Project): ReportConfig {
  const sections: ReportSection[] = project.flowsheets.map((fs) => ({
    id: crypto.randomUUID(),
    name: `${fs.name} — Mass Flows`,
    fields: fs.edges.flatMap((edge) => {
      const tagDefs = tagRegistry.getPipeTags(edge, project, fs.id, fs.name)
      const qmDef = tagDefs.find((d) => d.tagPath.endsWith('.Qm'))
      const solidDef = tagDefs.find((d) => d.tagPath.endsWith('.QmSolid'))
      const liquidDef = tagDefs.find((d) => d.tagPath.endsWith('.QmLiquid'))
      const vapourDef = tagDefs.find((d) => d.tagPath.endsWith('.QmVapour'))
      const fields: ReportField[] = []
      for (const def of [qmDef, solidDef, liquidDef, vapourDef]) {
        if (def) {
          fields.push({
            id: crypto.randomUUID(),
            tagPath: def.tagPath,
            displayName: `${edge.tag} — ${def.displayName}`,
            unit: def.unit,
          })
        }
      }
      return fields
    }),
  }))

  return {
    id: crypto.randomUUID(),
    name: 'Mass Balance Summary',
    sections,
    createdAt: new Date().toISOString(),
  }
}

export function templateStreamProperties(project: Project): ReportConfig {
  const fields: ReportField[] = []

  for (const fs of project.flowsheets) {
    for (const edge of fs.edges) {
      const tagDefs = tagRegistry.getPipeTags(edge, project, fs.id, fs.name)
      for (const def of tagDefs) {
        if (['Qm', 'T', 'P'].some((k) => def.tagPath.endsWith(`.${k}`))) {
          fields.push({
            id: crypto.randomUUID(),
            tagPath: def.tagPath,
            displayName: `${edge.tag} — ${def.displayName}`,
            unit: def.unit,
          })
        }
      }
    }
  }

  return {
    id: crypto.randomUUID(),
    name: 'Stream Properties',
    sections: [{ id: crypto.randomUUID(), name: 'Streams', fields }],
    createdAt: new Date().toISOString(),
  }
}

export function templateUnitSummary(project: Project): ReportConfig {
  const fields: ReportField[] = []

  for (const fs of project.flowsheets) {
    for (const node of fs.nodes) {
      const tagDefs = tagRegistry.getUnitTags(node, fs.id, fs.name)
      for (const def of tagDefs) {
        fields.push({
          id: crypto.randomUUID(),
          tagPath: def.tagPath,
          displayName: `${node.tag} — ${def.displayName}`,
          unit: def.unit,
        })
      }
    }
  }

  return {
    id: crypto.randomUUID(),
    name: 'Unit Operation Summary',
    sections: [{ id: crypto.randomUUID(), name: 'Units', fields }],
    createdAt: new Date().toISOString(),
  }
}
