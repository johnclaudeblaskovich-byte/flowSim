"""
flowsim-backend/solver/probal.py

Sequential (topological-order) mass balance solver for acyclic flowsheets.

Usage
-----
Calls each unit solver in topological order, passing the output streams of
upstream units as inputs to the next unit.  Only handles acyclic graphs —
recycle loops require the tear-stream convergence loop in the full solver.

This module is intentionally minimal: it exists to support unit testing of
the solver pipeline without requiring a running FastAPI server.
"""

from __future__ import annotations

from collections import deque

from solver.thermo import ThermoHelper, StreamDataPy, SpeciesFlowPy
from solver.units.filter import solve_filter
from solver.units.thickener import solve_thickener
from solver.units.cyclone import solve_cyclone
from solver.units.screen import solve_screen


# ─── Unit solver registry ─────────────────────────────────────────────────────

_UNIT_SOLVERS = {
    "Filter":    solve_filter,
    "Thickener": solve_thickener,
    "Cyclone":   solve_cyclone,
    "Screen":    solve_screen,
}


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _topological_sort(
    nodes: list[dict],
    edges: list[dict],
) -> list[str]:
    """Return node tags in topological order (Kahn's algorithm)."""
    in_degree: dict[str, int] = {n["tag"]: 0 for n in nodes}
    adjacency: dict[str, list[str]] = {n["tag"]: [] for n in nodes}

    for edge in edges:
        src, dst = edge["sourceTag"], edge["targetTag"]
        adjacency.setdefault(src, []).append(dst)
        in_degree[dst] = in_degree.get(dst, 0) + 1

    queue: deque[str] = deque(
        tag for tag, deg in in_degree.items() if deg == 0
    )
    order: list[str] = []
    while queue:
        tag = queue.popleft()
        order.append(tag)
        for nbr in adjacency.get(tag, []):
            in_degree[nbr] -= 1
            if in_degree[nbr] == 0:
                queue.append(nbr)

    return order


def make_water_stream(
    tag: str = "feed",
    mass_flow_kg_s: float = 1.0,
    T_K: float = 298.15,
) -> StreamDataPy:
    """Create a pure-water stream for testing."""
    species = {
        "Water": SpeciesFlowPy(
            speciesId="Water",
            massFlow=mass_flow_kg_s,
            phase="Liquid",
        )
    }
    stream = StreamDataPy(
        tag=tag,
        QmLiquid=mass_flow_kg_s,
        T=T_K,
        species=species,
    )
    stream.recalculate_fractions()
    return stream


# ─── Sequential solve ─────────────────────────────────────────────────────────


def solve_sequential(
    nodes: list[dict],
    edges: list[dict],
    configs: dict[str, dict],
    thermo: ThermoHelper | None = None,
    feed_streams: dict[str, StreamDataPy] | None = None,
) -> dict[str, dict[str, StreamDataPy]]:
    """
    Sequentially solve an acyclic flowsheet.

    Parameters
    ----------
    nodes:
        List of node dicts with ``tag`` and ``type`` fields.
    edges:
        List of edge dicts with ``sourceTag`` and ``targetTag`` fields.
    configs:
        Mapping of ``tag → config dict`` for each unit.
    thermo:
        ThermoHelper instance (created if not supplied).
    feed_streams:
        Optional mapping of ``tag → StreamDataPy`` for Feeder nodes.

    Returns
    -------
    Dict mapping ``tag → {outlet_name: StreamDataPy}`` for each solved unit.
    """
    if thermo is None:
        thermo = ThermoHelper()
    if feed_streams is None:
        feed_streams = {}

    order = _topological_sort(nodes, edges)

    # Map: edge_id → StreamDataPy (outlet streams produced by each unit)
    # Keyed by (sourceTag, targetTag)
    edge_streams: dict[tuple[str, str], StreamDataPy] = {}

    # For Feeder nodes, create a default water stream if not provided
    node_map = {n["tag"]: n for n in nodes}

    results: dict[str, dict[str, StreamDataPy]] = {}

    for tag in order:
        node = node_map[tag]
        unit_type = node.get("type", "")
        cfg = configs.get(tag, {})

        # Collect incoming streams
        inlet_streams: list[StreamDataPy] = []
        for edge in edges:
            if edge["targetTag"] == tag:
                key = (edge["sourceTag"], tag)
                s = edge_streams.get(key)
                if s is not None:
                    inlet_streams.append(s)

        if unit_type == "Feeder":
            # Use provided feed stream or a default water stream
            feed = feed_streams.get(tag, make_water_stream(tag))
            results[tag] = {"outlet": feed}
            # Route outlet to edges leaving this feeder
            for edge in edges:
                if edge["sourceTag"] == tag:
                    key = (tag, edge["targetTag"])
                    edge_streams[key] = feed

        elif unit_type == "FeederSink":
            # Sink: absorbs all inlets, no output
            results[tag] = {}

        elif unit_type in _UNIT_SOLVERS:
            solver_fn = _UNIT_SOLVERS[unit_type]
            # Use default config if not specified
            output = solver_fn(inlet_streams or [thermo.make_empty_stream()], cfg, thermo)
            results[tag] = output

            # Route first output stream to outgoing edges
            # (simplified: routes first outlet value to all outgoing edges)
            outlet_values = list(output.values())
            for i, edge in enumerate(e for e in edges if e["sourceTag"] == tag):
                key = (tag, edge["targetTag"])
                edge_streams[key] = outlet_values[i] if i < len(outlet_values) else thermo.make_empty_stream()

        else:
            # Unknown type: pass-through
            combined = thermo.mix_streams(inlet_streams) if inlet_streams else thermo.make_empty_stream()
            results[tag] = {"outlet": combined}
            for edge in edges:
                if edge["sourceTag"] == tag:
                    key = (tag, edge["targetTag"])
                    edge_streams[key] = combined

    return results
