import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import type { Project, ReadinessReport, ReportConfig, SolverDiagnosticEvent, SolverUnitSummary } from '@/types'
import { tagRegistry } from '@/services/tagRegistry'
import { generateReport } from '@/services/reportGenerator'
import { buildReadinessReport } from '@/services/readinessReport'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExportConfig {
  project: Project
  reportConfig?: ReportConfig
  flowsheetId?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildStreamRows(project: Project): (string | number)[][] {
  const rows: (string | number)[][] = []
  for (const fs of project.flowsheets) {
    for (const edge of fs.edges) {
      const s = edge.stream
      if (!s) continue
      rows.push([
        edge.tag,
        fs.name,
        parseFloat((s.Qm * 3.6).toFixed(4)),
        parseFloat((s.T - 273.15).toFixed(4)),
        parseFloat((s.P / 1000).toFixed(4)),
        parseFloat((s.solidFraction * 100).toFixed(4)),
        parseFloat((s.liquidFraction * 100).toFixed(4)),
        parseFloat((s.vapourFraction * 100).toFixed(4)),
      ])
    }
  }
  return rows
}

function buildUnitRows(project: Project): (string | number)[][] {
  const rows: (string | number)[][] = []
  for (const fs of project.flowsheets) {
    for (const node of fs.nodes) {
      const keyVal = tagRegistry.resolveTagValue(`${node.tag}.T`, project)
      const keyStr = typeof keyVal === 'number' ? `${keyVal.toFixed(2)} °C` : '—'
      rows.push([node.tag, node.type, fs.name, node.enabled ? 'Enabled' : 'Disabled', keyStr])
    }
  }
  return rows
}

function buildBalanceRows(project: Project): (string | number | undefined)[][] {
  // Collect node types for boundary detection
  const nodeTypeByTag: Record<string, string> = {}
  for (const fs of project.flowsheets) {
    for (const n of fs.nodes) nodeTypeByTag[n.tag] = n.type
  }

  let totalIn = 0
  let totalOut = 0
  let hIn = 0
  let hOut = 0

  for (const fs of project.flowsheets) {
    for (const edge of fs.edges) {
      const s = edge.stream
      if (!s || !s.solved) continue
      if (nodeTypeByTag[s.sourceUnitTag] === 'Feeder') {
        totalIn += s.Qm * 3.6
        hIn += (s.H * s.Qm) / 1000
      }
      if (nodeTypeByTag[s.destUnitTag] === 'FeederSink') {
        totalOut += s.Qm * 3.6
        hOut += (s.H * s.Qm) / 1000
      }
    }
  }

  const massError = Math.abs(totalIn - totalOut) / Math.max(totalIn, 1e-10) * 100
  const netQ = hIn - hOut

  return [
    ['Global Mass Balance'],
    ['', 'Total In (t/h)', 'Total Out (t/h)', 'Error (%)'],
    ['', totalIn.toFixed(4), totalOut.toFixed(4), massError.toFixed(4)],
    [],
    ['Global Energy Balance'],
    ['', 'H_in (kW)', 'H_out (kW)', 'Net Q (kW)'],
    ['', hIn.toFixed(4), hOut.toFixed(4), netQ.toFixed(4)],
  ]
}

function applySheetStyle(ws: XLSX.WorkSheet, _dataRowCount: number): void {
  // Column widths — auto-fit based on header
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  const cols: XLSX.ColInfo[] = []
  for (let c = range.s.c; c <= range.e.c; c++) {
    let maxLen = 10
    for (let r = range.s.r; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (cell?.v != null) {
        maxLen = Math.max(maxLen, String(cell.v).length + 2)
      }
    }
    cols.push({ wch: Math.min(maxLen, 40) })
  }
  ws['!cols'] = cols

  // Cell styles: header row bold + blue, alternating data rows
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws[addr]
      if (!cell) continue
      if (r === 0) {
        cell.s = {
          fill: { fgColor: { rgb: '3B82F6' } },
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        }
      } else if (r % 2 === 0) {
        cell.s = {
          fill: { fgColor: { rgb: 'F3F4F6' } },
        }
      }
      if (typeof cell.v === 'number') {
        cell.z = '0.0000'
        if (!cell.s) cell.s = {}
        cell.s.alignment = { horizontal: 'right' }
      }
    }
  }
}

// ─── ExportService ────────────────────────────────────────────────────────────

class ExportService {
  async exportToExcel({ project, reportConfig }: ExportConfig): Promise<void> {
    const wb = XLSX.utils.book_new()

    // Sheet 1: Streams
    const streamRows = buildStreamRows(project)
    const ws1 = XLSX.utils.aoa_to_sheet([
      ['Tag', 'Flowsheet', 'Qm (t/h)', 'T (°C)', 'P (kPa)', '% Solid', '% Liquid', '% Vapour'],
      ...streamRows,
    ])
    applySheetStyle(ws1, streamRows.length)
    XLSX.utils.book_append_sheet(wb, ws1, 'Streams')

    // Sheet 2: Units
    const unitRows = buildUnitRows(project)
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['Tag', 'Type', 'Flowsheet', 'Status', 'Key Value'],
      ...unitRows,
    ])
    applySheetStyle(ws2, unitRows.length)
    XLSX.utils.book_append_sheet(wb, ws2, 'Units')

    // Sheet 3: Mass Balance
    const balRows = buildBalanceRows(project)
    const ws3 = XLSX.utils.aoa_to_sheet(balRows)
    XLSX.utils.book_append_sheet(wb, ws3, 'Balance')

    // Sheet 4+: Custom report sections
    if (reportConfig) {
      const data = generateReport(reportConfig, project)
      for (const section of data.sections) {
        const sheetRows = [
          ['Label', 'Value', 'Unit'],
          ...section.rows.map((r) => [r.label, r.value, r.unit]),
        ]
        const ws = XLSX.utils.aoa_to_sheet(sheetRows)
        applySheetStyle(ws, section.rows.length)
        XLSX.utils.book_append_sheet(wb, ws, section.name.slice(0, 31))
      }
    }

    // Write with cell styles
    const wbArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true })
    saveAs(
      new Blob([wbArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `${project.name}_Results.xlsx`,
    )
  }

  async exportToCSV(tagPaths: string[], project: Project): Promise<void> {
    const allDefs = tagRegistry.buildTagList(project)
    const units = tagPaths.map((t) => allDefs.find((d) => d.tagPath === t)?.unit ?? '')
    const values = tagPaths.map((t) => String(tagRegistry.resolveTagValue(t, project) ?? ''))
    const csv = [['Tag', ...tagPaths], ['Unit', ...units], ['Value', ...values]]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    saveAs(new Blob([csv], { type: 'text/csv' }), `${project.name}_Export.csv`)
  }

  async exportFlowsheetSVG(flowsheetId: string): Promise<void> {
    const rfContainer = document.querySelector('.react-flow') as HTMLElement | null
    if (!rfContainer) return
    const viewport = rfContainer.querySelector('.react-flow__viewport') as SVGElement | null
    if (!viewport) return

    const bounds = rfContainer.getBoundingClientRect()
    const svgNS = 'http://www.w3.org/2000/svg'
    const svgEl = document.createElementNS(svgNS, 'svg')
    svgEl.setAttribute('width', String(bounds.width))
    svgEl.setAttribute('height', String(bounds.height))
    svgEl.setAttribute('xmlns', svgNS)
    // Background rect
    const bg = document.createElementNS(svgNS, 'rect')
    bg.setAttribute('width', String(bounds.width))
    bg.setAttribute('height', String(bounds.height))
    bg.setAttribute('fill', '#F8F9FA')
    svgEl.appendChild(bg)
    svgEl.appendChild(viewport.cloneNode(true))

    const svgStr = new XMLSerializer().serializeToString(svgEl)
    saveAs(new Blob([svgStr], { type: 'image/svg+xml' }), `${flowsheetId}.svg`)
  }

  async exportFlowsheetPNG(flowsheetId: string): Promise<void> {
    const rfContainer = document.querySelector('.react-flow') as HTMLElement | null
    if (!rfContainer) return
    const viewport = rfContainer.querySelector('.react-flow__viewport') as SVGElement | null
    if (!viewport) return

    const bounds = rfContainer.getBoundingClientRect()
    const SCALE = 2

    const svgNS = 'http://www.w3.org/2000/svg'
    const svgEl = document.createElementNS(svgNS, 'svg')
    svgEl.setAttribute('width', String(bounds.width))
    svgEl.setAttribute('height', String(bounds.height))
    svgEl.setAttribute('xmlns', svgNS)
    const bg = document.createElementNS(svgNS, 'rect')
    bg.setAttribute('width', String(bounds.width))
    bg.setAttribute('height', String(bounds.height))
    bg.setAttribute('fill', '#F8F9FA')
    svgEl.appendChild(bg)
    svgEl.appendChild(viewport.cloneNode(true))
    const svgStr = new XMLSerializer().serializeToString(svgEl)

    const blob = await new Promise<Blob | null>((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = bounds.width * SCALE
        canvas.height = bounds.height * SCALE
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }
        ctx.fillStyle = '#F8F9FA'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.scale(SCALE, SCALE)
        ctx.drawImage(img, 0, 0)
        canvas.toBlob(resolve, 'image/png')
      }
      img.onerror = () => resolve(null)
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)))
    })

    if (blob) saveAs(blob, `${flowsheetId}.png`)
  }

  async exportSolveDiagnostics(
    project: Project,
    diagnostics: SolverDiagnosticEvent[],
    unitSummaries: SolverUnitSummary[] = [],
  ): Promise<void> {
    const readinessReport = buildReadinessReport(project)
    const payload = {
      project: {
        name: project.name,
        schemaVersion: project.schemaVersion,
        modifiedAt: project.modifiedAt,
        solveHistory: project.solveHistory,
        readinessReports: project.readinessReports,
      },
      exportedAt: new Date().toISOString(),
      readinessReport,
      diagnostics,
      unitSummaries,
    }
    saveAs(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      `${project.name}_SolveDiagnostics.json`,
    )
  }

  async exportReadinessReport(project: Project, report?: ReadinessReport): Promise<void> {
    const readinessReport = report ?? buildReadinessReport(project)
    const payload = {
      project: {
        name: project.name,
        schemaVersion: project.schemaVersion,
        modifiedAt: project.modifiedAt,
      },
      exportedAt: new Date().toISOString(),
      readinessReport,
    }

    saveAs(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      `${project.name}_SolveReadiness.json`,
    )
  }
}

export const exportService = new ExportService()
