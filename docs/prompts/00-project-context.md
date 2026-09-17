# FlowSim: Project Context (paste this before every prompt)

You are working in the FlowSim repository, a browser-based steady-state process flowsheet simulator in the style of SysCAD. Users are process/metallurgical engineers who draw a flowsheet (feeders, thickeners, filters, cyclones, screens, CCD washers, sinks), configure each unit, press Solve, and read stream mass balances.

## Stack and layout

```
src/
  App.tsx                     app shell: TopBar, LeftNav, left panel, FlowsheetTabs, FlowsheetCanvas, AccessWindowPanel, TrendWindow, ResultsPanel, StatusBar, dialogs
  store/index.ts              Zustand + Immer stores: useProjectStore, useCanvasStore, useSolverStore, useUIStore, useTrendStore; createDefaultProject()
  store/historyStore.ts       undo/redo snapshots (pushHistory/undo/redo)
  types/index.ts              Project, Flowsheet, UnitNode, PipeEdge, StreamData, UnitModelType, SolverState, ...
  components/
    layout/                   TopBar, LeftNav, StatusBar, FlowsheetTabs, AccessWindowPanel (right-side inspector)
    canvas/                   FlowsheetCanvas (React Flow), CanvasToolbar, FindDialog, nodes/UnitNodeRenderer, edges/PipeEdgeRenderer, symbols/, annotations/
    palette/UnitPalette.tsx   drag source for unit types
    panels/ProjectExplorer.tsx
    accessWindow/             FeederAccessWindow, FilterAccessWindow, ThickenerAccessWindow, SizeDistributionTab, PGMAccessWindowTab
    results/ResultsPanel.tsx  bottom dock with 8 tabs
    dialogs/                  NewProjectWizard, SetupWindow, ValidationDialog, ExampleProjectDialog, DxfMappingDialog
    ui/ToastSystem.tsx        toast() from hooks/useToastStore
  services/
    solverService.ts          WebSocket client; drives useSolverStore and writes streams back into useProjectStore
    solveProtocol.ts          serializeFlowsheetForSolve, buildFeederStream, validateSolverMessage, mapStreamsToOutgoingEdges
    projectValidator.ts       validateProject(project) -> { valid, errors[], warnings[] }
    projectIO.ts              .fsim zip save/load;  projectSchema.ts: CURRENT_PROJECT_SCHEMA_VERSION + migrateProject()
    exportService.ts, reportGenerator.ts, tagRegistry.ts, historian.ts, readinessReport.ts, solveDiagnostics.ts
  lib/                        routing.ts (MULTI_OUTPUT_UNIT_ROUTES), unitConversion.ts (toSI/fromSI, unused by UI today), speciesCatalog.ts, tagUtils.ts, utils.ts (cn)
  hooks/useKeyboardShortcuts.ts
  pgm/                        PGM scripting language (lexer, parser, interpreter, Monaco)
  tests/                      vitest (node environment)
flowsim-backend/
  main.py                     FastAPI; WebSocket /ws/solve/{job_id}; GET /health; UNIT_SOLVERS dispatch table
  solver/units/{filter,thickener,ccd_washer,cyclone,screen}.py   solve_x(input_streams, config, thermo) -> {route_name: StreamDataPy}
  solver/thermo.py            ThermoHelper, StreamDataPy, SpeciesFlowPy, mix_streams
  solver/probal.py, graph.py, convergence.py   sequential solver, cycle detection, Wegstein (used by tests/examples only, not by main.py)
  tests/                      pytest
public/examples/              12 example .fsim projects + inventory.json (served by Vite); examples/ is a duplicate for the Python runner
```

Frontend: React 19, Vite 8, TypeScript 5.9 (strict, `noUnusedLocals`), Tailwind 3 utility classes, Radix UI primitives (`@radix-ui/react-*`), `lucide-react` icons, React Flow 12 (`@xyflow/react`), Zustand 5 with the `immer` middleware, `@/` path alias to `src/`.
Backend: Python 3.11, FastAPI, uvicorn. The frontend dev server proxies `/ws` to `ws://localhost:8000`.

## Key facts you must respect

- **Units in the data model are SI**: kg/s, K, Pa. Display conversion happens in components. `UnitPreferences` (°C/K/°F, kPa/bar/psi/atm, t/h/kg/s/t/d) live in `useUIStore`.
- **Solve protocol** (keep `solveProtocol.ts` and `main.py` in sync): client sends `{type:'solve', flowsheet:{nodes:[{tag,type,config,enabled}], edges:[{sourceUnitTag,destUnitTag,sourcePortKey?,targetPortKey?,stream?}]}}`; server streams `status`, `result` (`{unitTag, streams:{routeName: StreamData}}`), `done`, `error` messages, each with `solveId` and `timestamp`.
- **Multi-output units** (`src/lib/routing.ts`): Thickener overflow/underflow, Filter cake/filtrate, Cyclone overflow/underflow, Screen oversize/undersize, Washer product_liquor/washed_solids. An edge's `sourcePortKey` names which output it carries; if missing, outputs are assigned by connection order.
- **Only these unit types have solvers**: Filter, Thickener, Washer, Cyclone, Screen. Feeder and FeederSink are pass-through. Everything else in the palette is skipped by the backend today.
- **Backend config keys** (snake_case): Filter `solid_recovery, moisture_content, wash_efficiency`; Thickener `solid_recovery, underflow_density`; Cyclone `efficiency, d50_microns, liquid_split_uf`; Screen `aperture_size_microns, efficiency, num_decks`; Washer `num_stages, wash_water_flow, solid_recovery_per_stage, wash_efficiency_per_stage`. Feeder config is camelCase: `massFlow, temperature, pressure, solidFraction, species:{id:fraction}, speciesPhases:{id:Phase}`.
- **Project schema**: any change to the `Project` shape bumps `CURRENT_PROJECT_SCHEMA_VERSION` and adds a migration in `projectSchema.ts`. All 12 example projects under `public/examples/` must still open.
- **Styling**: Tailwind utilities, `cn()` from `@/lib/utils`, blue-500 accent, gray-200 borders, 12 px (`text-xs`) body text in panels. Keep new UI consistent with the existing look; do not introduce a new component library.
- **State**: put new UI state in `useUIStore`, project data in `useProjectStore`. Prefer store selectors (`useUIStore((s) => s.x)`) over destructuring the whole store.

## Commands

```
npm install                       # once
npm run dev                       # Vite on http://localhost:5173
npm run dev:backend               # uvicorn on :8000 (Windows script today; prompt 02 makes it cross-platform)
npx tsc -b                        # typecheck (must pass)
npm run lint                      # eslint (must pass after prompt 02)
npm test                          # vitest, 115 tests
cd flowsim-backend && python -m pytest -q     # 92 tests (needs pip install -r requirements.txt httpx2 pytest)
```

## Working rules

- Finish the whole prompt. Do not leave TODOs for the parts that are hard.
- Do not widen scope beyond the "In scope" list; note anything you noticed but did not change in your final summary.
- Every prompt ends with the same gate: `npx tsc -b`, `npm run lint`, `npm test`, backend pytest, and a manual check of the acceptance criteria in a running app against at least one example project (File > Open Example Project).
- Write plain-language UI copy. The user is an engineer, not a developer: never show "WebSocket", "payload", "sourcePortKey" or "edge" in the UI. Say "solver", "connection", "outlet", "stream".
- Commit with a clear message per prompt.
