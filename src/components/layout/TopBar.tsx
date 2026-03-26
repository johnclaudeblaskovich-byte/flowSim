import { useState } from 'react'
import { Play, Pause, Square, LineChart, TableProperties } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@radix-ui/react-tooltip'
import { useProjectStore, useCanvasStore, useSolverStore, useUIStore } from '@/store'
import { tagRegistry } from '@/services/tagRegistry'
import { exportService } from '@/services/exportService'
import { validateProject } from '@/services/projectValidator'
import { buildReadinessReport } from '@/services/readinessReport'
import { solverService } from '@/services/solverService'
import { toast } from '@/hooks/useToastStore'
import { ValidationDialog } from '@/components/dialogs/ValidationDialog'
import type { ValidationResult } from '@/services/projectValidator'
import { cn } from '@/lib/utils'

interface TopBarProps {
  onOpen?: () => void
  onSave?: () => void
  onDxfOpen?: () => void
  onOpenExample?: () => void
}

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

function IconButton({
  onClick,
  label,
  active,
  children,
}: {
  onClick: () => void
  label: string
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              'w-8 h-8 rounded flex items-center justify-center transition-colors',
              active
                ? 'bg-blue-100 text-blue-600'
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

export function TopBar({ onOpen, onSave, onDxfOpen, onOpenExample }: TopBarProps) {
  const project = useProjectStore((s) => s.project)
  const addReadinessReport = useProjectStore((s) => s.addReadinessReport)
  const { solverState, startSolve, pauseSolve, stopSolve } = useSolverStore()
  const { status } = solverState
  const {
    trendPanelOpen, toggleTrendPanel,
    resultsPanelOpen, toggleResultsPanel,
    setReportBuilderOpen,
    setNewProjectWizardOpen,
  } = useUIStore()
  const activeFlowsheetId = useCanvasStore((s) => s.activeFlowsheetId)

  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)

  const isSolving = status === 'solving'
  const isPaused = status === 'paused'
  const isIdle = status === 'idle' || status === 'converged' || status === 'error'

  function handleStartSolve() {
    addReadinessReport(buildReadinessReport(project))
    const result = validateProject(project)
    if (!result.valid || result.warnings.length > 0) {
      setValidationResult(result)
      return
    }
    doSolve()
  }

  function doSolve() {
    startSolve()
    solverService.solve(project)
    toast.info('Solving…', `Started solve for "${project.name}"`)
  }

  function handleSolveAnyway() {
    setValidationResult(null)
    doSolve()
  }

  function handleSaveAs() {
    // Save As: identical to Save for now (uses current project name as filename)
    onSave?.()
  }

  function handleExportExcel() {
    exportService.exportToExcel({ project })
  }

  function handleExportCSV() {
    const allTagPaths = tagRegistry
      .buildTagList(project)
      .filter((d) => d.parentType === 'Pipe')
      .map((d) => d.tagPath)
    exportService.exportToCSV(allTagPaths, project)
  }

  function handleExportSVG() {
    const fsId = activeFlowsheetId ?? project.flowsheets[0]?.id ?? 'flowsheet'
    exportService.exportFlowsheetSVG(fsId)
  }

  function handleExportPNG() {
    const fsId = activeFlowsheetId ?? project.flowsheets[0]?.id ?? 'flowsheet'
    exportService.exportFlowsheetPNG(fsId)
  }

  function handleExportReadiness() {
    const report = buildReadinessReport(project)
    addReadinessReport(report)
    exportService.exportReadinessReport(project, report)
  }

  return (
    <div className="flex items-center justify-between px-4 h-12 bg-white border-b border-gray-200 shadow-sm flex-none">
      {/* Left: File menu + Logo + project name */}
      <div className="flex items-center gap-2">
        {/* File dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="px-2 h-7 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors">
              File
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="start"
              sideOffset={4}
              className="bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[220px] py-1 text-sm"
            >
              {/* Project file operations */}
              <DropdownMenu.Item
                className="px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 cursor-pointer outline-none flex items-center justify-between"
                onSelect={() => setNewProjectWizardOpen(true)}
              >
                <span>New Project…</span>
                <span className="text-gray-400 text-[10px]">Ctrl+N</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 cursor-pointer outline-none flex items-center justify-between"
                onSelect={() => onOpen?.()}
              >
                <span>Open…</span>
                <span className="text-gray-400 text-[10px]">Ctrl+O</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 cursor-pointer outline-none"
                onSelect={() => onOpenExample?.()}
              >
                Open Example Project…
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 cursor-pointer outline-none flex items-center justify-between"
                onSelect={() => onSave?.()}
              >
                <span>Save</span>
                <span className="text-gray-400 text-[10px]">Ctrl+S</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 cursor-pointer outline-none"
                onSelect={handleSaveAs}
              >
                Save As…
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 border-t border-gray-100" />
              <DropdownMenu.Item
                className="px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 cursor-pointer outline-none"
                onSelect={() => onDxfOpen?.()}
              >
                Import DXF…
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 border-t border-gray-100" />
              <DropdownMenu.Label className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                Export
              </DropdownMenu.Label>
              <DropdownMenu.Separator className="my-1 border-t border-gray-100" />
              <DropdownMenu.Item
                className="px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 cursor-pointer outline-none flex items-center gap-2"
                onSelect={handleExportExcel}
              >
                Mass Balance (Excel)
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 cursor-pointer outline-none flex items-center gap-2"
                onSelect={handleExportCSV}
              >
                Stream Data (CSV)
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 cursor-pointer outline-none flex items-center gap-2"
                onSelect={handleExportReadiness}
              >
                Solve Readiness (JSON)
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 border-t border-gray-100" />
              <DropdownMenu.Item
                className="px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 cursor-pointer outline-none flex items-center gap-2"
                onSelect={handleExportSVG}
              >
                Flowsheet (SVG)
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 cursor-pointer outline-none flex items-center gap-2"
                onSelect={handleExportPNG}
              >
                Flowsheet (PNG)
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 border-t border-gray-100" />
              <DropdownMenu.Item
                className="px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 cursor-pointer outline-none flex items-center gap-2"
                onSelect={() => setReportBuilderOpen(true)}
              >
                Report Builder…
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <div className="w-px h-4 bg-gray-200" />

        {/* Logo */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="flex-none">
          <polygon points="12,2 20,7 20,17 12,22 4,17 4,7" fill="#3B82F6" />
          <polygon points="12,6 17,9 17,15 12,18 7,15 7,9" fill="white" opacity="0.3" />
          <circle cx="12" cy="12" r="2.5" fill="white" />
        </svg>
        <span className="text-sm font-semibold text-gray-700 max-w-[200px] truncate">
          {project.name}
        </span>
      </div>

      {/* Center: Solver controls */}
      <div className="flex items-center gap-1">
        <SolverButton onClick={handleStartSolve} disabled={isSolving} label="Solve (F5)">
          <Play size={16} />
        </SolverButton>
        <SolverButton onClick={pauseSolve} disabled={!isSolving} label="Pause">
          <Pause size={16} />
        </SolverButton>
        <SolverButton onClick={stopSolve} disabled={isIdle && !isPaused} label="Stop">
          <Square size={16} />
        </SolverButton>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <IconButton onClick={toggleTrendPanel} label="Trend Window" active={trendPanelOpen}>
          <LineChart size={16} />
        </IconButton>
        <IconButton onClick={toggleResultsPanel} label="Results Panel" active={resultsPanelOpen}>
          <TableProperties size={16} />
        </IconButton>
      </div>

      {/* Right: User avatar */}
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium">
        U
      </div>

      {/* Pre-solve validation dialog */}
      {validationResult && (
        <ValidationDialog
          open={true}
          result={validationResult}
          onClose={() => setValidationResult(null)}
          onSolveAnyway={handleSolveAnyway}
        />
      )}
    </div>
  )
}
