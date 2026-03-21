"""
Unit tests for the Screen model (P10-03).

Run with:  python -m pytest flowsim-backend/tests/test_screen.py -v
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from solver.thermo import ThermoHelper, StreamDataPy, SpeciesFlowPy
from solver.units.screen import solve_screen


@pytest.fixture
def thermo():
    return ThermoHelper()


def make_ore_slurry(
    solid_kgs: float = 20.0,
    liquid_kgs: float = 10.0,
) -> StreamDataPy:
    species = {
        "CoarseOre": SpeciesFlowPy(speciesId="CoarseOre", massFlow=solid_kgs * 0.5, phase="Solid"),
        "FineOre":   SpeciesFlowPy(speciesId="FineOre",   massFlow=solid_kgs * 0.5, phase="Solid"),
        "Water":     SpeciesFlowPy(speciesId="Water",     massFlow=liquid_kgs,       phase="Liquid"),
    }
    stream = StreamDataPy(
        tag="feed",
        QmSolid=solid_kgs,
        QmLiquid=liquid_kgs,
        species=species,
    )
    stream.recalculate_fractions()
    return stream


def make_psd_slurry(solid_kgs: float = 20.0, liquid_kgs: float = 10.0) -> StreamDataPy:
    """Slurry with size distribution: 50% at 50 µm, 50% at 300 µm."""
    stream = make_ore_slurry(solid_kgs=solid_kgs, liquid_kgs=liquid_kgs)
    stream.quality = {
        "sizeDistribution": {
            "method": "Custom",
            "classes": [
                {"upperMicrons": 100,  "lowerMicrons": 0,   "massFraction": 0.50},
                {"upperMicrons": 500,  "lowerMicrons": 100, "massFraction": 0.50},
            ],
        }
    }
    return stream


class TestScreenMassBalance:
    def test_total_mass_conserved(self, thermo):
        """Total mass in = oversize + undersize."""
        feed = make_ore_slurry()
        config = {"aperture_size_microns": 150.0, "efficiency": 0.90}
        result = solve_screen([feed], config, thermo)

        total_out = result["oversize"].Qm + result["undersize"].Qm
        assert abs(total_out - feed.Qm) < 1e-6

    def test_solid_mass_conserved(self, thermo):
        feed = make_ore_slurry()
        config = {"aperture_size_microns": 150.0, "efficiency": 0.90}
        result = solve_screen([feed], config, thermo)

        total_solid = result["oversize"].QmSolid + result["undersize"].QmSolid
        assert abs(total_solid - feed.QmSolid) < 1e-9

    def test_liquid_mass_conserved(self, thermo):
        feed = make_ore_slurry()
        config = {"aperture_size_microns": 150.0, "efficiency": 0.90}
        result = solve_screen([feed], config, thermo)

        total_liquid = result["oversize"].QmLiquid + result["undersize"].QmLiquid
        assert abs(total_liquid - feed.QmLiquid) < 1e-9


class TestScreenSplitWithoutPSD:
    def test_all_liquid_to_undersize(self, thermo):
        """Screen does not separate liquid — all liquid passes to undersize."""
        feed = make_ore_slurry(solid_kgs=20.0, liquid_kgs=10.0)
        config = {"aperture_size_microns": 150.0, "efficiency": 0.90}
        result = solve_screen([feed], config, thermo)

        assert abs(result["undersize"].QmLiquid - 10.0) < 1e-9
        assert result["oversize"].QmLiquid < 1e-9

    def test_90_percent_efficiency_solid_split(self, thermo):
        """Without PSD: 90% efficiency sends 90% of solid to undersize."""
        feed = make_ore_slurry(solid_kgs=20.0)
        config = {"aperture_size_microns": 150.0, "efficiency": 0.90}
        result = solve_screen([feed], config, thermo)

        assert abs(result["undersize"].QmSolid - 20.0 * 0.90) < 1e-9
        assert abs(result["oversize"].QmSolid - 20.0 * 0.10) < 1e-9

    def test_full_efficiency(self, thermo):
        """100% efficiency: all solid to undersize."""
        feed = make_ore_slurry(solid_kgs=20.0)
        config = {"aperture_size_microns": 150.0, "efficiency": 1.0}
        result = solve_screen([feed], config, thermo)

        assert abs(result["undersize"].QmSolid - 20.0) < 1e-9
        assert result["oversize"].QmSolid < 1e-9

    def test_zero_efficiency(self, thermo):
        """0% efficiency: all solid to oversize."""
        feed = make_ore_slurry(solid_kgs=20.0)
        config = {"aperture_size_microns": 150.0, "efficiency": 0.0}
        result = solve_screen([feed], config, thermo)

        assert result["undersize"].QmSolid < 1e-9
        assert abs(result["oversize"].QmSolid - 20.0) < 1e-9


class TestScreenSplitWithPSD:
    def test_psd_coarse_to_oversize(self, thermo):
        """
        With PSD: 50% fines (50 µm) → undersize, 50% coarse (300 µm) → oversize.
        At aperture=150 µm with 90% efficiency:
          Fine class (d_rep=50 < 150): 90% → undersize, 10% → oversize
          Coarse class (d_rep=300 > 150): 90% → oversize, 10% → undersize
        Undersize solid = 20 * 0.5 * 0.9 + 20 * 0.5 * 0.1 = 9 + 1 = 10
        Oversize solid  = 20 * 0.5 * 0.1 + 20 * 0.5 * 0.9 = 1 + 9 = 10
        """
        feed = make_psd_slurry(solid_kgs=20.0)
        config = {"aperture_size_microns": 150.0, "efficiency": 0.90}
        result = solve_screen([feed], config, thermo)

        expected_undersize = 20.0 * 0.5 * 0.90 + 20.0 * 0.5 * 0.10
        expected_oversize  = 20.0 * 0.5 * 0.10 + 20.0 * 0.5 * 0.90
        assert abs(result["undersize"].QmSolid - expected_undersize) < 1e-6
        assert abs(result["oversize"].QmSolid - expected_oversize) < 1e-6

    def test_psd_mass_balance(self, thermo):
        feed = make_psd_slurry(solid_kgs=20.0)
        config = {"aperture_size_microns": 150.0, "efficiency": 0.90}
        result = solve_screen([feed], config, thermo)

        total_solid = result["oversize"].QmSolid + result["undersize"].QmSolid
        assert abs(total_solid - feed.QmSolid) < 1e-9


class TestScreenOutputStructure:
    def test_has_required_keys(self, thermo):
        feed = make_ore_slurry()
        result = solve_screen([feed], {"aperture_size_microns": 150.0, "efficiency": 0.90}, thermo)

        assert "oversize" in result
        assert "undersize" in result
        assert result["oversize"].solved is True
        assert result["undersize"].solved is True
