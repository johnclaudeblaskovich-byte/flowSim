import { useState, useCallback, useEffect, useRef } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { LeftNav } from '@/components/layout/LeftNav'
import { FlowsheetTabs } from '@/components/layout/FlowsheetTabs'
import { AccessWindowPanel } from '@/components/layout/AccessWindowPanel'
import { StatusBar } from '@/components/layout/StatusBar'
import { FlowsheetCanvas } from '@/components/canvas/FlowsheetCanvas'
import { UnitPalette } from '@/components/palette/UnitPalette'
import { ProjectExplorer } from '@/components/panels/ProjectExplorer'
import { FindDialog } from '@/components/canvas/FindDialog'
import { TrendWindow } from '@/components/trend/TrendWindow'
import { ResultsPanel } from '@/components/results/ResultsPanel'
import { ReportBuilder } from '@/components/reports/ReportBuilder'
import { NewProjectWizard } from '@/components/dialogs/NewProjectWizard'
import { DxfMappingDialog } from '@/components/dialogs/DxfMappingDialog'
import { ReactionFileEditor } from '@/components/editors/ReactionFileEditor'
import { useUIStore, useProjectStore } from '@/store'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { historian } from '@/services/historian'
import { projectIO } from '@/services/projectIO'
import { parseDXF } from '@/services/dxfImport'
import type { DxfUnit } from '@/services/dxfImport'

// ─── Auto-save constants ──────────────────────────────────────────────────────

const AUTOSAVE_KEY = 'flowsim-autosave'
const AUTOSAVE_INTERVAL_MS = 30_000

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const leftNavTab = useUIStore((s) => s.leftNavTab)
  const trendPanelOpen = useUIStore((s) => s.trendPanelOpen)
  const resultsPanelOpen = useUIStore((s) => s.resultsPanelOpen)
  const reportBuilderOpen = useUIStore((s) => s.reportBuilderOpen)
  const setReportBuilderOpen = useUIStore((s) => s.setReportBuilderOpen)

  const [findOpen, setFindOpen] = useState(false)
  const [autosaveAvailable, setAutosaveAvailable] = useState(false)

  // DXF import state
  const [dxfUnits, setDxfUnits] = useState<DxfUnit[]>([])
  const [dxfDialogOpen, setDxfDialogOpen] = useState(false)

  // Hidden file input refs
  const openFileRef = useRef<HTMLInputElement>(null)
  const dxfFileRef = useRef<HTMLInputElement>(null)

  // Initialise historian once on mount
  useEffect(() => {
    historian.init().catch(() => {
      console.warn('[FlowSim] Historian init failed — trend data will not persist')
    })
  }, [])

  // 30-second auto-save to localStorage
  useEffect(() => {
    const id = setInterval(() => {
      const { project, pgmSources, reactionFiles } = useProjectStore.getState()
      try {
        localStorage.setItem(
          AUTOSAVE_KEY,
          JSON.stringify({
            project,
            pgmSources,
            reactionFiles,
            savedAt: new Date().toISOString(),
          }),
        )
      } catch {
        // localStorage full or unavailable — ignore
      }
    }, AUTOSAVE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  // Check for autosave on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY)
      if (!raw) return
      const { savedAt } = JSON.parse(raw)
      const age = Date.now() - new Date(savedAt).getTime()
      if (age < 24 * 60 * 60 * 1000) setAutosaveAvailable(true)
    } catch {
      // ignore corrupt autosave
    }
  }, [])

  function handleRestoreAutosave() {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY)!
      const { project, pgmSources, reactionFiles } = JSON.parse(raw)
      useProjectStore.getState().setProject(project)
      useProjectStore.getState().setPGMSources(pgmSources ?? {})
      useProjectStore.getState().setReactionFiles(reactionFiles ?? {})
      setAutosaveAvailable(false)
    } catch {
      setAutosaveAvailable(false)
    }
  }

  function handleDismissAutosave() {
    localStorage.removeItem(AUTOSAVE_KEY)
    setAutosaveAvailable(false)
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    const { project, pgmSources, reactionFiles } = useProjectStore.getState()
    projectIO.saveProject(project, pgmSources, reactionFiles).catch((err) => {
      console.error('[FlowSim] Save failed:', err)
    })
  }, [])

  // ── Open ──────────────────────────────────────────────────────────────────
  const handleOpen = useCallback(() => {
    openFileRef.current?.click()
  }, [])

  async function handleFileOpen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await projectIO.loadProject(file)
      useProjectStore.getState().setProject(result.project)
      useProjectStore.getState().setPGMSources(result.pgmSources)
      useProjectStore.getState().setReactionFiles(result.reactionFiles)
      setAutosaveAvailable(false)
    } catch (err) {
      console.error('[FlowSim] Load failed:', err)
      alert(`Failed to open project: ${err instanceof Error ? err.message : String(err)}`)
    }
    // Reset input so the same file can be re-opened
    e.target.value = ''
  }

  // ── DXF Import ────────────────────────────────────────────────────────────
  const handleDxfOpen = useCallback(() => {
    dxfFileRef.current?.click()
  }, [])

  async function handleDxfFileOpen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const { units } = parseDXF(text)
      setDxfUnits(units)
      setDxfDialogOpen(true)
    } catch (err) {
      console.error('[FlowSim] DXF parse failed:', err)
      alert(`Failed to parse DXF: ${err instanceof Error ? err.message : String(err)}`)
    }
    e.target.value = ''
  }

  const handleFindOpen = useCallback(() => setFindOpen(true), [])

  useKeyboardShortcuts({ onFindOpen: handleFindOpen, onSave: handleSave, onOpen: handleOpen })

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <TopBar onOpen={handleOpen} onSave={handleSave} onDxfOpen={handleDxfOpen} />
      <div className="flex flex-1 overflow-hidden">
        <LeftNav />

        {/* Left panel — project explorer or unit palette */}
        {leftNavTab === 'flowsheets' && <ProjectExplorer />}
        {leftNavTab === 'units' && <UnitPalette />}

        {/* Main content column */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <FlowsheetTabs />

          {leftNavTab === 'reactions' ? (
            <div className="flex-1 overflow-hidden">
              <ReactionFileEditor />
            </div>
          ) : (
            <div className="flex flex-1 overflow-hidden">
              <FlowsheetCanvas />
              <AccessWindowPanel />
            </div>
          )}

          {/* Trend panel — collapsible bottom panel */}
          {trendPanelOpen && leftNavTab !== 'reactions' && (
            <div className="h-64 flex-none border-t border-gray-200 overflow-hidden">
              <TrendWindow />
            </div>
          )}
        </div>
      </div>

      {/* Results panel — collapsible bottom dock */}
      {resultsPanelOpen && <ResultsPanel />}

      {/* Auto-save restore banner */}
      {autosaveAvailable && (
        <div className="flex items-center justify-between px-4 py-1 bg-amber-50 border-t border-amber-200 text-xs text-amber-700 flex-none">
          <span>Unsaved session found from a previous visit.</span>
          <div className="flex gap-3">
            <button onClick={handleRestoreAutosave} className="font-medium hover:underline">
              Restore
            </button>
            <button onClick={handleDismissAutosave} className="hover:underline">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <StatusBar />

      {/* Hidden file inputs */}
      <input
        ref={openFileRef}
        type="file"
        accept=".fsim"
        className="hidden"
        onChange={handleFileOpen}
      />
      <input
        ref={dxfFileRef}
        type="file"
        accept=".dxf"
        className="hidden"
        onChange={handleDxfFileOpen}
      />

      {/* Find dialog */}
      <FindDialog open={findOpen} onClose={() => setFindOpen(false)} />

      {/* Report builder — full-screen modal */}
      {reportBuilderOpen && (
        <ReportBuilder open={reportBuilderOpen} onClose={() => setReportBuilderOpen(false)} />
      )}

      {/* New Project Wizard */}
      <NewProjectWizard />

      {/* DXF Mapping Dialog */}
      <DxfMappingDialog
        open={dxfDialogOpen}
        units={dxfUnits}
        onClose={() => setDxfDialogOpen(false)}
      />
    </div>
  )
}

export default App
