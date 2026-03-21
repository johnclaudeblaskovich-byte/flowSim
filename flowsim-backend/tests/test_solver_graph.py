"""
Unit tests for solver/graph.py — directed graph, cycle detection, and tears.

Run with:  python -m pytest flowsim-backend/tests/test_solver_graph.py -v
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from solver.graph import build_directed_graph, find_cycles, find_minimum_tears


# ─── Helpers ──────────────────────────────────────────────────────────────────

def make_node(tag: str) -> dict:
    return {"tag": tag}


def make_edge(src: str, dst: str) -> dict:
    return {"sourceTag": src, "targetTag": dst}


# ─── build_directed_graph ─────────────────────────────────────────────────────


class TestBuildDirectedGraph:
    def test_empty_graph(self):
        g = build_directed_graph([], [])
        assert g == {}

    def test_single_node_no_edges(self):
        g = build_directed_graph([make_node("A")], [])
        assert g == {"A": []}

    def test_linear_chain(self):
        nodes = [make_node("A"), make_node("B"), make_node("C")]
        edges = [make_edge("A", "B"), make_edge("B", "C")]
        g = build_directed_graph(nodes, edges)
        assert g["A"] == ["B"]
        assert g["B"] == ["C"]
        assert g["C"] == []

    def test_multiple_outgoing_edges(self):
        nodes = [make_node("A"), make_node("B"), make_node("C")]
        edges = [make_edge("A", "B"), make_edge("A", "C")]
        g = build_directed_graph(nodes, edges)
        assert set(g["A"]) == {"B", "C"}


# ─── find_cycles ──────────────────────────────────────────────────────────────


class TestFindCycles:
    def test_no_recycle_no_cycles(self):
        nodes = [make_node("A"), make_node("B"), make_node("C")]
        edges = [make_edge("A", "B"), make_edge("B", "C")]
        g = build_directed_graph(nodes, edges)
        cycles = find_cycles(g)
        assert cycles == []

    def test_two_node_cycle(self):
        """A → B → A: smallest meaningful recycle loop."""
        nodes = [make_node("A"), make_node("B")]
        edges = [make_edge("A", "B"), make_edge("B", "A")]
        g = build_directed_graph(nodes, edges)
        cycles = find_cycles(g)
        assert len(cycles) >= 1

    def test_simple_recycle_loop(self):
        """A → B → C → B: one cycle B→C→B"""
        nodes = [make_node("A"), make_node("B"), make_node("C")]
        edges = [make_edge("A", "B"), make_edge("B", "C"), make_edge("C", "B")]
        g = build_directed_graph(nodes, edges)
        cycles = find_cycles(g)
        assert len(cycles) >= 1

    def test_two_independent_cycles(self):
        """Two separate loops: A→B→A and C→D→C"""
        nodes = [make_node("A"), make_node("B"), make_node("C"), make_node("D")]
        edges = [make_edge("A", "B"), make_edge("B", "A"),
                 make_edge("C", "D"), make_edge("D", "C")]
        g = build_directed_graph(nodes, edges)
        cycles = find_cycles(g)
        assert len(cycles) == 2

    def test_empty_graph_no_cycles(self):
        g = build_directed_graph([], [])
        assert find_cycles(g) == []


# ─── find_minimum_tears ───────────────────────────────────────────────────────


class TestFindMinimumTears:
    def test_no_cycles_no_tears(self):
        nodes = [make_node("A"), make_node("B"), make_node("C")]
        edges = [make_edge("A", "B"), make_edge("B", "C")]
        g = build_directed_graph(nodes, edges)
        cycles = find_cycles(g)
        tears = find_minimum_tears(g, cycles)
        assert len(tears) == 0

    def test_single_recycle_one_tear(self):
        """A → B → C → B: should need exactly 1 tear to break the cycle."""
        nodes = [make_node("A"), make_node("B"), make_node("C")]
        edges = [make_edge("A", "B"), make_edge("B", "C"), make_edge("C", "B")]
        g = build_directed_graph(nodes, edges)
        cycles = find_cycles(g)
        tears = find_minimum_tears(g, cycles)
        assert len(tears) == 1

    def test_two_independent_recycles_two_tears(self):
        """Two independent recycles: A→B→A and C→D→C, need 2 tears."""
        nodes = [make_node("A"), make_node("B"), make_node("C"), make_node("D")]
        edges = [make_edge("A", "B"), make_edge("B", "A"),
                 make_edge("C", "D"), make_edge("D", "C")]
        g = build_directed_graph(nodes, edges)
        cycles = find_cycles(g)
        tears = find_minimum_tears(g, cycles)
        assert len(tears) == 2

    def test_tears_are_actual_graph_edges(self):
        """Every identified tear must correspond to an actual edge."""
        nodes = [make_node("A"), make_node("B"), make_node("C")]
        edges = [make_edge("A", "B"), make_edge("B", "C"), make_edge("C", "A")]
        g = build_directed_graph(nodes, edges)
        cycles = find_cycles(g)
        tears = find_minimum_tears(g, cycles)
        edge_set = {(e["sourceTag"], e["targetTag"]) for e in edges}
        for tear in tears:
            assert tear in edge_set

    def test_empty_cycles_returns_empty(self):
        assert find_minimum_tears({}, []) == []
