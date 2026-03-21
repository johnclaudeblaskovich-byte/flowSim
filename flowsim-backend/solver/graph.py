"""
flowsim-backend/solver/graph.py

Directed graph utilities for the FlowSim solver.
Used to:
  1. Build a process flowsheet graph from nodes + edges
  2. Detect cycles (recycle loops)
  3. Find a minimum set of tear streams to break all cycles
"""

from __future__ import annotations


# ─── Graph construction ───────────────────────────────────────────────────────


def build_directed_graph(
    nodes: list[dict],
    edges: list[dict],
) -> dict[str, list[str]]:
    """
    Build an adjacency-list representation of the flowsheet.

    Each node is identified by its ``tag`` field.
    Each edge must have ``sourceTag`` and ``targetTag`` fields.

    Returns a dict mapping ``tag → [dest_tag, ...]``.
    """
    # Initialise with empty adjacency lists for every node
    graph: dict[str, list[str]] = {node["tag"]: [] for node in nodes}

    for edge in edges:
        src = edge["sourceTag"]
        dst = edge["targetTag"]
        if src in graph:
            graph[src].append(dst)
        else:
            graph[src] = [dst]

    return graph


# ─── Cycle detection (iterative DFS) ─────────────────────────────────────────


def find_cycles(graph: dict[str, list[str]]) -> list[list[str]]:
    """
    Return all simple cycles in the directed graph.

    Uses Johnson's algorithm (via DFS with a blocked-set approach) simplified
    for practical flowsheet sizes (≤ 500 nodes).

    Returns a list of cycles, where each cycle is a list of node tags forming
    the cycle path (first tag == last tag is NOT included; use the implicit
    wrap-around).
    """
    cycles: list[list[str]] = []
    nodes = list(graph)

    def _dfs(start: str, current: str, path: list[str], visited: set[str]) -> None:
        for neighbour in graph.get(current, []):
            if neighbour == start and len(path) >= 2:
                cycles.append(list(path))
            elif neighbour not in visited:
                visited.add(neighbour)
                path.append(neighbour)
                _dfs(start, neighbour, path, visited)
                path.pop()
                visited.discard(neighbour)

    for node in nodes:
        _dfs(node, node, [node], {node})

    # Deduplicate: canonicalise each cycle by rotating to smallest tag
    seen: set[tuple[str, ...]] = set()
    unique: list[list[str]] = []
    for cycle in cycles:
        if not cycle:
            continue
        min_idx = cycle.index(min(cycle))
        canonical = tuple(cycle[min_idx:] + cycle[:min_idx])
        if canonical not in seen:
            seen.add(canonical)
            unique.append(list(canonical))

    return unique


# ─── Minimum tears (greedy DFS back-edge removal) ─────────────────────────────


def find_minimum_tears(
    graph: dict[str, list[str]],
    cycles: list[list[str]],
) -> list[tuple[str, str]]:
    """
    Find a minimum set of edges to remove ("tear streams") that breaks all
    cycles in the graph.

    Uses a greedy approach: iteratively remove the edge that appears in the
    most remaining cycles until no cycles remain.

    Returns a list of ``(source_tag, dest_tag)`` tuples identifying tear edges.
    """
    if not cycles:
        return []

    # Build a set of remaining cycles (as frozensets for fast membership test)
    remaining: list[tuple[str, ...]] = [tuple(c) for c in cycles]

    # Count how many cycles each edge participates in
    def edge_cycle_count(edges_in_cycle: list[tuple[str, ...]]) -> dict[tuple[str, str], int]:
        count: dict[tuple[str, str], int] = {}
        for cycle in edges_in_cycle:
            n = len(cycle)
            for i in range(n):
                edge = (cycle[i], cycle[(i + 1) % n])
                count[edge] = count.get(edge, 0) + 1
        return count

    tears: list[tuple[str, str]] = []

    while remaining:
        # Pick the edge that appears in the most cycles
        counts = edge_cycle_count(remaining)
        if not counts:
            break
        best_edge = max(counts, key=lambda e: counts[e])
        tears.append(best_edge)

        # Remove cycles that contained this edge
        src, dst = best_edge
        new_remaining = []
        for cycle in remaining:
            n = len(cycle)
            edge_in_cycle = any(
                cycle[i] == src and cycle[(i + 1) % n] == dst
                for i in range(n)
            )
            if not edge_in_cycle:
                new_remaining.append(cycle)
        remaining = new_remaining

    return tears
