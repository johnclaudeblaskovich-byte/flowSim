# Prompt 08: Named ports and visible routing

**Depends on:** 01, 07 (unit registry with inlets/outlets).
**Effort:** L

## Goal

Make stream routing something the user does by dragging from a labelled outlet, not something they discover from a warning and fix in a dropdown. A Thickener should visibly have an Overflow port and an Underflow port.

## Why

- `UnitNodeRenderer` renders one anonymous target handle (left) and one source handle (right), invisible until hover.
- `FlowsheetCanvas.onConnect` assigns `sourcePortKey` by connection order from `getOutputRoutes`; the only way to change it is the select in the Connectivity tab.
- Validation copy: "Stream … is missing an explicit output routing assignment from …".
- Example projects tag streams `P_001`; the app generates `FDR_001_TO_THKR_001`.
- `PipeEdge.ports` on `UnitNode` is always `[]`.

## In scope

- **Ports from the registry**: `unitRegistry` `inlets`/`outlets` (e.g. Thickener: inlets `[feed]`, outlets `[overflow (top-right), underflow (bottom-right)]`; Cyclone: `overflow` top, `underflow` bottom; Filter: `cake` right, `filtrate` bottom; Screen: `oversize` right, `undersize` bottom; Washer: `product_liquor` top-right, `washed_solids` bottom-right; Feeder: one outlet; Sink: one inlet; single-outlet units: `out`). Each port has `{key, label, side, offset}`. Populate `UnitNode.ports` from the registry on create and on load (migration fills missing ports; schema bump).
- **Rendering**: `UnitNodeRenderer` renders one React Flow `Handle` per port with `id = port.key`, always visible as a small circle (bigger hit area via CSS), and a tiny label on hover or when the node is selected ("Overflow"). Inlet handles blue, outlet handles grey, connected ports filled. Multiple inlets are allowed on a single inlet port (maxConnections from the registry, default unlimited for inlets, 1 for outlets).
- **Connection semantics**: `onConnect` sets `sourcePortKey = connection.sourceHandle`, `targetPortKey = connection.targetHandle`; drop the order-based fallback for new edges. `isValidConnection` rejects a second edge from an outlet that already has one, with a toast explaining why ("Overflow already has a stream. Delete it first or connect to Underflow."). Rejections for other rules (self-connection, Feeder as target, controllers) also toast a short reason, once per drag.
- **Edge labels**: `PipeEdgeRenderer` shows the stream tag near the source end and the outlet name as a small chip; when solved, the mass flow in display units. Add a per-flowsheet setting to hide labels (Settings > Editor, prompt 06).
- **Stream tags**: default to `S_001`, `S_002`, … (SysCAD style, project-unique, with the existing `_2` suffix collision rule) and let users rename a stream from the stream inspector and via double-click on the label. Keep loading old `_TO_` and `P_` tags unchanged.
- **Migration of existing edges**: when a loaded edge has no `sourcePortKey`, assign it by the same order rule as today and mark the project modified; when it has a `sourcePortKey` that is not a registry port, keep it and let validation flag it.
- **Validator copy**: replace routing messages with: "Thickener THKR_001 has two outlet streams but neither says whether it is Overflow or Underflow. Drag each stream to the right outlet port or pick one in the stream inspector." Keep the machine-readable `edgeId` so "Go to stream" still works.
- **Backend**: `main.py` already prefers `sourcePortKey`; keep it, but when a solvable unit has an outlet with no edge, send a `status` message "Underflow of THKR_001 is not connected; its flow is discarded" so the user sees where mass goes.

## Out of scope

Curved/orthogonal edge routing, auto-layout, cross-flowsheet connectors.

## Acceptance criteria

- Drop a Feeder and a Thickener: the Thickener shows one inlet and two labelled outlets. Drag from Overflow to a Sink: the new stream's inspector shows "Outlet: Overflow" and the edge chip reads "Overflow".
- Try to drag a second stream from Overflow: rejected with a toast.
- Open "Three Stage CCD Thickener" (old file): it loads, every edge has a port, validation shows no routing warnings, and it solves with the same numbers as before.
- New streams are named `S_001`, `S_002`; renaming to "Thickener U/F" works and is used in results.
- Leave Underflow unconnected and solve: the log shows the discard message.

## Verification

```
npm run check && npm test
cd flowsim-backend && python -m pytest -q
```
Add vitest tests for the port migration and for `mapStreamsToOutgoingEdges` with explicit port keys.
