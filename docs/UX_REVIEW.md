# FlowSim UX & Codebase Review

Reviewed on branch `main` at commit `4a8924d` (Phase 14 + prod-readiness batch).
This document is the evidence base for the prompt package in `docs/prompts/`.

## What FlowSim is

A browser-based, SysCAD-style steady-state process flowsheet simulator.

| Layer | Stack | Entry points |
|---|---|---|
| Frontend | React 19, Vite 8, TypeScript 5.9, Tailwind 3, Zustand + Immer, React Flow (`@xyflow/react`), Radix UI, Monaco, Recharts | `src/App.tsx`, `src/store/index.ts`, `src/types/index.ts` |
| Solver backend | Python 3.11, FastAPI, WebSocket at `/ws/solve/{job_id}` | `flowsim-backend/main.py`, `flowsim-backend/solver/units/*.py` |
| Persistence | `.fsim` zip (project.json + controls/ + reactions/ + config/species.json), 30 s localStorage autosave | `src/services/projectIO.ts`, `src/services/projectSchema.ts` |
| Examples | 12 verified example projects, duplicated in `examples/` and `public/examples/` | `public/examples/inventory.json` |

## Health of the repo's own checks

| Check | Command | Result |
|---|---|---|
| Typecheck | `npx tsc -b` | passes |
| Frontend tests | `npm test` | 115 passed (5 files) |
| Backend tests | `python -m pytest` in `flowsim-backend/` | 92 passed, but only after `pip install httpx2` (not in `requirements.txt`) |
| Lint | `npm run lint` | **fails: 31 errors, 3 warnings** (React Compiler rules, unused vars, useless escapes, fast-refresh exports) |
| CI | none | no `.github/` directory |
| Scripts | `npm run dev:backend` | Windows-only (`.cmd`), fails on macOS/Linux |

## The core user journey today

1. App opens on an empty "Untitled Project" with **no species selected** and the Explorer tab active. Nothing tells the user to open the Unit Palette (the wrench icon) or drag a unit.
2. User drags units, connects them, presses Solve.
3. Validation fails with "No species selected. Add species via File > New Project wizard." The **Species panel is a "coming soon" stub**, so the only way to add species is to create a new project, which discards the flowsheet.
4. The user rebuilds, presses Solve again. Almost every project has at least one warning, and **any warning opens the blocking validation dialog**, so "Solve Anyway" becomes a reflex.
5. If the Python backend is not running, the first sign is an error toast after pressing Solve. There is no persistent connection indicator, and solving first **wipes all previous results** (`resetProjectResults`) before the connection fails.

## Findings

Severity: **P0** = data loss or a control that does nothing; **P1** = blocks or confuses the main journey; **P2** = friction and polish.

### P0: correctness bugs that undermine trust

| # | Finding | Where |
|---|---|---|
| 1 | **Autosave clobbers the previous session.** The 30 s autosave interval starts on mount and writes the current (empty) project to `flowsim-autosave`. If the user does not click "Restore" within 30 s, last session's work is overwritten. | `src/App.tsx:62-80` |
| 2 | **F5 does not solve.** The shortcut calls the store's `startSolve()`, which only flips status to `solving`; it never calls `solverService.solve()` or validation. Status shows "Solving" forever. | `src/hooks/useKeyboardShortcuts.ts:60-66` |
| 3 | **Stop does not stop.** The Stop button and F7 call the store's `stopSolve()`, which never closes the WebSocket; backend results keep arriving and flip status back to `converged`. | `src/components/layout/TopBar.tsx:283`, `src/store/index.ts` |
| 4 | **Pause is a no-op.** The backend has no pause protocol; the button only changes a status label. | `src/store/index.ts`, `flowsim-backend/main.py` |
| 5 | **Undo/Redo never works.** `historyStore.pushHistory()` is never called anywhere, so Ctrl+Z/Ctrl+Y are bound to an empty stack. Deleting a unit (Delete key, no confirmation) is irreversible. | `src/store/historyStore.ts`, `grep pushHistory src` returns nothing |
| 6 | **Only the first flowsheet is ever solved.** `serializeFlowsheetForSolve` uses `project.flowsheets[0]` regardless of the active tab. Users on "Flowsheet 2" silently solve Flowsheet 1. | `src/services/solveProtocol.ts:127` |
| 7 | **Duplicate Flowsheet drops every connection** (`edges: []`). | `src/store/index.ts:duplicateFlowsheet` |
| 8 | **Select/Pan toggle does nothing.** `panMode` is local state never passed to React Flow. Titles promise "S" and "Space" shortcuts that do not exist. | `src/components/canvas/CanvasToolbar.tsx` |
| 9 | **Ctrl+N is advertised in the File menu but not bound.** F6/F7 are bound but not advertised. Ctrl+M (minimap) is undocumented. | `TopBar.tsx:195`, `useKeyboardShortcuts.ts` |
| 10 | **Access-window inputs show stale values.** `FilterAccessWindow` and `FeederAccessWindow` use uncontrolled `defaultValue` inputs and the panel renders them without a `key`, so clicking from one Filter to another keeps the first unit's numbers on screen. | `src/components/layout/AccessWindowPanel.tsx:470-473` |

### P1: blocks or confuses the main journey

| # | Finding | Where |
|---|---|---|
| 11 | **No species management after project creation.** Species and Controls nav tabs are "coming soon" placeholders; Explorer hard-codes `Scripts (0)` / `Reactions (0)` even though `pgmSources` and `reactionFiles` exist in the store. | `src/App.tsx:207-232`, `src/components/panels/ProjectExplorer.tsx:124-126` |
| 12 | **Unit preferences are collected and ignored.** The wizard asks for °C/K/°F, kPa/bar/psi, t/h/kg/s, but every display hard-codes `* 3.6`, `- 273.15`, `/ 1000`. `src/lib/unitConversion.ts` is unused by any component. Feeder inputs are in kg/s while every readout is t/h. | `ResultsPanel.tsx`, `AccessWindowPanel.tsx`, `PipeEdgeRenderer.tsx`, `FeederAccessWindow.tsx` |
| 13 | **23 unit types in the palette, 5 have solvers.** Tank, Tie, Splitter, Pump, Valve, heat units, controllers, Mill and Flash have no backend model; the solver just logs "No solver for unit type … skipping". The palette gives no hint which units work. | `flowsim-backend/main.py:UNIT_SOLVERS`, `src/components/palette/UnitPalette.tsx` |
| 14 | **Cyclone, Screen and Washer cannot be configured.** The backend reads `efficiency`, `d50_microns`, `liquid_split_uf`, `aperture_size_microns`, `num_stages`, `wash_water_flow`, `solid_recovery_per_stage`, `wash_efficiency_per_stage`, but there is no Config tab for those types. | `AccessWindowPanel.tsx:hasUnitConfig` |
| 15 | **Output routing is invisible.** Every node has one anonymous left handle and one right handle. For a Thickener the overflow/underflow assignment is decided by connection order and can only be changed from a dropdown in the Connectivity tab. Warnings use the internal term "output routing assignment". | `UnitNodeRenderer.tsx`, `FlowsheetCanvas.tsx:onConnect`, `projectValidator.ts` |
| 16 | **Validation dialog fires on any warning.** A Feeder without explicit composition or a unit with no connections triggers the modal every solve. | `TopBar.tsx:handleStartSolve` |
| 17 | **Backend connectivity is discovered by failure.** No health poll, no status-bar indicator, no in-app instructions; the Solve button is enabled even when nothing is listening on port 8000. | `solverService.ts` |
| 18 | **Solving discards results before it knows it can connect.** A failed connection leaves the user with no results at all. | `solverService.ts:resetProjectResults` |
| 19 | **No dirty-state.** No unsaved-changes indicator, no `beforeunload` guard, New Project wizard replaces the current project without confirmation, project name is only editable in the wizard (`setProjectName` exists but has no UI). | `App.tsx`, `NewProjectWizard.tsx:handleCreate`, `TopBar.tsx` |
| 20 | **"Save" is a browser download every time and "Save As" is identical to Save.** No File System Access API, no recent-files list. | `projectIO.ts`, `TopBar.tsx:handleSaveAs` |
| 21 | **Single click on a node opens the side panel; clicking the canvas closes it.** Double-click also opens the bottom Results dock. The same stream data is shown in four places: Access Window "Results" tab, Results dock "Selection", "Streams" and the edge hover badge. | `FlowsheetCanvas.tsx:onNodeClick/onPaneClick` |
| 22 | **Eight tabs in the Results dock** (Selection, Streams, Units, Balance, Audit, Diagnostics, Connectivity, Readiness). Audit and Diagnostics overlap; Connectivity and Readiness overlap with the validation dialog. | `ResultsPanel.tsx` |
| 23 | **Navigation model is inconsistent.** Four nav tabs swap the left panel; the Reactions tab replaces the whole canvas. The gear icon labelled "Settings" opens a unit enable/disable table, not settings. | `App.tsx`, `LeftNav.tsx`, `SetupWindow.tsx` |
| 24 | **Error text is developer-facing.** "Edge references unknown source unit", "sourcePortKey", "WebSocket connection to backend failed", "Received invalid message shape from backend." | `main.py`, `solverService.ts`, `projectValidator.ts` |
| 25 | **Status bar shows "Iter: — Max Error: —".** The backend is single-pass (always iteration 1, error 0), so this is noise. It could show connection state, unit/stream counts, zoom and last solve time. | `StatusBar.tsx` |

### P2: friction and polish

| # | Finding | Where |
|---|---|---|
| 26 | Toast noise: "Solving…" info toast on every start plus a success toast plus validation toasts. | `TopBar.tsx`, `solverService.ts` |
| 27 | Species catalog is 26 hard-coded entries with no molecular weights; `inferMolecularWeight` returns 0.1 kg/mol for everything but water. The default `Ore_Solid` species used by examples is not in the catalog. | `speciesCatalog.ts`, `solveProtocol.ts` |
| 28 | Accessibility: icon buttons in the TopBar and CanvasToolbar have tooltips/titles but no `aria-label`; context menus are plain `div`s with no keyboard navigation or Escape handling; no `focus-visible` styles; 9-10 px labels throughout; no reduced-motion handling; no dark mode. | `TopBar.tsx`, `CanvasToolbar.tsx`, `FlowsheetCanvas.tsx`, `PipeEdgeRenderer.tsx` |
| 29 | Fixed panel widths (`w-64`, `w-96`) with no resize; the right panel collapses to `w-0` with overflow hidden, so content stays mounted and focusable. | `App.tsx`, `AccessWindowPanel.tsx` |
| 30 | Browser tab title is "flowsim"; the TopBar has a dead "U" avatar; no app name or version anywhere in the UI. | `index.html`, `TopBar.tsx` |
| 31 | Minimap only toggles via undocumented Ctrl+M. No keyboard shortcut reference. | `FlowsheetCanvas.tsx` |
| 32 | Trend window and historian exist, but with a single-pass steady-state solver there is nothing to trend. | `TrendWindow.tsx`, `historian.ts` |
| 33 | README does not say what the app is, has no screenshots, no user guide, Windows-only instructions. | `README.md` |
| 34 | Examples are duplicated in `examples/` and `public/examples/` with no sync step. | repo root |
| 35 | Stream tags: examples use `P_001`, the app generates `FDR_001_TO_THKR_001`. | `FlowsheetCanvas.tsx:onConnect`, `examples/_generate_examples.py` |
| 36 | `FlashTank2` and `CrushingMill` are in `UnitModelType` but not in any palette category. | `UnitPalette.tsx:CATEGORIES` |

## What is already good

- Clean separation of stores (project / canvas / solver / UI / trend) with Immer.
- A real `.fsim` schema with versioning and migrations.
- Backend protocol validation on both sides (`solveProtocol.ts`, `_validate_flowsheet_payload`).
- Validation results are rendered on the canvas (red/amber borders, dashed edges) and each issue has a "Go to unit/stream" link.
- Comprehensive export surface (Excel, CSV, SVG, PNG, JSON, report builder).
- 12 example projects with a verification report.
- Good test coverage for the pieces that have tests (PGM lexer/parser, protocol, thermodynamics, all five unit models).

## Recommended order of work

See `docs/prompts/README.md`. In short: fix the P0 bugs and make `npm run lint` green first (prompts 01-02), then the first-run experience and backend connectivity (03-04), then the editing loop (05-09), then results, shortcuts, accessibility and docs (10-13), and finally the solver engine (14).
