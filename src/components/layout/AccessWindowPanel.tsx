import { useMemo, useState } from 'react'
import { ArrowRightLeft, Link2, X } from 'lucide-react'
import { useUIStore, useProjectStore, useCanvasStore } from '@/store'
import { cn } from '@/lib/utils'
import { FilterAccessWindow } from '@/components/accessWindow/FilterAccessWindow'
import { ThickenerAccessWindow } from '@/components/accessWindow/ThickenerAccessWindow'
import { FeederAccessWindow } from '@/components/accessWindow/FeederAccessWindow'
import { SizeDistributionTab } from '@/components/accessWindow/SizeDistributionTab'
import { getOutputRoutes } from '@/lib/routing'
import { validateProject } from '@/services/projectValidator'
import type { Flowsheet, PipeEdge, UnitNode } from '@/types'

type Tab = 'config' | 'feed' | 'dsz' | 'connectivity' | 'results'

function formatNumber(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '--'
}

function StreamResultsCard({
  title,
  stream,
}: {
  title: string
  stream: {
    tag: string
    Qm: number
    T: number
    P: number
    solidFraction: number
    liquidFraction: number
    vapourFraction: number
    species: Record<string, { massFlow: number; massFraction: number }>
    errors?: string[]
  }
}) {
  const speciesRows = Object.entries(stream.species)
    .filter(([, species]) => species.massFlow > 0 || species.massFraction > 0)
    .sort((a, b) => b[1].massFlow - a[1].massFlow)

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-gray-400">{title}</p>
          <p className="text-sm font-semibold text-gray-800 font-mono">{stream.tag}</p>
        </div>
        {stream.errors && stream.errors.length > 0 && (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
            {stream.errors.length} issue(s)
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
        <span>Mass Flow</span>
        <span className="text-right font-mono">{formatNumber(stream.Qm * 3.6, 3)} t/h</span>
        <span>Temperature</span>
        <span className="text-right font-mono">{formatNumber(stream.T - 273.15, 2)} C</span>
        <span>Pressure</span>
        <span className="text-right font-mono">{formatNumber(stream.P / 1000, 2)} kPa</span>
        <span>Solid / Liquid / Vapour</span>
        <span className="text-right font-mono">
          {formatNumber(stream.solidFraction * 100, 1)} / {formatNumber(stream.liquidFraction * 100, 1)} / {formatNumber(stream.vapourFraction * 100, 1)} %
        </span>
      </div>

      {speciesRows.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Components</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {speciesRows.map(([speciesId, species]) => (
              <div key={speciesId} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-gray-600 font-mono truncate">{speciesId}</span>
                <span className="text-gray-700 font-mono">
                  {formatNumber(species.massFlow * 3.6, 3)} t/h ({formatNumber(species.massFraction * 100, 2)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stream.errors && stream.errors.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Errors</p>
          <div className="space-y-1">
            {stream.errors.map((error, index) => (
              <p key={`${stream.tag}-${index}`} className="text-xs text-red-600">
                {error}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function IssueList({
  title,
  messages,
  severity,
}: {
  title: string
  messages: string[]
  severity: 'error' | 'warning'
}) {
  if (messages.length === 0) return null

  return (
    <div className={cn(
      'rounded-lg border p-3 space-y-1',
      severity === 'error' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50',
    )}>
      <p className={cn(
        'text-xs font-semibold uppercase tracking-wide',
        severity === 'error' ? 'text-red-700' : 'text-amber-700',
      )}>
        {title}
      </p>
      {messages.map((message, index) => (
        <p
          key={`${severity}-${index}`}
          className={cn('text-xs', severity === 'error' ? 'text-red-700' : 'text-amber-700')}
        >
          {message}
        </p>
      ))}
    </div>
  )
}

function ConnectivityRow({
  direction,
  edge,
  connectedUnit,
  routeOptions,
  issueMessages,
  onOpen,
  onUpdateRoute,
}: {
  direction: 'incoming' | 'outgoing'
  edge: PipeEdge
  connectedUnit?: UnitNode
  routeOptions: string[]
  issueMessages: string[]
  onOpen: () => void
  onUpdateRoute?: (route: string | undefined) => void
}) {
  const isOutgoing = direction === 'outgoing'

  return (
    <div className={cn(
      'rounded-lg border p-3 space-y-2',
      issueMessages.length > 0 ? 'border-amber-300 bg-amber-50/60' : 'border-gray-200 bg-white',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-gray-400">{isOutgoing ? 'Outlet Stream' : 'Inlet Stream'}</p>
          <button
            onClick={onOpen}
            className="text-sm font-mono text-blue-700 hover:text-blue-800 truncate text-left"
          >
            {edge.tag}
          </button>
        </div>
        <span className={cn(
          'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
          isOutgoing ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700',
        )}>
          {direction}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
        <span>{isOutgoing ? 'Destination Unit' : 'Source Unit'}</span>
        <span className="text-right font-mono">{connectedUnit?.tag ?? '--'}</span>
        <span>Current Flow</span>
        <span className="text-right font-mono">
          {edge.stream ? `${formatNumber(edge.stream.Qm * 3.6, 3)} t/h` : 'Unsolved'}
        </span>
      </div>

      {routeOptions.length > 0 && isOutgoing && onUpdateRoute && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Output Route</p>
          <select
            value={edge.sourcePortKey ?? ''}
            onChange={(event) => onUpdateRoute(event.target.value || undefined)}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-white text-gray-700"
          >
            <option value="">Select output route</option>
            {routeOptions.map((route) => (
              <option key={route} value={route}>
                {route}
              </option>
            ))}
          </select>
        </div>
      )}

      {issueMessages.length > 0 && (
        <div className="space-y-1">
          {issueMessages.map((message, index) => (
            <p key={`${edge.id}-${index}`} className="text-xs text-amber-700">
              {message}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function ConnectivityInspector({
  unit,
  activeFlowsheet,
  activeFlowsheetId,
  updateEdge,
  onOpenEdge,
}: {
  unit: UnitNode
  activeFlowsheet: Flowsheet | undefined
  activeFlowsheetId: string | null
  updateEdge: (flowsheetId: string, edgeId: string, updates: Partial<PipeEdge>) => void
  onOpenEdge: (edgeId: string) => void
}) {
  const project = useProjectStore((s) => s.project)
  const validation = useMemo(() => validateProject(project), [project])
  const nodeIssues = useMemo(() => {
    const errors = validation.errors
      .filter((issue) => issue.nodeId === unit.id)
      .map((issue) => issue.msg)
    const warnings = validation.warnings
      .filter((issue) => issue.nodeId === unit.id)
      .map((issue) => issue.msg)
    return { errors, warnings }
  }, [unit.id, validation])

  const edges = useMemo(() => {
    if (!activeFlowsheet) return { incoming: [], outgoing: [] as PipeEdge[] }
    return {
      incoming: activeFlowsheet.edges.filter((edge) => edge.target === unit.id),
      outgoing: activeFlowsheet.edges.filter((edge) => edge.source === unit.id),
    }
  }, [activeFlowsheet, unit.id])

  const nodeById = useMemo(
    () => new Map((activeFlowsheet?.nodes ?? []).map((node) => [node.id, node])),
    [activeFlowsheet],
  )
  const routeOptions = getOutputRoutes(unit.type)

  function getEdgeIssues(edgeId: string): string[] {
    return [
      ...validation.errors.filter((issue) => issue.edgeId === edgeId).map((issue) => issue.msg),
      ...validation.warnings.filter((issue) => issue.edgeId === edgeId).map((issue) => issue.msg),
    ]
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
          <ArrowRightLeft size={16} />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">Connectivity Inspector</p>
          <p className="text-xs text-gray-500">
            Review every inlet and outlet assignment for {unit.tag}.
          </p>
        </div>
      </div>

      <IssueList title="Connectivity Errors" messages={nodeIssues.errors} severity="error" />
      <IssueList title="Connectivity Warnings" messages={nodeIssues.warnings} severity="warning" />

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-gray-400 mb-1">Incoming Streams</p>
          <p className="text-lg font-semibold text-gray-800">{edges.incoming.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-gray-400 mb-1">Outgoing Streams</p>
          <p className="text-lg font-semibold text-gray-800">{edges.outgoing.length}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Incoming</p>
        {edges.incoming.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-3 text-xs text-gray-400">
            No inlet streams are connected to this unit.
          </div>
        ) : (
          edges.incoming.map((edge) => (
            <ConnectivityRow
              key={edge.id}
              direction="incoming"
              edge={edge}
              connectedUnit={nodeById.get(edge.source)}
              routeOptions={[]}
              issueMessages={getEdgeIssues(edge.id)}
              onOpen={() => onOpenEdge(edge.id)}
            />
          ))
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Outgoing</p>
          {routeOptions.length > 0 && (
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">
              Supported routes: {routeOptions.join(', ')}
            </span>
          )}
        </div>
        {edges.outgoing.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-3 text-xs text-gray-400">
            No outlet streams are connected to this unit.
          </div>
        ) : (
          edges.outgoing.map((edge) => (
            <ConnectivityRow
              key={edge.id}
              direction="outgoing"
              edge={edge}
              connectedUnit={nodeById.get(edge.target)}
              routeOptions={routeOptions}
              issueMessages={getEdgeIssues(edge.id)}
              onOpen={() => onOpenEdge(edge.id)}
              onUpdateRoute={(route) => {
                if (!activeFlowsheetId) return
                updateEdge(activeFlowsheetId, edge.id, { sourcePortKey: route })
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}

export function AccessWindowPanel() {
  const {
    rightPanelOpen,
    accessWindowUnitId,
    accessWindowEdgeId,
    setRightPanelOpen,
    setAccessWindowUnitId,
    setAccessWindowEdgeId,
    setResultsPanelOpen,
    setResultsPanelTab,
  } = useUIStore()
  const activeFlowsheetId = useCanvasStore((s) => s.activeFlowsheetId)
  const setSelectedEdgeId = useCanvasStore((s) => s.setSelectedEdgeId)
  const project = useProjectStore((s) => s.project)
  const updateEdge = useProjectStore((s) => s.updateEdge)

  const [activeTab, setActiveTab] = useState<Tab>('config')

  const activeFlowsheet = project.flowsheets.find((f) => f.id === activeFlowsheetId) ?? project.flowsheets[0]
  const unit = accessWindowUnitId
    ? activeFlowsheet?.nodes.find((n) => n.id === accessWindowUnitId)
    : null
  const edge = accessWindowEdgeId
    ? activeFlowsheet?.edges.find((candidate) => candidate.id === accessWindowEdgeId)
    : null

  const connectedStreams = useMemo(() => {
    if (!unit || !activeFlowsheet) return { incoming: [], outgoing: [] }
    const incoming = activeFlowsheet.edges.filter((candidate) => candidate.target === unit.id && candidate.stream)
    const outgoing = activeFlowsheet.edges.filter((candidate) => candidate.source === unit.id && candidate.stream)
    return { incoming, outgoing }
  }, [activeFlowsheet, unit])

  const edgeSourceNode = edge && activeFlowsheet
    ? activeFlowsheet.nodes.find((candidate) => candidate.id === edge.source)
    : null
  const edgeRouteOptions = edgeSourceNode ? getOutputRoutes(edgeSourceNode.type) : []

  const hasUnitConfig = unit?.type === 'Filter' || unit?.type === 'Thickener'
  const hasFeederConfig = unit?.type === 'Feeder'
  const hasSizeDistribution = unit?.type === 'Feeder'
  const hasResultsTab = Boolean(edge?.stream || connectedStreams.incoming.length || connectedStreams.outgoing.length)

  function handleClose() {
    setRightPanelOpen(false)
    setAccessWindowUnitId(null)
    setAccessWindowEdgeId(null)
  }

  function handleOpenEdge(edgeId: string) {
    setSelectedEdgeId(edgeId)
    setAccessWindowEdgeId(edgeId)
    setAccessWindowUnitId(null)
    setRightPanelOpen(true)
    setResultsPanelOpen(true)
    setResultsPanelTab('selection')
  }

  const tabs: { id: Tab; label: string; show: boolean }[] = edge
    ? [{ id: 'results' as Tab, label: 'Results', show: true }]
    : [
        { id: 'config', label: 'Config', show: hasUnitConfig },
        { id: 'feed', label: 'Feed', show: hasFeederConfig },
        { id: 'dsz', label: 'DSz', show: hasSizeDistribution },
        { id: 'results', label: 'Results', show: hasResultsTab },
        { id: 'connectivity', label: 'Connectivity', show: true },
      ].filter((tab): tab is { id: Tab; label: string; show: boolean } => tab.show)

  const showTabs = tabs.length > 1

  return (
    <div
      className={cn(
        'transition-all duration-200 bg-white border-l border-gray-200 overflow-hidden flex-none flex flex-col',
        rightPanelOpen ? 'w-96' : 'w-0',
      )}
    >
      <div className="flex items-center justify-between px-4 h-10 border-b border-gray-200 flex-none">
        <div className="flex items-center gap-2 min-w-0">
          {unit ? (
            <>
              <span className="text-sm font-semibold text-gray-800 truncate">{unit.tag}</span>
              <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-100 text-blue-700 font-medium flex-none">
                {unit.type}
              </span>
            </>
          ) : edge ? (
            <>
              <span className="text-sm font-semibold text-gray-800 truncate">{edge.tag}</span>
              <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-100 text-emerald-700 font-medium flex-none">
                Stream
              </span>
            </>
          ) : (
            <span className="text-sm font-medium text-gray-600">Properties</span>
          )}
        </div>
        <button
          onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex-none"
        >
          <X size={14} />
        </button>
      </div>

      {(unit || edge) && showTabs && (
        <div className="flex border-b border-gray-200 flex-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {edge ? (
          <div className="p-4 space-y-3">
            {edgeRouteOptions.length > 0 && activeFlowsheetId && (
              <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div>
                  <p className="text-xs text-gray-400">Output Routing</p>
                  <p className="text-sm text-gray-800">
                    {edgeSourceNode?.tag} to {edge.tag}
                  </p>
                </div>
                <select
                  value={edge.sourcePortKey ?? ''}
                  onChange={(e) => {
                    updateEdge(activeFlowsheetId, edge.id, {
                      sourcePortKey: e.target.value || undefined,
                    })
                  }}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-white text-gray-700"
                >
                  <option value="">Select output route</option>
                  {edgeRouteOptions.map((route) => (
                    <option key={route} value={route}>
                      {route}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Assign the specific solver output this connection should carry.
                </p>
              </div>
            )}
            {edge.stream ? (
              <StreamResultsCard title="Selected Stream" stream={edge.stream} />
            ) : (
              <p className="text-sm text-gray-400">No solved result is available for this stream yet.</p>
            )}
          </div>
        ) : unit ? (
          <>
            {activeTab === 'config' && unit.type === 'Filter' && <FilterAccessWindow unit={unit} />}
            {activeTab === 'config' && unit.type === 'Thickener' && <ThickenerAccessWindow unit={unit} />}
            {activeTab === 'feed' && unit.type === 'Feeder' && <FeederAccessWindow unit={unit} />}
            {activeTab === 'dsz' && unit.type === 'Feeder' && (
              <div className="p-2">
                <SizeDistributionTab unit={unit} />
              </div>
            )}
            {activeTab === 'results' && (
              <div className="p-4 space-y-3">
                {connectedStreams.incoming.length === 0 && connectedStreams.outgoing.length === 0 ? (
                  <p className="text-sm text-gray-400">Run the solver to see stream results for this unit.</p>
                ) : (
                  <>
                    {connectedStreams.incoming.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Incoming Streams</p>
                        {connectedStreams.incoming.map((candidate) => (
                          candidate.stream ? (
                            <StreamResultsCard key={candidate.id} title="Inlet" stream={candidate.stream} />
                          ) : null
                        ))}
                      </div>
                    )}
                    {connectedStreams.outgoing.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Outgoing Streams</p>
                        {connectedStreams.outgoing.map((candidate) => (
                          candidate.stream ? (
                            <StreamResultsCard key={candidate.id} title="Outlet" stream={candidate.stream} />
                          ) : null
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {activeTab === 'connectivity' && (
              <ConnectivityInspector
                unit={unit}
                activeFlowsheet={activeFlowsheet}
                activeFlowsheetId={activeFlowsheetId}
                updateEdge={updateEdge}
                onOpenEdge={handleOpenEdge}
              />
            )}
          </>
        ) : (
          <div className="p-4">
            <div className="mt-8 flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center">
                <Link2 size={18} />
              </div>
              <p className="text-sm text-gray-400">
                Double-click a stream or unit to inspect connectivity and results.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
