import { useEffect, useRef, useState } from 'react'
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

export function FlowsheetTabs() {
  const { project, addFlowsheet, removeFlowsheet, updateFlowsheet } =
    useProjectStore()
  const { activeFlowsheetId, setActiveFlowsheetId } = useCanvasStore()

  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)
  const [ctxOpen, setCtxOpen] = useState(false)
  const ctxRef = useRef<HTMLDivElement>(null)

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
    if (
      activeFlowsheetId &&
      !flowsheets.find((f) => f.id === activeFlowsheetId)
    ) {
      setActiveFlowsheetId(flowsheets[0]?.id ?? null)
    }
  }, [flowsheets, activeFlowsheetId, setActiveFlowsheetId])

  function handleAddFlowsheet() {
    const newFs: Flowsheet = {
      id: crypto.randomUUID(),
      name: `Flowsheet ${project.flowsheets.length + 1}`,
      order: project.flowsheets.length,
      nodes: [],
      edges: [],
      annotations: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    }
    addFlowsheet(newFs)
    setActiveFlowsheetId(newFs.id)
  }

  function handleContextMenu(e: React.MouseEvent, flowsheetId: string) {
    e.preventDefault()
    setCtxMenu({ flowsheetId, x: e.clientX, y: e.clientY })
    setCtxOpen(true)
  }

  function handleRename(id: string) {
    const fs = project.flowsheets.find((f) => f.id === id)
    if (!fs) return
    const name = window.prompt('Rename flowsheet:', fs.name)
    if (name && name.trim()) {
      updateFlowsheet(id, { name: name.trim() })
    }
    setCtxOpen(false)
  }

  function handleDuplicate(id: string) {
    const fs = project.flowsheets.find((f) => f.id === id)
    if (!fs) return
    const newFs: Flowsheet = {
      ...fs,
      id: crypto.randomUUID(),
      name: `${fs.name} (copy)`,
      order: project.flowsheets.length,
      nodes: fs.nodes.map((n) => ({ ...n, id: crypto.randomUUID() })),
      edges: [],
    }
    addFlowsheet(newFs)
    setActiveFlowsheetId(newFs.id)
    setCtxOpen(false)
  }

  function handleDelete(id: string) {
    if (project.flowsheets.length <= 1) return
    removeFlowsheet(id)
    setCtxOpen(false)
  }

  const menuItem =
    'flex items-center px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer rounded outline-none'
  const menuSep = 'h-px bg-gray-200 my-1'

  return (
    <div className="flex items-center h-9 border-b border-gray-200 bg-gray-50 flex-none">
      {/* Tab list */}
      <div className="flex flex-1 overflow-x-auto h-full scrollbar-none">
        {flowsheets.map((fs) => {
          const isActive = fs.id === activeFlowsheetId
          return (
            <button
              key={fs.id}
              onClick={() => setActiveFlowsheetId(fs.id)}
              onContextMenu={(e) => handleContextMenu(e, fs.id)}
              className={cn(
                'px-4 h-full text-sm whitespace-nowrap border-b-2 transition-colors',
                isActive
                  ? 'border-blue-500 bg-white text-gray-800 font-medium'
                  : 'border-transparent text-gray-500 hover:bg-gray-100',
              )}
            >
              {fs.name}
            </button>
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

      {/* Context menu (Radix DropdownMenu opened programmatically) */}
      {ctxMenu && (
        <div
          ref={ctxRef}
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
                  onSelect={() => handleRename(ctxMenu.flowsheetId)}
                >
                  Rename…
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={menuItem}
                  onSelect={() => handleDuplicate(ctxMenu.flowsheetId)}
                >
                  Duplicate
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
