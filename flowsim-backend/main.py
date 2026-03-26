"""
FlowSim Backend — FastAPI application.

Exposes a WebSocket endpoint at /ws/solve/{job_id}.
The frontend connects, sends a flowsheet JSON payload, and receives
streaming solver result messages as the solve progresses.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from solver.thermo import ThermoHelper, StreamDataPy
from solver.units.filter import solve_filter
from solver.units.thickener import solve_thickener
from solver.units.ccd_washer import solve_ccd_washer
from solver.units.cyclone import solve_cyclone
from solver.units.screen import solve_screen

logger = logging.getLogger(__name__)

app = FastAPI(title="FlowSim Solver", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Unit solver dispatch table ───────────────────────────────────────────────

UNIT_SOLVERS: dict[str, Any] = {
    "Filter": solve_filter,
    "Thickener": solve_thickener,
    "Washer": solve_ccd_washer,   # CCD Washer uses same interface
    "Cyclone": solve_cyclone,
    "Screen": solve_screen,
}


def _topological_sort(nodes: list[dict], edges: list[dict]) -> list[dict]:
    """Return nodes in topological order using sourceUnitTag → destUnitTag edges."""
    in_degree: dict[str, int] = {node.get("tag", ""): 0 for node in nodes}
    adjacency: dict[str, list[str]] = {node.get("tag", ""): [] for node in nodes}
    node_by_tag = {node.get("tag", ""): node for node in nodes}

    for edge in edges:
        src = edge.get("sourceUnitTag", "")
        dst = edge.get("destUnitTag", "")
        if not src or not dst:
            continue
        adjacency.setdefault(src, []).append(dst)
        in_degree[dst] = in_degree.get(dst, 0) + 1

    queue = [tag for tag, degree in in_degree.items() if degree == 0]
    ordered: list[dict] = []

    while queue:
        tag = queue.pop(0)
        node = node_by_tag.get(tag)
        if node is not None:
            ordered.append(node)
        for neighbour in adjacency.get(tag, []):
            in_degree[neighbour] -= 1
            if in_degree[neighbour] == 0:
                queue.append(neighbour)

    if len(ordered) != len(nodes):
        logger.warning("Flowsheet graph contains a cycle or disconnected tags; falling back to payload order")
        return nodes

    return ordered


def _stream_from_dict(d: dict) -> StreamDataPy:
    """Deserialise a frontend StreamData JSON object into StreamDataPy."""
    from solver.thermo import SpeciesFlowPy
    species = {
        sp_id: SpeciesFlowPy(
            speciesId=sp_id,
            massFlow=float(sf.get("massFlow", 0.0)),
            moleFlow=float(sf.get("moleFlow", 0.0)),
            massFraction=float(sf.get("massFraction", 0.0)),
            moleFraction=float(sf.get("moleFraction", 0.0)),
            phase=sf.get("phase", "Liquid"),
        )
        for sp_id, sf in d.get("species", {}).items()
    }
    return StreamDataPy(
        tag=d.get("tag", ""),
        Qm=float(d.get("Qm", 0.0)),
        Qv=float(d.get("Qv", 0.0)),
        QmSolid=float(d.get("QmSolid", 0.0)),
        QmLiquid=float(d.get("QmLiquid", 0.0)),
        QmVapour=float(d.get("QmVapour", 0.0)),
        T=float(d.get("T", 298.15)),
        P=float(d.get("P", 101325.0)),
        H=float(d.get("H", 0.0)),
        rho=float(d.get("rho", 1000.0)),
        Cp=float(d.get("Cp", 4186.0)),
        species=species,
        solidFraction=float(d.get("solidFraction", 0.0)),
        liquidFraction=float(d.get("liquidFraction", 1.0)),
        vapourFraction=float(d.get("vapourFraction", 0.0)),
        sourceUnitTag=d.get("sourceUnitTag", ""),
        destUnitTag=d.get("destUnitTag", ""),
        solved=bool(d.get("solved", False)),
        errors=list(d.get("errors", [])),
        quality=d.get("quality", {}),
    )


def _stream_to_dict(s: StreamDataPy) -> dict:
    """Serialise a StreamDataPy to a JSON-compatible dict."""
    from dataclasses import asdict
    d = asdict(s)
    return d


def _validate_flowsheet_payload(nodes: list[dict], edges: list[dict]) -> list[str]:
    """Return protocol validation errors for an incoming solve payload."""
    errors: list[str] = []
    node_tags = {node.get("tag", "") for node in nodes if node.get("tag")}

    if not nodes:
        errors.append("Flowsheet has no nodes.")

    for node in nodes:
        if not node.get("tag"):
            errors.append("Node is missing required field 'tag'.")
        if not node.get("type"):
            errors.append(f"Node '{node.get('tag', '')}' is missing required field 'type'.")

    for edge in edges:
        src = edge.get("sourceUnitTag") or edge.get("source", "")
        dst = edge.get("destUnitTag") or edge.get("target", "")
        if not src:
            errors.append("Edge is missing required field 'sourceUnitTag'.")
        elif src not in node_tags:
            errors.append(f"Edge references unknown source unit '{src}'.")
        if not dst:
            errors.append("Edge is missing required field 'destUnitTag'.")
        elif dst not in node_tags:
            errors.append(f"Edge references unknown destination unit '{dst}'.")

    return errors


def _event_base(solve_id: str) -> dict[str, str]:
    return {
        "solveId": solve_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ─── WebSocket solver endpoint ────────────────────────────────────────────────

@app.websocket("/ws/solve/{job_id}")
async def solve_websocket(websocket: WebSocket, job_id: str):
    """
    Flowsheet solve via WebSocket.

    Protocol:
      Client → {'type': 'solve', 'flowsheet': <FlowsheetPayload>}
      Server → {'type': 'status', 'message': '...'}   (progress)
      Server → {'type': 'result', 'unitTag': '...', 'streams': {...}}
      Server → {'type': 'done', 'iteration': N, 'maxError': E}
      Server → {'type': 'error', 'message': '...'}
    """
    await websocket.accept()
    logger.info("WebSocket connection accepted: job_id=%s", job_id)
    thermo = ThermoHelper()
    solve_id = job_id

    try:
        raw = await websocket.receive_text()
        payload = json.loads(raw)

        if payload.get("type") != "solve":
            await websocket.send_json({
                **_event_base(solve_id),
                "type": "error",
                "message": "Expected type='solve'",
            })
            return

        flowsheet = payload.get("flowsheet", {})
        nodes: list[dict] = flowsheet.get("nodes", [])
        edges: list[dict] = flowsheet.get("edges", [])
        validation_errors = _validate_flowsheet_payload(nodes, edges)
        if validation_errors:
            await websocket.send_json({
                **_event_base(solve_id),
                "type": "error",
                "message": validation_errors[0],
                "detail": " ".join(validation_errors),
            })
            return

        ordered_nodes = _topological_sort(nodes, edges)

        # Build a map of edge streams by destination unit tag so unit inputs are gathered correctly.
        edge_streams: dict[str, list[StreamDataPy]] = {}
        for edge in edges:
            dst = edge.get("destUnitTag") or edge.get("target", "")
            if edge.get("stream"):
                stream = _stream_from_dict(edge["stream"])
                edge_streams.setdefault(dst, []).append(stream)

        max_error = 0.0
        solved_count = 0

        for node in ordered_nodes:
            unit_type: str = node.get("type", "")
            unit_tag: str = node.get("tag", "")
            config: dict = node.get("config", {})

            if unit_type == "Feeder":
                await websocket.send_json({
                    **_event_base(solve_id),
                    "type": "status",
                    "message": f"Using predefined feed for {unit_tag}",
                })
                continue

            if unit_type == "FeederSink":
                await websocket.send_json({
                    **_event_base(solve_id),
                    "type": "status",
                    "message": f"Receiving sink flow at {unit_tag}",
                })
                continue

            solver_fn = UNIT_SOLVERS.get(unit_type)
            if solver_fn is None:
                await websocket.send_json({
                    **_event_base(solve_id),
                    "type": "status",
                    "message": f"No solver for unit type '{unit_type}' ({unit_tag}) — skipping",
                })
                continue

            input_streams = edge_streams.get(unit_tag, [])

            await websocket.send_json({
                **_event_base(solve_id),
                "type": "status",
                "message": f"Solving {unit_tag} ({unit_type})",
            })

            try:
                result_streams: dict[str, StreamDataPy] = solver_fn(
                    input_streams, config, thermo
                )
                serialised = {k: _stream_to_dict(v) for k, v in result_streams.items()}
                await websocket.send_json({
                    **_event_base(solve_id),
                    "type": "result",
                    "unitTag": unit_tag,
                    "streams": serialised,
                })

                # Route this unit's outputs onto downstream edges so later units receive them as inputs.
                outgoing_edges = [
                    edge for edge in edges
                    if (edge.get("sourceUnitTag") or edge.get("source", "")) == unit_tag
                ]
                output_streams = [
                    (name, stream)
                    for name, stream in result_streams.items()
                    if not str(name).startswith("_")
                ]
                for index, edge in enumerate(outgoing_edges):
                    dst = edge.get("destUnitTag") or edge.get("target", "")
                    if not dst:
                        continue
                    source_port_key = edge.get("sourcePortKey")
                    matched_output = None
                    if source_port_key:
                        matched_output = next(
                            ((name, stream) for name, stream in output_streams if name == source_port_key),
                            None,
                        )
                    if matched_output is not None:
                        routed_stream = matched_output[1]
                    elif index < len(output_streams):
                        routed_stream = output_streams[index][1]
                    elif output_streams:
                        routed_stream = output_streams[-1][1]
                    else:
                        routed_stream = thermo.make_empty_stream()

                    routed_stream.sourceUnitTag = unit_tag
                    routed_stream.destUnitTag = dst
                    edge_streams.setdefault(dst, []).append(routed_stream)

                solved_count += 1
            except Exception as exc:
                logger.exception("Error solving %s", unit_tag)
                await websocket.send_json({
                    **_event_base(solve_id),
                    "type": "error",
                    "message": f"Error solving {unit_tag}: {exc}",
                    "unitTag": unit_tag,
                })

            # Yield control briefly so the event loop stays responsive
            await asyncio.sleep(0)

        await websocket.send_json({
            **_event_base(solve_id),
            "type": "done",
            "iteration": 1,
            "maxError": max_error,
            "solvedUnits": solved_count,
        })

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: job_id=%s", job_id)
    except Exception as exc:
        logger.exception("Unhandled error in solver WebSocket")
        try:
            await websocket.send_json({
                **_event_base(solve_id),
                "type": "error",
                "message": str(exc),
            })
        except Exception:
            pass


# ─── Health check ─────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "version": "1.0.0"}
