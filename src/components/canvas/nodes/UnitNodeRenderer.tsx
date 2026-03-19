import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { UNIT_SYMBOLS } from '@/components/canvas/symbols'
import type { UnitNode, UnitSolveStatus } from '@/types'

export type UnitNodeType = Node<{ unit: UnitNode }, 'UnitNode'>

const STATUS_DOT: Record<UnitSolveStatus, string> = {
  idle:      'bg-gray-400',
  solving:   'bg-blue-500 animate-pulse',
  converged: 'bg-[#22C55E]',
  warning:   'bg-[#F59E0B]',
  error:     'bg-[#EF4444]',
  disabled:  'bg-[#9CA3AF]',
}

export function UnitNodeRenderer({ data, selected }: NodeProps<UnitNodeType>) {
  const { unit } = data
  const Icon = UNIT_SYMBOLS[unit.type]
  const isDisabled = !unit.enabled

  return (
    <div
      className={cn(
        'relative bg-white rounded-lg border border-gray-200 min-w-[80px] min-h-[80px]',
        'flex flex-col items-center justify-center p-2 cursor-pointer select-none',
        selected && 'ring-2 ring-blue-500',
        isDisabled && 'opacity-60',
      )}
    >
      {/* Status dot */}
      <span
        className={cn(
          'absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full',
          STATUS_DOT[unit.solveStatus],
        )}
      />

      {/* Unit icon */}
      <Icon
        size={24}
        className={cn(
          isDisabled ? 'text-gray-300' : 'text-gray-400',
        )}
      />

      {/* Tag label */}
      <span className="text-[10px] text-gray-600 mt-1 text-center leading-tight max-w-[72px] truncate">
        {unit.tag}
      </span>

      {/* Connection handles — visible on hover */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-white !rounded-full !opacity-0 hover:!opacity-100 transition-opacity"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-white !rounded-full !opacity-0 hover:!opacity-100 transition-opacity"
      />
    </div>
  )
}
