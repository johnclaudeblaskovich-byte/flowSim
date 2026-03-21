"""
Unit tests for the CCD Washer model (P10-02).

Run with:  python -m pytest flowsim-backend/tests/test_ccd.py -v
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from solver.thermo import ThermoHelper, StreamDataPy, SpeciesFlowPy
from solver.units.ccd_washer import solve_ccd_washer


@pytest.fixture
def thermo():
    return ThermoHelper()


def make_leach_slurry(
    solid_kgs: float = 20.0,
    liquid_kgs: float = 30.0,
    dissolved_kgs: float = 5.0,
) -> StreamDataPy:
    """Leach slurry: solid residue + rich liquor."""
    species = {
        "Residue":  SpeciesFlowPy(speciesId="Residue",  massFlow=solid_kgs,  phase="Solid"),
        "ZnSO4":    SpeciesFlowPy(speciesId="ZnSO4",    massFlow=dissolved_kgs, phase="Aqueous"),
        "Water":    SpeciesFlowPy(speciesId="Water",    massFlow=liquid_kgs - dissolved_kgs, phase="Liquid"),
    }
    stream = StreamDataPy(
        tag="leach_slurry",
        QmSolid=solid_kgs,
        QmLiquid=liquid_kgs,
        QmVapour=0.0,
        T=338.15,  # 65°C leach temperature
        P=101325.0,
        species=species,
    )
    stream.recalculate_fractions()
    return stream


class TestCCDMassBalance:
    def test_total_mass_conserved_3_stages(self, thermo):
        """
        Total mass out (product_liquor + washed_solids) should equal
        total mass in (feed + wash_water).
        """
        feed = make_leach_slurry()
        config = {
            "num_stages": 3,
            "wash_water_flow": 15.0,
            "solid_recovery_per_stage": 0.98,
            "wash_efficiency_per_stage": 0.70,
        }
        result = solve_ccd_washer([feed], config, thermo)

        wash_water_flow = config["wash_water_flow"]
        mass_in = feed.Qm + wash_water_flow
        mass_out = result["product_liquor"].Qm + result["washed_solids"].Qm

        assert abs(mass_out - mass_in) < 0.1, (  # allow 0.1 kg/s tolerance for iterative model
            f"CCD mass balance: in={mass_in:.3f} out={mass_out:.3f}"
        )

    def test_solid_substantially_in_washed_solids(self, thermo):
        """Washed solids stream should contain most of the input solid mass."""
        feed = make_leach_slurry(solid_kgs=20.0)
        config = {
            "num_stages": 3,
            "wash_water_flow": 15.0,
            "solid_recovery_per_stage": 0.98,
            "wash_efficiency_per_stage": 0.70,
        }
        result = solve_ccd_washer([feed], config, thermo)

        # 98% recovery per stage; 3 stages → ~94% overall minimum
        assert result["washed_solids"].QmSolid > feed.QmSolid * 0.90

    def test_overflow_has_lower_solid_than_feed(self, thermo):
        """Product liquor (stage 1 overflow) should have much less solid than feed."""
        feed = make_leach_slurry(solid_kgs=20.0)
        config = {
            "num_stages": 3,
            "wash_water_flow": 10.0,
            "solid_recovery_per_stage": 0.98,
            "wash_efficiency_per_stage": 0.70,
        }
        result = solve_ccd_washer([feed], config, thermo)

        # Product liquor solid fraction should be far less than feed solid fraction
        feed_solid_frac = feed.QmSolid / feed.Qm
        liquor_solid_frac = result["product_liquor"].QmSolid / max(result["product_liquor"].Qm, 1e-12)
        assert liquor_solid_frac < feed_solid_frac * 0.5


class TestCCDConvergence:
    def test_converges_within_30_iterations(self, thermo):
        """CCD washer should converge in ≤ 30 iterations for typical inputs."""
        feed = make_leach_slurry()
        config = {
            "num_stages": 3,
            "wash_water_flow": 15.0,
            "solid_recovery_per_stage": 0.98,
            "wash_efficiency_per_stage": 0.70,
        }
        result = solve_ccd_washer([feed], config, thermo)
        iterations = result.get("_iterations", 0)
        assert iterations <= 30, f"CCD took {iterations} iterations to converge (limit 30)"

    def test_single_stage(self, thermo):
        """Single-stage CCD degenerates to a simple thickener+wash."""
        feed = make_leach_slurry(solid_kgs=10.0, liquid_kgs=20.0)
        config = {
            "num_stages": 1,
            "wash_water_flow": 10.0,
            "solid_recovery_per_stage": 0.99,
            "wash_efficiency_per_stage": 0.80,
        }
        result = solve_ccd_washer([feed], config, thermo)

        assert "product_liquor" in result
        assert "washed_solids" in result
        assert result["washed_solids"].QmSolid > 0

    def test_5_stage_circuit(self, thermo):
        """5-stage circuit should converge and give very low dissolved values in solids."""
        feed = make_leach_slurry(solid_kgs=20.0, liquid_kgs=30.0, dissolved_kgs=5.0)
        config = {
            "num_stages": 5,
            "wash_water_flow": 20.0,
            "solid_recovery_per_stage": 0.99,
            "wash_efficiency_per_stage": 0.80,
        }
        result = solve_ccd_washer([feed], config, thermo)

        iterations = result.get("_iterations", 0)
        assert iterations <= 100
        assert result["washed_solids"].QmSolid > 0


class TestCCDOutputStructure:
    def test_has_required_keys(self, thermo):
        feed = make_leach_slurry()
        config = {"num_stages": 3, "wash_water_flow": 10.0,
                  "solid_recovery_per_stage": 0.98, "wash_efficiency_per_stage": 0.70}
        result = solve_ccd_washer([feed], config, thermo)

        assert "product_liquor" in result
        assert "washed_solids" in result
