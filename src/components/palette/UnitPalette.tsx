import { useState } from 'react'
import { Search } from 'lucide-react'
import { UNIT_SYMBOLS } from '@/components/canvas/symbols'
import { cn } from '@/lib/utils'
import type { UnitModelType } from '@/types'

// ─── Category definitions ─────────────────────────────────────────────────────
const CATEGORIES = {
  General:    ['Feeder', 'FeederSink', 'Pipe', 'Tank', 'Tie', 'Splitter', 'FlashTank'] as UnitModelType[],
  Heat:       ['HeatExchanger', 'Cooler', 'Heater'] as UnitModelType[],
  Separation: ['Filter', 'Thickener', 'Washer', 'Cyclone', 'Screen'] as UnitModelType[],
  Pressure:   ['Pump', 'Valve'] as UnitModelType[],
  Control:    ['GeneralController', 'PIDController', 'SetTagController', 'MakeupSource'] as UnitModelType[],
}

type CategoryKey = keyof typeof CATEGORIES

const UNIT_LABELS: Partial<Record<UnitModelType, string>> = {
  Feeder:            'Feeder',
  FeederSink:        'Sink',
  Pipe:              'Pipe',
  Tank:              'Tank',
  Tie:               'Tie',
  Splitter:          'Splitter',
  FlashTank:         'Flash Tank',
  FlashTank2:        'Flash Tank 2',
  HeatExchanger:     'Heat Exch.',
  Cooler:            'Cooler',
  Heater:            'Heater',
  Filter:            'Filter',
  Washer:            'Washer',
  Thickener:         'Thickener',
  CrushingMill:      'Mill',
  Screen:            'Screen',
  Cyclone:           'Cyclone',
  Pump:              'Pump',
  Valve:             'Valve',
  GeneralController: 'Gen. Ctrl',
  PIDController:     'PID Ctrl',
  SetTagController:  'Set Tag',
  MakeupSource:      'Makeup',
}

// ─── Unit card ────────────────────────────────────────────────────────────────
interface UnitCardProps {
  unitType: UnitModelType
}

function UnitCard({ unitType }: UnitCardProps) {
  const Icon = UNIT_SYMBOLS[unitType]
  const label = UNIT_LABELS[unitType] ?? unitType

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('unitType', unitType)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={cn(
        'flex flex-col items-center justify-center gap-1 p-2 rounded border border-gray-200 bg-white',
        'cursor-grab hover:bg-blue-50 hover:border-blue-300 transition-colors select-none',
        'active:cursor-grabbing',
      )}
      title={unitType}
    >
      <Icon size={22} className="text-gray-500 group-hover:text-blue-500" />
      <span className="text-[10px] text-center text-gray-600 leading-tight">
        {label}
      </span>
    </div>
  )
}

// ─── Palette panel ────────────────────────────────────────────────────────────
export function UnitPalette() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('General')

  const categories = Object.keys(CATEGORIES) as CategoryKey[]

  // Filter units in active category by search term
  const visibleUnits = CATEGORIES[activeCategory].filter((type) => {
    if (!search.trim()) return true
    const label = UNIT_LABELS[type] ?? type
    return (
      label.toLowerCase().includes(search.toLowerCase()) ||
      type.toLowerCase().includes(search.toLowerCase())
    )
  })

  // If searching, search across ALL categories
  const searchUnits: UnitModelType[] = search.trim()
    ? (Object.values(CATEGORIES).flat() as UnitModelType[]).filter((type) => {
        const label = UNIT_LABELS[type] ?? type
        return (
          label.toLowerCase().includes(search.toLowerCase()) ||
          type.toLowerCase().includes(search.toLowerCase())
        )
      })
    : visibleUnits

  const displayUnits = search.trim() ? searchUnits : visibleUnits

  return (
    <div className="w-64 flex-none border-r border-gray-200 bg-white flex flex-col h-full">
      {/* Search */}
      <div className="px-2 py-2 border-b border-gray-200">
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-gray-200 bg-gray-50">
          <Search size={13} className="text-gray-400 flex-none" />
          <input
            type="text"
            placeholder="Search units…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-xs bg-transparent outline-none text-gray-700 placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Category tabs — only show when not searching */}
      {!search.trim() && (
        <div className="flex gap-1 px-2 py-1.5 border-b border-gray-200 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'px-2 py-0.5 text-[10px] rounded-full whitespace-nowrap flex-none transition-colors',
                activeCategory === cat
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-100',
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Search label */}
      {search.trim() && (
        <div className="px-3 py-1.5 border-b border-gray-200">
          <span className="text-[10px] text-gray-400">
            {displayUnits.length} result{displayUnits.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Unit grid */}
      <div className="grid grid-cols-2 gap-2 p-2 overflow-y-auto flex-1">
        {displayUnits.map((type) => (
          <UnitCard key={type} unitType={type} />
        ))}
        {displayUnits.length === 0 && (
          <div className="col-span-2 text-xs text-gray-400 text-center py-8">
            No units found
          </div>
        )}
      </div>
    </div>
  )
}
