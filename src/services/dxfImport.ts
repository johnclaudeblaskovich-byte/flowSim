import DxfParser from 'dxf-parser'
import type { UnitModelType } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DxfUnit {
  blockName: string
  position: { x: number; y: number }
  handle: string
}

export interface DxfImportResult {
  units: DxfUnit[]
}

// ─── Block name → FlowSim unit type auto-detection map ────────────────────────

export const AUTO_DETECT_MAP: Record<string, UnitModelType> = {
  TANK: 'Tank',
  TK: 'Tank',
  VESSEL: 'Tank',
  PUMP: 'Pump',
  PMP: 'Pump',
  VALVE: 'Valve',
  VLV: 'Valve',
  FILTER: 'Filter',
  FLTR: 'Filter',
  SCREEN: 'Screen',
  SCR: 'Screen',
  CYCLONE: 'Cyclone',
  CYCL: 'Cyclone',
  MILL: 'CrushingMill',
  CM: 'CrushingMill',
  THICKENER: 'Thickener',
  THKR: 'Thickener',
  HX: 'HeatExchanger',
  HEATEX: 'HeatExchanger',
  HEATER: 'Heater',
  HTR: 'Heater',
  COOLER: 'Cooler',
  CLR: 'Cooler',
  FEEDER: 'Feeder',
  FDR: 'Feeder',
  SINK: 'FeederSink',
  SNK: 'FeederSink',
  SPLITTER: 'Splitter',
  SPL: 'Splitter',
  FLASHTANK: 'FlashTank',
  FT: 'FlashTank',
  WASHER: 'Washer',
  WSH: 'Washer',
}

// ─── DXF Parsing ──────────────────────────────────────────────────────────────

export function parseDXF(text: string): DxfImportResult {
  const parser = new DxfParser()
  const dxf = parser.parseSync(text)

  const units: DxfUnit[] = dxf.entities
    .filter((e) => e.type === 'INSERT' && e.position)
    .map((e) => ({
      blockName: (e.name ?? '').toUpperCase(),
      position: { x: e.position!.x, y: e.position!.y },
      handle: e.handle ?? crypto.randomUUID(),
    }))

  return { units }
}

// ─── Position Normalization ───────────────────────────────────────────────────

export function normalizeDXFPositions(
  units: DxfUnit[],
  canvasWidth = 1600,
  canvasHeight = 1200,
  margin = 100,
): Array<DxfUnit & { canvasX: number; canvasY: number }> {
  if (units.length === 0) return []

  const xs = units.map((u) => u.position.x)
  const ys = units.map((u) => u.position.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const scale = Math.min(
    (canvasWidth - 2 * margin) / rangeX,
    (canvasHeight - 2 * margin) / rangeY,
  )

  return units.map((u) => ({
    ...u,
    canvasX: margin + (u.position.x - minX) * scale,
    canvasY: margin + (maxY - u.position.y) * scale, // flip Y axis
  }))
}
