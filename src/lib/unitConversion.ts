// ─── Unit Conversion Utilities ────────────────────────────────────────────────
// Convert between display units and SI base units.
//
// Quantities:
//   temperature → SI unit: K
//   pressure    → SI unit: Pa
//   massFlow    → SI unit: kg/s

export type Quantity = 'temperature' | 'pressure' | 'massFlow'

// ─── toSI ─────────────────────────────────────────────────────────────────────

/**
 * Convert a value from a display unit to its SI base unit.
 */
export function toSI(value: number, quantity: Quantity, unit: string): number {
  switch (quantity) {
    case 'temperature':
      switch (unit) {
        case '°C': return value + 273.15
        case '°F': return (value + 459.67) * (5 / 9)
        case 'K':  return value
        default:   throw new Error(`Unknown temperature unit: ${unit}`)
      }
    case 'pressure':
      switch (unit) {
        case 'Pa':  return value
        case 'kPa': return value * 1_000
        case 'bar': return value * 100_000
        case 'psi': return value * 6_894.757_293_168
        case 'atm': return value * 101_325
        default:    throw new Error(`Unknown pressure unit: ${unit}`)
      }
    case 'massFlow':
      switch (unit) {
        case 'kg/s': return value
        case 't/h':  return value / 3.6
        case 't/d':  return value / 86.4
        default:     throw new Error(`Unknown mass-flow unit: ${unit}`)
      }
    default:
      throw new Error(`Unknown quantity: ${quantity}`)
  }
}

// ─── fromSI ───────────────────────────────────────────────────────────────────

/**
 * Convert a value from SI base units to a display unit.
 */
export function fromSI(value: number, quantity: Quantity, unit: string): number {
  switch (quantity) {
    case 'temperature':
      switch (unit) {
        case '°C': return value - 273.15
        case '°F': return value * (9 / 5) - 459.67
        case 'K':  return value
        default:   throw new Error(`Unknown temperature unit: ${unit}`)
      }
    case 'pressure':
      switch (unit) {
        case 'Pa':  return value
        case 'kPa': return value / 1_000
        case 'bar': return value / 100_000
        case 'psi': return value / 6_894.757_293_168
        case 'atm': return value / 101_325
        default:    throw new Error(`Unknown pressure unit: ${unit}`)
      }
    case 'massFlow':
      switch (unit) {
        case 'kg/s': return value
        case 't/h':  return value * 3.6
        case 't/d':  return value * 86.4
        default:     throw new Error(`Unknown mass-flow unit: ${unit}`)
      }
    default:
      throw new Error(`Unknown quantity: ${quantity}`)
  }
}
