import { useState, useRef, useEffect, useCallback } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { useProjectStore, useCanvasStore } from '@/store'
import { cn } from '@/lib/utils'
import type { Annotation } from '@/types'

export type TextLabelNodeType = Node<{ annotation: Annotation }, 'annotation-text'>

const TEXT_COLORS = [
  '#111827', '#374151', '#6B7280', '#3B82F6',
  '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
]

export function TextLabel({ data, selected }: NodeProps<TextLabelNodeType>) {
  const { annotation } = data
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(annotation.content ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { updateAnnotation } = useProjectStore()
  const { activeFlowsheetId } = useCanvasStore()

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus()
      textareaRef.current?.select()
    }
  }, [editing])

  const commitEdit = useCallback(() => {
    if (!activeFlowsheetId) return
    updateAnnotation(activeFlowsheetId, annotation.id, { content: draft })
    setEditing(false)
  }, [activeFlowsheetId, annotation.id, draft, updateAnnotation])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setDraft(annotation.content ?? '')
      setEditing(false)
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      commitEdit()
    }
    e.stopPropagation()
  }

  const fontSize = annotation.fontSize ?? 14
  const color = annotation.textColor ?? '#374151'
  const fontWeight = annotation.fontWeight ?? 'normal'
  const fontStyle = annotation.fontStyle ?? 'normal'

  return (
    <div
      className={cn(
        'min-w-[80px] min-h-[24px] nodrag nopan relative',
        selected && 'outline outline-2 outline-blue-400 outline-offset-2 rounded',
      )}
      onDoubleClick={() => setEditing(true)}
    >
      {editing ? (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="block w-full bg-white border border-blue-400 rounded p-1 resize-none outline-none"
          style={{ fontSize, color, fontWeight, fontStyle, minWidth: 80, minHeight: 24 }}
          rows={Math.max(1, draft.split('\n').length)}
        />
      ) : (
        <div
          className="whitespace-pre-wrap cursor-text"
          style={{ fontSize, color, fontWeight, fontStyle }}
        >
          {annotation.content || (
            <span className="text-gray-300 italic">Double-click to edit</span>
          )}
        </div>
      )}

      {/* Invisible handles for selection only (no connections) */}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
    </div>
  )
}

// Formatting toolbar (rendered in AccessWindowPanel for selected text labels)
export function TextLabelToolbar({ annotationId }: { annotationId: string }) {
  const { project, updateAnnotation } = useProjectStore()
  const { activeFlowsheetId } = useCanvasStore()
  const fs = project.flowsheets.find((f) => f.id === activeFlowsheetId)
  const ann = fs?.annotations.find((a) => a.id === annotationId)
  if (!ann) return null

  function update(updates: Partial<Annotation>) {
    if (!activeFlowsheetId) return
    updateAnnotation(activeFlowsheetId, annotationId, updates)
  }

  return (
    <div className="flex items-center gap-1 p-1 flex-wrap">
      {/* Font size */}
      <select
        value={ann.fontSize ?? 14}
        onChange={(e) => update({ fontSize: Number(e.target.value) })}
        className="text-xs border border-gray-200 rounded px-1 py-0.5"
      >
        {[10, 12, 14, 16, 18, 20, 24].map((s) => (
          <option key={s} value={s}>{s}px</option>
        ))}
      </select>
      {/* Bold */}
      <button
        onClick={() => update({ fontWeight: ann.fontWeight === 'bold' ? 'normal' : 'bold' })}
        className={cn('w-6 h-6 text-xs rounded border', ann.fontWeight === 'bold' ? 'bg-gray-200' : 'bg-white')}
      >
        B
      </button>
      {/* Italic */}
      <button
        onClick={() => update({ fontStyle: ann.fontStyle === 'italic' ? 'normal' : 'italic' })}
        className={cn('w-6 h-6 text-xs italic rounded border', ann.fontStyle === 'italic' ? 'bg-gray-200' : 'bg-white')}
      >
        I
      </button>
      {/* Color swatches */}
      <div className="flex gap-0.5">
        {TEXT_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => update({ textColor: c })}
            className={cn('w-4 h-4 rounded-sm border', ann.textColor === c && 'ring-2 ring-blue-400')}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  )
}
