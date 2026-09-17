# Prompt 10: Results dock consolidation and inspector

**Depends on:** 06, 08, 09.
**Effort:** M

## Goal

One obvious place for each kind of information. Today stream numbers appear in the right-side Access Window "Results" tab, the bottom dock "Selection" tab, the "Streams" table, and the edge hover badge; the dock has eight tabs; a single click opens the side panel and a canvas click closes it.

## Why

- `FlowsheetCanvas.onNodeClick` opens the right panel; `onPaneClick` closes it; double-click additionally opens the bottom dock on "Selection".
- `ResultsPanel` tabs: selection, streams, units, balance, audit, diagnostics, connectivity, readiness (prompt 09 already merged audit+diagnostics into Log and connectivity+readiness into Problems).
- Panels have fixed widths (`w-64`, `w-96`), the right panel animates to `w-0` while keeping its content mounted.

## In scope

- **Inspector (right panel)** is the single place for the *selected thing*: unit (Config, Feed, Results, Connections tabs) or stream (Properties, Composition). Selection follows single click; the panel stays open until the user closes it or presses Escape (canvas click just clears selection and shows the "Nothing selected" state with a hint). Double-click focuses the Config tab. Remove the bottom dock's "Selection" tab.
- **Results dock** tabs become: **Streams** (all streams of the active flowsheet, toggle "all flowsheets"), **Units** (per-unit status, in/out flow, mass closure), **Balance** (overall), **Problems**, **Log**. Column headers carry display units. Add: column chooser (persisted), copy table to clipboard (TSV), "Export this table" (CSV), row click selects the stream/unit on the canvas and in the inspector, and a stream composition drawer inside the Streams table (expand row to see species). Empty states explain what to do ("Solve to see stream results").
- **Layout**: make the left panel, inspector and dock resizable by drag (`react-resizable-panels` is acceptable to add; otherwise reuse the existing drag logic from `ResultsPanel`). Persist sizes and open/closed state in `localStorage`. Unmount the inspector when closed (no `w-0` overflow trick). Minimum widths so panels cannot vanish; a "Reset layout" item under View.
- **View menu** in the TopBar (View: Inspector, Results, Trend, Minimap, Stream labels, Reset layout, Zoom to fit) so panel toggles are discoverable without icons.
- **Edge hover badge**: keep, but reduce to tag + flow; full data lives in the inspector.

## Out of scope

Charting of results, trend window redesign.

## Acceptance criteria

- Click a unit: inspector opens on Config; click the canvas: inspector shows "Nothing selected"; press Escape: inspector closes. Double-click a stream: inspector shows its properties.
- Dock has exactly five tabs; Streams shows unit headers, supports column hide/show, copy, export, and row-click selection.
- Drag the inspector wider; reload: width persists. View > Reset layout restores defaults.
- With no solve yet, every dock tab has a helpful empty state.

## Verification

```
npm run check && npm test
```
