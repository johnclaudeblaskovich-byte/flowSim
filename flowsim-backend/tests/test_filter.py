"""
Unit tests for the Filter model (P10-01).

Run with:  python -m pytest flowsim-backend/tests/test_filter.py -v
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from solver.thermo import ThermoHelper, StreamDataPy, SpeciesFlowPy
from solver.units.filter import solve_filter


@pytest.fixture
def thermo():
    return ThermoHelper()


def make_slurry_feed(
    solid_kgs: float = 10.0,
    liquid_kgs: float = 20.0,
    dissolved_kgs: float = 2.0,
) -> StreamDataPy:
    """Build a simple slurry stream with one solid and one dissolved species."""
    species = {
        "Quartz": SpeciesFlowPy(speciesId="Quartz", massFlow=solid_kgs, phase="Solid"),
        "ZnSO4":  SpeciesFlowPy(speciesId="ZnSO4",  massFlow=dissolved_kgs, phase="Aqueous"),
        "Water":  SpeciesFlowPy(speciesId="Water",  massFlow=liquid_kgs - dissolved_kgs, phase="Liquid"),
    }
    stream = StreamDataPy(
        tag="feed",
        QmSolid=solid_kgs,
        QmLiquid=liquid_kgs,
        QmVapour=0.0,
        T=298.15,
        P=101325.0,
        species=species,
    )
    stream.recalculate_fractions()
    return stream


class TestFilterMassBalance:
    def test_total_mass_conserved(self, thermo):
        """Total mass in = cake + filtrate."""
        feed = make_slurry_feed(solid_kgs=10.0, liquid_kgs=20.0)
        config = {"solid_recovery": 0.95, "moisture_content": 0.15, "wash_efficiency": 0.80}
        result = solve_filter([feed], config, thermo)
        cake, filtrate = result["cake"], result["filtrate"]

        total_in = feed.Qm
        total_out = cake.Qm + filtrate.Qm
        assert abs(total_out - total_in) < 1e-6, (
            f"Mass not conserved: in={total_in:.6f} out={total_out:.6f}"
        )

    def test_solid_mass_conserved(self, thermo):
        """Solid mass in = cake solids + filtrate solids."""
        feed = make_slurry_feed(solid_kgs=10.0, liquid_kgs=20.0)
        config = {"solid_recovery": 0.95, "moisture_content": 0.15, "wash_efficiency": 0.80}
        result = solve_filter([feed], config, thermo)
        cake, filtrate = result["cake"], result["filtrate"]

        assert abs((cake.QmSolid + filtrate.QmSolid) - feed.QmSolid) < 1e-9

    def test_liquid_mass_conserved(self, thermo):
        """Liquid mass in = cake liquid + filtrate liquid."""
        feed = make_slurry_feed(solid_kgs=10.0, liquid_kgs=20.0)
        config = {"solid_recovery": 0.95, "moisture_content": 0.15, "wash_efficiency": 0.80}
        result = solve_filter([feed], config, thermo)
        cake, filtrate = result["cake"], result["filtrate"]

        assert abs((cake.QmLiquid + filtrate.QmLiquid) - feed.QmLiquid) < 1e-9


class TestFilterSolidsRecovery:
    def test_95_percent_solid_recovery(self, thermo):
        """95% solid recovery sends 9.5 kg/s of 10 kg/s solids to cake."""
        feed = make_slurry_feed(solid_kgs=10.0, liquid_kgs=20.0)
        config = {"solid_recovery": 0.95, "moisture_content": 0.15, "wash_efficiency": 0.80}
        result = solve_filter([feed], config, thermo)

        assert abs(result["cake"].QmSolid - 9.5) < 1e-9
        assert abs(result["filtrate"].QmSolid - 0.5) < 1e-9

    def test_zero_solid_recovery(self, thermo):
        """0% recovery: all solids in filtrate."""
        feed = make_slurry_feed(solid_kgs=10.0, liquid_kgs=20.0)
        config = {"solid_recovery": 0.0, "moisture_content": 0.0, "wash_efficiency": 0.0}
        result = solve_filter([feed], config, thermo)

        assert result["cake"].QmSolid < 1e-9
        assert abs(result["filtrate"].QmSolid - 10.0) < 1e-9

    def test_full_solid_recovery(self, thermo):
        """100% recovery: all solids in cake."""
        feed = make_slurry_feed(solid_kgs=10.0, liquid_kgs=20.0)
        config = {"solid_recovery": 1.0, "moisture_content": 0.10, "wash_efficiency": 0.0}
        result = solve_filter([feed], config, thermo)

        assert abs(result["cake"].QmSolid - 10.0) < 1e-9


class TestFilterMoistureContent:
    def test_15_percent_moisture(self, thermo):
        """
        At 95% solid recovery and 15% moisture:
          cake_solids = 9.5
          retained_liquid = 0.15 * 9.5 / 0.85 ≈ 1.676 kg/s
          cake_total ≈ 11.176 kg/s
        """
        feed = make_slurry_feed(solid_kgs=10.0, liquid_kgs=20.0)
        config = {"solid_recovery": 0.95, "moisture_content": 0.15, "wash_efficiency": 0.0}
        result = solve_filter([feed], config, thermo)

        cake_solids = 9.5
        expected_retained = 0.15 * cake_solids / (1.0 - 0.15)
        assert abs(result["cake"].QmLiquid - expected_retained) < 1e-6

    def test_moisture_cannot_exceed_available_liquid(self, thermo):
        """Very high moisture_content cannot retain more liquid than exists in feed."""
        feed = make_slurry_feed(solid_kgs=100.0, liquid_kgs=1.0)
        config = {"solid_recovery": 1.0, "moisture_content": 0.95, "wash_efficiency": 0.0}
        result = solve_filter([feed], config, thermo)

        # Retained liquid cannot exceed feed liquid
        assert result["cake"].QmLiquid <= feed.QmLiquid + 1e-9


class TestFilterWashEfficiency:
    def test_80_percent_wash_removes_dissolved_species(self, thermo):
        """
        With 80% wash efficiency, 80% of dissolved species are removed from cake
        to the filtrate.
        """
        feed = make_slurry_feed(solid_kgs=10.0, liquid_kgs=20.0, dissolved_kgs=2.0)
        config = {"solid_recovery": 0.95, "moisture_content": 0.15, "wash_efficiency": 0.80}
        result = solve_filter([feed], config, thermo)

        cake = result["cake"]
        zn_in_cake = cake.species.get("ZnSO4")
        assert zn_in_cake is not None

        # The cake liquid fraction of dissolved ZnSO4:
        # retained_liquid = 0.15 * 9.5 / 0.85 ≈ 1.676
        # liquid_frac_cake = 1.676 / 20 ≈ 0.0838
        # ZnSO4 in cake before wash = 2.0 * 0.0838 = 0.1676
        # After 80% wash: cake ZnSO4 = 0.1676 * (1 - 0.80) = 0.0335

        retained_liq = 0.15 * 9.5 / 0.85
        liq_frac = retained_liq / 20.0
        expected_cake_znso4 = 2.0 * liq_frac * (1.0 - 0.80)
        assert abs(zn_in_cake.massFlow - expected_cake_znso4) < 1e-6

    def test_zero_wash_efficiency_no_removal(self, thermo):
        """With 0% wash, dissolved species distribution follows liquid split only."""
        feed = make_slurry_feed(solid_kgs=10.0, liquid_kgs=20.0, dissolved_kgs=4.0)
        config = {"solid_recovery": 0.95, "moisture_content": 0.20, "wash_efficiency": 0.0}
        result = solve_filter([feed], config, thermo)

        cake = result["cake"]
        filtrate = result["filtrate"]
        total_dissolved = (
            cake.species.get("ZnSO4", SpeciesFlowPy("ZnSO4", 0.0)).massFlow
            + filtrate.species.get("ZnSO4", SpeciesFlowPy("ZnSO4", 0.0)).massFlow
        )
        assert abs(total_dissolved - 4.0) < 1e-9

    def test_species_mass_conserved(self, thermo):
        """Total species mass (cake + filtrate) equals feed species mass."""
        feed = make_slurry_feed(solid_kgs=10.0, liquid_kgs=20.0, dissolved_kgs=2.0)
        config = {"solid_recovery": 0.95, "moisture_content": 0.15, "wash_efficiency": 0.80}
        result = solve_filter([feed], config, thermo)

        for sp_id, sf_feed in feed.species.items():
            cake_flow = result["cake"].species.get(sp_id, SpeciesFlowPy(sp_id, 0.0)).massFlow
            filt_flow = result["filtrate"].species.get(sp_id, SpeciesFlowPy(sp_id, 0.0)).massFlow
            assert abs((cake_flow + filt_flow) - sf_feed.massFlow) < 1e-9, (
                f"Species {sp_id} mass not conserved"
            )


class TestFilterOutputStructure:
    def test_returns_cake_and_filtrate(self, thermo):
        feed = make_slurry_feed()
        config = {"solid_recovery": 0.95, "moisture_content": 0.15, "wash_efficiency": 0.80}
        result = solve_filter([feed], config, thermo)

        assert "cake" in result
        assert "filtrate" in result

    def test_output_streams_are_solved(self, thermo):
        feed = make_slurry_feed()
        result = solve_filter([feed], {"solid_recovery": 0.95, "moisture_content": 0.15, "wash_efficiency": 0.80}, thermo)
        assert result["cake"].solved is True
        assert result["filtrate"].solved is True
