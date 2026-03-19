import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
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
import { UnitNodeRenderer, type UnitNodeType } from './nodes/UnitNodeRenderer'
import { PipeEdgeRenderer, type PipeEdgeType } from './edges/PipeEdgeRenderer'
import { CanvasToolbar } from './CanvasToolbar'
import { generateTag } from '@/lib/tagUtils'
import type { UnitNode, PipeEdge, UnitModelType } from '@/types'

// ─── RF type aliases ──────────────────────────────────────────────────────────
type AppUnitNode = UnitNodeType
type AppPipeEdge = PipeEdgeType

// ─── Conversion helpers ───────────────────────────────────────────────────────
function toRFNode(unit: UnitNode): AppUnitNode {
  return {
    id: unit.id,
    type: 'UnitNode' as const,
    position: unit.position,
    data: { unit },
  }
}

function toRFEdge(pipe: PipeEdge): AppPipeEdge {
  return {
    id: pipe.id,
    source: pipe.source,
    target: pipe.target,
    sourceHandle: pipe.sourceHandle ?? null,
    targetHandle: pipe.targetHandle ?? null,
    type: 'PipeEdge' as const,
    data: { pipe },
  }
}

// ─── Context menu state ───────────────────────────────────────────────────────
interface CtxMenu {
  x: number
  y: number
  nodeId: string
}

// ─── Inner canvas (inside ReactFlowProvider) ──────────────────────────────────
function FlowsheetCanvasInner() {
  const { project, addNode, removeNode, updateNode, addEdge: storeAddEdge, removeEdge: storeRemoveEdge } =
    useProjectStore()
  const { activeFlowsheetId, setSelectedNodeId, setSelectedEdgeId, clearSelection } =
    useCanvasStore()
  const { setRightPanelOpen, setAccessWindowUnitId } = useUIStore()
  const { screenToFlowPosition } = useReactFlow()

  const [nodes, setNodes] = useNodesState<AppUnitNode>([])
  const [edges, setEdges] = useEdgesState<AppPipeEdge>([])
  const [showMiniMap, setShowMiniMap] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const ctxRef = useRef<HTMLDivElement>(null)

  // ── Initialize RF state from store when active flowsheet changes ────────────
  useEffect(() => {
    const fs = project.flowsheets.find((f) => f.id === activeFlowsheetId)
    if (fs) {
      setNodes(fs.nodes.map(toRFNode))
      setEdges(fs.edges.map(toRFEdge))
    } else {
      setNodes([])
      setEdges([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFlowsheetId])

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
  const nodeTypes = useMemo<NodeTypes>(() => ({ UnitNode: UnitNodeRenderer }), [])
  const edgeTypes = useMemo<EdgeTypes>(() => ({ PipeEdge: PipeEdgeRenderer }), [])

  // ── onNodesChange: apply locally ──────────────────────────────────────────
  const onNodesChange: OnNodesChange<AppUnitNode> = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes],
  )

  // ── onEdgesChange: apply locally ──────────────────────────────────────────
  const onEdgesChange: OnEdgesChange<AppPipeEdge> = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges],
  )

  // ── onNodeDragStop: sync position to store ────────────────────────────────
  const onNodeDragStop: NodeMouseHandler<AppUnitNode> = useCallback(
    (_e, node) => {
      if (!activeFlowsheetId) return
      updateNode(activeFlowsheetId, node.id, { position: node.position })
    },
    [activeFlowsheetId, updateNode],
  )

  // ── onConnect: create a PipeEdge and add to both RF and store ─────────────
  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (!activeFlowsheetId || !connection.source || !connection.target) return
      const fs = project.flowsheets.find((f) => f.id === activeFlowsheetId)
      const sourceUnit = fs?.nodes.find((n) => n.id === connection.source)
      const targetUnit = fs?.nodes.find((n) => n.id === connection.target)
      if (!sourceUnit || !targetUnit) return

      const newPipe: PipeEdge = {
        id: crypto.randomUUID(),
        tag: `S_${String((fs?.edges.length ?? 0) + 1).padStart(3, '0')}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
        config: { simplified: true },
      }
      storeAddEdge(activeFlowsheetId, newPipe)
      setEdges((eds) =>
        addEdge<AppPipeEdge>(
          { ...toRFEdge(newPipe) },
          eds,
        ),
      )
    },
    [activeFlowsheetId, project.flowsheets, storeAddEdge, setEdges],
  )

  // ── onNodesDelete: remove from store ─────────────────────────────────────
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      if (!activeFlowsheetId) return
      deleted.forEach((n) => removeNode(activeFlowsheetId, n.id))
    },
    [activeFlowsheetId, removeNode],
  )

  // ── onEdgesDelete: remove from store ─────────────────────────────────────
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      if (!activeFlowsheetId) return
      deleted.forEach((e) => storeRemoveEdge(activeFlowsheetId, e.id))
    },
    [activeFlowsheetId, storeRemoveEdge],
  )

  // ── Selection events ──────────────────────────────────────────────────────
  const onNodeClick: NodeMouseHandler<AppUnitNode> = useCallback(
    (_e, node) => {
      setSelectedNodeId(node.id)
      setAccessWindowUnitId(node.id)
      setRightPanelOpen(true)
    },
    [setSelectedNodeId, setAccessWindowUnitId, setRightPanelOpen],
  )

  const onNodeDoubleClick: NodeMouseHandler<AppUnitNode> = useCallback(
    (_e, node) => {
      setAccessWindowUnitId(node.id)
      setRightPanelOpen(true)
    },
    [setAccessWindowUnitId, setRightPanelOpen],
  )

  const onEdgeClick: EdgeMouseHandler<AppPipeEdge> = useCallback(
    (_e, edge) => {
      setSelectedEdgeId(edge.id)
    },
    [setSelectedEdgeId],
  )

  const onPaneClick = useCallback(() => {
    clearSelection()
    setRightPanelOpen(false)
    setCtxMenu(null)
  }, [clearSelection, setRightPanelOpen])

  // ── Context menu ──────────────────────────────────────────────────────────
  const onNodeContextMenu: NodeMouseHandler<AppUnitNode> = useCallback(
    (e, node) => {
      e.preventDefault()
      setCtxMenu({ x: e.clientX, y: e.clientY, nodeId: node.id })
    },
    [],
  )

  // ── Drag-to-place handlers ────────────────────────────────────────────────
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
                unit: { ...n.data.unit, enabled: nextEnabled, solveStatus: nextStatus },
              },
            }
          : n,
      ),
    )
    setCtxMenu(null)
  }

  function ctxDelete() {
    if (!ctxMenu || !activeFlowsheetId) return
    removeNode(activeFlowsheetId, ctxMenu.nodeId)
    setNodes((nds) => nds.filter((n) => n.id !== ctxMenu.nodeId))
    setEdges((eds) =>
      eds.filter(
        (e) => e.source !== ctxMenu.nodeId && e.target !== ctxMenu.nodeId,
      ),
    )
    // Also remove connected edges from store
    const fs = project.flowsheets.find((f) => f.id === activeFlowsheetId)
    fs?.edges
      .filter(
        (e) => e.source === ctxMenu.nodeId || e.target === ctxMenu.nodeId,
      )
      .forEach((e) => storeRemoveEdge(activeFlowsheetId, e.id))
    setCtxMenu(null)
  }

  // ── Context menu: find unit for enable/disable label ─────────────────────
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
      <ReactFlow<AppUnitNode, AppPipeEdge>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeClick={onEdgeClick}
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
        <Controls
          showFitView
          showZoom
          showInteractive={false}
          className="!bottom-8 !left-14"
        />
        {showMiniMap && (
          <MiniMap
            nodeColor="#9CA3AF"
            maskColor="rgba(255,255,255,0.8)"
            className="!bottom-8 !right-4"
          />
        )}
      </ReactFlow>

      <CanvasToolbar />

      {/* Context menu overlay */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          style={{
            position: 'fixed',
            top: ctxMenu.y,
            left: ctxMenu.x,
            zIndex: 100,
          }}
          className="min-w-[160px] bg-white rounded-lg shadow-lg border border-gray-200 p-1"
        >
          <button className={menuItem} onClick={ctxOpenProperties}>
            Open Properties
          </button>
          <button className={menuItem} onClick={ctxCopyTag}>
            Copy Tag
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
    </div>
  )
}

// ─── Public export wrapped in provider ────────────────────────────────────────
export function FlowsheetCanvas() {
  return (
    <ReactFlowProvider>
      <FlowsheetCanvasInner />
    </ReactFlowProvider>
  )
}
