import { useState, useEffect, useRef, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Search, X } from 'lucide-react'
import { useProjectStore, useCanvasStore, useUIStore } from '@/store'
import { UNIT_SYMBOLS } from '@/components/canvas/symbols'
import { cn } from '@/lib/utils'
import type { UnitModelType } from '@/types'

type FilterType = 'All' | 'Units' | 'Streams'

interface SearchResult {
  id: string
  tag: string
  label: string
  type: 'unit' | 'stream'
  unitType?: UnitModelType
  flowsheetId: string
  flowsheetName: string
}

interface FindDialogProps {
  open: boolean
  onClose: () => void
}

export function FindDialog({ open, onClose }: FindDialogProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('All')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const { project } = useProjectStore()
  const { setActiveFlowsheetId, setSelectedNodeId, setSelectedEdgeId } = useCanvasStore()
  const { setAccessWindowUnitId, setRightPanelOpen } = useUIStore()

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Build results from all flowsheets
  const results: SearchResult[] = []
  const q = query.toLowerCase().trim()

  for (const fs of project.flowsheets) {
    if (filter !== 'Streams') {
      for (const node of fs.nodes) {
        if (!q || node.tag.toLowerCase().includes(q) || node.type.toLowerCase().includes(q) || node.label.toLowerCase().includes(q)) {
          results.push({
            id: node.id,
            tag: node.tag,
            label: node.type,
            type: 'unit',
            unitType: node.type,
            flowsheetId: fs.id,
            flowsheetName: fs.name,
          })
        }
      }
    }
    if (filter !== 'Units') {
      for (const edge of fs.edges) {
        if (!q || edge.tag.toLowerCase().includes(q)) {
          results.push({
            id: edge.id,
            tag: edge.tag,
            label: 'Stream',
            type: 'stream',
            flowsheetId: fs.id,
            flowsheetName: fs.name,
          })
        }
      }
    }
  }

  const navigateToResult = useCallback(
    (result: SearchResult) => {
      setActiveFlowsheetId(result.flowsheetId)
      if (result.type === 'unit') {
        setSelectedNodeId(result.id)
        setAccessWindowUnitId(result.id)
        setRightPanelOpen(true)
      } else {
        setSelectedEdgeId(result.id)
      }
      onClose()
    },
    [
      setActiveFlowsheetId, setSelectedNodeId, setSelectedEdgeId,
      setAccessWindowUnitId, setRightPanelOpen, onClose,
    ],
  )

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIdx]) navigateToResult(results[selectedIdx])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  // Reset selection when results change
  useEffect(() => {
    setSelectedIdx(0)
  }, [query, filter])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[selectedIdx] as HTMLElement
    item?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  const FILTERS: FilterType[] = ['All', 'Units', 'Streams']

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/20 z-50" />
        <Dialog.Content
          className="fixed left-1/2 top-[20%] -translate-x-1/2 z-50
            bg-white rounded-xl shadow-2xl border border-gray-200 w-[520px] max-h-[60vh] flex flex-col focus:outline-none"
          onKeyDown={handleKeyDown}
        >
          {/* Search input */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            <Search size={16} className="text-gray-400 flex-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search units and streams…"
              className="flex-1 text-sm outline-none text-gray-800 placeholder:text-gray-400"
            />
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={15} />
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-100">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-2.5 py-0.5 text-xs rounded-full transition-colors',
                  filter === f
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-500 hover:bg-gray-100',
                )}
              >
                {f}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-gray-400">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Results list */}
          <div ref={listRef} className="overflow-y-auto flex-1 py-1">
            {results.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-8">(no results)</div>
            ) : (
              results.map((result, idx) => {
                const isSelected = idx === selectedIdx
                const Icon = result.unitType ? UNIT_SYMBOLS[result.unitType] : null
                return (
                  <div
                    key={result.id}
                    onClick={() => navigateToResult(result)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors',
                      isSelected ? 'bg-blue-50' : 'hover:bg-gray-50',
                    )}
                  >
                    {/* Icon */}
                    <div className="w-7 h-7 flex items-center justify-center flex-none">
                      {Icon ? (
                        <Icon size={22} color="#6B7280" />
                      ) : (
                        <div className="w-4 h-0.5 bg-gray-400 rounded" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{result.tag}</div>
                      <div className="text-xs text-gray-500">{result.label}</div>
                    </div>
                    <div className="text-xs text-gray-400 flex-none truncate max-w-[120px]">
                      {result.flowsheetName}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
