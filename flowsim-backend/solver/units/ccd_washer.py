"""
flowsim-backend/solver/units/ccd_washer.py

Counter-Current Decantation (CCD) Washer model.

Multi-stage thickening + washing circuit used in hydrometallurgy to
recover dissolved values from slurry while washing solids with fresh water.

Circuit topology
----------------
Feed (slurry) → Stage 1 → Stage 2 → … → Stage N ← Wash water
                 ↑ OF(2)    ↑ OF(3)        ↑ OF(N+1 = wash water)

  Stage overflow flows counter-currently (stage n+1 overflow washes stage n).
  Stage underflow flows co-currently (each stage UF feeds the next).

Outputs
-------
product_liquor  : Stage 1 overflow (rich liquor)
washed_solids   : Stage N underflow (washed solids)
"""

from __future__ import annotations

import copy
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from solver.thermo import ThermoHelper, StreamDataPy

from solver.thermo import SpeciesFlowPy, StreamDataPy, SOLID_PHASES


# ─── Single CCD stage model ───────────────────────────────────────────────────

def _solve_stage(
    feed: "StreamDataPy",
    wash_in: "StreamDataPy",
    solid_recovery: float,
    wash_efficiency: float,
    thermo: "ThermoHelper",
    stage_idx: int,
) -> tuple["StreamDataPy", "StreamDataPy"]:
    """
    Solve a single CCD stage (thickener + wash).

    Returns
    -------
    (overflow, underflow)
    """
    # Mix feed slurry with incoming wash liquor
    mixed = thermo.mix_streams([feed, wash_in])

    # All solids (×solid_recovery) go to underflow
    uf_solids = mixed.QmSolid * solid_recovery
    of_solids = mixed.QmSolid * (1.0 - solid_recovery)

    # Liquid: wash_efficiency fraction of dissolved species is transferred
    # from the thickened underflow liquid back to overflow (via displacement washing).
    # Simple model: retain a fixed fraction of liquid in the underflow.
    # Use a default 30% liquid retention in underflow.
    liq_retention = 0.30
    uf_liquid = mixed.QmLiquid * liq_retention
    of_liquid = mixed.QmLiquid * (1.0 - liq_retention)

    liq_frac_uf = liq_retention  # fraction of mixed liquid in UF

    # Per-species split
    uf_species: dict[str, SpeciesFlowPy] = {}
    of_species: dict[str, SpeciesFlowPy] = {}

    for sp_id, sf in mixed.species.items():
        if sf.phase in SOLID_PHASES:
            uf_flow = sf.massFlow * solid_recovery
            of_flow = sf.massFlow * (1.0 - solid_recovery)
        else:
            # Retained dissolved species (before intra-stage wash displacement)
            retained = sf.massFlow * liq_frac_uf
            # wash_efficiency: fraction displaced from UF to OF
            displaced = retained * wash_efficiency
            uf_flow = retained - displaced
            of_flow = sf.massFlow - uf_flow

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

    underflow = StreamDataPy(
        tag=f"uf_stage_{stage_idx + 1}",
        QmSolid=uf_solids,
        QmLiquid=uf_liquid,
        QmVapour=0.0,
        T=mixed.T, P=mixed.P, H=mixed.H,
        species=uf_species,
        quality=copy.deepcopy(feed.quality),
        solved=True,
    )
    underflow.recalculate_fractions()
    underflow.rho = thermo._bulk_density(underflow)

    overflow = StreamDataPy(
        tag=f"of_stage_{stage_idx + 1}",
        QmSolid=of_solids,
        QmLiquid=of_liquid,
        QmVapour=0.0,
        T=mixed.T, P=mixed.P, H=mixed.H,
        species=of_species,
        quality={},
        solved=True,
    )
    overflow.recalculate_fractions()
    overflow.rho = thermo._bulk_density(overflow)

    return overflow, underflow


# ─── Convergence helpers ──────────────────────────────────────────────────────

def _composition_error(
    a_species: dict[str, SpeciesFlowPy],
    b_species: dict[str, SpeciesFlowPy],
    total_Qm: float,
) -> float:
    """Return max absolute species mass-flow difference, normalised by total Qm."""
    max_err = 0.0
    all_ids = set(a_species) | set(b_species)
    for sp_id in all_ids:
        a_flow = a_species.get(sp_id, SpeciesFlowPy(sp_id, 0.0)).massFlow
        b_flow = b_species.get(sp_id, SpeciesFlowPy(sp_id, 0.0)).massFlow
        err = abs(a_flow - b_flow) / max(total_Qm, 1e-12)
        if err > max_err:
            max_err = err
    return max_err


# ─── Main solver ──────────────────────────────────────────────────────────────

def solve_ccd_washer(
    input_streams: list["StreamDataPy"],
    config: dict,
    thermo: "ThermoHelper",
) -> dict[str, "StreamDataPy"]:
    """
    Multi-stage CCD washer.

    Parameters
    ----------
    input_streams : list[StreamDataPy]
        Slurry feed stream(s).
    config : dict
        num_stages                – number of thickener stages  (default 3)
        wash_water_flow           – wash water mass flow  [kg/s]  (default 10.0)
        solid_recovery_per_stage  – fraction of solids to UF per stage  (default 0.98)
        wash_efficiency_per_stage – fraction of dissolved species displaced per stage  (default 0.70)
    thermo : ThermoHelper

    Returns
    -------
    {'product_liquor': StreamDataPy, 'washed_solids': StreamDataPy}
    """
    feed = thermo.mix_streams(input_streams)

    num_stages: int = max(1, int(config.get("num_stages", 3)))
    wash_water_flow: float = float(config.get("wash_water_flow", 10.0))
    solid_rec: float = float(config.get("solid_recovery_per_stage", 0.98))
    wash_eff: float = float(config.get("wash_efficiency_per_stage", 0.70))

    # Build wash water stream (fresh water — no dissolved solids)
    wash_water = StreamDataPy(
        tag="wash_water",
        QmSolid=0.0,
        QmLiquid=wash_water_flow,
        QmVapour=0.0,
        T=feed.T,
        P=feed.P,
        H=0.0,
        solved=True,
    )
    wash_water.recalculate_fractions()
    wash_water.rho = thermo.get_liquid_density(feed)

    # ── Initial state ──────────────────────────────────────────────────────────
    # Guess: overflows initially carry no dissolved solids (fresh wash)
    stage_overflows: list[StreamDataPy] = [wash_water] * num_stages

    stage_underflows: list[StreamDataPy] = [thermo.make_empty_stream() for _ in range(num_stages)]
    stage_overflows_out: list[StreamDataPy] = [thermo.make_empty_stream() for _ in range(num_stages)]

    iterations_done = 0

    for iteration in range(100):
        prev_of_species = [copy.deepcopy(of.species) for of in stage_overflows_out]

        # Forward pass: feed enters stage 0; each stage's UF feeds the next.
        # Wash water (or the previous OF from downstream) enters from the right.
        current_feed = feed
        for i in range(num_stages):
            # Wash input: stage i+1 overflow (or wash_water for the last stage)
            if i < num_stages - 1:
                wash_in = stage_overflows[i + 1]   # from downstream stage
            else:
                wash_in = wash_water  # last stage gets fresh wash water

            of_i, uf_i = _solve_stage(
                current_feed, wash_in,
                solid_rec, wash_eff,
                thermo, i,
            )
            stage_overflows_out[i] = of_i
            stage_underflows[i] = uf_i

            # UF of this stage is feed to next stage
            current_feed = uf_i

        # Update the stage_overflows (used as wash_in for previous stage next iteration)
        for i in range(num_stages):
            stage_overflows[i] = stage_overflows_out[i]

        # Check convergence of overflow compositions
        total_Qm = max(feed.Qm, 1e-12)
        max_err = max(
            _composition_error(stage_overflows_out[i].species, prev_of_species[i], total_Qm)
            for i in range(num_stages)
        )
        iterations_done = iteration + 1

        if max_err < 1e-6:
            break

    # Tag outputs
    product_liquor = stage_overflows_out[0]
    product_liquor.tag = "product_liquor"

    washed_solids = stage_underflows[-1]
    washed_solids.tag = "washed_solids"

    return {
        "product_liquor": product_liquor,
        "washed_solids": washed_solids,
        "_iterations": iterations_done,  # type: ignore[dict-item]
    }
