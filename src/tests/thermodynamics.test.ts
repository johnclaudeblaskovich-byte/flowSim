import { describe, test, expect } from 'vitest'
import {
  WATER_CP_25C,
  WATER_ENTHALPY_100C,
  mixStreams,
  waterEnthalpyApprox,
} from '../lib/thermodynamics'

// ─── Thermodynamics Engine ────────────────────────────────────────────────────

describe('Thermodynamics Engine', () => {
  test('water Cp at 25°C ≈ 4182 J/kg·K', () => {
    expect(WATER_CP_25C).toBe(4182)
  })

  test('water enthalpy at 100°C correct', () => {
    // At 100°C (373.15 K): h = Cp × 100°C = 4182 × 100 = 418 200 J/kg
    const h = waterEnthalpyApprox(373.15)
    expect(h).toBeCloseTo(418_200, 0)
    expect(WATER_ENTHALPY_100C).toBeCloseTo(418_200, -2)
  })

  test('water enthalpy at 0°C = 0 J/kg (reference point)', () => {
    const h = waterEnthalpyApprox(273.15)
    expect(h).toBeCloseTo(0, 6)
  })

  test('mixStreams conserves mass', () => {
    const s1 = { Qm: 2.0, T: 300, H: 100 }
    const s2 = { Qm: 3.0, T: 350, H: 200 }
    const mixed = mixStreams([s1, s2])
    expect(mixed.Qm).toBeCloseTo(5.0, 9)
  })

  test('mixStreams conserves energy (adiabatic)', () => {
    const s1 = { Qm: 1.0, T: 300, H: 100 }
    const s2 = { Qm: 2.0, T: 300, H: 300 }
    // Total energy in: 1*100 + 2*300 = 700 J/s
    // Total mass: 3 kg/s  →  H_mix = 700/3 ≈ 233.33 J/kg
    const mixed = mixStreams([s1, s2])
    const energyIn = s1.Qm * s1.H + s2.Qm * s2.H
    const energyOut = mixed.Qm * mixed.H
    expect(energyOut).toBeCloseTo(energyIn, 6)
  })

  test('mixStreams: 20°C + 80°C → 50°C (equal mass flows)', () => {
    const T1 = 293.15  // 20°C in K
    const T2 = 353.15  // 80°C in K
    const s1 = { Qm: 1.0, T: T1, H: waterEnthalpyApprox(T1) }
    const s2 = { Qm: 1.0, T: T2, H: waterEnthalpyApprox(T2) }
    const mixed = mixStreams([s1, s2])
    // Expected: T = (1*T1 + 1*T2) / 2 = 323.15 K = 50°C
    expect(mixed.T).toBeCloseTo(323.15, 4)
  })

  test('mixStreams with empty streams returns zero-flow stream', () => {
    const s1 = { Qm: 0, T: 300, H: 0 }
    const s2 = { Qm: 0, T: 350, H: 0 }
    const mixed = mixStreams([s1, s2])
    expect(mixed.Qm).toBe(0)
  })

  test('mixStreams with single stream returns clone', () => {
    const s = { Qm: 5.0, T: 320, H: 150 }
    const mixed = mixStreams([s])
    expect(mixed.Qm).toBe(5.0)
    expect(mixed.T).toBe(320)
    expect(mixed.H).toBe(150)
  })
})
