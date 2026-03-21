import { useRef, useState, type ChangeEvent } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { saveAs } from 'file-saver'
import { Trash2, X, BarChart2 } from 'lucide-react'
import { useTrendStore } from '@/store'
import { useProjectStore } from '@/store'
import { useTrendData } from '@/hooks/useTrendData'
import { tagRegistry } from '@/services/tagRegistry'
import { historian } from '@/services/historian'
import { TagBrowser } from '@/components/ui/TagBrowser'
import { cn } from '@/lib/utils'

// ─── Tag row ──────────────────────────────────────────────────────────────────

interface TrendTagRowProps {
  tagPath: string
  color: string
  min?: number
  max?: number
  currentValue: number | string | boolean | null
  onColorChange: (color: string) => void
  onMinChange: (v: number | undefined) => void
  onMaxChange: (v: number | undefined) => void
  onRemove: () => void
}

function TrendTagRow({
  tagPath, color, min, max, currentValue, onColorChange, onMinChange, onMaxChange, onRemove,
}: TrendTagRowProps) {
  const colorInputRef = useRef<HTMLInputElement>(null)

  const displayValue =
    currentValue === null
      ? '—'
      : typeof currentValue === 'number'
        ? currentValue.toPrecision(4)
        : String(currentValue)

  return (
    <div className="flex flex-col px-2 py-1 border-b border-gray-100 text-xs">
      <div className="flex items-center gap-1.5">
        {/* Color swatch */}
        <button
          onClick={() => colorInputRef.current?.click()}
          style={{ background: color }}
          className="w-3 h-3 rounded-sm flex-none border border-gray-300"
          title="Change color"
        />
        <input
          ref={colorInputRef}
          type="color"
          value={color}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onColorChange(e.target.value)}
          className="sr-only"
        />

        {/* Tag path */}
        <span className="flex-1 font-mono truncate text-gray-700" title={tagPath}>
          {tagPath}
        </span>

        {/* Current value */}
        <span className="text-gray-400 font-mono flex-none">{displayValue}</span>

        {/* Remove */}
        <button
          onClick={onRemove}
          className="flex-none text-gray-300 hover:text-red-500 ml-0.5"
          title="Remove tag"
        >
          <X size={10} />
        </button>
      </div>

      {/* Min / Max row */}
      <div className="flex items-center gap-2 mt-0.5 ml-4.5 text-[10px] text-gray-400">
        <label className="flex items-center gap-1">
          Min
          <input
            type="number"
            value={min ?? ''}
            placeholder="auto"
            step="any"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const n = parseFloat(e.target.value)
              onMinChange(isNaN(n) ? undefined : n)
            }}
            className="w-16 border border-gray-200 rounded px-1 py-0 font-mono text-gray-600 bg-white"
          />
        </label>
        <label className="flex items-center gap-1">
          Max
          <input
            type="number"
            value={max ?? ''}
            placeholder="auto"
            step="any"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const n = parseFloat(e.target.value)
              onMaxChange(isNaN(n) ? undefined : n)
            }}
            className="w-16 border border-gray-200 rounded px-1 py-0 font-mono text-gray-600 bg-white"
          />
        </label>
      </div>
    </div>
  )
}

// ─── Chart data builder ───────────────────────────────────────────────────────

function buildChartData(
  buffer: Record<string, { simTime: number; value: number }[]>,
  tagPaths: string[],
): Record<string, number>[] {
  const timeSet = new Set<number>()
  for (const pts of Object.values(buffer)) {
    for (const pt of pts) timeSet.add(pt.simTime)
  }
  const times = Array.from(timeSet).sort((a, b) => a - b)

  // Build lookup
  const lookup = new Map<string, Map<number, number>>()
  for (const tp of tagPaths) {
    const m = new Map<number, number>()
    for (const pt of buffer[tp] ?? []) m.set(pt.simTime, pt.value)
    lookup.set(tp, m)
  }

  return times.map((t) => {
    const row: Record<string, number> = { iteration: t }
    for (const tp of tagPaths) {
      const v = lookup.get(tp)?.get(t)
      if (v !== undefined) row[tp] = v
    }
    return row
  })
}

// ─── TrendWindow ─────────────────────────────────────────────────────────────

export function TrendWindow() {
  const { trackedTags, logScale, addTag, removeTag, updateTag, setLogScale } = useTrendStore()
  const project = useProjectStore((s) => s.project)
  const { buffer, clearBuffer } = useTrendData()

  const [browserOpen, setBrowserOpen] = useState(false)

  const tagPaths = trackedTags.map((t) => t.tagPath)
  const chartData = buildChartData(buffer, tagPaths)

  // Guard log scale: only enable if all values in buffer are > 0
  const allPositive = tagPaths.every((tp) =>
    (buffer[tp] ?? []).every((pt) => pt.value > 0),
  )
  const yScale: 'auto' | 'log' = logScale && allPositive ? 'log' : 'auto'

  async function handleExportCSV() {
    if (tagPaths.length === 0) return
    const csv = await historian.exportCSV(tagPaths)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    saveAs(blob, 'trend-export.csv')
  }

  function handleAddTags(selected: string[]) {
    for (const tp of selected) {
      addTag(tp)
      void historian.ensureTagTracked(tp)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 h-8 border-b border-gray-200 bg-gray-50 flex-none text-xs">
        <button
          onClick={() => setBrowserOpen(true)}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs"
        >
          <span>+</span> Add Tag
        </button>

        <div className="w-px h-4 bg-gray-200 mx-1" />

        <button
          onClick={() => {
            const sel = useTrendStore.getState().trackedTags
            if (sel.length > 0) removeTag(sel[sel.length - 1].tagPath)
          }}
          className="p-1 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          title="Remove last tag"
        >
          <X size={12} />
        </button>

        <button
          onClick={clearBuffer}
          className="p-1 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          title="Clear chart data (keeps tags)"
        >
          <Trash2 size={12} />
        </button>

        <button
          onClick={handleExportCSV}
          className="p-1 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          title="Export CSV"
        >
          <BarChart2 size={12} />
        </button>

        <div className="w-px h-4 bg-gray-200 mx-1" />

        <button
          onClick={() => setLogScale(!logScale)}
          className={cn(
            'px-2 py-0.5 rounded border text-xs',
            logScale
              ? 'bg-blue-100 text-blue-700 border-blue-300'
              : 'text-gray-500 border-gray-200 hover:bg-gray-100',
          )}
          title="Toggle log scale (requires all-positive values)"
        >
          Log
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Tag list */}
        <div className="w-56 flex-none border-r border-gray-200 overflow-y-auto bg-white">
          {trackedTags.length === 0 ? (
            <p className="text-xs text-gray-400 text-center mt-4 px-2">
              Click "+ Add Tag" to start tracking
            </p>
          ) : (
            trackedTags.map((tag) => (
              <TrendTagRow
                key={tag.tagPath}
                tagPath={tag.tagPath}
                color={tag.color}
                min={tag.min}
                max={tag.max}
                currentValue={tagRegistry.resolveTagValue(tag.tagPath, project)}
                onColorChange={(c) => updateTag(tag.tagPath, { color: c })}
                onMinChange={(v) => updateTag(tag.tagPath, { min: v })}
                onMaxChange={(v) => updateTag(tag.tagPath, { max: v })}
                onRemove={() => removeTag(tag.tagPath)}
              />
            ))
          )}
        </div>

        {/* Right: Chart */}
        <div className="flex-1 p-2 min-w-0">
          {tagPaths.length === 0 || chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-gray-300">
              No trend data — add tags and run a solve
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="iteration"
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Iteration', position: 'insideBottomRight', offset: -4, fontSize: 10 }}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  scale={yScale}
                  domain={['auto', 'auto']}
                  allowDataOverflow
                />
                <Tooltip
                  contentStyle={{ fontSize: 11 }}
                  labelFormatter={(v) => `Iter: ${v}`}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {trackedTags.map((tag) => (
                  <Line
                    key={tag.tagPath}
                    type="monotone"
                    dataKey={tag.tagPath}
                    stroke={tag.color}
                    dot={false}
                    isAnimationActive={false}
                    strokeWidth={1.5}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tag browser modal */}
      {browserOpen && (
        <TagBrowser
          open={browserOpen}
          mode="multi"
          onSelect={handleAddTags}
          onClose={() => setBrowserOpen(false)}
        />
      )}
    </div>
  )
}
