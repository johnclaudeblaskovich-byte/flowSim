"""
flowsim-backend/solver/units/thickener.py

Gravity thickener model.

Outputs
-------
overflow  : clarified liquid (overflow launder)
underflow : thickened slurry
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from solver.thermo import ThermoHelper, StreamDataPy

from solver.thermo import SpeciesFlowPy, StreamDataPy, SOLID_PHASES


def solve_thickener(
    input_streams: list["StreamDataPy"],
    config: dict,
    thermo: "ThermoHelper",
) -> dict[str, "StreamDataPy"]:
    """
    Steady-state thickener model.

    Parameters
    ----------
    input_streams : list[StreamDataPy]
        All feed streams (slurry, flocculant, dilution water, etc.).
    config : dict
        solid_recovery     – fraction of solids reporting to underflow  [0, 1]
        underflow_density  – target underflow bulk density  [kg/m³]
    thermo : ThermoHelper

    Returns
    -------
    {'overflow': StreamDataPy, 'underflow': StreamDataPy}
    """
    feed = thermo.mix_streams(input_streams)

    solid_recovery: float = float(config.get("solid_recovery", 0.98))
    rho_target: float = float(config.get("underflow_density", 1400.0))

    # ── Solid split ────────────────────────────────────────────────────────────
    uf_solids = feed.QmSolid * solid_recovery
    of_solids = feed.QmSolid * (1.0 - solid_recovery)

    # ── Liquid in underflow driven by target density ───────────────────────────
    # Formula (from spec):
    #   rho_uf = (uf_solids + uf_liquid) / (uf_solids/rho_solid + uf_liquid/rho_liquid)
    # Rearranging:
    #   uf_liquid = uf_solids * (rho_solid/rho_target - 1) / (1 - rho_liquid/rho_target)
    rho_solid = thermo.get_solid_density(feed)
    rho_liquid = thermo.get_liquid_density(feed)

    denominator = max(1.0 - rho_liquid / max(rho_target, 1.0), 1e-10)
    uf_liquid = uf_solids * (rho_solid / max(rho_target, 1.0) - 1.0) / denominator
    uf_liquid = max(0.0, min(uf_liquid, feed.QmLiquid))
    of_liquid = feed.QmLiquid - uf_liquid

    # Fraction of feed liquid in underflow
    liq_frac_uf = uf_liquid / max(feed.QmLiquid, 1e-12)

    # ── Per-species split ──────────────────────────────────────────────────────
    uf_species: dict[str, SpeciesFlowPy] = {}
    of_species: dict[str, SpeciesFlowPy] = {}

    for sp_id, sf in feed.species.items():
        if sf.phase in SOLID_PHASES:
            uf_flow = sf.massFlow * solid_recovery
            of_flow = sf.massFlow * (1.0 - solid_recovery)
        else:
            uf_flow = sf.massFlow * liq_frac_uf
            of_flow = sf.massFlow * (1.0 - liq_frac_uf)

        uf_species[sp_id] = SpeciesFlowPy(
            speciesId=sp_id,
            massFlow=max(uf_flow, 0.0),
            moleFlow=sf.moleFlow * (uf_flow / max(sf.massFlow, 1e-12)) if sf.massFlow > 0 else 0.0,
            phase=sf.phase,
        )
        of_species[sp_id] = SpeciesFlowPy(
            speciesId=sp_id,
            massFlow=max(of_flow, 0.0),
            moleFlow=sf.moleFlow * (of_flow / max(sf.massFlow, 1e-12)) if sf.massFlow > 0 else 0.0,
            phase=sf.phase,
        )

    # ── Build output streams ───────────────────────────────────────────────────
    import copy

    underflow = StreamDataPy(
        tag="underflow",
        QmSolid=uf_solids,
        QmLiquid=uf_liquid,
        QmVapour=0.0,
        T=feed.T,
        P=feed.P,
        H=feed.H,
        species=uf_species,
        quality=copy.deepcopy(feed.quality),
        solved=True,
    )
    underflow.recalculate_fractions()
    # Use the target density directly (it's the design specification)
    underflow.rho = rho_target

    overflow = StreamDataPy(
        tag="overflow",
        QmSolid=of_solids,
        QmLiquid=of_liquid,
        QmVapour=feed.QmVapour,
        T=feed.T,
        P=feed.P,
        H=feed.H,
        species=of_species,
        quality={},
        solved=True,
    )
    overflow.recalculate_fractions()
    overflow.rho = thermo._bulk_density(overflow)

    return {"overflow": overflow, "underflow": underflow}
