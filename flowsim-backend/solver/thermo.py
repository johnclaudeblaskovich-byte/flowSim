"""
flowsim-backend/solver/thermo.py

Core thermodynamic helpers used by all unit solver models.
Mirrors the TypeScript StreamData / SpeciesFlow interfaces.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Any

# ─── Data classes ─────────────────────────────────────────────────────────────

SOLID_PHASES = frozenset({"Solid"})
LIQUID_PHASES = frozenset({"Liquid", "Aqueous"})
VAPOUR_PHASES = frozenset({"Vapour"})


@dataclass
class SpeciesFlowPy:
    """Per-species flow data inside a stream."""
    speciesId: str
    massFlow: float          # kg/s
    moleFlow: float = 0.0   # mol/s
    massFraction: float = 0.0
    moleFraction: float = 0.0
    phase: str = "Liquid"   # 'Solid' | 'Liquid' | 'Vapour' | 'Aqueous'


@dataclass
class StreamDataPy:
    """
    Python mirror of the TypeScript StreamData interface.
    All flow values in SI base units.
    """
    tag: str = ""
    Qm: float = 0.0          # Total mass flow  kg/s
    Qv: float = 0.0          # Volumetric flow   m³/s
    QmSolid: float = 0.0     # Solid mass flow   kg/s
    QmLiquid: float = 0.0    # Liquid mass flow  kg/s
    QmVapour: float = 0.0    # Vapour mass flow  kg/s
    T: float = 298.15        # Temperature       K
    P: float = 101325.0      # Pressure          Pa
    H: float = 0.0           # Specific enthalpy J/kg
    rho: float = 1000.0      # Bulk density      kg/m³
    Cp: float = 4186.0       # Specific heat     J/kg·K
    species: dict[str, SpeciesFlowPy] = field(default_factory=dict)
    solidFraction: float = 0.0
    liquidFraction: float = 1.0
    vapourFraction: float = 0.0
    sourceUnitTag: str = ""
    destUnitTag: str = ""
    solved: bool = True
    errors: list[str] = field(default_factory=list)
    # Optional quality data (e.g. sizeDistribution)
    quality: dict[str, Any] = field(default_factory=dict)

    # ── Derived helpers ────────────────────────────────────────────────────────

    def recalculate_fractions(self) -> None:
        """Recompute phase fractions and mass fractions from raw flows."""
        self.Qm = self.QmSolid + self.QmLiquid + self.QmVapour
        denom = max(self.Qm, 1e-12)
        self.solidFraction = self.QmSolid / denom
        self.liquidFraction = self.QmLiquid / denom
        self.vapourFraction = self.QmVapour / denom

        # Update per-species mass fractions
        for sp in self.species.values():
            sp.massFraction = sp.massFlow / denom


# ─── ThermoHelper ─────────────────────────────────────────────────────────────

class ThermoHelper:
    """
    Stateless thermodynamic utilities.
    All methods are pure functions operating on StreamDataPy objects.
    """

    # Default densities used when species-level data is absent
    DEFAULT_SOLID_DENSITY: float = 2650.0   # kg/m³ — typical mineral
    DEFAULT_LIQUID_DENSITY: float = 1000.0  # kg/m³ — water

    # ── Stream mixing ──────────────────────────────────────────────────────────

    def mix_streams(self, streams: list[StreamDataPy]) -> StreamDataPy:
        """
        Mix a list of streams into a single combined stream.
        - Mass flows are summed.
        - Temperature is energy-weighted average (H·Qm).
        - Species dicts are merged by speciesId (flows summed).
        """
        non_empty = [s for s in streams if s.Qm > 0]
        if not non_empty:
            return StreamDataPy()

        Qm_total = sum(s.Qm for s in non_empty)
        QmSolid_total = sum(s.QmSolid for s in non_empty)
        QmLiquid_total = sum(s.QmLiquid for s in non_empty)
        QmVapour_total = sum(s.QmVapour for s in non_empty)

        # Energy-weighted temperature and enthalpy
        total_H_flow = sum(s.Qm * s.H for s in non_empty)   # J/s
        H_mixed = total_H_flow / max(Qm_total, 1e-12)
        T_mixed = sum(s.Qm * s.T for s in non_empty) / max(Qm_total, 1e-12)
        P_mixed = sum(s.Qm * s.P for s in non_empty) / max(Qm_total, 1e-12)

        # Merge species
        species_merged: dict[str, SpeciesFlowPy] = {}
        for s in non_empty:
            for sp_id, sf in s.species.items():
                if sp_id in species_merged:
                    existing = species_merged[sp_id]
                    existing.massFlow += sf.massFlow
                    existing.moleFlow += sf.moleFlow
                else:
                    species_merged[sp_id] = copy.copy(sf)

        # Propagate quality (size distribution from first stream that has it)
        quality: dict[str, Any] = {}
        for s in non_empty:
            if s.quality:
                quality = copy.deepcopy(s.quality)
                break

        mixed = StreamDataPy(
            Qm=Qm_total,
            QmSolid=QmSolid_total,
            QmLiquid=QmLiquid_total,
            QmVapour=QmVapour_total,
            T=T_mixed,
            P=P_mixed,
            H=H_mixed,
            species=species_merged,
            quality=quality,
            solved=True,
        )
        mixed.recalculate_fractions()

        # Bulk density: harmonic-mean weighted by volume fraction
        mixed.rho = self._bulk_density(mixed)
        return mixed

    # ── Density helpers ────────────────────────────────────────────────────────

    def get_solid_density(self, stream: StreamDataPy) -> float:
        """
        Return the mass-weighted average density of solid-phase species.
        Falls back to DEFAULT_SOLID_DENSITY when no species data is available.
        """
        solid_mass = 0.0
        solid_volume = 0.0
        for sf in stream.species.values():
            if sf.phase in SOLID_PHASES and sf.massFlow > 0:
                # Use a simple default per-species density (could be extended from species DB)
                rho_sp = self.DEFAULT_SOLID_DENSITY
                solid_mass += sf.massFlow
                solid_volume += sf.massFlow / rho_sp

        if solid_volume > 0:
            return solid_mass / solid_volume
        return self.DEFAULT_SOLID_DENSITY

    def get_liquid_density(self, stream: StreamDataPy) -> float:
        """
        Return the mass-weighted average density of liquid-phase species.
        Falls back to DEFAULT_LIQUID_DENSITY.
        """
        liq_mass = 0.0
        liq_volume = 0.0
        for sf in stream.species.values():
            if sf.phase in LIQUID_PHASES and sf.massFlow > 0:
                rho_sp = self.DEFAULT_LIQUID_DENSITY
                liq_mass += sf.massFlow
                liq_volume += sf.massFlow / rho_sp

        if liq_volume > 0:
            return liq_mass / liq_volume
        return self.DEFAULT_LIQUID_DENSITY

    def _bulk_density(self, stream: StreamDataPy) -> float:
        """Harmonic-mean bulk density from phase densities and volume fractions."""
        rho_s = self.DEFAULT_SOLID_DENSITY
        rho_l = self.DEFAULT_LIQUID_DENSITY
        rho_v = 1.2  # kg/m³ — approximate air/steam

        if stream.Qm < 1e-12:
            return rho_l

        # Volume flows
        Qv_s = stream.QmSolid / rho_s
        Qv_l = stream.QmLiquid / rho_l
        Qv_v = stream.QmVapour / rho_v
        Qv_total = Qv_s + Qv_l + Qv_v

        if Qv_total < 1e-15:
            return rho_l
        return stream.Qm / Qv_total

    # ── Quality helpers ────────────────────────────────────────────────────────

    @staticmethod
    def has_size_distribution(stream: StreamDataPy) -> bool:
        """Return True if the stream carries particle size distribution data."""
        return bool(stream.quality.get("sizeDistribution"))

    # ── Stream splitting ───────────────────────────────────────────────────────

    def make_empty_stream(self, tag: str = "") -> StreamDataPy:
        """Return an empty stream (all flows zero)."""
        return StreamDataPy(tag=tag, Qm=0.0, QmSolid=0.0, QmLiquid=0.0, QmVapour=0.0)

    def split_species(
        self,
        feed: StreamDataPy,
        solid_frac: float,
        liquid_frac: float,
        vapour_frac: float,
        tag: str = "",
    ) -> StreamDataPy:
        """
        Create a sub-stream from `feed` using the given phase split fractions.
        Species flows are distributed proportionally to their phase fraction.
        """
        out = StreamDataPy(
            tag=tag,
            QmSolid=feed.QmSolid * solid_frac,
            QmLiquid=feed.QmLiquid * liquid_frac,
            QmVapour=feed.QmVapour * vapour_frac,
            T=feed.T,
            P=feed.P,
            H=feed.H,
            quality=copy.deepcopy(feed.quality) if solid_frac > 0 else {},
            solved=True,
        )

        for sp_id, sf in feed.species.items():
            if sf.phase in SOLID_PHASES:
                frac = solid_frac
            elif sf.phase in VAPOUR_PHASES:
                frac = vapour_frac
            else:
                frac = liquid_frac

            out.species[sp_id] = SpeciesFlowPy(
                speciesId=sp_id,
                massFlow=sf.massFlow * frac,
                moleFlow=sf.moleFlow * frac,
                phase=sf.phase,
            )

        out.recalculate_fractions()
        out.rho = self._bulk_density(out)
        return out
