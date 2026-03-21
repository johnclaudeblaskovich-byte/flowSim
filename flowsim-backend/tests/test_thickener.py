"""
Unit tests for the Thickener model (P10-01).

Run with:  python -m pytest flowsim-backend/tests/test_thickener.py -v
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from solver.thermo import ThermoHelper, StreamDataPy, SpeciesFlowPy
from solver.units.thickener import solve_thickener


@pytest.fixture
def thermo():
    return ThermoHelper()


def make_slurry(solid_kgs: float = 10.0, liquid_kgs: float = 40.0) -> StreamDataPy:
    species = {
        "Quartz": SpeciesFlowPy(speciesId="Quartz", massFlow=solid_kgs, phase="Solid"),
        "CuSO4":  SpeciesFlowPy(speciesId="CuSO4",  massFlow=2.0,      phase="Aqueous"),
        "Water":  SpeciesFlowPy(speciesId="Water",  massFlow=liquid_kgs - 2.0, phase="Liquid"),
    }
    stream = StreamDataPy(
        tag="feed",
        QmSolid=solid_kgs,
        QmLiquid=liquid_kgs,
        QmVapour=0.0,
        T=298.15, P=101325.0,
        species=species,
    )
    stream.recalculate_fractions()
    return stream


class TestThickenerMassBalance:
    def test_total_mass_conserved(self, thermo):
        """Total mass in = overflow + underflow."""
        feed = make_slurry()
        config = {"solid_recovery": 0.98, "underflow_density": 1400.0}
        result = solve_thickener([feed], config, thermo)

        total_out = result["overflow"].Qm + result["underflow"].Qm
        assert abs(total_out - feed.Qm) < 1e-6

    def test_solid_mass_conserved(self, thermo):
        feed = make_slurry()
        config = {"solid_recovery": 0.98, "underflow_density": 1400.0}
        result = solve_thickener([feed], config, thermo)

        total_solid = result["overflow"].QmSolid + result["underflow"].QmSolid
        assert abs(total_solid - feed.QmSolid) < 1e-9

    def test_liquid_mass_conserved(self, thermo):
        feed = make_slurry()
        config = {"solid_recovery": 0.98, "underflow_density": 1400.0}
        result = solve_thickener([feed], config, thermo)

        total_liquid = result["overflow"].QmLiquid + result["underflow"].QmLiquid
        assert abs(total_liquid - feed.QmLiquid) < 1e-9


class TestThickenerSolidRecovery:
    def test_98_percent_solid_to_underflow(self, thermo):
        feed = make_slurry(solid_kgs=10.0, liquid_kgs=40.0)
        config = {"solid_recovery": 0.98, "underflow_density": 1400.0}
        result = solve_thickener([feed], config, thermo)

        assert abs(result["underflow"].QmSolid - 9.8) < 1e-9
        assert abs(result["overflow"].QmSolid - 0.2) < 1e-9

    def test_zero_solid_recovery(self, thermo):
        feed = make_slurry()
        config = {"solid_recovery": 0.0, "underflow_density": 1000.0}
        result = solve_thickener([feed], config, thermo)

        assert result["underflow"].QmSolid < 1e-9

    def test_full_solid_recovery(self, thermo):
        feed = make_slurry()
        config = {"solid_recovery": 1.0, "underflow_density": 1400.0}
        result = solve_thickener([feed], config, thermo)

        assert abs(result["underflow"].QmSolid - feed.QmSolid) < 1e-9


class TestThickenerDensity:
    def test_underflow_density_assigned(self, thermo):
        """Underflow stream should carry the target density."""
        feed = make_slurry(solid_kgs=10.0, liquid_kgs=40.0)
        config = {"solid_recovery": 0.98, "underflow_density": 1500.0}
        result = solve_thickener([feed], config, thermo)

        assert abs(result["underflow"].rho - 1500.0) < 1e-6

    def test_density_higher_than_water(self, thermo):
        """A thickened underflow should be denser than water."""
        feed = make_slurry(solid_kgs=15.0, liquid_kgs=35.0)
        config = {"solid_recovery": 0.98, "underflow_density": 1350.0}
        result = solve_thickener([feed], config, thermo)

        assert result["underflow"].rho > 1000.0

    def test_liquid_in_underflow_increases_with_lower_density_target(self, thermo):
        """Lower target density → more liquid in underflow (more dilute)."""
        feed = make_slurry(solid_kgs=10.0, liquid_kgs=40.0)
        config_hi = {"solid_recovery": 0.98, "underflow_density": 1600.0}
        config_lo = {"solid_recovery": 0.98, "underflow_density": 1200.0}

        result_hi = solve_thickener([feed], config_hi, thermo)
        result_lo = solve_thickener([feed], config_lo, thermo)

        # Lower density target should give MORE liquid in the underflow
        assert result_lo["underflow"].QmLiquid > result_hi["underflow"].QmLiquid


class TestThickenerSpecies:
    def test_species_mass_conserved(self, thermo):
        feed = make_slurry()
        config = {"solid_recovery": 0.98, "underflow_density": 1400.0}
        result = solve_thickener([feed], config, thermo)

        for sp_id, sf_feed in feed.species.items():
            uf_flow = result["underflow"].species.get(sp_id, SpeciesFlowPy(sp_id, 0.0)).massFlow
            of_flow = result["overflow"].species.get(sp_id, SpeciesFlowPy(sp_id, 0.0)).massFlow
            assert abs((uf_flow + of_flow) - sf_feed.massFlow) < 1e-9, (
                f"Species {sp_id} not conserved"
            )
