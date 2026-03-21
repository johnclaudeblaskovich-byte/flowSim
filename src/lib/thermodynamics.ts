// ─── Thermodynamics Utilities ─────────────────────────────────────────────────
// Lightweight frontend thermodynamic helpers.
// Mirrors the Python ThermoHelper in flowsim-backend/solver/thermo.py.

// ─── Constants ────────────────────────────────────────────────────────────────

/** Water specific heat capacity at 25°C in J/(kg·K) */
export const WATER_CP_25C = 4182

/** Approximate water specific enthalpy at 100°C in J/kg
 * = Cp × (100 - 0) = 4182 × 100 = 418 200 J/kg */
export const WATER_ENTHALPY_100C = WATER_CP_25C * 100  // 418 200 J/kg

/** Water Cp used for enthalpy approximation */
const CP_WATER = WATER_CP_25C  // J/(kg·K)

// ─── Stream mixing interface ──────────────────────────────────────────────────

/** Minimal stream representation for mixing calculations */
export interface StreamMix {
  /** Total mass flow in kg/s */
  Qm: number
  /** Temperature in K */
  T: number
  /** Specific enthalpy in J/kg */
  H: number
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Mix a list of streams.
 * - Qm: summed
 * - T: mass-weighted average
 * - H: energy-weighted average (H_mix = Σ(Qm_i · H_i) / Qm_total)
 */
export function mixStreams(streams: StreamMix[]): StreamMix {
  const nonEmpty = streams.filter((s) => s.Qm > 0)
  if (nonEmpty.length === 0) return { Qm: 0, T: 298.15, H: 0 }

  const Qm = nonEmpty.reduce((acc, s) => acc + s.Qm, 0)
  const T = nonEmpty.reduce((acc, s) => acc + s.Qm * s.T, 0) / Math.max(Qm, 1e-12)
  const H = nonEmpty.reduce((acc, s) => acc + s.Qm * s.H, 0) / Math.max(Qm, 1e-12)

  return { Qm, T, H }
}

/**
 * Approximate specific enthalpy of water relative to 0°C.
 * h(T) = Cp × (T - 273.15)  [J/kg]
 */
export function waterEnthalpyApprox(T_K: number): number {
  return CP_WATER * (T_K - 273.15)
}
