import { memo, useMemo } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { UNIT_SYMBOLS } from '@/components/canvas/symbols'
import type { UnitNode, UnitSolveStatus, UnitModelType } from '@/types'

export type UnitNodeType = Node<{
  unit: UnitNode
  validation?: {
    severity: 'error' | 'warning'
    messages: string[]
  }
}, 'UnitNode'>

// ─── Color mappings ───────────────────────────────────────────────────────────

const STATUS_DOT: Record<UnitSolveStatus, string> = {
  idle:      'bg-gray-400',
  solving:   'bg-blue-500 animate-pulse',
  converged: 'bg-green-500',
  warning:   'bg-amber-400',
  error:     'bg-red-500',
  disabled:  'bg-gray-300',
}

// Symbol color per solve status (spec: gray-500 idle, gray-700 converged, red error)
function getSymbolColor(status: UnitSolveStatus, enabled: boolean): string {
  if (!enabled) return '#D1D5DB'   // gray-300
  switch (status) {
    case 'converged': return '#374151'  // gray-700
    case 'error':     return '#EF4444'  // red-500
    case 'warning':   return '#F59E0B'  // amber-400
    case 'solving':   return '#3B82F6'  // blue-500
    default:          return '#6B7280'  // gray-500
  }
}

// ─── Node renderer ───────────────────────────────────────────────────────────

export const UnitNodeRenderer = memo(function UnitNodeRenderer({ data, selected }: NodeProps<UnitNodeType>) {
  const { unit, validation } = data

  // Memoize symbol lookup — avoids re-computation on unrelated re-renders
  const Symbol = useMemo(() => {
    const key = (unit.symbolKey in UNIT_SYMBOLS ? unit.symbolKey : unit.type) as UnitModelType
    return UNIT_SYMBOLS[key]
  }, [unit.symbolKey, unit.type])

  // Memoize symbol color
  const symbolColor = useMemo(
    () => getSymbolColor(unit.solveStatus, unit.enabled),
    [unit.solveStatus, unit.enabled],
  )

  const isDisabled = !unit.enabled
  // FeederSink gets dashed border to indicate cross-page connector status
  const isCrossPage = unit.type === 'FeederSink'

  // Error tooltip — native title attribute for simplicity
  const errorTitle = unit.errorMessages.length > 0
    ? unit.errorMessages.join('\n')
    : undefined
  const validationTitle = validation?.messages.length ? validation.messages.join('\n') : undefined
  const title = [errorTitle, validationTitle].filter(Boolean).join('\n')

  return (
    <div
      title={title || undefined}
      className={cn(
        'relative bg-white rounded-lg border-2 min-w-[80px] min-h-[80px]',
        'flex flex-col items-center justify-center p-2 cursor-pointer select-none',
        selected
          ? 'border-blue-500 shadow-md shadow-blue-100'
          : validation?.severity === 'error'
            ? 'border-red-400 shadow-sm shadow-red-100'
            : validation?.severity === 'warning'
              ? 'border-amber-400 shadow-sm shadow-amber-100'
          : isCrossPage
            ? 'border-dashed border-gray-400'
            : 'border-gray-200',
        isDisabled && 'opacity-60',
      )}
    >
      {/* Status dot */}
      <span
        className={cn(
          'absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full',
          validation?.severity === 'error'
            ? 'bg-red-500'
            : validation?.severity === 'warning'
              ? 'bg-amber-400'
              : STATUS_DOT[unit.solveStatus],
        )}
      />

      {validation && (
        <span
          className={cn(
            'absolute top-1.5 left-1.5 px-1 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide',
            validation.severity === 'error'
              ? 'bg-red-100 text-red-700'
              : 'bg-amber-100 text-amber-700',
          )}
        >
          {validation.severity}
        </span>
      )}

      {/* SVG Symbol — 36×36 centered */}
      <Symbol size={36} color={symbolColor} />

      {/* Tag label */}
      <span className="text-[10px] text-gray-600 mt-1 text-center leading-tight max-w-[72px] truncate">
        {unit.tag}
      </span>

      {/* Connection handles — visible on node hover via CSS */}
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
})
