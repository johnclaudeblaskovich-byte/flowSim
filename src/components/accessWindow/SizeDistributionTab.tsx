import { type ChangeEvent } from 'react'
import type { UnitNode } from '@/types'
import type { SizeClass, SizeDistribution } from '@/types/sizeDistribution'
import { useProjectStore, useCanvasStore } from '@/store'

interface Props {
  unit: UnitNode
}

export function SizeDistributionTab({ unit }: Props) {
  const activeFlowsheetId = useCanvasStore((s) => s.activeFlowsheetId)
  const updateNode = useProjectStore((s) => s.updateNode)

  const quality = unit.config.quality as Record<string, unknown> | undefined
  const sizeDistRaw = quality?.sizeDistribution as SizeDistribution | undefined

  const sizeDist: SizeDistribution = sizeDistRaw ?? {
    method: 'Custom',
    classes: [],
  }

  function update(newDist: SizeDistribution) {
    if (!activeFlowsheetId) return
    updateNode(activeFlowsheetId, unit.id, {
      config: {
        ...unit.config,
        quality: {
          ...(unit.config.quality as Record<string, unknown> | undefined),
          sizeDistribution: newDist,
        },
      },
    })
  }

  function updateMethod(method: SizeDistribution['method']) {
    update({ ...sizeDist, method })
  }

  function updateClass(idx: number, field: keyof SizeClass, value: number) {
    const newClasses = sizeDist.classes.map((cls, i) =>
      i === idx ? { ...cls, [field]: value } : cls,
    )
    update({ ...sizeDist, classes: newClasses })
  }

  function addClass() {
    const lastUpper = sizeDist.classes[sizeDist.classes.length - 1]?.upperMicrons ?? 0
    update({
      ...sizeDist,
      classes: [
        ...sizeDist.classes,
        { lowerMicrons: lastUpper, upperMicrons: lastUpper * 2 || 100, massFraction: 0 },
      ],
    })
  }

  function removeClass(idx: number) {
    update({
      ...sizeDist,
      classes: sizeDist.classes.filter((_, i) => i !== idx),
    })
  }

  const totalFraction = sizeDist.classes.reduce((s, c) => s + c.massFraction, 0)
  const fractionOk = Math.abs(totalFraction - 1.0) < 0.001 || sizeDist.classes.length === 0

  return (
    <div className="space-y-2">
      {/* Method selector */}
      <div className="flex items-center justify-between px-2 py-1 text-sm">
        <span className="text-gray-700">Method</span>
        <select
          value={sizeDist.method}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            updateMethod(e.target.value as SizeDistribution['method'])
          }
          className="text-sm border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-700"
        >
          <option value="Custom">Custom</option>
          <option value="Phi">Phi</option>
          <option value="Tyler">Tyler</option>
        </select>
      </div>

      {/* Size class table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-500">
              <th className="px-2 py-1 text-left font-medium">Lower (µm)</th>
              <th className="px-2 py-1 text-left font-medium">Upper (µm)</th>
              <th className="px-2 py-1 text-left font-medium">Mass Frac.</th>
              <th className="px-1 py-1" />
            </tr>
          </thead>
          <tbody>
            {sizeDist.classes.map((cls, idx) => (
              <tr key={idx} className="border-t border-gray-100">
                <td className="px-1 py-0.5">
                  <input
                    type="number"
                    value={cls.lowerMicrons}
                    min={0}
                    step="any"
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const n = parseFloat(e.target.value)
                      if (!isNaN(n)) updateClass(idx, 'lowerMicrons', n)
                    }}
                    className="w-20 border border-gray-200 rounded px-1 py-0.5 bg-white font-mono text-right text-xs"
                  />
                </td>
                <td className="px-1 py-0.5">
                  <input
                    type="number"
                    value={cls.upperMicrons}
                    min={0}
                    step="any"
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const n = parseFloat(e.target.value)
                      if (!isNaN(n)) updateClass(idx, 'upperMicrons', n)
                    }}
                    className="w-20 border border-gray-200 rounded px-1 py-0.5 bg-white font-mono text-right text-xs"
                  />
                </td>
                <td className="px-1 py-0.5">
                  <input
                    type="number"
                    value={cls.massFraction}
                    min={0}
                    max={1}
                    step="0.01"
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const n = parseFloat(e.target.value)
                      if (!isNaN(n)) updateClass(idx, 'massFraction', n)
                    }}
                    className="w-20 border border-gray-200 rounded px-1 py-0.5 bg-white font-mono text-right text-xs"
                  />
                </td>
                <td className="px-1 py-0.5">
                  <button
                    onClick={() => removeClass(idx)}
                    className="text-red-400 hover:text-red-600 px-1"
                    title="Remove row"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Fraction total validation */}
      {sizeDist.classes.length > 0 && (
        <div className={`px-2 text-xs ${fractionOk ? 'text-gray-400' : 'text-red-500'}`}>
          Total: {totalFraction.toFixed(4)}{!fractionOk && ' (must sum to 1.0)'}
        </div>
      )}

      <div className="px-2">
        <button
          onClick={addClass}
          className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-50"
        >
          + Add size class
        </button>
      </div>
    </div>
  )
}
