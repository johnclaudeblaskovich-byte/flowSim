import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  MarkerType,
  type Edge,
  type EdgeProps,
} from '@xyflow/react'
import type { PipeEdge } from '@/types'

export type PipeEdgeType = Edge<{ pipe: PipeEdge }, 'PipeEdge'>

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
  const stream = data?.pipe.stream

  let strokeColor = '#D1D5DB'
  let strokeDasharray: string | undefined = '5,5'

  if (stream) {
    if (stream.errors && stream.errors.length > 0) {
      strokeColor = '#EF4444'
      strokeDasharray = undefined
    } else if (stream.solved) {
      strokeColor = '#374151'
      strokeDasharray = undefined
    }
  }

  if (selected) {
    strokeColor = '#3B82F6'
    strokeDasharray = undefined
  }

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const markerEnd = `url(#arrow-${id})`

  return (
    <>
      {/* Custom arrow marker */}
      <defs>
        <marker
          id={`arrow-${id}`}
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

      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeDasharray,
          strokeWidth: 1.5,
        }}
      />

      {/* Stream tag label — visible on hover */}
      {data?.pipe.tag && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="px-1.5 py-0.5 text-[9px] text-gray-600 bg-white border border-gray-200 rounded shadow-sm opacity-0 hover:opacity-100 transition-opacity nodrag nopan"
          >
            {data.pipe.tag}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

// Tell React Flow the marker type (used when creating edges via connection)
export const defaultEdgeOptions = {
  type: 'PipeEdge',
  markerEnd: { type: MarkerType.ArrowClosed },
}
