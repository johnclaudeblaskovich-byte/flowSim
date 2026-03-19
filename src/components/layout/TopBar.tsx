import { Play, Pause, Square } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@radix-ui/react-tooltip'
import { useProjectStore } from '@/store'
import { useSolverStore } from '@/store'
import { cn } from '@/lib/utils'

function SolverButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  disabled: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
              'w-8 h-8 rounded flex items-center justify-center transition-colors',
              disabled
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
            )}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-gray-800 text-white text-xs px-2 py-1 rounded">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function TopBar() {
  const projectName = useProjectStore((s) => s.project.name)
  const { solverState, startSolve, pauseSolve, stopSolve } = useSolverStore()
  const { status } = solverState

  const isSolving = status === 'solving'
  const isPaused = status === 'paused'
  const isIdle = status === 'idle' || status === 'converged' || status === 'error'

  return (
    <div className="flex items-center justify-between px-4 h-12 bg-white border-b border-gray-200 shadow-sm flex-none">
      {/* Left: Logo + project name */}
      <div className="flex items-center gap-3">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          className="flex-none"
        >
          <polygon points="12,2 20,7 20,17 12,22 4,17 4,7" fill="#3B82F6" />
          <polygon
            points="12,6 17,9 17,15 12,18 7,15 7,9"
            fill="white"
            opacity="0.3"
          />
          <circle cx="12" cy="12" r="2.5" fill="white" />
        </svg>
        <span className="text-sm font-semibold text-gray-700 max-w-[200px] truncate">
          {projectName}
        </span>
      </div>

      {/* Center: Solver controls */}
      <div className="flex items-center gap-1">
        <SolverButton
          onClick={startSolve}
          disabled={isSolving}
          label="Solve (F5)"
        >
          <Play size={16} />
        </SolverButton>
        <SolverButton
          onClick={pauseSolve}
          disabled={!isSolving}
          label="Pause"
        >
          <Pause size={16} />
        </SolverButton>
        <SolverButton
          onClick={stopSolve}
          disabled={isIdle && !isPaused}
          label="Stop"
        >
          <Square size={16} />
        </SolverButton>
      </div>

      {/* Right: User avatar */}
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium">
        U
      </div>
    </div>
  )
}
