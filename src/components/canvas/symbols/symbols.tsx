// SVG Symbol components for each unit type
// ViewBox: "0 0 40 40", stroke: currentColor, strokeWidth: 1.5
import type { ReactElement } from 'react'
import type { UnitModelType } from '@/types'

export interface SymbolProps {
  color?: string
  size?: number
  className?: string
}

export type SymbolFC = (props: SymbolProps) => ReactElement

// ─── Symbol Components ────────────────────────────────────────────────────────

export function FeederSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="8,8 8,32 34,20" fill={color} stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export function FeederSinkSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="32,8 32,32 6,20" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export function MakeupSourceSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="16" r="9" stroke={color} strokeWidth="1.5" />
      <line x1="20" y1="25" x2="20" y2="35" stroke={color} strokeWidth="1.5" />
      <polyline points="15,30 20,35 25,30" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export function PipeSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="5" y1="20" x2="30" y2="20" stroke={color} strokeWidth="1.5" />
      <polyline points="25,14 33,20 25,26" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export function PumpSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="13" stroke={color} strokeWidth="1.5" />
      <polygon points="13,13 13,27 30,20" fill={color} stroke={color} strokeWidth="1" strokeLinejoin="round" />
    </svg>
  )
}

export function ValveSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="5,8 20,20 5,32" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <polygon points="35,8 20,20 35,32" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <line x1="20" y1="8" x2="20" y2="5" stroke={color} strokeWidth="1.5" />
      <line x1="16" y1="5" x2="24" y2="5" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

export function TankSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="24" height="24" rx="2" stroke={color} strokeWidth="1.5" />
      <line x1="8" y1="24" x2="32" y2="24" stroke={color} strokeWidth="1" strokeDasharray="3,2" />
    </svg>
  )
}

export function TieSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="10" stroke={color} strokeWidth="1.5" />
      <circle cx="20" cy="20" r="3" fill={color} />
    </svg>
  )
}

export function SplitterSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="6" y1="20" x2="20" y2="20" stroke={color} strokeWidth="1.5" />
      <line x1="20" y1="20" x2="34" y2="10" stroke={color} strokeWidth="1.5" />
      <line x1="20" y1="20" x2="34" y2="30" stroke={color} strokeWidth="1.5" />
      <circle cx="20" cy="20" r="3" fill={color} />
    </svg>
  )
}

export function FlashTankSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="6" width="24" height="28" rx="2" stroke={color} strokeWidth="1.5" />
      <line x1="8" y1="22" x2="32" y2="22" stroke={color} strokeWidth="1.5" strokeDasharray="4,2" />
      <text x="20" y="17" textAnchor="middle" fontSize="6" fill={color} fontFamily="sans-serif">V</text>
      <text x="20" y="30" textAnchor="middle" fontSize="6" fill={color} fontFamily="sans-serif">L</text>
    </svg>
  )
}

export function FlashTank2Symbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="5" width="24" height="30" rx="2" stroke={color} strokeWidth="1.5" />
      <line x1="8" y1="17" x2="32" y2="17" stroke={color} strokeWidth="1" strokeDasharray="4,2" />
      <line x1="8" y1="26" x2="32" y2="26" stroke={color} strokeWidth="1" strokeDasharray="4,2" />
    </svg>
  )
}

export function FilterSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="7" y="9" width="26" height="22" rx="1" stroke={color} strokeWidth="1.5" />
      <line x1="7" y1="20" x2="33" y2="14" stroke={color} strokeWidth="1" />
      <line x1="7" y1="25" x2="33" y2="19" stroke={color} strokeWidth="1" />
      <line x1="7" y1="30" x2="33" y2="24" stroke={color} strokeWidth="1" />
    </svg>
  )
}

export function WasherSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="6" width="24" height="8" rx="1" stroke={color} strokeWidth="1.5" />
      <rect x="8" y="16" width="24" height="8" rx="1" stroke={color} strokeWidth="1.5" />
      <rect x="8" y="26" width="24" height="8" rx="1" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

export function ThickenerSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="5,8 35,8 28,32 12,32" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <line x1="20" y1="8" x2="20" y2="26" stroke={color} strokeWidth="1" />
      <line x1="12" y1="26" x2="28" y2="26" stroke={color} strokeWidth="1" />
    </svg>
  )
}

export function CrushingMillSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="20" r="9" stroke={color} strokeWidth="1.5" />
      <circle cx="26" cy="20" r="9" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

export function ScreenSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="10" width="28" height="20" rx="1" stroke={color} strokeWidth="1.5" />
      <line x1="12" y1="10" x2="6" y2="16" stroke={color} strokeWidth="1" />
      <line x1="18" y1="10" x2="6" y2="22" stroke={color} strokeWidth="1" />
      <line x1="24" y1="10" x2="6" y2="28" stroke={color} strokeWidth="1" />
      <line x1="30" y1="10" x2="12" y2="28" stroke={color} strokeWidth="1" />
      <line x1="34" y1="12" x2="18" y2="28" stroke={color} strokeWidth="1" />
      <line x1="34" y1="18" x2="24" y2="28" stroke={color} strokeWidth="1" />
    </svg>
  )
}

export function CycloneSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="8,5 32,5 26,30 14,30" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <line x1="14" y1="30" x2="17" y2="36" stroke={color} strokeWidth="1.5" />
      <line x1="26" y1="30" x2="23" y2="36" stroke={color} strokeWidth="1.5" />
      <line x1="20" y1="5" x2="20" y2="18" stroke={color} strokeWidth="1" strokeDasharray="2,2" />
    </svg>
  )
}

export function HeatExchangerSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="12" width="30" height="16" rx="2" stroke={color} strokeWidth="1.5" />
      <line x1="5" y1="20" x2="35" y2="20" stroke={color} strokeWidth="1" strokeDasharray="2,2" />
      <polyline points="8,16 12,24 16,16 20,24 24,16 28,24 32,16"
        stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export function CoolerSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="10" width="28" height="20" rx="2" stroke={color} strokeWidth="1.5" />
      <line x1="20" y1="13" x2="20" y2="27" stroke={color} strokeWidth="1.5" />
      <line x1="13" y1="20" x2="27" y2="20" stroke={color} strokeWidth="1.5" />
      <line x1="15" y1="15" x2="25" y2="25" stroke={color} strokeWidth="1" />
      <line x1="25" y1="15" x2="15" y2="25" stroke={color} strokeWidth="1" />
    </svg>
  )
}

export function HeaterSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="10" width="28" height="20" rx="2" stroke={color} strokeWidth="1.5" />
      <path d="M20,26 C16,26 14,23 15,20 C16,17 18,19 18,17 C19,14 21,13 22,15 C23,13 25,14 24,17 C25,15 27,17 26,20 C26,23 24,26 20,26Z"
        stroke={color} strokeWidth="1" fill="none" />
    </svg>
  )
}

export function GeneralControllerSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="20,6 34,20 20,34 6,20" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <text x="20" y="24" textAnchor="middle" fontSize="8" fill={color} fontFamily="sans-serif" fontWeight="bold">GC</text>
    </svg>
  )
}

export function PIDControllerSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="14" stroke={color} strokeWidth="1.5" />
      <text x="20" y="23" textAnchor="middle" fontSize="8" fill={color} fontFamily="sans-serif" fontWeight="bold">PID</text>
    </svg>
  )
}

export function SetTagControllerSymbol({ color = 'currentColor', size = 40 }: SymbolProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="20,6 34,20 20,34 6,20" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <line x1="14" y1="18" x2="26" y2="18" stroke={color} strokeWidth="1.5" />
      <line x1="14" y1="22" x2="26" y2="22" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

// ─── Symbol Map ────────────────────────────────────────────────────────────────

export const UNIT_SYMBOLS: Record<UnitModelType, SymbolFC> = {
  Feeder:            FeederSymbol,
  FeederSink:        FeederSinkSymbol,
  MakeupSource:      MakeupSourceSymbol,
  Pipe:              PipeSymbol,
  Pump:              PumpSymbol,
  Valve:             ValveSymbol,
  Tank:              TankSymbol,
  Tie:               TieSymbol,
  Splitter:          SplitterSymbol,
  FlashTank:         FlashTankSymbol,
  FlashTank2:        FlashTank2Symbol,
  Filter:            FilterSymbol,
  Washer:            WasherSymbol,
  Thickener:         ThickenerSymbol,
  CrushingMill:      CrushingMillSymbol,
  Screen:            ScreenSymbol,
  Cyclone:           CycloneSymbol,
  HeatExchanger:     HeatExchangerSymbol,
  Cooler:            CoolerSymbol,
  Heater:            HeaterSymbol,
  GeneralController: GeneralControllerSymbol,
  PIDController:     PIDControllerSymbol,
  SetTagController:  SetTagControllerSymbol,
}

// ─── Symbol Variants (variants available per unit type) ───────────────────────
export const SYMBOL_VARIANTS: Partial<Record<UnitModelType, UnitModelType[]>> = {
  FlashTank:  ['FlashTank', 'FlashTank2'],
  FlashTank2: ['FlashTank2', 'FlashTank'],
}
