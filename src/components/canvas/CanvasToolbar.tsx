import { useState } from 'react'
import {
  MousePointer2, Hand, ZoomIn, ZoomOut, Maximize2,
  Type, Square, FileText,
} from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { cn } from '@/lib/utils'

interface CanvasToolbarProps {
  onInsertAnnotation?: (type: 'text' | 'border' | 'titleblock') => void
}

export function CanvasToolbar({ onInsertAnnotation }: CanvasToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const [panMode, setPanMode] = useState(false)

  const btnClass =
    'w-8 h-8 rounded bg-white shadow-md flex items-center justify-center text-gray-600 hover:text-blue-600 hover:shadow-lg transition-all'

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1">
      {/* Mode toggle */}
      <button
        onClick={() => setPanMode(false)}
        title="Select mode (S)"
        className={cn(btnClass, !panMode && 'text-blue-600 ring-1 ring-blue-300')}
      >
        <MousePointer2 size={15} />
      </button>
      <button
        onClick={() => setPanMode(true)}
        title="Pan mode (Space)"
        className={cn(btnClass, panMode && 'text-blue-600 ring-1 ring-blue-300')}
      >
        <Hand size={15} />
      </button>

      {/* Separator */}
      <div className="h-px bg-gray-200 mx-1 my-0.5" />

      {/* Zoom controls */}
      <button
        onClick={() => zoomIn()}
        title="Zoom in (Ctrl+=)"
        className={btnClass}
      >
        <ZoomIn size={15} />
      </button>
      <button
        onClick={() => zoomOut()}
        title="Zoom out (Ctrl+-)"
        className={btnClass}
      >
        <ZoomOut size={15} />
      </button>
      <button
        onClick={() => fitView({ padding: 0.1 })}
        title="Fit view (Ctrl+0)"
        className={btnClass}
      >
        <Maximize2 size={15} />
      </button>

      {/* Separator */}
      {onInsertAnnotation && (
        <>
          <div className="h-px bg-gray-200 mx-1 my-0.5" />

          {/* Annotation tools */}
          <button
            onClick={() => onInsertAnnotation('text')}
            title="Insert text label"
            className={btnClass}
          >
            <Type size={15} />
          </button>
          <button
            onClick={() => onInsertAnnotation('border')}
            title="Insert border frame"
            className={btnClass}
          >
            <Square size={15} />
          </button>
          <button
            onClick={() => onInsertAnnotation('titleblock')}
            title="Insert title block"
            className={btnClass}
          >
            <FileText size={15} />
          </button>
        </>
      )}
    </div>
  )
}
