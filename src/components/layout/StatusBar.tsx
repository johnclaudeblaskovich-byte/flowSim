import { useSolverStore } from '@/store'
import { cn } from '@/lib/utils'
import type { SolverStatus } from '@/types'

const STATUS_DOT: Record<SolverStatus, string> = {
  idle:      'bg-gray-400',
  solving:   'bg-blue-500 animate-pulse',
  converged: 'bg-green-500',
  error:     'bg-red-500',
  paused:    'bg-amber-500',
}

const STATUS_LABEL: Record<SolverStatus, string> = {
  idle:      'Idle',
  solving:   'Solving',
  converged: 'Converged',
  error:     'Error',
  paused:    'Paused',
}

export function StatusBar() {
  const { status, iteration, maxError, elapsedMs } = useSolverStore(
    (s) => s.solverState,
  )

  return (
    <div className="flex items-center justify-between px-4 h-7 bg-gray-100 border-t border-gray-200 text-xs text-gray-500 flex-none">
      {/* Left: Status */}
      <div className="flex items-center gap-1.5">
        <span className={cn('w-2 h-2 rounded-full flex-none', STATUS_DOT[status])} />
        <span>Status: {STATUS_LABEL[status]}</span>
      </div>

      {/* Center: Iteration + Error */}
      <div className="flex items-center gap-3">
        <span>Iter: {iteration === 0 ? '—' : iteration}</span>
        <span>
          Max Error:{' '}
          {maxError === 0 ? '—' : maxError.toExponential(2)}
        </span>
      </div>

      {/* Right: Time */}
      <div>
        Time: {elapsedMs === 0 ? '—' : `${elapsedMs}ms`}
      </div>
    </div>
  )
}
