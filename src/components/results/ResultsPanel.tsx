import { useState, useRef, useCallback } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { ChevronDown, ChevronUp, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useProjectStore, useCanvasStore, useSolverStore, useUIStore } from '@/store'
import { tagRegistry } from '@/services/tagRegistry'
import { cn } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 2): string {
  return n.toFixed(dec)
}

function StatusBadge({ status }: { status: string | undefined }) {
  const map: Record<string, { label: string; cls: string }> = {
    converged: { label: 'OK', cls: 'bg-green-100 text-green-700' },
    warning: { label: 'Warn', cls: 'bg-amber-100 text-amber-700' },
    error: { label: 'Error', cls: 'bg-red-100 text-red-700' },
    solving: { label: 'Solving', cls: 'bg-blue-100 text-blue-700' },
    disabled: { label: 'Off', cls: 'bg-gray-100 text-gray-500' },
  }
  const entry = map[status ?? ''] ?? { label: '—', cls: 'bg-gray-100 text-gray-400' }
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', entry.cls)}>
      {entry.label}
    </span>
  )
}

// ─── Streams Tab ──────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc'

function StreamsTab() {
  const project = useProjectStore((s) => s.project)
  const [query, setQuery] = useState('')
  const [sortCol, setSortCol] = useState('tag')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Collect all solved edges across all flowsheets
  const rows = project.flowsheets.flatMap((fs) =>
    fs.edges
      .filter((e) => e.stream)
      .map((e) => ({
        edgeId: e.id,
        fsId: fs.id,
        fsName: fs.name,
        tag: e.stream!.tag || e.tag,
        Qm: e.stream!.Qm * 3.6,
        T: e.stream!.T - 273.15,
        P: e.stream!.P / 1000,
        pctSolid: e.stream!.solidFraction * 100,
        pctLiquid: e.stream!.liquidFraction * 100,
        pctVapour: e.stream!.vapourFraction * 100,
        zeroFlow: e.stream!.Qm === 0,
      })),
  )

  const filtered = rows.filter(
    (r) =>
      r.tag.toLowerCase().includes(query.toLowerCase()) ||
      r.fsName.toLowerCase().includes(query.toLowerCase()),
  )

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortCol as keyof typeof a] as string | number
    const bv = b[sortCol as keyof typeof b] as string | number
    const cmp = typeof av === 'string' ? av.localeCompare(String(bv)) : (av as number) - (bv as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('asc') }
  }

  function handleRowClick(row: { edgeId: string; fsId: string }) {
    useCanvasStore.getState().setActiveFlowsheetId(row.fsId)
    useCanvasStore.getState().setSelectedEdgeId(row.edgeId)
  }

  const TH = ({ col, label }: { col: string; label: string }) => (
    <th
      className="px-2 py-1 text-left text-xs font-semibold text-gray-500 cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
      onClick={() => toggleSort(col)}
    >
      {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-2 py-1 flex-none border-b border-gray-100">
        <input
          className="w-full text-xs border border-gray-200 rounded px-2 py-0.5 outline-none focus:border-blue-400"
          placeholder="Filter by tag or flowsheet…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
            <tr>
              <TH col="tag" label="Tag" />
              <TH col="fsName" label="Flowsheet" />
              <TH col="Qm" label="Qm [t/h]" />
              <TH col="T" label="T [°C]" />
              <TH col="P" label="P [kPa]" />
              <TH col="pctSolid" label="% Solid" />
              <TH col="pctLiquid" label="% Liquid" />
              <TH col="pctVapour" label="% Vapour" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-4 text-center text-gray-400">
                  No stream data. Run the solver first.
                </td>
              </tr>
            )}
            {sorted.map((r) => (
              <tr
                key={r.edgeId}
                className={cn(
                  'cursor-pointer border-b border-gray-50 hover:bg-blue-50 transition-colors',
                  r.zeroFlow ? 'text-gray-400' : 'text-gray-700',
                )}
                onClick={() => handleRowClick(r)}
              >
                <td className="px-2 py-0.5 font-mono">{r.tag}</td>
                <td className="px-2 py-0.5">{r.fsName}</td>
                <td className="px-2 py-0.5 text-right">{fmt(r.Qm)}</td>
                <td className="px-2 py-0.5 text-right">{fmt(r.T)}</td>
                <td className="px-2 py-0.5 text-right">{fmt(r.P)}</td>
                <td className="px-2 py-0.5 text-right">{fmt(r.pctSolid)}</td>
                <td className="px-2 py-0.5 text-right">{fmt(r.pctLiquid)}</td>
                <td className="px-2 py-0.5 text-right">{fmt(r.pctVapour)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Units Tab ────────────────────────────────────────────────────────────────

const THERMAL_TYPES = new Set(['HeatExchanger', 'Cooler', 'Heater', 'FlashTank', 'FlashTank2'])
const FLOW_TYPES = new Set(['Feeder', 'Pipe', 'Pump', 'Valve'])

function UnitsTab() {
  const project = useProjectStore((s) => s.project)
  const unitStatuses = useSolverStore((s) => s.solverState.unitStatuses)
  const [query, setQuery] = useState('')
  const [sortCol, setSortCol] = useState('tag')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const rows = project.flowsheets.flatMap((fs) =>
    fs.nodes.map((node) => {
      const status = unitStatuses[node.tag]
      let keyVal = '—'
      if (THERMAL_TYPES.has(node.type)) {
        const v = tagRegistry.resolveTagValue(`${node.tag}.T`, project)
        if (typeof v === 'number') keyVal = `${v.toFixed(2)} °C`
      } else if (FLOW_TYPES.has(node.type)) {
        const v = tagRegistry.resolveTagValue(`${node.tag}.Qm`, project)
        if (typeof v === 'number') keyVal = `${(v * 3.6).toFixed(2)} t/h`
      }
      return { nodeId: node.id, fsId: fs.id, tag: node.tag, type: node.type, fsName: fs.name, status, keyVal }
    }),
  )

  const filtered = rows.filter(
    (r) =>
      r.tag.toLowerCase().includes(query.toLowerCase()) ||
      r.type.toLowerCase().includes(query.toLowerCase()) ||
      r.fsName.toLowerCase().includes(query.toLowerCase()),
  )

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortCol as keyof typeof a] as string
    const bv = b[sortCol as keyof typeof b] as string
    const cmp = String(av).localeCompare(String(bv))
    return sortDir === 'asc' ? cmp : -cmp
  })

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('asc') }
  }

  function handleRowClick(row: { nodeId: string; fsId: string }) {
    useCanvasStore.getState().setActiveFlowsheetId(row.fsId)
    useCanvasStore.getState().setSelectedNodeId(row.nodeId)
    useUIStore.getState().setAccessWindowUnitId(row.nodeId)
    useUIStore.getState().setRightPanelOpen(true)
  }

  const TH = ({ col, label }: { col: string; label: string }) => (
    <th
      className="px-2 py-1 text-left text-xs font-semibold text-gray-500 cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
      onClick={() => toggleSort(col)}
    >
      {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-2 py-1 flex-none border-b border-gray-100">
        <input
          className="w-full text-xs border border-gray-200 rounded px-2 py-0.5 outline-none focus:border-blue-400"
          placeholder="Filter by tag, type, or flowsheet…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
            <tr>
              <TH col="tag" label="Tag" />
              <TH col="type" label="Type" />
              <TH col="fsName" label="Flowsheet" />
              <TH col="status" label="Status" />
              <TH col="keyVal" label="Key Value" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-2 py-4 text-center text-gray-400">
                  No units in project.
                </td>
              </tr>
            )}
            {sorted.map((r) => (
              <tr
                key={r.nodeId}
                className="cursor-pointer border-b border-gray-50 hover:bg-blue-50 transition-colors text-gray-700"
                onClick={() => handleRowClick(r)}
              >
                <td className="px-2 py-0.5 font-mono">{r.tag}</td>
                <td className="px-2 py-0.5">{r.type}</td>
                <td className="px-2 py-0.5">{r.fsName}</td>
                <td className="px-2 py-0.5">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-2 py-0.5 text-right">{r.keyVal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Balance Tab ──────────────────────────────────────────────────────────────

function BalanceTab() {
  const project = useProjectStore((s) => s.project)
  const status = useSolverStore((s) => s.solverState.status)
  const [expandedSpecies, setExpandedSpecies] = useState(false)

  if (status !== 'converged') {
    return (
      <div className="p-4 text-xs text-gray-400">Run solver to see balance results.</div>
    )
  }

  // Build node-type lookup
  const nodeTypeByTag: Record<string, string> = {}
  for (const fs of project.flowsheets) {
    for (const n of fs.nodes) nodeTypeByTag[n.tag] = n.type
  }

  let massIn = 0, massOut = 0, hIn = 0, hOut = 0
  const speciesIn: Record<string, number> = {}
  const speciesOut: Record<string, number> = {}

  for (const fs of project.flowsheets) {
    for (const edge of fs.edges) {
      const s = edge.stream
      if (!s || !s.solved) continue
      const isFeeder = nodeTypeByTag[s.sourceUnitTag] === 'Feeder'
      const isSink = nodeTypeByTag[s.destUnitTag] === 'FeederSink'
      if (isFeeder) {
        massIn += s.Qm * 3.6
        hIn += (s.H * s.Qm) / 1000
        for (const [id, sp] of Object.entries(s.species)) {
          speciesIn[id] = (speciesIn[id] ?? 0) + sp.massFlow * 3.6
        }
      }
      if (isSink) {
        massOut += s.Qm * 3.6
        hOut += (s.H * s.Qm) / 1000
        for (const [id, sp] of Object.entries(s.species)) {
          speciesOut[id] = (speciesOut[id] ?? 0) + sp.massFlow * 3.6
        }
      }
    }
  }

  const massError = Math.abs(massIn - massOut) / Math.max(massIn, 1e-10) * 100
  const netQ = hIn - hOut
  const errCls = (e: number) => (e > 0.01 ? 'text-red-600 font-semibold' : 'text-gray-700')

  return (
    <div className="p-3 overflow-auto flex-1 flex flex-col gap-3">
      {/* Mass balance card */}
      <div className="border border-gray-200 rounded p-3 text-xs">
        <h3 className="font-semibold text-gray-700 mb-2">Global Mass Balance</h3>
        <table className="w-full text-right">
          <thead>
            <tr className="text-gray-500 border-b border-gray-100">
              <th className="text-left pb-1">Metric</th>
              <th className="pb-1">Total In [t/h]</th>
              <th className="pb-1">Total Out [t/h]</th>
              <th className="pb-1">Error [%]</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-left py-0.5 text-gray-600">Mass</td>
              <td className="py-0.5">{fmt(massIn, 4)}</td>
              <td className="py-0.5">{fmt(massOut, 4)}</td>
              <td className={cn('py-0.5', errCls(massError))}>{fmt(massError, 4)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Energy balance card */}
      <div className="border border-gray-200 rounded p-3 text-xs">
        <h3 className="font-semibold text-gray-700 mb-2">Global Energy Balance</h3>
        <table className="w-full text-right">
          <thead>
            <tr className="text-gray-500 border-b border-gray-100">
              <th className="text-left pb-1">Metric</th>
              <th className="pb-1">H_in [kW]</th>
              <th className="pb-1">H_out [kW]</th>
              <th className="pb-1">Net Q [kW]</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-left py-0.5 text-gray-600">Enthalpy</td>
              <td className="py-0.5">{fmt(hIn, 2)}</td>
              <td className="py-0.5">{fmt(hOut, 2)}</td>
              <td className="py-0.5">{fmt(netQ, 2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Species accordion */}
      {project.selectedSpecies.length > 0 && (
        <div className="border border-gray-200 rounded text-xs">
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-left font-semibold text-gray-700 hover:bg-gray-50"
            onClick={() => setExpandedSpecies((e) => !e)}
          >
            <span>Per-Species Balance</span>
            {expandedSpecies ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {expandedSpecies && (
            <div className="border-t border-gray-100">
              <table className="w-full text-right">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-2 py-1">Species</th>
                    <th className="px-2 py-1">In [t/h]</th>
                    <th className="px-2 py-1">Out [t/h]</th>
                    <th className="px-2 py-1">Error [%]</th>
                  </tr>
                </thead>
                <tbody>
                  {project.selectedSpecies.map((spId) => {
                    const sIn = speciesIn[spId] ?? 0
                    const sOut = speciesOut[spId] ?? 0
                    const sErr = Math.abs(sIn - sOut) / Math.max(sIn, 1e-10) * 100
                    return (
                      <tr key={spId} className="border-b border-gray-50">
                        <td className="text-left px-2 py-0.5 font-mono text-gray-600">{spId}</td>
                        <td className="px-2 py-0.5">{fmt(sIn, 4)}</td>
                        <td className="px-2 py-0.5">{fmt(sOut, 4)}</td>
                        <td className={cn('px-2 py-0.5', errCls(sErr))}>{fmt(sErr, 4)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Audit Tab ────────────────────────────────────────────────────────────────

function AuditTab() {
  const project = useProjectStore((s) => s.project)
  const auditErrors = useSolverStore((s) => s.solverState.auditErrors)
  const clearAudit = useSolverStore((s) => s.clearAudit)

  function handleRowClick(unitTag: string) {
    // Find node by tag across all flowsheets
    for (const fs of project.flowsheets) {
      const node = fs.nodes.find((n) => n.tag === unitTag)
      if (node) {
        useCanvasStore.getState().setActiveFlowsheetId(fs.id)
        useCanvasStore.getState().setSelectedNodeId(node.id)
        break
      }
    }
  }

  const severityRow: Record<string, string> = {
    error: 'bg-red-50',
    warning: 'bg-amber-50',
    info: 'bg-gray-50',
  }

  const SeverityIcon = ({ sev }: { sev: string }) => {
    if (sev === 'error') return <AlertCircle size={12} className="text-red-500 flex-none" />
    if (sev === 'warning') return <AlertTriangle size={12} className="text-amber-500 flex-none" />
    return <Info size={12} className="text-gray-400 flex-none" />
  }

  if (auditErrors.length === 0) {
    return (
      <div className="p-4 flex items-center gap-2 text-xs text-green-600">
        <span>✓</span> No issues
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-2 py-1 flex-none border-b border-gray-100 flex justify-end">
        <button
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors"
          onClick={clearAudit}
        >
          <X size={10} /> Clear
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
            <tr>
              <th className="px-2 py-1 text-left text-xs font-semibold text-gray-500 w-6"></th>
              <th className="px-2 py-1 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Unit/Stream</th>
              <th className="px-2 py-1 text-left text-xs font-semibold text-gray-500">Message</th>
            </tr>
          </thead>
          <tbody>
            {auditErrors.map((entry) => (
              <tr
                key={entry.id}
                className={cn(
                  'cursor-pointer border-b border-gray-100 hover:opacity-80 transition-opacity',
                  severityRow[entry.severity] ?? '',
                )}
                onClick={() => handleRowClick(entry.unitTag)}
              >
                <td className="px-2 py-0.5">
                  <SeverityIcon sev={entry.severity} />
                </td>
                <td className="px-2 py-0.5 font-mono whitespace-nowrap">{entry.unitTag}</td>
                <td className="px-2 py-0.5 text-gray-600">{entry.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── ResultsPanel ─────────────────────────────────────────────────────────────

export function ResultsPanel() {
  const [panelHeight, setPanelHeight] = useState(240)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start resize on the handle area when not toggling collapse
    dragRef.current = { startY: e.clientY, startH: panelHeight }
    e.preventDefault()

    function onMouseMove(ev: MouseEvent) {
      if (!dragRef.current) return
      const delta = dragRef.current.startY - ev.clientY
      const newH = Math.min(
        Math.max(dragRef.current.startH + delta, 160),
        Math.floor(window.innerHeight * 0.5),
      )
      setPanelHeight(newH)
    }

    function onMouseUp() {
      dragRef.current = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [panelHeight])

  const effectiveHeight = isCollapsed ? 24 : panelHeight

  return (
    <div
      className="flex-none border-t border-gray-200 bg-white flex flex-col overflow-hidden"
      style={{ height: effectiveHeight }}
    >
      {/* Resize / collapse handle */}
      <div
        className="h-6 flex-none bg-gray-100 border-b border-gray-200 flex items-center justify-between px-3 select-none"
        onMouseDown={handleResizeMouseDown}
        style={{ cursor: isCollapsed ? 'default' : 'ns-resize' }}
      >
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Results</span>
        <button
          className="text-gray-400 hover:text-gray-600 transition-colors"
          onClick={(e) => { e.stopPropagation(); setIsCollapsed((c) => !c) }}
          title={isCollapsed ? 'Expand results' : 'Collapse results'}
        >
          {isCollapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Tabs (hidden when collapsed) */}
      {!isCollapsed && (
        <Tabs.Root defaultValue="streams" className="flex flex-col flex-1 overflow-hidden">
          <Tabs.List className="flex-none flex border-b border-gray-200 bg-white px-2 gap-0">
            {(['streams', 'units', 'balance', 'audit'] as const).map((tab) => (
              <Tabs.Trigger
                key={tab}
                value={tab}
                className="px-3 py-1.5 text-xs font-medium text-gray-500 border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 hover:text-gray-700 capitalize transition-colors"
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <Tabs.Content value="streams" className="flex-1 overflow-hidden flex flex-col">
            <StreamsTab />
          </Tabs.Content>
          <Tabs.Content value="units" className="flex-1 overflow-hidden flex flex-col">
            <UnitsTab />
          </Tabs.Content>
          <Tabs.Content value="balance" className="flex-1 overflow-auto">
            <BalanceTab />
          </Tabs.Content>
          <Tabs.Content value="audit" className="flex-1 overflow-hidden flex flex-col">
            <AuditTab />
          </Tabs.Content>
        </Tabs.Root>
      )}
    </div>
  )
}
