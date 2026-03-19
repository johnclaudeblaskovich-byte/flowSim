import { ChevronRight, ChevronDown, LayoutDashboard, Cpu, FileCode, FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { useProjectStore, useCanvasStore, useUIStore } from '@/store'
import { cn } from '@/lib/utils'
import type { Flowsheet, UnitNode } from '@/types'

interface TreeNodeProps {
  label: string
  icon: React.ReactNode
  depth?: number
  children?: React.ReactNode
  defaultOpen?: boolean
  onClick?: () => void
  isActive?: boolean
}

function TreeNode({ label, icon, depth = 0, children, defaultOpen = false, onClick, isActive }: TreeNodeProps) {
  const [open, setOpen] = useState(defaultOpen)
  const hasChildren = !!children

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1 text-xs cursor-pointer rounded transition-colors select-none',
          'hover:bg-gray-100',
          isActive && 'bg-blue-50 text-blue-700',
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          if (hasChildren) setOpen((v) => !v)
          onClick?.()
        }}
      >
        {hasChildren ? (
          open ? (
            <ChevronDown size={12} className="flex-none text-gray-400" />
          ) : (
            <ChevronRight size={12} className="flex-none text-gray-400" />
          )
        ) : (
          <span className="w-3 flex-none" />
        )}
        <span className="flex-none text-gray-500">{icon}</span>
        <span className="truncate text-gray-700">{label}</span>
      </div>
      {hasChildren && open && <div>{children}</div>}
    </div>
  )
}

function UnitTreeItem({
  unit,
  flowsheetId,
  depth,
}: {
  unit: UnitNode
  flowsheetId: string
  depth: number
}) {
  const { setActiveFlowsheetId } = useCanvasStore()
  const { setAccessWindowUnitId, setRightPanelOpen } = useUIStore()

  function handleClick() {
    setActiveFlowsheetId(flowsheetId)
    setAccessWindowUnitId(unit.id)
    setRightPanelOpen(true)
  }

  return (
    <TreeNode
      label={`${unit.tag} — ${unit.type}`}
      icon={<span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" />}
      depth={depth}
      onClick={handleClick}
    />
  )
}

function FlowsheetTreeItem({ fs, depth }: { fs: Flowsheet; depth: number }) {
  const { activeFlowsheetId, setActiveFlowsheetId } = useCanvasStore()
  const isActive = fs.id === activeFlowsheetId

  // Group units by category for sub-display
  const controllers = fs.nodes.filter((n) =>
    ['GeneralController', 'PIDController', 'SetTagController'].includes(n.type),
  )

  return (
    <TreeNode
      label={fs.name}
      icon={<LayoutDashboard size={13} />}
      depth={depth}
      defaultOpen={isActive}
      isActive={isActive}
      onClick={() => setActiveFlowsheetId(fs.id)}
    >
      {fs.nodes
        .filter((n) => !['GeneralController', 'PIDController', 'SetTagController'].includes(n.type))
        .map((unit) => (
          <UnitTreeItem key={unit.id} unit={unit} flowsheetId={fs.id} depth={depth + 1} />
        ))}
      {controllers.length > 0 && (
        <TreeNode
          label={`Controllers (${controllers.length})`}
          icon={<Cpu size={12} />}
          depth={depth + 1}
          defaultOpen={false}
        >
          {controllers.map((unit) => (
            <UnitTreeItem key={unit.id} unit={unit} flowsheetId={fs.id} depth={depth + 2} />
          ))}
        </TreeNode>
      )}
    </TreeNode>
  )
}

export function ProjectExplorer() {
  const { project } = useProjectStore()

  const sortedFlowsheets = [...project.flowsheets].sort((a, b) => a.order - b.order)

  // Count scripts and reactions (placeholders for future phases)
  const scriptCount = 0
  const reactionCount = 0

  return (
    <div className="w-64 flex-none border-r border-gray-200 bg-white flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-200 flex-none">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Project Explorer
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {/* Root project node */}
        <TreeNode
          label={project.name}
          icon={<span className="text-gray-400">📁</span>}
          depth={0}
          defaultOpen={true}
        >
          {/* Flowsheets */}
          <TreeNode
            label={`Flowsheets (${sortedFlowsheets.length})`}
            icon={<LayoutDashboard size={13} />}
            depth={1}
            defaultOpen={true}
          >
            {sortedFlowsheets.map((fs) => (
              <FlowsheetTreeItem key={fs.id} fs={fs} depth={2} />
            ))}
          </TreeNode>

          {/* Scripts placeholder */}
          <TreeNode
            label={`Scripts (${scriptCount})`}
            icon={<FileCode size={13} />}
            depth={1}
          >
            <div className="px-4 py-2 text-[10px] text-gray-400">No scripts</div>
          </TreeNode>

          {/* Reactions placeholder */}
          <TreeNode
            label={`Reactions (${reactionCount})`}
            icon={<FlaskConical size={13} />}
            depth={1}
          >
            <div className="px-4 py-2 text-[10px] text-gray-400">No reactions</div>
          </TreeNode>
        </TreeNode>
      </div>
    </div>
  )
}
