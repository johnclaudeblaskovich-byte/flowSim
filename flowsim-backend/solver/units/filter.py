"""
flowsim-backend/solver/units/filter.py

Solid–liquid filter model.

Outputs
-------
cake     : washed filter cake (solids + retained moisture)
filtrate : clarified liquid stream
"""

from __future__ import annotations

import copy
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from solver.thermo import ThermoHelper, StreamDataPy

from solver.thermo import SpeciesFlowPy, SOLID_PHASES


def solve_filter(
    input_streams: list["StreamDataPy"],
    config: dict,
    thermo: "ThermoHelper",
) -> dict[str, "StreamDataPy"]:
    """
    Steady-state filter model.

    Parameters
    ----------
    input_streams : list[StreamDataPy]
        All feed streams to the filter (typically one slurry feed).
    config : dict
        solid_recovery      – fraction of solids reporting to cake  [0, 1]
        moisture_content    – mass fraction of liquid retained in cake
                              i.e.  retained_liquid / (retained_liquid + cake_solids)  [0, 1)
        wash_efficiency     – fraction of dissolved species removed from cake by washing  [0, 1]
    thermo : ThermoHelper

    Returns
    -------
    {'cake': StreamDataPy, 'filtrate': StreamDataPy}
    """
    feed = thermo.mix_streams(input_streams)

    solid_recovery: float = float(config.get("solid_recovery", 0.95))
    moisture_content: float = float(config.get("moisture_content", 0.15))
    wash_efficiency: float = float(config.get("wash_efficiency", 0.80))

    # ── Solid split ────────────────────────────────────────────────────────────
    cake_solids = feed.QmSolid * solid_recovery
    filtrate_solids = feed.QmSolid * (1.0 - solid_recovery)

    # ── Retained liquid in cake ────────────────────────────────────────────────
    # moisture_content = retained_liquid / (retained_liquid + cake_solids)
    # ⇒  retained_liquid = mc * cake_solids / (1 - mc)
    mc = max(0.0, min(moisture_content, 0.9999))
    if cake_solids > 0:
        retained_liquid = mc * cake_solids / max(1.0 - mc, 1e-10)
    else:
        retained_liquid = 0.0
    retained_liquid = min(retained_liquid, feed.QmLiquid)
    filtrate_liquid = feed.QmLiquid - retained_liquid

    # Fraction of the feed liquid that ends up in the cake (before wash)
    liquid_frac_cake = retained_liquid / max(feed.QmLiquid, 1e-12)

    # ── Per-species split ──────────────────────────────────────────────────────
    # Solid phases  → split by solid_recovery
    # Liquid/Aqueous/Vapour phases → proportional to liquid split,
    #   then wash removes wash_efficiency fraction of dissolved species from cake

    cake_species: dict[str, SpeciesFlowPy] = {}
    filtrate_species: dict[str, SpeciesFlowPy] = {}

    for sp_id, sf in feed.species.items():
        if sf.phase in SOLID_PHASES:
            cake_flow = sf.massFlow * solid_recovery
            filt_flow = sf.massFlow * (1.0 - solid_recovery)
        else:
            # Retained portion before wash
            retained_species = sf.massFlow * liquid_frac_cake
            # Wash removes wash_efficiency of the retained dissolved species to filtrate
            washed_out = retained_species * wash_efficiency
            cake_flow = retained_species - washed_out        # = retained * (1 - wash_eff)
            filt_flow = sf.massFlow - cake_flow

        cake_species[sp_id] = SpeciesFlowPy(
            speciesId=sp_id,
            massFlow=max(cake_flow, 0.0),
            moleFlow=sf.moleFlow * (cake_flow / max(sf.massFlow, 1e-12)) if sf.massFlow > 0 else 0.0,
            phase=sf.phase,
        )
        filtrate_species[sp_id] = SpeciesFlowPy(
            speciesId=sp_id,
            massFlow=max(filt_flow, 0.0),
            moleFlow=sf.moleFlow * (filt_flow / max(sf.massFlow, 1e-12)) if sf.massFlow > 0 else 0.0,
            phase=sf.phase,
        )

    # ── Build output streams ───────────────────────────────────────────────────
    from solver.thermo import StreamDataPy

    cake = StreamDataPy(
        tag="cake",
        QmSolid=cake_solids,
        QmLiquid=retained_liquid,
        QmVapour=0.0,
        T=feed.T,
        P=feed.P,
        H=feed.H,
        species=cake_species,
        quality=copy.deepcopy(feed.quality),   # propagate PSD to cake
        solved=True,
    )
    cake.recalculate_fractions()
    cake.rho = thermo._bulk_density(cake)

    filtrate = StreamDataPy(
        tag="filtrate",
        QmSolid=filtrate_solids,
        QmLiquid=filtrate_liquid,
        QmVapour=feed.QmVapour,                # vapour exits with filtrate
        T=feed.T,
        P=feed.P,
        H=feed.H,
        species=filtrate_species,
        quality={},
        solved=True,
    )
    filtrate.recalculate_fractions()
    filtrate.rho = thermo._bulk_density(filtrate)

    return {"cake": cake, "filtrate": filtrate}
