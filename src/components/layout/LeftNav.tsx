import {
  LayoutList,
  Wrench,
  BarChart2,
  TrendingUp,
  FolderOpen,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@radix-ui/react-tooltip'
import { useUIStore } from '@/store'
import { cn } from '@/lib/utils'

type NavTab = 'flowsheets' | 'units' | 'species' | 'reactions' | 'controls'

interface NavItem {
  icon: LucideIcon
  tab: NavTab
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutList, tab: 'flowsheets', label: 'Explorer' },
  { icon: Wrench,     tab: 'units',      label: 'Unit Palette' },
  { icon: BarChart2,  tab: 'species',    label: 'Species' },
  { icon: TrendingUp, tab: 'reactions',  label: 'Reactions' },
  { icon: FolderOpen, tab: 'controls',   label: 'Controls' },
]

interface LeftNavProps {
  onSettingsClick?: () => void
}

export function LeftNav({ onSettingsClick }: LeftNavProps) {
  const leftNavTab = useUIStore((s) => s.leftNavTab)
  const setLeftNavTab = useUIStore((s) => s.setLeftNavTab)

  return (
    <div className="flex flex-col w-12 bg-[#F1F3F5] border-r border-gray-200 flex-none py-2 gap-1">
      {NAV_ITEMS.map(({ icon: Icon, tab, label }) => {
        const isActive = leftNavTab === tab
        return (
          <TooltipProvider key={label} delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setLeftNavTab(tab)}
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center mx-auto transition-colors',
                    isActive
                      ? 'bg-blue-100 text-blue-600'
                      : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700',
                  )}
                  aria-label={label}
                >
                  <Icon size={18} />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="bg-gray-800 text-white text-xs px-2 py-1 rounded"
              >
                {label}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      })}

      {/* Spacer pushes Settings to bottom */}
      <div className="flex-1" />

      {/* Settings button — opens Setup / Component Toggle window */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onSettingsClick?.()}
              className="w-9 h-9 rounded-lg flex items-center justify-center mx-auto transition-colors text-gray-500 hover:bg-gray-200 hover:text-gray-700"
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="bg-gray-800 text-white text-xs px-2 py-1 rounded"
          >
            Settings
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
