"""
Regression tests for the FastAPI WebSocket solver endpoint.

Run with:
  python -m pytest flowsim-backend/tests/test_websocket_solver.py -v
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def make_feeder_stream():
    return {
        "tag": "FDR_001",
        "Qm": 10.0,
        "Qv": 0.0,
        "QmSolid": 3.0,
        "QmLiquid": 7.0,
        "QmVapour": 0.0,
        "T": 298.15,
        "P": 101325.0,
        "H": 0.0,
        "rho": 1000.0,
        "Cp": 4186.0,
        "species": {
            "Water": {
                "speciesId": "Water",
                "massFlow": 7.0,
                "moleFlow": 388.888,
                "massFraction": 0.7,
                "moleFraction": 0.0,
                "phase": "Liquid",
            },
            "SiO2": {
                "speciesId": "SiO2",
                "massFlow": 3.0,
                "moleFlow": 30.0,
                "massFraction": 0.3,
                "moleFraction": 0.0,
                "phase": "Solid",
            },
        },
        "solidFraction": 0.3,
        "liquidFraction": 0.7,
        "vapourFraction": 0.0,
        "sourceUnitTag": "FDR_001",
        "destUnitTag": "THKR_001",
        "solved": True,
        "errors": [],
    }


def collect_messages(ws):
    messages = []
    while True:
        msg = ws.receive_json()
        messages.append(msg)
        if msg.get("type") in {"done", "error"}:
            break
    return messages


def test_websocket_routes_feeder_into_thickener_and_to_both_sinks():
    payload = {
        "type": "solve",
        "flowsheet": {
            "nodes": [
                {"tag": "FDR_001", "type": "Feeder", "config": {}, "enabled": True},
                {
                    "tag": "THKR_001",
                    "type": "Thickener",
                    "config": {"solid_recovery": 0.98, "underflow_density": 1400.0},
                    "enabled": True,
                },
                {"tag": "SNK_001", "type": "FeederSink", "config": {}, "enabled": True},
                {"tag": "SNK_002", "type": "FeederSink", "config": {}, "enabled": True},
            ],
            "edges": [
                {
                    "sourceUnitTag": "FDR_001",
                    "destUnitTag": "THKR_001",
                    "stream": make_feeder_stream(),
                },
                {
                    "sourceUnitTag": "THKR_001",
                    "destUnitTag": "SNK_001",
                    "sourcePortKey": "overflow",
                },
                {
                    "sourceUnitTag": "THKR_001",
                    "destUnitTag": "SNK_002",
                    "sourcePortKey": "underflow",
                },
            ],
        },
    }

    with client.websocket_connect("/ws/solve/test-job") as ws:
        ws.send_text(json.dumps(payload))
        messages = collect_messages(ws)

    result_messages = [msg for msg in messages if msg.get("type") == "result"]
    thickener_result = next(msg for msg in result_messages if msg.get("unitTag") == "THKR_001")

    assert "overflow" in thickener_result["streams"]
    assert "underflow" in thickener_result["streams"]
    assert thickener_result["streams"]["overflow"]["Qm"] > 0
    assert thickener_result["streams"]["underflow"]["Qm"] > 0

    done = messages[-1]
    assert done["type"] == "done"
    assert done["solvedUnits"] >= 1


def test_websocket_rejects_invalid_payload_with_protocol_error():
    payload = {
        "type": "solve",
        "flowsheet": {
            "nodes": [
                {"tag": "THKR_001", "type": "Thickener", "config": {}, "enabled": True},
            ],
            "edges": [
                {
                    "sourceUnitTag": "MISSING",
                    "destUnitTag": "THKR_001",
                },
            ],
        },
    }

    with client.websocket_connect("/ws/solve/test-invalid") as ws:
        ws.send_text(json.dumps(payload))
        message = ws.receive_json()

    assert message["type"] == "error"
    assert "unknown source unit" in message["detail"].lower()
