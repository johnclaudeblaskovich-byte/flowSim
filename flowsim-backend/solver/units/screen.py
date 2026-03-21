"""
flowsim-backend/solver/units/screen.py

Vibrating screen classifier model.

Without particle size distribution (PSD): efficiency-based split of all solids.
With PSD: step-function partition at `aperture_size_microns`.

Outputs (single-deck)
------
oversize  : material retained on screen (> aperture)
undersize : material passing through screen (< aperture)

Multi-deck: not yet implemented — num_decks > 1 treated as single deck.
"""

from __future__ import annotations

import copy
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from solver.thermo import ThermoHelper, StreamDataPy

from solver.thermo import SpeciesFlowPy, StreamDataPy, SOLID_PHASES


def solve_screen(
    input_streams: list["StreamDataPy"],
    config: dict,
    thermo: "ThermoHelper",
) -> dict[str, "StreamDataPy"]:
    """
    Vibrating screen model.

    Parameters
    ----------
    input_streams : list[StreamDataPy]
    config : dict
        aperture_size_microns – screen aperture  [µm]  (default 150)
        efficiency            – fraction of correctly classified particles  [0, 1]
                                Without PSD: efficiency fraction of all solids → undersize
        num_decks             – number of screen decks  (default 1; >1 not yet handled)
    thermo : ThermoHelper

    Returns
    -------
    {'oversize': StreamDataPy, 'undersize': StreamDataPy}
    """
    feed = thermo.mix_streams(input_streams)

    aperture: float = float(config.get("aperture_size_microns", 150.0))
    efficiency: float = float(config.get("efficiency", 0.90))
    _num_decks: int = int(config.get("num_decks", 1))  # future use

    has_psd = thermo.has_size_distribution(feed)

    if not has_psd:
        # ── Simple efficiency split ────────────────────────────────────────────
        # efficiency fraction of all solid mass passes through (→ undersize)
        # (1 - efficiency) fraction is retained (→ oversize)
        under_solid_frac = efficiency
        over_solid_frac = 1.0 - efficiency

        # All liquid passes to undersize (screens do not separate liquids)
        under_liquid_frac = 1.0
        over_liquid_frac = 0.0

        under_species: dict[str, SpeciesFlowPy] = {}
        over_species: dict[str, SpeciesFlowPy] = {}

        for sp_id, sf in feed.species.items():
            if sf.phase in SOLID_PHASES:
                under_flow = sf.massFlow * under_solid_frac
                over_flow = sf.massFlow * over_solid_frac
            else:
                under_flow = sf.massFlow * under_liquid_frac
                over_flow = sf.massFlow * over_liquid_frac

            under_species[sp_id] = SpeciesFlowPy(
                speciesId=sp_id,
                massFlow=max(under_flow, 0.0),
                moleFlow=sf.moleFlow * (under_flow / max(sf.massFlow, 1e-12)) if sf.massFlow > 0 else 0.0,
                phase=sf.phase,
            )
            over_species[sp_id] = SpeciesFlowPy(
                speciesId=sp_id,
                massFlow=max(over_flow, 0.0),
                moleFlow=sf.moleFlow * (over_flow / max(sf.massFlow, 1e-12)) if sf.massFlow > 0 else 0.0,
                phase=sf.phase,
            )

        under_solid = feed.QmSolid * under_solid_frac
        over_solid = feed.QmSolid * over_solid_frac
        under_liquid = feed.QmLiquid
        over_liquid = 0.0

    else:
        # ── PSD-based split ────────────────────────────────────────────────────
        # Apply step-function partition at aperture_size_microns.
        # Particles with d_rep < aperture → undersize (with efficiency)
        # Particles with d_rep >= aperture → oversize (with efficiency)
        psd_data = feed.quality.get("sizeDistribution", {})
        classes = psd_data.get("classes", [])

        under_solid = 0.0
        over_solid = 0.0

        for cls in classes:
            d_upper = cls.get("upperMicrons", 0.0)
            d_lower = cls.get("lowerMicrons", 0.0)
            d_rep = (d_upper + d_lower) / 2.0
            cls_mass = feed.QmSolid * cls.get("massFraction", 0.0)

            if d_rep < aperture:
                # Fine class: efficiency fraction correctly passes through
                under_solid += cls_mass * efficiency
                over_solid += cls_mass * (1.0 - efficiency)  # misreport to oversize
            else:
                # Coarse class: efficiency fraction correctly retained
                over_solid += cls_mass * efficiency
                under_solid += cls_mass * (1.0 - efficiency)  # misreport to undersize

        under_liquid = feed.QmLiquid
        over_liquid = 0.0

        # Proportional species split (solid-phase species follow overall solid split)
        overall_under_solid_frac = under_solid / max(feed.QmSolid, 1e-12)
        over_solid_frac = 1.0 - overall_under_solid_frac

        under_species = {}
        over_species = {}
        for sp_id, sf in feed.species.items():
            if sf.phase in SOLID_PHASES:
                under_flow = sf.massFlow * overall_under_solid_frac
                over_flow = sf.massFlow * over_solid_frac
            else:
                under_flow = sf.massFlow
                over_flow = 0.0

            under_species[sp_id] = SpeciesFlowPy(
                speciesId=sp_id,
                massFlow=max(under_flow, 0.0),
                moleFlow=sf.moleFlow * (under_flow / max(sf.massFlow, 1e-12)) if sf.massFlow > 0 else 0.0,
                phase=sf.phase,
            )
            over_species[sp_id] = SpeciesFlowPy(
                speciesId=sp_id,
                massFlow=max(over_flow, 0.0),
                moleFlow=sf.moleFlow * (over_flow / max(sf.massFlow, 1e-12)) if sf.massFlow > 0 else 0.0,
                phase=sf.phase,
            )

    # ── Build output streams ───────────────────────────────────────────────────
    oversize = StreamDataPy(
        tag="oversize",
        QmSolid=over_solid,
        QmLiquid=over_liquid,
        QmVapour=0.0,
        T=feed.T, P=feed.P, H=feed.H,
        species=over_species,
        quality={},   # PSD data lost on oversize (would need recalculation)
        solved=True,
    )
    oversize.recalculate_fractions()
    oversize.rho = thermo._bulk_density(oversize)

    undersize = StreamDataPy(
        tag="undersize",
        QmSolid=under_solid,
        QmLiquid=under_liquid,
        QmVapour=feed.QmVapour,
        T=feed.T, P=feed.P, H=feed.H,
        species=under_species,
        quality=copy.deepcopy(feed.quality),  # PSD propagates to undersize
        solved=True,
    )
    undersize.recalculate_fractions()
    undersize.rho = thermo._bulk_density(undersize)

    return {"oversize": oversize, "undersize": undersize}
