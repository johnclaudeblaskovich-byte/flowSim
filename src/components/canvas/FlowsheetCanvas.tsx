import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react'
import { useProjectStore, useCanvasStore, useUIStore } from '@/store'
import { UnitNodeRenderer } from './nodes/UnitNodeRenderer'
import { PipeEdgeRenderer, type PipeEdgeType } from './edges/PipeEdgeRenderer'
import { TextLabel } from './annotations/TextLabel'
import { BorderFrame } from './annotations/BorderFrame'
import { TitleBlock } from './annotations/TitleBlock'
import { CanvasToolbar } from './CanvasToolbar'
import { SymbolPickerDialog } from './symbols/SymbolPickerDialog'
import { generateTag } from '@/lib/tagUtils'
import { getOutputRoutes } from '@/lib/routing'
import { validateProject } from '@/services/projectValidator'
import type { UnitNode, PipeEdge, UnitModelType, Annotation } from '@/types'

// ─── RF type aliases ──────────────────────────────────────────────────────────
// Use base Node for mixed node types (unit + annotations); narrowing happens at render time
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppNode = Node<any>
type AppPipeEdge = PipeEdgeType

// ─── Units with no stream connections ────────────────────────────────────────
const NO_STREAM_UNITS: UnitModelType[] = [
  'GeneralController',
  'PIDController',
  'SetTagController',
  'MakeupSource',
]

// ─── Conversion helpers ───────────────────────────────────────────────────────
type ValidationBadge = {
  severity: 'error' | 'warning'
  messages: string[]
}

function toRFNode(unit: UnitNode, validation?: ValidationBadge): AppNode {
  return {
    id: unit.id,
    type: 'UnitNode' as const,
    position: unit.position,
    data: { unit, validation },
  }
}

function toRFAnnotation(ann: Annotation): AppNode {
  if (ann.type === 'border') {
    return {
      id: ann.id,
      type: 'annotation-border' as const,
      position: ann.position,
      style: ann.size ? { width: ann.size.width, height: ann.size.height } : { width: 200, height: 150 },
      data: { annotation: ann },
    }
  }
  if (ann.type === 'titleblock') {
    return {
      id: ann.id,
      type: 'annotation-titleblock' as const,
      position: ann.position,
      data: { annotation: ann },
    }
  }
  return {
    id: ann.id,
    type: 'annotation-text' as const,
    position: ann.position,
    data: { annotation: ann },
  }
}

function toRFEdge(pipe: PipeEdge, validation?: ValidationBadge): AppPipeEdge {
  return {
    id: pipe.id,
    source: pipe.source,
    target: pipe.target,
    sourceHandle: pipe.sourceHandle ?? null,
    targetHandle: pipe.targetHandle ?? null,
    type: 'PipeEdge' as const,
    data: { pipe, validation },
  }
}

// ─── Context menu state ───────────────────────────────────────────────────────
interface CtxMenu {
  x: number
  y: number
  nodeId: string
}

// ─── Inner canvas ─────────────────────────────────────────────────────────────
function FlowsheetCanvasInner() {
  const { project, addNode, removeNode, updateNode, addEdge: storeAddEdge, removeEdge: storeRemoveEdge, addAnnotation } =
    useProjectStore()
  const { activeFlowsheetId, setSelectedNodeId, setSelectedEdgeId, clearSelection } =
    useCanvasStore()
  const { setRightPanelOpen, setAccessWindowUnitId, setAccessWindowEdgeId, setResultsPanelOpen, setResultsPanelTab } = useUIStore()
  const { screenToFlowPosition } = useReactFlow()

  const [nodes, setNodes] = useNodesState<AppNode>([])
  const [edges, setEdges] = useEdgesState<AppPipeEdge>([])
  const [showMiniMap, setShowMiniMap] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const [symbolPickerNodeId, setSymbolPickerNodeId] = useState<string | null>(null)
  const ctxRef = useRef<HTMLDivElement>(null)
  const validationResult = useMemo(() => validateProject(project), [project])

  const validationMaps = useMemo(() => {
    const nodeMap = new Map<string, ValidationBadge>()
    const edgeMap = new Map<string, ValidationBadge>()

    for (const issue of validationResult.errors) {
      if (issue.nodeId) {
        const existing = nodeMap.get(issue.nodeId)
        nodeMap.set(issue.nodeId, {
          severity: 'error',
          messages: [...(existing?.messages ?? []), issue.msg],
        })
      }
      if (issue.edgeId) {
        const existing = edgeMap.get(issue.edgeId)
        edgeMap.set(issue.edgeId, {
          severity: 'error',
          messages: [...(existing?.messages ?? []), issue.msg],
        })
      }
    }

    for (const issue of validationResult.warnings) {
      if (issue.nodeId && !nodeMap.has(issue.nodeId)) {
        const existing = nodeMap.get(issue.nodeId)
        nodeMap.set(issue.nodeId, {
          severity: existing?.severity ?? 'warning',
          messages: [...(existing?.messages ?? []), issue.msg],
        })
      }
      if (issue.edgeId && !edgeMap.has(issue.edgeId)) {
        const existing = edgeMap.get(issue.edgeId)
        edgeMap.set(issue.edgeId, {
          severity: existing?.severity ?? 'warning',
          messages: [...(existing?.messages ?? []), issue.msg],
        })
      }
    }

    return { nodeMap, edgeMap }
  }, [validationResult])

  // ── Initialize RF state from store when active flowsheet changes ────────────
  useEffect(() => {
    const fs = project.flowsheets.find((f) => f.id === activeFlowsheetId)
    if (fs) {
      const unitNodes = fs.nodes.map((node) => toRFNode(node, validationMaps.nodeMap.get(node.id)))
      const annNodes = fs.annotations.map(toRFAnnotation)
      setNodes([...unitNodes, ...annNodes])
      setEdges(fs.edges.map((edge) => toRFEdge(edge, validationMaps.edgeMap.get(edge.id))))
    } else {
      setNodes([])
      setEdges([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFlowsheetId, project, validationMaps])

  // ── Ctrl+M toggles minimap ─────────────────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'm') {
        e.preventDefault()
        setShowMiniMap((v) => !v)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // ── Close context menu on outside click ────────────────────────────────────
  useEffect(() => {
    if (!ctxMenu) return
    function handleOutside(e: MouseEvent) {
      if (ctxRef.current && !ctxRef.current.contains(e.target as HTMLElement)) {
        setCtxMenu(null)
      }
    }
    window.addEventListener('mousedown', handleOutside)
    return () => window.removeEventListener('mousedown', handleOutside)
  }, [ctxMenu])

  // ── Node types / edge types (stable references) ───────────────────────────
  const nodeTypes = useMemo<NodeTypes>(() => ({
    UnitNode: UnitNodeRenderer,
    'annotation-text': TextLabel,
    'annotation-border': BorderFrame,
    'annotation-titleblock': TitleBlock,
  }), [])
  const edgeTypes = useMemo<EdgeTypes>(() => ({ PipeEdge: PipeEdgeRenderer }), [])

  // ── onNodesChange ─────────────────────────────────────────────────────────
  const onNodesChange: OnNodesChange<AppNode> = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes],
  )

  // ── onEdgesChange ─────────────────────────────────────────────────────────
  const onEdgesChange: OnEdgesChange<AppPipeEdge> = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges],
  )

  // ── onNodeDragStop ────────────────────────────────────────────────────────
  const onNodeDragStop: NodeMouseHandler<AppNode> = useCallback(
    (_e, node) => {
      if (!activeFlowsheetId) return
      updateNode(activeFlowsheetId, node.id, { position: node.position })
    },
    [activeFlowsheetId, updateNode],
  )

  // ── Connection validation ─────────────────────────────────────────────────
  const isValidConnection = useCallback(
    (connection: { source: string | null; target: string | null }) => {
      const { source, target } = connection
      if (!source || !target) return false
      // Rule 1: no self-connections
      if (source === target) return false

      const fs = project.flowsheets.find((f) => f.id === activeFlowsheetId)
      if (!fs) return false
      const sourceUnit = fs.nodes.find((n) => n.id === source)
      const targetUnit = fs.nodes.find((n) => n.id === target)
      if (!sourceUnit || !targetUnit) return false

      // Rule 5: controllers and MakeupSource have no stream connections
      if (NO_STREAM_UNITS.includes(sourceUnit.type) || NO_STREAM_UNITS.includes(targetUnit.type)) {
        return false
      }

      // Rule 4: Feeder only has outputs (cannot be a target), FeederSink only inputs (cannot be source)
      if (sourceUnit.type === 'FeederSink') return false
      if (targetUnit.type === 'Feeder' || targetUnit.type === 'MakeupSource') return false

      // Rule 3: no duplicate edges between same source/target
      const alreadyConnected = fs.edges.some(
        (e) => e.source === source && e.target === target,
      )
      if (alreadyConnected) return false

      return true
    },
    [activeFlowsheetId, project.flowsheets],
  )

  // ── onConnect ────────────────────────────────────────────────────────────
  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (!activeFlowsheetId || !connection.source || !connection.target) return
      const fs = project.flowsheets.find((f) => f.id === activeFlowsheetId)
      const sourceUnit = fs?.nodes.find((n) => n.id === connection.source)
      const targetUnit = fs?.nodes.find((n) => n.id === connection.target)
      if (!sourceUnit || !targetUnit) return

      // Auto-tag: {sourceTag}_TO_{targetTag}, append _2, _3 if duplicate
      const baseTag = `${sourceUnit.tag}_TO_${targetUnit.tag}`
      const existing = fs?.edges ?? []
      let finalTag = baseTag
      let suffix = 2
      while (existing.some((e) => e.tag === finalTag)) {
        finalTag = `${baseTag}_${suffix}`
        suffix++
      }

      const sourceRoutes = getOutputRoutes(sourceUnit.type)
      const nextRoute = sourceRoutes[
        existing.filter((e) => e.source === connection.source).length
      ]

      const newPipe: PipeEdge = {
        id: crypto.randomUUID(),
        tag: finalTag,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
        sourcePortKey: connection.sourceHandle ?? nextRoute,
        targetPortKey: connection.targetHandle ?? undefined,
        config: { simplified: true },
      }
      storeAddEdge(activeFlowsheetId, newPipe)
      setEdges((eds) => addEdge<AppPipeEdge>({ ...toRFEdge(newPipe) }, eds))
    },
    [activeFlowsheetId, project.flowsheets, storeAddEdge, setEdges],
  )

  // ── onNodesDelete ─────────────────────────────────────────────────────────
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      if (!activeFlowsheetId) return
      deleted.forEach((n) => {
        removeNode(activeFlowsheetId, n.id)
        // Also remove connected edges from store
        const fs = project.flowsheets.find((f) => f.id === activeFlowsheetId)
        fs?.edges
          .filter((e) => e.source === n.id || e.target === n.id)
          .forEach((e) => storeRemoveEdge(activeFlowsheetId, e.id))
      })
    },
    [activeFlowsheetId, removeNode, storeRemoveEdge, project.flowsheets],
  )

  // ── onEdgesDelete ─────────────────────────────────────────────────────────
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      if (!activeFlowsheetId) return
      deleted.forEach((e) => storeRemoveEdge(activeFlowsheetId, e.id))
    },
    [activeFlowsheetId, storeRemoveEdge],
  )

  // ── Selection events ──────────────────────────────────────────────────────
  const onNodeClick: NodeMouseHandler<AppNode> = useCallback(
    (_e, node) => {
      setSelectedNodeId(node.id)
      setAccessWindowUnitId(node.id)
      setRightPanelOpen(true)
    },
    [setSelectedNodeId, setAccessWindowUnitId, setRightPanelOpen],
  )

  const onNodeDoubleClick: NodeMouseHandler<AppNode> = useCallback(
    (_e, node) => {
      setAccessWindowUnitId(node.id)
      setRightPanelOpen(true)
      setResultsPanelOpen(true)
      setResultsPanelTab('selection')
    },
    [setAccessWindowUnitId, setRightPanelOpen, setResultsPanelOpen, setResultsPanelTab],
  )

  const onEdgeClick: EdgeMouseHandler<AppPipeEdge> = useCallback(
    (_e, edge) => {
      setSelectedEdgeId(edge.id)
    },
    [setSelectedEdgeId],
  )

  const onEdgeDoubleClick: EdgeMouseHandler<AppPipeEdge> = useCallback(
    (_e, edge) => {
      setSelectedEdgeId(edge.id)
      setAccessWindowEdgeId(edge.id)
      setRightPanelOpen(true)
      setResultsPanelOpen(true)
      setResultsPanelTab('selection')
    },
    [setSelectedEdgeId, setAccessWindowEdgeId, setRightPanelOpen, setResultsPanelOpen, setResultsPanelTab],
  )

  const onPaneClick = useCallback(() => {
    clearSelection()
    setRightPanelOpen(false)
    setCtxMenu(null)
  }, [clearSelection, setRightPanelOpen])

  // ── Context menu ──────────────────────────────────────────────────────────
  const onNodeContextMenu: NodeMouseHandler<AppNode> = useCallback(
    (e, node) => {
      e.preventDefault()
      setCtxMenu({ x: e.clientX, y: e.clientY, nodeId: node.id })
    },
    [],
  )

  // ── Drag-to-place ─────────────────────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const unitType = e.dataTransfer.getData('unitType') as UnitModelType
      if (!unitType || !activeFlowsheetId) return

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const fs = project.flowsheets.find((f) => f.id === activeFlowsheetId)

      const tag = generateTag(unitType, fs?.nodes ?? [])
      const newUnit: UnitNode = {
        id: crypto.randomUUID(),
        tag,
        type: unitType,
        label: tag,
        position,
        symbolKey: unitType,
        enabled: true,
        config: {},
        subModels: [],
        solveStatus: 'idle',
        errorMessages: [],
        ports: [],
      }
      addNode(activeFlowsheetId, newUnit)
      setNodes((nds) => [...nds, toRFNode(newUnit)])
    },
    [activeFlowsheetId, project.flowsheets, screenToFlowPosition, addNode, setNodes],
  )

  // ── Context menu actions ──────────────────────────────────────────────────
  function ctxOpenProperties() {
    if (!ctxMenu) return
    setAccessWindowUnitId(ctxMenu.nodeId)
    setRightPanelOpen(true)
    setCtxMenu(null)
  }

  function ctxCopyTag() {
    if (!ctxMenu || !activeFlowsheetId) return
    const fs = project.flowsheets.find((f) => f.id === activeFlowsheetId)
    const unit = fs?.nodes.find((n) => n.id === ctxMenu.nodeId)
    if (unit) void navigator.clipboard.writeText(unit.tag)
    setCtxMenu(null)
  }

  function ctxToggleEnable() {
    if (!ctxMenu || !activeFlowsheetId) return
    const fs = project.flowsheets.find((f) => f.id === activeFlowsheetId)
    const unit = fs?.nodes.find((n) => n.id === ctxMenu.nodeId)
    if (!unit) return
    const nextEnabled = !unit.enabled
    const nextStatus = nextEnabled ? ('idle' as const) : ('disabled' as const)
    updateNode(activeFlowsheetId, ctxMenu.nodeId, {
      enabled: nextEnabled,
      solveStatus: nextStatus,
    })
    setNodes((nds) =>
      nds.map((n) =>
        n.id === ctxMenu.nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                unit: { ...n.data.unit, enabled: nextEnabled, solveStatus: nextStatus },
              },
            }
          : n,
      ),
    )
    setCtxMenu(null)
  }

  function ctxChangeSymbol() {
    if (!ctxMenu) return
    setSymbolPickerNodeId(ctxMenu.nodeId)
    setCtxMenu(null)
  }

  function ctxDelete() {
    if (!ctxMenu || !activeFlowsheetId) return
    const fs = project.flowsheets.find((f) => f.id === activeFlowsheetId)
    // Remove connected edges from store first
    fs?.edges
      .filter((e) => e.source === ctxMenu.nodeId || e.target === ctxMenu.nodeId)
      .forEach((e) => storeRemoveEdge(activeFlowsheetId, e.id))
    removeNode(activeFlowsheetId, ctxMenu.nodeId)
    setNodes((nds) => nds.filter((n) => n.id !== ctxMenu.nodeId))
    setEdges((eds) =>
      eds.filter((e) => e.source !== ctxMenu.nodeId && e.target !== ctxMenu.nodeId),
    )
    setCtxMenu(null)
  }

  // ── Insert annotation ─────────────────────────────────────────────────────
  const handleInsertAnnotation = useCallback(
    (type: 'text' | 'border' | 'titleblock') => {
      if (!activeFlowsheetId) return
      const now = new Date().toLocaleDateString()
      const fs = project.flowsheets.find((f) => f.id === activeFlowsheetId)
      const ann: Annotation = {
        id: crypto.randomUUID(),
        type,
        position: { x: 100, y: 100 },
        ...(type === 'border' && { size: { width: 200, height: 150 }, headerText: '' }),
        ...(type === 'titleblock' && {
          projectName: project.name,
          flowsheetName: fs?.name ?? '',
          date: now,
          revision: 'A',
          drawnBy: '',
          checkedBy: '',
        }),
        ...(type === 'text' && { content: 'Label', fontSize: 14 }),
      }
      addAnnotation(activeFlowsheetId, ann)
      setNodes((nds) => [...nds, toRFAnnotation(ann)])
    },
    [activeFlowsheetId, project, addAnnotation, setNodes],
  )

  // ── Symbol picker ─────────────────────────────────────────────────────────
  const symbolPickerUnit = symbolPickerNodeId
    ? project.flowsheets
        .find((f) => f.id === activeFlowsheetId)
        ?.nodes.find((n) => n.id === symbolPickerNodeId)
    : null

  function handleSymbolSelect(symbolKey: string) {
    if (!symbolPickerNodeId || !activeFlowsheetId) return
    updateNode(activeFlowsheetId, symbolPickerNodeId, { symbolKey })
    setNodes((nds) =>
      nds.map((n) =>
        n.id === symbolPickerNodeId
          ? {
              ...n,
              data: {
                ...n.data,
                unit: { ...n.data.unit, symbolKey },
              },
            }
          : n,
      ),
    )
    setSymbolPickerNodeId(null)
  }

  // ── Context menu helpers ──────────────────────────────────────────────────
  const ctxUnit = ctxMenu
    ? project.flowsheets
        .find((f) => f.id === activeFlowsheetId)
        ?.nodes.find((n) => n.id === ctxMenu.nodeId)
    : null

  const menuItem =
    'px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer rounded text-left w-full'
  const menuSep = 'h-px bg-gray-200 my-1'

  return (
    <div className="relative w-full h-full">
      <ReactFlow<AppNode, AppPipeEdge>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeClick={onEdgeClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        fitView
        className="w-full h-full"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={2}
          color="#DEE2E6"
          style={{ backgroundColor: '#F8F9FA' }}
        />
        {showMiniMap && (
          <MiniMap
            nodeColor="#9CA3AF"
            maskColor="rgba(255,255,255,0.8)"
            className="!bottom-8 !right-4"
          />
        )}
      </ReactFlow>

      <CanvasToolbar onInsertAnnotation={handleInsertAnnotation} />

      {/* Node context menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          style={{ position: 'fixed', top: ctxMenu.y, left: ctxMenu.x, zIndex: 100 }}
          className="min-w-[160px] bg-white rounded-lg shadow-lg border border-gray-200 p-1"
        >
          <button className={menuItem} onClick={ctxOpenProperties}>
            Open Properties
          </button>
          <button className={menuItem} onClick={ctxCopyTag}>
            Copy Tag
          </button>
          <button className={menuItem} onClick={ctxChangeSymbol}>
            Change Symbol…
          </button>
          <div className={menuSep} />
          <button className={menuItem} onClick={ctxToggleEnable}>
            {ctxUnit?.enabled ? 'Disable' : 'Enable'}
          </button>
          <div className={menuSep} />
          <button
            className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 cursor-pointer rounded text-left w-full"
            onClick={ctxDelete}
          >
            Delete
          </button>
        </div>
      )}

      {/* Symbol picker dialog */}
      {symbolPickerUnit && (
        <SymbolPickerDialog
          open={true}
          unitType={symbolPickerUnit.type}
          unitTag={symbolPickerUnit.tag}
          currentSymbolKey={symbolPickerUnit.symbolKey}
          onSelect={handleSymbolSelect}
          onClose={() => setSymbolPickerNodeId(null)}
        />
      )}
    </div>
  )
}

export function FlowsheetCanvas() {
  return (
    <ReactFlowProvider>
      <FlowsheetCanvasInner />
    </ReactFlowProvider>
  )
}
