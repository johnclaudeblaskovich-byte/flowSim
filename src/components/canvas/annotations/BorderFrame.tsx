import { useState, useCallback } from 'react'
import { Handle, Position, type Node, type NodeProps, NodeResizer } from '@xyflow/react'
import { useProjectStore, useCanvasStore } from '@/store'
import { cn } from '@/lib/utils'
import type { Annotation } from '@/types'

export type BorderFrameNodeType = Node<{ annotation: Annotation }, 'annotation-border'>

export function BorderFrame({ data, selected }: NodeProps<BorderFrameNodeType>) {
  const { annotation } = data
  const [editingHeader, setEditingHeader] = useState(false)
  const [headerDraft, setHeaderDraft] = useState(annotation.headerText ?? '')
  const { updateAnnotation } = useProjectStore()
  const { activeFlowsheetId } = useCanvasStore()

  const borderColor = annotation.borderColor ?? '#9CA3AF'
  const borderWidth = annotation.borderWidth ?? 1
  const borderStyle = annotation.borderStyle ?? 'solid'
  const headerColor = annotation.headerColor ?? '#3B82F6'

  const commitHeader = useCallback(() => {
    if (!activeFlowsheetId) return
    updateAnnotation(activeFlowsheetId, annotation.id, { headerText: headerDraft })
    setEditingHeader(false)
  }, [activeFlowsheetId, annotation.id, headerDraft, updateAnnotation])

  function handleHeaderKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === 'Escape') {
      commitHeader()
    }
    e.stopPropagation()
  }

  return (
    <>
      {/* Node resizer (8 handles) */}
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={60}
        lineStyle={{ stroke: '#3B82F6', strokeWidth: 1 }}
        handleStyle={{ background: '#3B82F6', border: 'none', width: 8, height: 8 }}
      />

      <div
        className="w-full h-full nodrag nopan relative"
        style={{
          border: `${borderWidth}px ${borderStyle} ${borderColor}`,
          borderRadius: 4,
          backgroundColor: 'transparent',
        }}
      >
        {/* Optional header bar */}
        {(annotation.headerText !== undefined || selected) && (
          <div
            className="absolute top-0 left-0 right-0 px-2 py-1 flex items-center"
            style={{
              backgroundColor: headerColor,
              borderRadius: '3px 3px 0 0',
              minHeight: 24,
            }}
            onDoubleClick={() => {
              setHeaderDraft(annotation.headerText ?? '')
              setEditingHeader(true)
            }}
          >
            {editingHeader ? (
              <input
                autoFocus
                value={headerDraft}
                onChange={(e) => setHeaderDraft(e.target.value)}
                onBlur={commitHeader}
                onKeyDown={handleHeaderKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 text-xs text-white bg-transparent border-b border-white/50 outline-none"
              />
            ) : (
              <span className="text-xs text-white font-medium truncate cursor-text">
                {annotation.headerText || (selected ? 'Double-click to set title' : '')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* No connection handles */}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
    </>
  )
}

// Styling toolbar (future: render in properties panel)
export function BorderFrameToolbar({ annotationId }: { annotationId: string }) {
  const { project, updateAnnotation } = useProjectStore()
  const { activeFlowsheetId } = useCanvasStore()
  const fs = project.flowsheets.find((f) => f.id === activeFlowsheetId)
  const ann = fs?.annotations.find((a) => a.id === annotationId)
  if (!ann) return null

  function update(updates: Partial<Annotation>) {
    if (!activeFlowsheetId) return
    updateAnnotation(activeFlowsheetId, annotationId, updates)
  }

  const BORDER_COLORS = ['#9CA3AF', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#111827']

  return (
    <div className={cn('flex items-center gap-1 p-1 flex-wrap')}>
      <select
        value={ann.borderStyle ?? 'solid'}
        onChange={(e) => update({ borderStyle: e.target.value as 'solid' | 'dashed' })}
        className="text-xs border border-gray-200 rounded px-1 py-0.5"
      >
        <option value="solid">Solid</option>
        <option value="dashed">Dashed</option>
      </select>
      <select
        value={ann.borderWidth ?? 1}
        onChange={(e) => update({ borderWidth: Number(e.target.value) })}
        className="text-xs border border-gray-200 rounded px-1 py-0.5"
      >
        <option value={1}>1px</option>
        <option value={2}>2px</option>
        <option value={3}>3px</option>
      </select>
      <div className="flex gap-0.5">
        {BORDER_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => update({ borderColor: c })}
            className={cn('w-4 h-4 rounded-sm border', ann.borderColor === c && 'ring-2 ring-blue-400')}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  )
}
