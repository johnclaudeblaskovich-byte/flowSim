"""
Unit tests for the Cyclone model (P10-02).

Run with:  python -m pytest flowsim-backend/tests/test_cyclone.py -v
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from solver.thermo import ThermoHelper, StreamDataPy, SpeciesFlowPy
from solver.units.cyclone import solve_cyclone


@pytest.fixture
def thermo():
    return ThermoHelper()


def make_slurry(
    solid_kgs: float = 20.0,
    liquid_kgs: float = 80.0,
) -> StreamDataPy:
    species = {
        "FineOre":   SpeciesFlowPy(speciesId="FineOre",   massFlow=solid_kgs * 0.6, phase="Solid"),
        "CoarseOre": SpeciesFlowPy(speciesId="CoarseOre", massFlow=solid_kgs * 0.4, phase="Solid"),
        "Water":     SpeciesFlowPy(speciesId="Water",     massFlow=liquid_kgs,      phase="Liquid"),
    }
    stream = StreamDataPy(
        tag="feed",
        QmSolid=solid_kgs,
        QmLiquid=liquid_kgs,
        species=species,
    )
    stream.recalculate_fractions()
    return stream


class TestCycloneMassBalance:
    def test_total_mass_conserved(self, thermo):
        feed = make_slurry()
        config = {"efficiency": 0.80, "d50_microns": 75.0}
        result = solve_cyclone([feed], config, thermo)

        total_out = result["overflow"].Qm + result["underflow"].Qm
        assert abs(total_out - feed.Qm) < 1e-6

    def test_solid_mass_conserved(self, thermo):
        feed = make_slurry()
        config = {"efficiency": 0.80, "d50_microns": 75.0}
        result = solve_cyclone([feed], config, thermo)

        total_solid = result["overflow"].QmSolid + result["underflow"].QmSolid
        assert abs(total_solid - feed.QmSolid) < 1e-9

    def test_liquid_mass_conserved(self, thermo):
        feed = make_slurry()
        config = {"efficiency": 0.80, "d50_microns": 75.0}
        result = solve_cyclone([feed], config, thermo)

        total_liquid = result["overflow"].QmLiquid + result["underflow"].QmLiquid
        assert abs(total_liquid - feed.QmLiquid) < 1e-9


class TestCycloneEfficiency:
    def test_80_percent_efficiency_solid_split(self, thermo):
        """80% efficiency: 80% of solid mass goes to underflow."""
        feed = make_slurry(solid_kgs=20.0)
        config = {"efficiency": 0.80, "d50_microns": 75.0, "liquid_split_uf": 0.20}
        result = solve_cyclone([feed], config, thermo)

        expected_uf_solid = 20.0 * 0.80
        assert abs(result["underflow"].QmSolid - expected_uf_solid) < 1e-9
        assert abs(result["overflow"].QmSolid - 20.0 * 0.20) < 1e-9

    def test_100_percent_efficiency(self, thermo):
        """100% efficiency: all solid to underflow."""
        feed = make_slurry(solid_kgs=10.0)
        config = {"efficiency": 1.0, "d50_microns": 75.0, "liquid_split_uf": 0.20}
        result = solve_cyclone([feed], config, thermo)

        assert abs(result["underflow"].QmSolid - 10.0) < 1e-9
        assert result["overflow"].QmSolid < 1e-9

    def test_zero_efficiency(self, thermo):
        """0% efficiency: all solid to overflow (no classification)."""
        feed = make_slurry(solid_kgs=10.0)
        config = {"efficiency": 0.0, "d50_microns": 75.0, "liquid_split_uf": 0.20}
        result = solve_cyclone([feed], config, thermo)

        assert result["underflow"].QmSolid < 1e-9
        assert abs(result["overflow"].QmSolid - 10.0) < 1e-9

    def test_liquid_split(self, thermo):
        """20% of liquid should go to underflow by default."""
        feed = make_slurry(solid_kgs=10.0, liquid_kgs=100.0)
        config = {"efficiency": 0.80, "d50_microns": 75.0, "liquid_split_uf": 0.20}
        result = solve_cyclone([feed], config, thermo)

        assert abs(result["underflow"].QmLiquid - 100.0 * 0.20) < 1e-9
        assert abs(result["overflow"].QmLiquid - 100.0 * 0.80) < 1e-9


class TestCycloneOutputStructure:
    def test_has_required_keys(self, thermo):
        feed = make_slurry()
        result = solve_cyclone([feed], {"efficiency": 0.80}, thermo)

        assert "overflow" in result
        assert "underflow" in result
        assert result["overflow"].solved is True
        assert result["underflow"].solved is True
