"""
Integration tests for solver/probal.py — sequential mass balance solver.

Run with:  python -m pytest flowsim-backend/tests/test_probal.py -v
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from solver.thermo import ThermoHelper, StreamDataPy, SpeciesFlowPy
from solver.probal import solve_sequential, make_water_stream
from solver.convergence import check_converged


@pytest.fixture
def thermo():
    return ThermoHelper()


# ─── Helpers ──────────────────────────────────────────────────────────────────


def make_node(tag: str, unit_type: str) -> dict:
    return {"tag": tag, "type": unit_type}


def make_edge(src: str, dst: str) -> dict:
    return {"sourceTag": src, "targetTag": dst}


# ─── make_water_stream ────────────────────────────────────────────────────────


class TestMakeWaterStream:
    def test_default_water_stream(self):
        s = make_water_stream()
        assert abs(s.Qm - 1.0) < 1e-9
        assert abs(s.T - 298.15) < 1e-6
        assert "Water" in s.species

    def test_custom_mass_flow(self):
        s = make_water_stream(mass_flow_kg_s=5.0)
        assert abs(s.Qm - 5.0) < 1e-9

    def test_custom_temperature(self):
        s = make_water_stream(T_K=373.15)
        assert abs(s.T - 373.15) < 1e-6


# ─── Simple feeder → sink ────────────────────────────────────────────────────


class TestSimpleFeederToSink:
    def test_feeder_outlet_equals_feed(self, thermo):
        """Feeder node should pass through its feed stream unchanged."""
        nodes = [make_node("FDR_001", "Feeder"), make_node("SNK_001", "FeederSink")]
        edges = [make_edge("FDR_001", "SNK_001")]
        feed = make_water_stream("FDR_001", mass_flow_kg_s=1.0, T_K=298.15)

        results = solve_sequential(nodes, edges, {}, thermo, feed_streams={"FDR_001": feed})

        feeder_out = results["FDR_001"]["outlet"]
        assert abs(feeder_out.Qm - 1.0) < 1e-9, f"Expected Qm=1.0, got {feeder_out.Qm}"
        assert abs(feeder_out.T - 298.15) < 1e-6

    def test_mass_error_below_tolerance(self, thermo):
        """Total mass in = total mass in sink (conservation)."""
        nodes = [make_node("FDR_001", "Feeder"), make_node("SNK_001", "FeederSink")]
        edges = [make_edge("FDR_001", "SNK_001")]
        feed = make_water_stream(mass_flow_kg_s=2.5)

        results = solve_sequential(nodes, edges, {}, thermo, feed_streams={"FDR_001": feed})

        feeder_qm = results["FDR_001"]["outlet"].Qm
        assert abs(feeder_qm - 2.5) < 1e-8


# ─── Feeder → Filter → Sink ──────────────────────────────────────────────────


def make_slurry_feed(tag: str = "FDR_001", solid: float = 10.0, liquid: float = 20.0) -> StreamDataPy:
    species = {
        "Sand":  SpeciesFlowPy(speciesId="Sand",  massFlow=solid,  phase="Solid"),
        "Water": SpeciesFlowPy(speciesId="Water", massFlow=liquid, phase="Liquid"),
    }
    stream = StreamDataPy(
        tag=tag,
        QmSolid=solid,
        QmLiquid=liquid,
        species=species,
    )
    stream.recalculate_fractions()
    return stream


class TestFilterInChain:
    def test_filter_mass_balance_in_chain(self, thermo):
        """Feeder → Filter: cake + filtrate = feed mass."""
        nodes = [
            make_node("FDR_001", "Feeder"),
            make_node("FLTR_001", "Filter"),
            make_node("SNK_001", "FeederSink"),
            make_node("SNK_002", "FeederSink"),
        ]
        edges = [
            make_edge("FDR_001", "FLTR_001"),
            make_edge("FLTR_001", "SNK_001"),   # cake
            make_edge("FLTR_001", "SNK_002"),   # filtrate (second outlet)
        ]
        cfg = {
            "FLTR_001": {"solid_recovery": 0.95, "moisture_content": 0.10, "wash_efficiency": 0.0}
        }
        feed = make_slurry_feed(tag="FDR_001", solid=10.0, liquid=20.0)
        results = solve_sequential(nodes, edges, cfg, thermo, feed_streams={"FDR_001": feed})

        assert "FLTR_001" in results
        outlets = results["FLTR_001"]
        assert "cake" in outlets or "filtrate" in outlets  # at least one outlet present

        total_out = sum(s.Qm for s in outlets.values())
        assert abs(total_out - feed.Qm) < 1e-5, (
            f"Mass not conserved: in={feed.Qm:.6f} out={total_out:.6f}"
        )

    def test_feeder_produces_output(self, thermo):
        """Feeder should produce an outlet stream."""
        nodes = [make_node("FDR_001", "Feeder"), make_node("SNK_001", "FeederSink")]
        edges = [make_edge("FDR_001", "SNK_001")]
        feed = make_water_stream("FDR_001")
        results = solve_sequential(nodes, edges, {}, thermo, feed_streams={"FDR_001": feed})
        assert "outlet" in results["FDR_001"]
        assert results["FDR_001"]["outlet"].Qm > 0


# ─── check_converged integration ─────────────────────────────────────────────


class TestCheckConvergedIntegration:
    def test_converged_at_tol(self):
        old = [1.0, 2.0, 3.0]
        new = [1.0, 2.0, 3.0]
        assert check_converged(old, new, tol=1e-6) is True

    def test_not_converged(self):
        old = [1.0, 2.0]
        new = [1.1, 2.1]
        assert check_converged(old, new, tol=1e-6) is False

    def test_converged_stream_flows(self):
        """Stream mass flows that haven't changed should be considered converged."""
        old_qm = [1.0, 5.0, 12.3456]
        new_qm = [1.0, 5.0, 12.3456]
        assert check_converged(old_qm, new_qm, tol=1e-8) is True
