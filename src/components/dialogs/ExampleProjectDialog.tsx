import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, FolderOpen, FileText, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InventoryEntry {
  name: string
  category: string
  flowsim_status: string
  flowsim_path?: string
  key_unit_ops?: string[]
  skip_reason?: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onLoad: (file: File, name: string) => Promise<void>
}

export function ExampleProjectDialog({ open, onClose, onLoad }: Props) {
  const [inventory, setInventory] = useState<InventoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingEntry, setLoadingEntry] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    fetch('/examples/inventory.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<InventoryEntry[]>
      })
      .then((data) => {
        setInventory(data)
        // Auto-expand all categories with generated examples
        const cats = new Set(
          data
            .filter((e) => e.flowsim_status === 'GENERATED')
            .map((e) => e.category),
        )
        setExpandedCategories(cats)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => setLoading(false))
  }, [open])

  // Group by category, only show GENERATED entries
  const generated = inventory.filter((e) => e.flowsim_status === 'GENERATED')
  const categories = [...new Set(generated.map((e) => e.category))].sort()

  async function handleSelect(entry: InventoryEntry) {
    if (!entry.flowsim_path) return
    // Convert e.g. "examples/03 UnitModels/Simple Thickener Example.fsim"
    // to a URL rooted at /examples/...
    const urlPath = '/' + entry.flowsim_path.replace(/\\/g, '/')
    setLoadingEntry(entry.name)
    try {
      const res = await fetch(urlPath)
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${urlPath}`)
      const buf = await res.arrayBuffer()
      const file = new File([buf], `${entry.name}.fsim`, { type: 'application/zip' })
      await onLoad(file, entry.name)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingEntry(null)
    }
  }

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-lg shadow-xl w-[560px] max-h-[80vh] flex flex-col outline-none">
          {/* Header */}
          <div className="flex items-center justify-between px-5 h-11 border-b border-gray-200 flex-none">
            <Dialog.Title className="text-sm font-semibold text-gray-800">
              Open Example Project
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <X size={14} />
              </button>
            </Dialog.Close>
          </div>

          {/* Description */}
          <div className="px-5 py-2 border-b border-gray-100 flex-none">
            <p className="text-xs text-gray-500">
              Select an example project to load. These projects demonstrate FlowSim unit models
              and are equivalent to SysCAD example projects.
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="p-8 text-center text-sm text-gray-400">Loading examples…</div>
            )}
            {error && (
              <div className="p-4 text-sm text-red-600 bg-red-50 m-4 rounded border border-red-200">
                Failed to load example catalog: {error}
              </div>
            )}
            {!loading && !error && categories.length === 0 && (
              <div className="p-8 text-center text-sm text-gray-400">No examples found.</div>
            )}
            {!loading && categories.map((cat) => {
              const entries = generated.filter((e) => e.category === cat)
              const isExpanded = expandedCategories.has(cat)
              return (
                <div key={cat}>
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors text-left"
                  >
                    <ChevronRight
                      size={14}
                      className={cn(
                        'text-gray-400 transition-transform flex-none',
                        isExpanded && 'rotate-90',
                      )}
                    />
                    <FolderOpen size={14} className="text-amber-500 flex-none" />
                    <span className="text-xs font-semibold text-gray-700">{cat}</span>
                    <span className="ml-auto text-xs text-gray-400">{entries.length}</span>
                  </button>

                  {/* Example entries */}
                  {isExpanded && entries.map((entry) => {
                    const isLoadingThis = loadingEntry === entry.name
                    return (
                      <button
                        key={entry.name}
                        onClick={() => handleSelect(entry)}
                        disabled={isLoadingThis || loadingEntry !== null}
                        className={cn(
                          'w-full flex items-start gap-3 px-6 py-2.5 border-b border-gray-50 hover:bg-blue-50 transition-colors text-left',
                          (isLoadingThis || loadingEntry !== null) && 'opacity-60 cursor-wait',
                        )}
                      >
                        <FileText size={14} className="text-blue-400 flex-none mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 truncate">{entry.name}</p>
                          {entry.key_unit_ops && entry.key_unit_ops.length > 0 && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {entry.key_unit_ops.join(' · ')}
                            </p>
                          )}
                        </div>
                        {isLoadingThis && (
                          <span className="text-xs text-blue-500 flex-none">Loading…</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-200 flex-none flex justify-end">
            <Dialog.Close asChild>
              <button className="px-4 py-1.5 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
