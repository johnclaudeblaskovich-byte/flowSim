import { useState, useMemo, type ChangeEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Search, ChevronRight, ChevronDown, X } from 'lucide-react'
import { useProjectStore } from '@/store'
import { tagRegistry, type TagDefinition } from '@/services/tagRegistry'
import { cn } from '@/lib/utils'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TagBrowserProps {
  open: boolean
  mode: 'single' | 'multi'
  onSelect: (tagPaths: string[]) => void
  onClose: () => void
}

// ─── Tree node types ──────────────────────────────────────────────────────────

interface FlowsheetGroup {
  id: string
  name: string
  units: UnitGroup[]
}

interface UnitGroup {
  parentTag: string
  parentType: string
  tags: TagDefinition[]
}

// ─── Tree builder ─────────────────────────────────────────────────────────────

function buildTree(defs: TagDefinition[]): FlowsheetGroup[] {
  const fsMap = new Map<string, FlowsheetGroup>()
  for (const def of defs) {
    if (!fsMap.has(def.flowsheetId)) {
      fsMap.set(def.flowsheetId, { id: def.flowsheetId, name: def.flowsheetName, units: [] })
    }
    const fs = fsMap.get(def.flowsheetId)!
    let unit = fs.units.find((u) => u.parentTag === def.parentTag)
    if (!unit) {
      unit = { parentTag: def.parentTag, parentType: def.parentType, tags: [] }
      fs.units.push(unit)
    }
    unit.tags.push(def)
  }
  return Array.from(fsMap.values())
}

// ─── Tag leaf row ─────────────────────────────────────────────────────────────

function TagLeaf({
  def,
  selected,
  mode,
  currentValue,
  onClick,
}: {
  def: TagDefinition
  selected: boolean
  mode: 'single' | 'multi'
  currentValue: number | string | boolean | null
  onClick: () => void
}) {
  const displayValue =
    currentValue === null
      ? ''
      : typeof currentValue === 'number'
        ? currentValue.toPrecision(4)
        : String(currentValue)

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-1 cursor-pointer text-xs hover:bg-blue-50',
        selected && 'bg-blue-50',
      )}
    >
      {mode === 'multi' && (
        <input
          type="checkbox"
          checked={selected}
          readOnly
          className="w-3 h-3 rounded text-blue-600 pointer-events-none"
        />
      )}
      <span className="font-mono text-gray-700 flex-1 truncate" title={def.tagPath}>
        {def.tagPath}
      </span>
      {def.unit && (
        <span className="text-gray-400 flex-none">[{def.unit}]</span>
      )}
      {displayValue && (
        <span className="text-gray-400 font-mono flex-none ml-1">{displayValue}</span>
      )}
    </div>
  )
}

// ─── Unit group row ───────────────────────────────────────────────────────────

function UnitGroupRow({
  unit,
  expanded,
  selected,
  mode,
  project,
  onToggle,
  onTagClick,
}: {
  unit: UnitGroup
  expanded: boolean
  selected: Set<string>
  mode: 'single' | 'multi'
  project: ReturnType<typeof useProjectStore.getState>['project']
  onToggle: () => void
  onTagClick: (tagPath: string) => void
}) {
  return (
    <div>
      <div
        onClick={onToggle}
        className="flex items-center gap-1 px-2 py-0.5 cursor-pointer hover:bg-gray-100 text-xs"
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <span className="font-medium text-gray-700">{unit.parentTag}</span>
        <span className="text-gray-400 text-[10px] ml-1">({unit.parentType})</span>
      </div>
      {expanded && (
        <div className="ml-2">
          {unit.tags.map((def) => (
            <TagLeaf
              key={def.tagPath}
              def={def}
              selected={selected.has(def.tagPath)}
              mode={mode}
              currentValue={tagRegistry.resolveTagValue(def.tagPath, project)}
              onClick={() => onTagClick(def.tagPath)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── TagBrowser ───────────────────────────────────────────────────────────────

export function TagBrowser({ open, mode, onSelect, onClose }: TagBrowserProps) {
  const project = useProjectStore((s) => s.project)

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const allDefs = useMemo(() => tagRegistry.buildTagList(project), [project])
  const tree = useMemo(() => buildTree(allDefs), [allDefs])

  // Filter: when query is set, show flat list; else show tree
  const filtered = useMemo(() => {
    if (!query.trim()) return null // null = show tree
    const q = query.toLowerCase()
    return allDefs.filter(
      (d) =>
        d.tagPath.toLowerCase().includes(q) ||
        d.displayName.toLowerCase().includes(q),
    )
  }, [query, allDefs])

  function toggleSelected(tagPath: string) {
    if (mode === 'single') {
      onSelect([tagPath])
      onClose()
      return
    }
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(tagPath)) next.delete(tagPath)
      else next.add(tagPath)
      return next
    })
  }

  function toggleUnit(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleConfirm() {
    onSelect(Array.from(selected))
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-50 w-[480px] max-h-[600px] flex flex-col outline-none">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-none">
            <Dialog.Title className="text-sm font-semibold text-gray-800">
              Tag Browser
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </Dialog.Close>
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-gray-100 flex-none">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded px-2 py-1">
              <Search size={12} className="text-gray-400 flex-none" />
              <input
                type="text"
                value={query}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                placeholder="Search tags..."
                className="flex-1 text-xs bg-transparent outline-none text-gray-700 placeholder-gray-400"
                autoFocus
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
                  <X size={10} />
                </button>
              )}
            </div>
          </div>

          {/* Tree / Flat list */}
          <div className="flex-1 overflow-y-auto">
            {filtered !== null ? (
              // Flat filtered list
              filtered.length === 0 ? (
                <p className="text-xs text-gray-400 text-center mt-6">No tags match "{query}"</p>
              ) : (
                filtered.map((def) => (
                  <TagLeaf
                    key={def.tagPath}
                    def={def}
                    selected={selected.has(def.tagPath)}
                    mode={mode}
                    currentValue={tagRegistry.resolveTagValue(def.tagPath, project)}
                    onClick={() => toggleSelected(def.tagPath)}
                  />
                ))
              )
            ) : (
              // Tree view
              tree.length === 0 ? (
                <p className="text-xs text-gray-400 text-center mt-6">
                  No units or pipes in this project
                </p>
              ) : (
                tree.map((fs) => (
                  <div key={fs.id}>
                    {/* Flowsheet header */}
                    <div className="px-2 py-1 text-[10px] font-semibold text-gray-500 bg-gray-50 border-b border-gray-100 uppercase tracking-wide">
                      {fs.name}
                    </div>
                    {fs.units.map((unit) => {
                      const key = `${fs.id}:${unit.parentTag}`
                      return (
                        <UnitGroupRow
                          key={key}
                          unit={unit}
                          expanded={expanded.has(key)}
                          selected={selected}
                          mode={mode}
                          project={project}
                          onToggle={() => toggleUnit(key)}
                          onTagClick={toggleSelected}
                        />
                      )
                    })}
                  </div>
                ))
              )
            )}
          </div>

          {/* Footer (multi mode only) */}
          {mode === 'multi' && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 flex-none">
              <span className="text-xs text-gray-500">
                {selected.size} tag{selected.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-3 py-1 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={selected.size === 0}
                  className={cn(
                    'px-3 py-1 text-xs rounded',
                    selected.size > 0
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed',
                  )}
                >
                  Add Tags
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
