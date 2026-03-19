import { useEffect, useRef, useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useProjectStore } from '@/store'
import { useCanvasStore } from '@/store'
import { cn } from '@/lib/utils'
import type { Flowsheet } from '@/types'

interface ContextMenuState {
  flowsheetId: string
  x: number
  y: number
}

interface RenamingState {
  id: string
  value: string
}

export function FlowsheetTabs() {
  const {
    project,
    addFlowsheet,
    removeFlowsheet,
    renameFlowsheet,
    duplicateFlowsheet,
    reorderFlowsheet,
  } = useProjectStore()
  const { activeFlowsheetId, setActiveFlowsheetId } = useCanvasStore()

  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)
  const [ctxOpen, setCtxOpen] = useState(false)
  const [renaming, setRenaming] = useState<RenamingState | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const flowsheets = [...project.flowsheets].sort((a, b) => a.order - b.order)

  // Initialize activeFlowsheetId to first flowsheet on mount
  useEffect(() => {
    if (!activeFlowsheetId && flowsheets.length > 0) {
      setActiveFlowsheetId(flowsheets[0].id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // If active flowsheet was deleted, switch to first
  useEffect(() => {
    if (activeFlowsheetId && !flowsheets.find((f) => f.id === activeFlowsheetId)) {
      setActiveFlowsheetId(flowsheets[0]?.id ?? null)
    }
  }, [flowsheets, activeFlowsheetId, setActiveFlowsheetId])

  // Focus rename input when renaming starts
  useEffect(() => {
    if (renaming) {
      setTimeout(() => renameInputRef.current?.select(), 0)
    }
  }, [renaming?.id])

  // ── Add new flowsheet ──────────────────────────────────────────────────────
  function handleAddFlowsheet() {
    const n = project.flowsheets.length + 1
    const num = String(n).padStart(2, '0')
    const newFs: Flowsheet = {
      id: crypto.randomUUID(),
      name: `${num}_NewFlowsheet`,
      order: project.flowsheets.length,
      nodes: [],
      edges: [],
      annotations: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    }
    addFlowsheet(newFs)
    setActiveFlowsheetId(newFs.id)
    // Start rename immediately
    setRenaming({ id: newFs.id, value: newFs.name })
  }

  // ── Rename ─────────────────────────────────────────────────────────────────
  function startRename(id: string) {
    const fs = project.flowsheets.find((f) => f.id === id)
    if (!fs) return
    setRenaming({ id, value: fs.name })
    setCtxOpen(false)
  }

  function commitRename() {
    if (!renaming) return
    const trimmed = renaming.value.trim()
    if (trimmed) renameFlowsheet(renaming.id, trimmed)
    setRenaming(null)
  }

  function handleRenameKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') setRenaming(null)
  }

  // ── Context menu ──────────────────────────────────────────────────────────
  function handleContextMenu(e: React.MouseEvent, flowsheetId: string) {
    e.preventDefault()
    setCtxMenu({ flowsheetId, x: e.clientX, y: e.clientY })
    setCtxOpen(true)
  }

  // ── Duplicate ─────────────────────────────────────────────────────────────
  const handleDuplicate = useCallback(
    (id: string) => {
      const newId = duplicateFlowsheet(id)
      if (newId) setActiveFlowsheetId(newId)
      setCtxOpen(false)
    },
    [duplicateFlowsheet, setActiveFlowsheetId],
  )

  // ── Delete ────────────────────────────────────────────────────────────────
  function handleDelete(id: string) {
    if (project.flowsheets.length <= 1) return
    removeFlowsheet(id)
    setCtxOpen(false)
  }

  // ── Reorder ───────────────────────────────────────────────────────────────
  function handleMove(id: string, direction: 'left' | 'right') {
    reorderFlowsheet(id, direction)
    setCtxOpen(false)
  }

  const isFirst = (id: string) => flowsheets[0]?.id === id
  const isLast = (id: string) => flowsheets[flowsheets.length - 1]?.id === id

  const menuItem =
    'flex items-center px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer rounded outline-none'
  const menuSep = 'h-px bg-gray-200 my-1'

  return (
    <div className="flex items-center h-9 border-b border-gray-200 bg-gray-50 flex-none">
      {/* Tab list */}
      <div className="flex flex-1 overflow-x-auto h-full scrollbar-none">
        {flowsheets.map((fs) => {
          const isActive = fs.id === activeFlowsheetId
          const isRenaming = renaming?.id === fs.id
          return (
            <div
              key={fs.id}
              onClick={() => { if (!isRenaming) setActiveFlowsheetId(fs.id) }}
              onDoubleClick={() => startRename(fs.id)}
              onContextMenu={(e) => handleContextMenu(e, fs.id)}
              className={cn(
                'relative flex items-center px-4 h-full text-sm whitespace-nowrap border-b-2',
                'transition-colors cursor-pointer select-none flex-none',
                isActive
                  ? 'border-blue-500 bg-white text-gray-800 font-medium'
                  : 'border-transparent text-gray-500 hover:bg-gray-100',
              )}
            >
              {isRenaming ? (
                <input
                  ref={renameInputRef}
                  value={renaming.value}
                  onChange={(e) => setRenaming({ id: renaming.id, value: e.target.value })}
                  onBlur={commitRename}
                  onKeyDown={handleRenameKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  className="w-32 text-sm bg-white border border-blue-400 rounded px-1 outline-none"
                />
              ) : (
                <span className="max-w-[160px] truncate">{fs.name}</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Add button */}
      <button
        onClick={handleAddFlowsheet}
        className="w-9 h-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 border-l border-gray-200 flex-none"
        title="Add flowsheet"
      >
        <Plus size={14} />
      </button>

      {/* Context menu */}
      {ctxMenu && (
        <div
          style={{ position: 'fixed', top: ctxMenu.y, left: ctxMenu.x, zIndex: 50 }}
        >
          <DropdownMenu.Root open={ctxOpen} onOpenChange={setCtxOpen}>
            <DropdownMenu.Trigger asChild>
              <div style={{ width: 0, height: 0 }} />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="min-w-[160px] bg-white rounded-lg shadow-lg border border-gray-200 p-1 z-50"
                align="start"
                sideOffset={0}
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                <DropdownMenu.Item
                  className={menuItem}
                  onSelect={() => startRename(ctxMenu.flowsheetId)}
                >
                  Rename
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={menuItem}
                  onSelect={() => handleDuplicate(ctxMenu.flowsheetId)}
                >
                  Duplicate
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={cn(menuItem, isFirst(ctxMenu.flowsheetId) && 'opacity-40 cursor-not-allowed')}
                  disabled={isFirst(ctxMenu.flowsheetId)}
                  onSelect={() => handleMove(ctxMenu.flowsheetId, 'left')}
                >
                  Move Left
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={cn(menuItem, isLast(ctxMenu.flowsheetId) && 'opacity-40 cursor-not-allowed')}
                  disabled={isLast(ctxMenu.flowsheetId)}
                  onSelect={() => handleMove(ctxMenu.flowsheetId, 'right')}
                >
                  Move Right
                </DropdownMenu.Item>
                <DropdownMenu.Separator className={menuSep} />
                <DropdownMenu.Item
                  className={cn(
                    menuItem,
                    project.flowsheets.length <= 1
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-red-50 hover:text-red-600',
                  )}
                  disabled={project.flowsheets.length <= 1}
                  onSelect={() => handleDelete(ctxMenu.flowsheetId)}
                >
                  Delete
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      )}
    </div>
  )
}
