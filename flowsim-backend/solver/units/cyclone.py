"""
flowsim-backend/solver/units/cyclone.py

Hydrocyclone classifier model.

Without particle size distribution (PSD) data: efficiency-based split.
With PSD data: Tromp (partition) curve applied per size class.

Outputs
-------
overflow  : fine product (low-density / small-particle stream)
underflow : coarse product (high-density / large-particle stream)
"""

from __future__ import annotations

import copy
import math
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from solver.thermo import ThermoHelper, StreamDataPy

from solver.thermo import SpeciesFlowPy, StreamDataPy, SOLID_PHASES


# ─── Tromp (partition) curve ──────────────────────────────────────────────────

def _tromp_probability(d_microns: float, d50: float, sharpness: float = 3.0) -> float:
    """
    Return the probability that a particle of size d_microns reports to
    the underflow (coarse product), using the standard Tromp equation.

    P(d) = 1 / (1 + (d50/d)^sharpness)

    Parameters
    ----------
    d_microns  : particle size  [µm]
    d50        : cut-size at which 50% reports to UF  [µm]
    sharpness  : alpha exponent (higher = sharper cut)
    """
    if d_microns <= 0:
        return 0.0
    ratio = d50 / max(d_microns, 1e-6)
    return 1.0 / (1.0 + ratio ** sharpness)


# ─── Main solver ──────────────────────────────────────────────────────────────

def solve_cyclone(
    input_streams: list["StreamDataPy"],
    config: dict,
    thermo: "ThermoHelper",
) -> dict[str, "StreamDataPy"]:
    """
    Hydrocyclone model.

    Parameters
    ----------
    input_streams : list[StreamDataPy]
    config : dict
        efficiency       – fraction of solid mass reporting to underflow  [0, 1]
        d50_microns      – Tromp cut-size  [µm]  (used with PSD only)
        liquid_split_uf  – fraction of feed liquid to underflow  (default 0.20)
    thermo : ThermoHelper

    Returns
    -------
    {'overflow': StreamDataPy, 'underflow': StreamDataPy}
    """
    feed = thermo.mix_streams(input_streams)

    efficiency: float = float(config.get("efficiency", 0.80))
    d50_microns: float = float(config.get("d50_microns", 75.0))
    liquid_split_uf: float = float(config.get("liquid_split_uf", 0.20))

    has_psd = thermo.has_size_distribution(feed)

    if not has_psd:
        # ── Simple efficiency-based split ──────────────────────────────────────
        uf_solid_frac = efficiency
        of_solid_frac = 1.0 - efficiency
        liq_frac_uf = liquid_split_uf

        uf_species: dict[str, SpeciesFlowPy] = {}
        of_species: dict[str, SpeciesFlowPy] = {}

        for sp_id, sf in feed.species.items():
            if sf.phase in SOLID_PHASES:
                uf_flow = sf.massFlow * uf_solid_frac
                of_flow = sf.massFlow * of_solid_frac
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

        uf_solid = feed.QmSolid * uf_solid_frac
        of_solid = feed.QmSolid * of_solid_frac
        uf_liquid = feed.QmLiquid * liq_frac_uf
        of_liquid = feed.QmLiquid * (1.0 - liq_frac_uf)

    else:
        # ── Tromp-curve PSD split ──────────────────────────────────────────────
        # TODO: full PSD Tromp curve implementation
        # Placeholder: compute per-class underflow fraction using Tromp equation
        psd_data = feed.quality.get("sizeDistribution", {})
        classes = psd_data.get("classes", [])

        uf_solid_total = 0.0
        of_solid_total = 0.0

        for cls in classes:
            d_rep = (cls.get("upperMicrons", 0) + cls.get("lowerMicrons", 0)) / 2.0
            cls_mass = feed.QmSolid * cls.get("massFraction", 0.0)
            p_uf = _tromp_probability(d_rep, d50_microns)
            uf_solid_total += cls_mass * p_uf
            of_solid_total += cls_mass * (1.0 - p_uf)

        uf_solid = uf_solid_total
        of_solid = of_solid_total
        uf_liquid = feed.QmLiquid * liquid_split_uf
        of_liquid = feed.QmLiquid * (1.0 - liquid_split_uf)

        # Species: all solids split by overall Tromp fraction; liquid by liquid_split_uf
        uf_solid_frac = uf_solid / max(feed.QmSolid, 1e-12)
        of_solid_frac = 1.0 - uf_solid_frac
        uf_species = {}
        of_species = {}

        for sp_id, sf in feed.species.items():
            if sf.phase in SOLID_PHASES:
                uf_flow = sf.massFlow * uf_solid_frac
                of_flow = sf.massFlow * of_solid_frac
            else:
                uf_flow = sf.massFlow * liquid_split_uf
                of_flow = sf.massFlow * (1.0 - liquid_split_uf)

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
    underflow = StreamDataPy(
        tag="underflow",
        QmSolid=uf_solid,
        QmLiquid=uf_liquid,
        QmVapour=0.0,
        T=feed.T, P=feed.P, H=feed.H,
        species=uf_species,
        quality=copy.deepcopy(feed.quality),
        solved=True,
    )
    underflow.recalculate_fractions()
    underflow.rho = thermo._bulk_density(underflow)

    overflow = StreamDataPy(
        tag="overflow",
        QmSolid=of_solid,
        QmLiquid=of_liquid,
        QmVapour=feed.QmVapour,
        T=feed.T, P=feed.P, H=feed.H,
        species=of_species,
        quality={},
        solved=True,
    )
    overflow.recalculate_fractions()
    overflow.rho = thermo._bulk_density(overflow)

    return {"overflow": overflow, "underflow": underflow}
