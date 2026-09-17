# Prompt 14: Solver engine: pass-through units and recycle loops

**Depends on:** 04, 07, 08, 09.
**Effort:** L

## Goal

Make more of the palette real and make the solver honest about iteration. Users draw Tanks, Splitters, Ties and Pumps because they exist in the palette; today the backend silently skips them, and any recycle loop falls back to "payload order" with no convergence at all.

## Why

- `flowsim-backend/main.py` solves once in topological order; on a cycle `_topological_sort` logs a warning and returns nodes in payload order. `solver/graph.py` (cycle detection, tear selection) and `solver/convergence.py` (Wegstein) exist but are only used by tests.
- `UNIT_SOLVERS` covers 5 types. `Project.solverSettings` (max iterations, tolerance, damping, tear method) is stored but never sent to the backend.
- The status bar's iteration/error fields were removed in prompt 04 because they were always 1 / 0.

## In scope

- **Simple unit models** in `solver/units/`: `Tank`/`Tie`/`Pipe`/`Pump`/`Valve` = mix inlets, pass through (Pump/Valve may apply a pressure change from config); `Splitter` = split by mass fraction to N outlets (config `splits: {outletKey: fraction}`, registry outlets `out_1..out_4`); `Heater`/`Cooler` = pass through with a temperature change or duty (mass-balance mode ignores enthalpy but sets T); `MakeupSource` = adds a fixed flow. Register each in `UNIT_SOLVERS`, the unit registry (prompt 07: status `solvable`, config schema, ports), and add pytest coverage. Controllers, FlashTank, HeatExchanger, CrushingMill stay `planned`.
- **Recycle convergence** in `main.py`: build the graph, detect cycles with `find_cycles`, choose tears with `find_minimum_tears`, initialise tear streams (empty or last solved values), iterate: solve in topological order of the torn graph, compare tear stream totals and per-species flows with `check_converged`, apply `DirectSubstitution` or `WegsteinAccelerator` per `solverSettings.tearMethod`, up to `maxIterations`. Send an `iteration` message each pass (`{type:'iteration', iteration, maxError, tearStreams:[...]}`) and finish with `done` carrying real `iteration`/`maxError`/`converged`. On non-convergence send `done` with `converged: false` and the worst tear stream named.
- **Protocol**: extend the client payload with `solverSettings`; extend `validateSolverMessage` and `solverService` for `iteration`; restore iteration count and max error to the status bar during a solve; show tear streams in the Log and a "did not converge" toast with the worst stream.
- **Cancel**: the WebSocket handler checks for a client `{type:'cancel'}` message between iterations (use `asyncio.wait` on receive) so Stop actually stops long solves. Optionally reintroduce Pause as "pause after this iteration" now that a real protocol exists.
- **Feeder from upstream**: allow a Feeder to be marked "cross-page connector" paired with a `FeederSink` of the same tag on another flowsheet, and have "Solve all" (prompt 09) pass the sink's stream to the paired feeder. This is what the dashed `FeederSink` border already hints at.
- **Examples**: add "Splitter and Recycle Example" (skipped in `examples/VERIFICATION_REPORT.md` today) and update `examples/run_examples.py` to use the same iterative solver path as `main.py` (extract it into `solver/probal.py` so runner and server share code).

## Out of scope

Energy balance, reactions, dynamic solving, PGM-driven controllers.

## Acceptance criteria

- A Splitter with a 30 % recycle back to a Tank ahead of a Thickener converges in under 50 iterations with Wegstein and the status bar shows iterations counting up; mass closure is within 1e-6.
- Stop during a long solve halts within one iteration.
- Every unit in the palette that is not marked "soon" produces outlet streams when solved.
- All old examples still produce the same numbers; the new recycle example passes `examples/run_examples.py`.

## Verification

```
npm run check && npm test
cd flowsim-backend && python -m pytest -q
python examples/run_examples.py && git diff --stat examples/VERIFICATION_REPORT.md
```
