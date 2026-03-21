import { describe, test, expect } from 'vitest'
import { toSI, fromSI } from '../lib/unitConversion'

// ─── Unit Conversion ──────────────────────────────────────────────────────────

describe('Temperature conversions', () => {
  test('100°C → K', () => {
    expect(toSI(100, 'temperature', '°C')).toBeCloseTo(373.15, 6)
  })

  test('0°C → 273.15 K', () => {
    expect(toSI(0, 'temperature', '°C')).toBeCloseTo(273.15, 6)
  })

  test('-273.15°C → 0 K (absolute zero)', () => {
    expect(toSI(-273.15, 'temperature', '°C')).toBeCloseTo(0, 4)
  })

  test('K → K (identity)', () => {
    expect(toSI(300, 'temperature', 'K')).toBe(300)
  })

  test('32°F → 273.15 K (water freezing point)', () => {
    expect(toSI(32, 'temperature', '°F')).toBeCloseTo(273.15, 3)
  })

  test('fromSI: 373.15 K → 100°C', () => {
    expect(fromSI(373.15, 'temperature', '°C')).toBeCloseTo(100, 4)
  })

  test('fromSI: 273.15 K → 32°F', () => {
    expect(fromSI(273.15, 'temperature', '°F')).toBeCloseTo(32, 3)
  })
})

describe('Pressure conversions', () => {
  test('1 kPa → 1000 Pa', () => {
    expect(toSI(1, 'pressure', 'kPa')).toBeCloseTo(1000, 6)
  })

  test('1 bar → 100 000 Pa', () => {
    expect(toSI(1, 'pressure', 'bar')).toBeCloseTo(100_000, 6)
  })

  test('1 atm → 101 325 Pa', () => {
    expect(toSI(1, 'pressure', 'atm')).toBeCloseTo(101_325, 3)
  })

  test('1 psi → ≈ 6894.76 Pa', () => {
    expect(toSI(1, 'pressure', 'psi')).toBeCloseTo(6894.757, 2)
  })

  test('fromSI: 101 325 Pa → 1 atm', () => {
    expect(fromSI(101_325, 'pressure', 'atm')).toBeCloseTo(1.0, 6)
  })

  test('fromSI: 100 000 Pa → 1 bar', () => {
    expect(fromSI(100_000, 'pressure', 'bar')).toBeCloseTo(1.0, 6)
  })
})

describe('Mass flow conversions', () => {
  test('1 kg/s → 3.6 t/h', () => {
    expect(fromSI(1, 'massFlow', 't/h')).toBeCloseTo(3.6, 6)
  })

  test('1 t/h → 1/3.6 kg/s', () => {
    expect(toSI(1, 'massFlow', 't/h')).toBeCloseTo(1 / 3.6, 6)
  })

  test('1 t/d → 1/86.4 kg/s', () => {
    expect(toSI(1, 'massFlow', 't/d')).toBeCloseTo(1 / 86.4, 8)
  })

  test('1 kg/s identity', () => {
    expect(toSI(1, 'massFlow', 'kg/s')).toBe(1)
  })

  test('fromSI: 1 kg/s → 86.4 t/d', () => {
    expect(fromSI(1, 'massFlow', 't/d')).toBeCloseTo(86.4, 6)
  })
})

describe('Error handling', () => {
  test('unknown unit throws', () => {
    expect(() => toSI(1, 'temperature', 'Rankine')).toThrow()
  })
})
