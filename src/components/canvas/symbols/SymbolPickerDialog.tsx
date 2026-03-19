import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import { UNIT_SYMBOLS, SYMBOL_VARIANTS } from './symbols'
import type { SymbolFC } from './symbols'
import type { UnitModelType } from '@/types'

interface SymbolPickerDialogProps {
  open: boolean
  unitType: UnitModelType
  unitTag: string
  currentSymbolKey: string
  onSelect: (symbolKey: string) => void
  onClose: () => void
}

export function SymbolPickerDialog({
  open,
  unitType,
  unitTag,
  currentSymbolKey,
  onSelect,
  onClose,
}: SymbolPickerDialogProps) {
  // Get variants for this unit type, default to [unitType] if none defined
  const variants: UnitModelType[] = SYMBOL_VARIANTS[unitType] ?? [unitType]

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 z-50" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
            bg-white rounded-xl shadow-xl border border-gray-200 p-5 w-80 focus:outline-none"
        >
          <Dialog.Title className="text-sm font-semibold text-gray-800 mb-1">
            Change Symbol
          </Dialog.Title>
          <Dialog.Description className="text-xs text-gray-500 mb-4">
            {unitTag}
          </Dialog.Description>

          <div className="grid grid-cols-4 gap-2 mb-5">
            {variants.map((key) => {
              const Sym: SymbolFC = UNIT_SYMBOLS[key]
              const isSelected = key === currentSymbolKey
              return (
                <button
                  key={key}
                  onClick={() => onSelect(key)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 p-2 rounded-lg border-2 transition-all',
                    'hover:border-blue-400 hover:bg-blue-50',
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-gray-50',
                  )}
                  title={key}
                >
                  <Sym size={32} color={isSelected ? '#3B82F6' : '#6B7280'} />
                  <span className="text-[9px] text-gray-500 leading-tight text-center">
                    {key}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
