import { useState } from 'react'
import { MousePointer2, Hand, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { cn } from '@/lib/utils'

export function CanvasToolbar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const [panMode, setPanMode] = useState(false)

  const btnClass =
    'w-8 h-8 rounded bg-white shadow-md flex items-center justify-center text-gray-600 hover:text-blue-600 hover:shadow-lg transition-all'

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1">
      {/* Mode toggle */}
      <button
        onClick={() => setPanMode(false)}
        title="Select mode"
        className={cn(btnClass, !panMode && 'text-blue-600 ring-1 ring-blue-300')}
      >
        <MousePointer2 size={15} />
      </button>
      <button
        onClick={() => setPanMode(true)}
        title="Pan mode"
        className={cn(btnClass, panMode && 'text-blue-600 ring-1 ring-blue-300')}
      >
        <Hand size={15} />
      </button>

      {/* Separator */}
      <div className="h-px bg-gray-200 mx-1 my-0.5" />

      {/* Zoom controls */}
      <button
        onClick={() => zoomIn()}
        title="Zoom in"
        className={btnClass}
      >
        <ZoomIn size={15} />
      </button>
      <button
        onClick={() => zoomOut()}
        title="Zoom out"
        className={btnClass}
      >
        <ZoomOut size={15} />
      </button>
      <button
        onClick={() => fitView({ padding: 0.1 })}
        title="Fit view"
        className={btnClass}
      >
        <Maximize2 size={15} />
      </button>
    </div>
  )
}
