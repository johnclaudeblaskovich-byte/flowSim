import type { UnitModelType } from '@/types'

export const MULTI_OUTPUT_UNIT_ROUTES: Partial<Record<UnitModelType, string[]>> = {
  Thickener: ['overflow', 'underflow'],
  Filter: ['cake', 'filtrate'],
  Cyclone: ['overflow', 'underflow'],
  Screen: ['oversize', 'undersize'],
  Washer: ['product_liquor', 'washed_solids'],
}

export function getOutputRoutes(unitType: UnitModelType): string[] {
  return MULTI_OUTPUT_UNIT_ROUTES[unitType] ?? []
}
