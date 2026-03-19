import { useState, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { LeftNav } from '@/components/layout/LeftNav'
import { FlowsheetTabs } from '@/components/layout/FlowsheetTabs'
import { AccessWindowPanel } from '@/components/layout/AccessWindowPanel'
import { StatusBar } from '@/components/layout/StatusBar'
import { FlowsheetCanvas } from '@/components/canvas/FlowsheetCanvas'
import { UnitPalette } from '@/components/palette/UnitPalette'
import { ProjectExplorer } from '@/components/panels/ProjectExplorer'
import { FindDialog } from '@/components/canvas/FindDialog'
import { useUIStore } from '@/store'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

function App() {
  const leftNavTab = useUIStore((s) => s.leftNavTab)
  const [findOpen, setFindOpen] = useState(false)

  const handleSave = useCallback(() => {
    // Stub: project save will be implemented in a future phase
    console.info('[FlowSim] Save triggered (Ctrl+S)')
  }, [])

  const handleFindOpen = useCallback(() => setFindOpen(true), [])

  useKeyboardShortcuts({ onFindOpen: handleFindOpen, onSave: handleSave })

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <LeftNav />

        {/* Left panel — project explorer or unit palette */}
        {leftNavTab === 'flowsheets' && <ProjectExplorer />}
        {leftNavTab === 'units' && <UnitPalette />}

        {/* Main content column */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <FlowsheetTabs />
          <div className="flex flex-1 overflow-hidden">
            <FlowsheetCanvas />
            <AccessWindowPanel />
          </div>
        </div>
      </div>
      <StatusBar />

      {/* Find dialog */}
      <FindDialog open={findOpen} onClose={() => setFindOpen(false)} />
    </div>
  )
}

export default App
