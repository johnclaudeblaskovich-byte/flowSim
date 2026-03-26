import { useState, useCallback, useRef, useEffect } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  MarkerType,
  type Edge,
  type EdgeProps,
} from '@xyflow/react'
import type { PipeEdge } from '@/types'
import { useProjectStore, useUIStore, useCanvasStore } from '@/store'

type PipeEdgeValidation = {
  severity: 'error' | 'warning'
  messages: string[]
}

export type PipeEdgeType = Edge<{
  pipe: PipeEdge
  validation?: PipeEdgeValidation
}, 'PipeEdge'>

// ─── Edge context menu ────────────────────────────────────────────────────────

interface EdgeCtxMenu {
  x: number
  y: number
  edgeId: string
  pipeTag: string
}

// Shared context menu state lives in a module-level ref so FlowsheetCanvas can clear it
// but we manage it locally per-edge with a callback approach instead

// ─── Renderer ────────────────────────────────────────────────────────────────

export function PipeEdgeRenderer({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<PipeEdgeType>) {
  const [hovered, setHovered] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<EdgeCtxMenu | null>(null)
  const ctxRef = useRef<HTMLDivElement>(null)

  const { project, removeEdge } = useProjectStore()
  const { activeFlowsheetId, setSelectedEdgeId } = useCanvasStore()
  const { setAccessWindowUnitId, setRightPanelOpen } = useUIStore()

  const stream = data?.pipe.stream
  const validation = data?.validation as PipeEdgeValidation | undefined

  // ── Edge color ──────────────────────────────────────────────────────────────
  let strokeColor: string
  let strokeDasharray: string | undefined

  if (selected) {
    strokeColor = '#3B82F6'      // blue
    strokeDasharray = undefined
  } else if (validation?.severity === 'error') {
    strokeColor = '#EF4444'
    strokeDasharray = '4,3'
  } else if (validation?.severity === 'warning') {
    strokeColor = '#F59E0B'
    strokeDasharray = '4,3'
  } else if (stream?.errors && stream.errors.length > 0) {
    strokeColor = '#EF4444'      // red — error
    strokeDasharray = undefined
  } else if (stream?.solved && stream.Qm > 0) {
    strokeColor = '#22C55E'      // green — flow OK
    strokeDasharray = undefined
  } else if (stream?.solved) {
    strokeColor = '#374151'      // dark — solved, zero flow
    strokeDasharray = undefined
  } else {
    strokeColor = '#D1D5DB'      // gray dashed — unsolved
    strokeDasharray = '5,4'
  }

  const strokeWidth = selected || hovered ? 3 : 1.5

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const markerId = `arrow-${id}`
  const markerEnd = `url(#${markerId})`

  // ── Context menu close on outside click ──────────────────────────────────
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

  // ── Context menu actions ──────────────────────────────────────────────────
  const ctxViewProperties = useCallback(() => {
    if (!ctxMenu) return
    // Select the edge and open access window
    setSelectedEdgeId(ctxMenu.edgeId)
    setRightPanelOpen(true)
    setCtxMenu(null)
  }, [ctxMenu, setSelectedEdgeId, setRightPanelOpen])

  const ctxCopyTag = useCallback(() => {
    if (!ctxMenu) return
    void navigator.clipboard.writeText(ctxMenu.pipeTag)
    setCtxMenu(null)
  }, [ctxMenu])

  const ctxDelete = useCallback(() => {
    if (!ctxMenu || !activeFlowsheetId) return
    removeEdge(activeFlowsheetId, ctxMenu.edgeId)
    setCtxMenu(null)
  }, [ctxMenu, activeFlowsheetId, removeEdge])

  // Suppress unused import warning
  void setAccessWindowUnitId
  void project

  const menuItem =
    'px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer rounded text-left w-full block'
  const menuSep = 'h-px bg-gray-200 my-1'

  return (
    <>
      {/* Arrow marker defs */}
      <defs>
        <marker
          id={markerId}
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L8,3 z" fill={strokeColor} />
        </marker>
      </defs>

      {/* Wider invisible hit area for hover/click */}
      <path
        d={edgePath}
        strokeWidth={20}
        stroke="transparent"
        fill="none"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setCtxMenu({
            x: e.clientX,
            y: e.clientY,
            edgeId: id,
            pipeTag: data?.pipe.tag ?? id,
          })
        }}
        style={{ cursor: 'pointer' }}
      />

      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeDasharray,
          strokeWidth,
          transition: 'stroke 0.15s, stroke-width 0.1s',
          pointerEvents: 'none',
        }}
      />

      {/* Stream hover badge */}
      {(hovered || selected) && data?.pipe.tag && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
            }}
            className="px-2 py-1 text-[10px] text-gray-700 bg-white border border-gray-200 rounded-md shadow-sm whitespace-nowrap nodrag nopan"
          >
            <span className="font-medium text-gray-800">{data.pipe.tag}</span>
            {validation && (
              <>
                {' '}
                <span className={validation.severity === 'error' ? 'text-red-600' : 'text-amber-600'}>
                  {validation.severity.toUpperCase()}
                </span>
              </>
            )}
            {stream && (
              <>
                {' '}
                <span className="text-gray-500">
                  Qm: {(stream.Qm * 3.6).toFixed(1)} t/h
                  {' | '}T: {(stream.T - 273.15).toFixed(0)}°C
                </span>
              </>
            )}
            {!stream && validation?.messages[0] && (
              <>
                {' '}
                <span className="text-gray-500">| {validation.messages[0]}</span>
              </>
            )}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Edge context menu */}
      {ctxMenu && (
        <EdgeLabelRenderer>
          <div
            ref={ctxRef}
            style={{
              position: 'fixed',
              top: ctxMenu.y,
              left: ctxMenu.x,
              zIndex: 100,
              pointerEvents: 'all',
            }}
            className="min-w-[160px] bg-white rounded-lg shadow-lg border border-gray-200 p-1 nodrag nopan"
          >
            <button className={menuItem} onClick={ctxViewProperties}>
              View Stream Properties
            </button>
            <button className={menuItem} onClick={ctxCopyTag}>
              Copy Stream Tag
            </button>
            <div className={menuSep} />
            <button
              className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 cursor-pointer rounded text-left w-full block"
              onClick={ctxDelete}
            >
              Delete Connection
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const defaultEdgeOptions = {
  type: 'PipeEdge',
  markerEnd: { type: MarkerType.ArrowClosed },
}
