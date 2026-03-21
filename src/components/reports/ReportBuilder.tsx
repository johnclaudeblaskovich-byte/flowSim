import { useState, useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { X, Plus, ChevronDown, GripVertical, Trash2 } from 'lucide-react'
import { useProjectStore } from '@/store'
import { tagRegistry, type TagDefinition } from '@/services/tagRegistry'
import { generateReport } from '@/services/reportGenerator'
import { templateMassBalance, templateStreamProperties, templateUnitSummary } from '@/services/reportGenerator'
import { exportService } from '@/services/exportService'
import type { ReportConfig, ReportSection, ReportField } from '@/types'
import { cn } from '@/lib/utils'

// ─── Tag panel (left) ─────────────────────────────────────────────────────────

function TagPanel({
  tags,
  onDragStart,
}: {
  tags: TagDefinition[]
  onDragStart: (tagPath: string) => void
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(
    () =>
      query
        ? tags.filter(
            (t) =>
              t.tagPath.toLowerCase().includes(query.toLowerCase()) ||
              t.displayName.toLowerCase().includes(query.toLowerCase()) ||
              t.parentTag.toLowerCase().includes(query.toLowerCase()),
          )
        : tags,
    [tags, query],
  )

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 py-2 border-b border-gray-200 flex-none">
        <input
          className="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-blue-400"
          placeholder="Search tags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-xs text-gray-400 p-3">No tags found.</p>
        )}
        {filtered.map((tag) => (
          <div
            key={tag.tagPath}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('tagPath', tag.tagPath)
              e.dataTransfer.effectAllowed = 'copy'
              onDragStart(tag.tagPath)
            }}
            className="px-2 py-1 text-xs cursor-grab hover:bg-blue-50 border-b border-gray-50 flex items-center gap-1.5"
            title={tag.tagPath}
          >
            <GripVertical size={10} className="text-gray-300 flex-none" />
            <div className="min-w-0">
              <div className="font-mono text-gray-700 truncate">{tag.tagPath}</div>
              <div className="text-gray-400 truncate">{tag.displayName}{tag.unit ? ` [${tag.unit}]` : ''}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Section block (center) ───────────────────────────────────────────────────

function SectionBlock({
  section,
  allDefs,
  project,
  onUpdate,
  onDelete,
  onDropTag,
  onFieldUpdate,
  onFieldDelete,
  onFieldReorder,
}: {
  section: ReportSection
  allDefs: TagDefinition[]
  project: ReturnType<typeof useProjectStore.getState>['project']
  onUpdate: (updates: Partial<ReportSection>) => void
  onDelete: () => void
  onDropTag: (tagPath: string) => void
  onFieldUpdate: (fieldId: string, updates: Partial<ReportField>) => void
  onFieldDelete: (fieldId: string) => void
  onFieldReorder: (dragIdx: number, dropIdx: number) => void
}) {
  const [isOver, setIsOver] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [dragFieldIdx, setDragFieldIdx] = useState<number | null>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsOver(false)
    const tagPath = e.dataTransfer.getData('tagPath')
    const fieldId = e.dataTransfer.getData('fieldId')
    if (fieldId) return // handled by field rows
    if (tagPath) onDropTag(tagPath)
  }

  return (
    <div
      className={cn(
        'border border-gray-200 rounded mb-3',
        isOver ? 'border-blue-400 bg-blue-50/30' : 'bg-white',
      )}
      onDragOver={(e) => { e.preventDefault(); setIsOver(true) }}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
    >
      {/* Section header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 rounded-t">
        {editingName ? (
          <input
            autoFocus
            className="flex-1 text-xs font-semibold border border-blue-400 rounded px-1 py-0.5 outline-none"
            value={section.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => { if (e.key === 'Enter') setEditingName(false) }}
          />
        ) : (
          <span
            className="flex-1 text-xs font-semibold text-gray-700 cursor-pointer hover:text-blue-600"
            onClick={() => setEditingName(true)}
            title="Click to rename"
          >
            {section.name || 'Unnamed Section'}
          </span>
        )}
        <button
          className="text-gray-400 hover:text-red-500 transition-colors"
          onClick={onDelete}
          title="Delete section"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Fields */}
      <div className="p-2 flex flex-col gap-1">
        {section.fields.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">
            Drag tags here to add fields
          </p>
        )}
        {section.fields.map((field, idx) => {
          const def = allDefs.find((d) => d.tagPath === field.tagPath)
          const rawVal = tagRegistry.resolveTagValue(field.tagPath, project)
          const displayVal = typeof rawVal === 'number' ? rawVal.toPrecision(4) : rawVal != null ? String(rawVal) : '—'

          return (
            <div
              key={field.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('fieldId', field.id)
                e.dataTransfer.setData('fieldIdx', String(idx))
                setDragFieldIdx(idx)
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.stopPropagation()
                const srcIdx = parseInt(e.dataTransfer.getData('fieldIdx'), 10)
                if (!isNaN(srcIdx) && srcIdx !== idx) onFieldReorder(srcIdx, idx)
                setDragFieldIdx(null)
              }}
              onDragEnd={() => setDragFieldIdx(null)}
              className={cn(
                'flex items-center gap-2 px-2 py-1 rounded border border-gray-100 bg-gray-50 text-xs group',
                dragFieldIdx === idx ? 'opacity-40' : '',
              )}
            >
              <GripVertical size={10} className="text-gray-300 cursor-grab flex-none" />
              <input
                className="flex-1 border border-transparent rounded px-1 py-0.5 bg-transparent outline-none focus:border-blue-400 focus:bg-white text-gray-700 min-w-0"
                value={field.displayName}
                onChange={(e) => onFieldUpdate(field.id, { displayName: e.target.value })}
              />
              <span className="font-mono text-gray-400 text-[10px] truncate max-w-[120px]" title={field.tagPath}>
                {field.tagPath}
              </span>
              {def?.unit && <span className="text-gray-400 whitespace-nowrap">[{def.unit}]</span>}
              <span className="text-gray-600 font-mono whitespace-nowrap">{displayVal}</span>
              <button
                className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                onClick={() => onFieldDelete(field.id)}
              >
                <X size={10} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Drop hint when dragging */}
      {isOver && (
        <div className="border-2 border-dashed border-blue-300 rounded mx-2 mb-2 p-2 text-xs text-blue-400 text-center">
          Drop here to add to this section
        </div>
      )}
    </div>
  )
}

// ─── Preview panel (right) ────────────────────────────────────────────────────

function PreviewPanel({ config, project }: { config: ReportConfig; project: ReturnType<typeof useProjectStore.getState>['project'] }) {
  const data = generateReport(config, project)

  if (config.sections.length === 0) {
    return <p className="text-xs text-gray-400 p-3">Add sections and fields to see preview.</p>
  }

  return (
    <div className="flex flex-col gap-3 p-2">
      <h3 className="text-sm font-semibold text-gray-700">{config.name}</h3>
      {data.sections.map((sec, i) => (
        <div key={i} className="border border-gray-200 rounded overflow-hidden">
          <div className="bg-gray-50 px-2 py-1 text-[11px] font-semibold text-gray-600 border-b border-gray-200">
            {sec.name}
          </div>
          <table className="w-full text-[11px]">
            <tbody>
              {sec.rows.map((row, j) => (
                <tr key={j} className={cn('border-b border-gray-50', j % 2 === 1 ? 'bg-gray-50/50' : '')}>
                  <td className="px-2 py-0.5 text-gray-600">{row.label}</td>
                  <td className="px-2 py-0.5 text-right font-mono text-gray-800">{row.value}</td>
                  <td className="px-2 py-0.5 text-gray-400">{row.unit}</td>
                </tr>
              ))}
              {sec.rows.length === 0 && (
                <tr><td colSpan={3} className="px-2 py-2 text-gray-400 text-center">No fields</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

// ─── ReportBuilder ────────────────────────────────────────────────────────────

interface ReportBuilderProps {
  open: boolean
  onClose: () => void
}

export function ReportBuilder({ open, onClose }: ReportBuilderProps) {
  const project = useProjectStore((s) => s.project)
  const setProject = useProjectStore((s) => s.setProject)

  const [config, setConfig] = useState<ReportConfig>(() => ({
    id: crypto.randomUUID(),
    name: 'New Report',
    sections: [],
    createdAt: new Date().toISOString(),
  }))

  const allDefs = useMemo(() => tagRegistry.buildTagList(project), [project])

  function addSection() {
    setConfig((c) => ({
      ...c,
      sections: [
        ...c.sections,
        { id: crypto.randomUUID(), name: `Section ${c.sections.length + 1}`, fields: [] },
      ],
    }))
  }

  function updateSection(sectionId: string, updates: Partial<ReportSection>) {
    setConfig((c) => ({
      ...c,
      sections: c.sections.map((s) => (s.id === sectionId ? { ...s, ...updates } : s)),
    }))
  }

  function deleteSection(sectionId: string) {
    setConfig((c) => ({ ...c, sections: c.sections.filter((s) => s.id !== sectionId) }))
  }

  function dropTagIntoSection(sectionId: string, tagPath: string) {
    const def = allDefs.find((d) => d.tagPath === tagPath)
    if (!def) return
    setConfig((c) => ({
      ...c,
      sections: c.sections.map((s) => {
        if (s.id !== sectionId) return s
        if (s.fields.some((f) => f.tagPath === tagPath)) return s
        return {
          ...s,
          fields: [
            ...s.fields,
            { id: crypto.randomUUID(), tagPath, displayName: def.displayName, unit: def.unit },
          ],
        }
      }),
    }))
  }

  function updateField(sectionId: string, fieldId: string, updates: Partial<ReportField>) {
    setConfig((c) => ({
      ...c,
      sections: c.sections.map((s) => {
        if (s.id !== sectionId) return s
        return { ...s, fields: s.fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)) }
      }),
    }))
  }

  function deleteField(sectionId: string, fieldId: string) {
    setConfig((c) => ({
      ...c,
      sections: c.sections.map((s) => {
        if (s.id !== sectionId) return s
        return { ...s, fields: s.fields.filter((f) => f.id !== fieldId) }
      }),
    }))
  }

  function reorderField(sectionId: string, fromIdx: number, toIdx: number) {
    setConfig((c) => ({
      ...c,
      sections: c.sections.map((s) => {
        if (s.id !== sectionId) return s
        const fields = [...s.fields]
        const [moved] = fields.splice(fromIdx, 1)
        fields.splice(toIdx, 0, moved)
        return { ...s, fields }
      }),
    }))
  }

  function loadTemplate(template: 'massBalance' | 'streams' | 'units') {
    const factories = {
      massBalance: templateMassBalance,
      streams: templateStreamProperties,
      units: templateUnitSummary,
    }
    setConfig(factories[template](project))
  }

  function handleSave() {
    const existing = project.reports ?? []
    const updated = existing.some((r) => r.id === config.id)
      ? existing.map((r) => (r.id === config.id ? config : r))
      : [...existing, config]
    setProject({ ...project, reports: updated })
  }

  async function handleExportExcel() {
    await exportService.exportToExcel({ project, reportConfig: config })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
        <Dialog.Content className="fixed inset-0 z-50 bg-white flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 h-12 border-b border-gray-200 bg-gray-50 flex-none">
            {/* Report name */}
            <input
              className="text-sm font-semibold border-b border-transparent focus:border-blue-400 outline-none bg-transparent text-gray-700 min-w-[120px]"
              value={config.name}
              onChange={(e) => setConfig((c) => ({ ...c, name: e.target.value }))}
            />

            <div className="flex-1" />

            {/* Load template dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-1 text-xs text-gray-600 border border-gray-200 rounded px-2 py-1 hover:bg-gray-100 transition-colors">
                  Load Template <ChevronDown size={12} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="bg-white border border-gray-200 rounded shadow-lg z-50 min-w-[180px] py-1">
                  <DropdownMenu.Item
                    className="px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 cursor-pointer outline-none"
                    onSelect={() => loadTemplate('massBalance')}
                  >
                    Mass Balance Summary
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 cursor-pointer outline-none"
                    onSelect={() => loadTemplate('streams')}
                  >
                    Stream Properties
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 cursor-pointer outline-none"
                    onSelect={() => loadTemplate('units')}
                  >
                    Unit Operation Summary
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            <button
              className="text-xs text-gray-600 border border-gray-200 rounded px-2 py-1 hover:bg-gray-100 transition-colors"
              onClick={handleSave}
            >
              Save to Project
            </button>

            <button
              className="text-xs text-white bg-blue-500 hover:bg-blue-600 rounded px-2 py-1 transition-colors"
              onClick={handleExportExcel}
            >
              Export Excel
            </button>

            <Dialog.Close asChild>
              <button className="w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors ml-2">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Three-panel body */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left: Tag selector */}
            <div className="w-56 flex-none border-r border-gray-200 overflow-hidden flex flex-col">
              <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Tags
              </div>
              <div className="flex-1 overflow-hidden">
                <TagPanel tags={allDefs} onDragStart={() => {}} />
              </div>
            </div>

            {/* Center: Layout builder */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
              <div className="max-w-2xl mx-auto">
                {config.sections.length === 0 && (
                  <div className="text-xs text-gray-400 text-center py-8 border-2 border-dashed border-gray-200 rounded">
                    No sections yet. Add a section and drag tags into it.
                  </div>
                )}

                {config.sections.map((section) => (
                  <SectionBlock
                    key={section.id}
                    section={section}
                    allDefs={allDefs}
                    project={project}
                    onUpdate={(updates) => updateSection(section.id, updates)}
                    onDelete={() => deleteSection(section.id)}
                    onDropTag={(tagPath) => dropTagIntoSection(section.id, tagPath)}
                    onFieldUpdate={(fieldId, updates) => updateField(section.id, fieldId, updates)}
                    onFieldDelete={(fieldId) => deleteField(section.id, fieldId)}
                    onFieldReorder={(from, to) => reorderField(section.id, from, to)}
                  />
                ))}

                <button
                  className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 border border-dashed border-blue-300 hover:border-blue-500 rounded px-3 py-2 w-full justify-center transition-colors"
                  onClick={addSection}
                >
                  <Plus size={12} /> Add Section
                </button>
              </div>
            </div>

            {/* Right: Preview */}
            <div className="w-72 flex-none border-l border-gray-200 overflow-y-auto flex flex-col">
              <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex-none">
                Preview
              </div>
              <PreviewPanel config={config} project={project} />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
