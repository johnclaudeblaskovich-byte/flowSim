import { useState } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { useProjectStore, useCanvasStore } from '@/store'
import type { Annotation } from '@/types'

export type TitleBlockNodeType = Node<{ annotation: Annotation }, 'annotation-titleblock'>

interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
}

function EditableCell({ label, value, onChange }: FieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function commit() {
    onChange(draft)
    setEditing(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === 'Escape') commit()
    e.stopPropagation()
  }

  return (
    <div className="flex border-b border-gray-200 last:border-b-0 text-[10px]">
      <div className="w-24 px-1.5 py-0.5 bg-gray-100 border-r border-gray-200 text-gray-500 font-medium flex-none">
        {label}
      </div>
      <div
        className="flex-1 px-1.5 py-0.5 cursor-text min-h-[20px]"
        onDoubleClick={() => { setDraft(value); setEditing(true) }}
      >
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKey}
            className="w-full bg-transparent outline-none text-[10px]"
          />
        ) : (
          <span>{value || <span className="text-gray-300">—</span>}</span>
        )}
      </div>
    </div>
  )
}

export function TitleBlock({ data }: NodeProps<TitleBlockNodeType>) {
  const { annotation } = data
  const { updateAnnotation } = useProjectStore()
  const { activeFlowsheetId } = useCanvasStore()

  function update(updates: Partial<Annotation>) {
    if (!activeFlowsheetId) return
    updateAnnotation(activeFlowsheetId, annotation.id, updates)
  }

  const fields: Array<{ label: string; key: keyof Annotation; value: string }> = [
    { label: 'Project',     key: 'projectName',    value: annotation.projectName    ?? '' },
    { label: 'Flowsheet',   key: 'flowsheetName',  value: annotation.flowsheetName  ?? '' },
    { label: 'Revision',    key: 'revision',        value: annotation.revision       ?? '' },
    { label: 'Date',        key: 'date',            value: annotation.date           ?? '' },
    { label: 'Drawn By',    key: 'drawnBy',         value: annotation.drawnBy        ?? '' },
    { label: 'Checked By',  key: 'checkedBy',       value: annotation.checkedBy      ?? '' },
  ]

  return (
    <div className="bg-white border-2 border-gray-400 rounded nodrag nopan" style={{ minWidth: 240 }}>
      {/* Company header */}
      <div className="bg-gray-800 text-white text-[11px] font-bold px-2 py-1 text-center tracking-wide">
        FLOWSIM
      </div>

      {/* Logo row */}
      {annotation.logoBase64 && (
        <div className="flex justify-center p-1 border-b border-gray-200">
          <img src={annotation.logoBase64} alt="Logo" className="h-8 object-contain" />
        </div>
      )}

      {/* Fields */}
      <div className="border border-gray-200">
        {fields.map(({ label, key, value }) => (
          <EditableCell
            key={key}
            label={label}
            value={value}
            onChange={(v) => update({ [key]: v })}
          />
        ))}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
    </div>
  )
}
