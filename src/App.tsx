import { TopBar } from '@/components/layout/TopBar'
import { LeftNav } from '@/components/layout/LeftNav'
import { FlowsheetTabs } from '@/components/layout/FlowsheetTabs'
import { AccessWindowPanel } from '@/components/layout/AccessWindowPanel'
import { StatusBar } from '@/components/layout/StatusBar'
import { FlowsheetCanvas } from '@/components/canvas/FlowsheetCanvas'
import { UnitPalette } from '@/components/palette/UnitPalette'
import { useUIStore } from '@/store'

function App() {
  const leftNavTab = useUIStore((s) => s.leftNavTab)

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <LeftNav />
        {/* Left panel — shows palette when unit tab is active */}
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
    </div>
  )
}

export default App
