# Prompt 04: Backend connection status and safe solving

**Depends on:** 01.
**Effort:** S

## Goal

The most common failure a new user hits is "the Python backend is not running". Today they find out via an error toast after pressing Solve, having already lost their previous results. Make backend state visible at all times, make Solve impossible when it cannot succeed, and never discard results before a new solve has actually started.

## Why

- `solverService.solve()` calls `resetProjectResults()` before opening the socket; a connection failure leaves the project with no streams.
- No health polling; `GET /health` exists in `main.py` but nothing calls it.
- `StatusBar` shows "Iter: — / Max Error: —", which is meaningless for a single-pass solver.
- Error copy: "WebSocket connection to backend failed", "Received invalid message shape from backend".

## In scope

- **Health poller** (`src/services/backendStatus.ts`): fetch `/health` (through the Vite proxy: add `/health` to `server.proxy` in `vite.config.ts`) every 5 s while the tab is visible, with exponential backoff up to 30 s when down. Store `{state: 'unknown'|'online'|'offline', version?, lastCheckedAt, latencyMs}` in `useSolverStore`.
- **Status bar** (`StatusBar.tsx`): left = connection pill (green "Solver online v1.0.0", red "Solver offline", grey "Checking…"), clicking it opens a popover with the exact start commands (copy button) and a "Retry now" action. Centre = active flowsheet name, unit count, stream count, selection summary. Right = last solve result ("Solved 4 units in 120 ms, 2 min ago" or "Not solved yet") and zoom percentage. Remove Iter/Max Error (prompt 14 may reintroduce iteration progress).
- **Solve button** is disabled with tooltip "Start the solver backend to solve" when offline. Keep it enabled in `unknown` state.
- **Results preservation**: do not clear existing streams until the `onopen` handler has successfully sent the payload. Instead mark them stale (`useSolverStore.resultsStale = true`) when the project changes after a solve, and render stale results with reduced opacity and a "Results are out of date, solve again" banner in the Results dock. Clear on first `result` message of a new solve.
- **Copy rewrite**: every user-facing solver message in `solverService.ts` and `main.py` gets plain language. Examples: "Could not reach the solver. Start it with `npm run dev:backend` and try again." / "The solver sent an unexpected reply. This is a bug; see details." Keep the technical text in the toast `detail` field.
- **Backend `/health`** returns `{status, version, supportedUnitTypes: [...]}` (from `UNIT_SOLVERS`) so the frontend can later tell which units are solvable without hard-coding (used by prompt 07).

## Out of scope

Retrying a failed solve automatically, the validation policy (09), multi-flowsheet (09).

## Acceptance criteria

- With the backend stopped, the status bar shows "Solver offline" within 5 s of launch and the Solve button is disabled with an explanatory tooltip; clicking the pill shows copyable start instructions.
- Start the backend: pill turns green within 10 s without reloading, Solve enables.
- Solve an example, then edit a Feeder flow: results stay visible but dimmed with an out-of-date banner; solving again replaces them.
- Kill the backend and press Solve (in the window before the poller notices): previous results remain, error toast uses the plain-language copy.

## Verification

```
npm run check && npm test
cd flowsim-backend && python -m pytest -q     # add a test for the extended /health payload
```
