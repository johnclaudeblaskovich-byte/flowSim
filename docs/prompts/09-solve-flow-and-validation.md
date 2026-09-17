# Prompt 09: Solve flow: active flowsheet, non-blocking validation, quieter feedback

**Depends on:** 01, 04, 07.
**Effort:** M

## Goal

Solving should do what the user expects (solve the flowsheet they are looking at), should not interrupt them with a modal for every warning, and should tell them what happened in one place instead of a stream of toasts.

## Why

- `serializeFlowsheetForSolve` always serialises `project.flowsheets[0]`; the active tab is ignored.
- `TopBar.handleStartSolve` opens the modal `ValidationDialog` when `errors.length > 0 || warnings.length > 0`. Nearly every project has a warning (unconnected sink, feeder without explicit composition), so every solve is interrupted.
- Feedback per solve: "Solving…" info toast, per-unit audit entries, "Solve complete" success toast, plus validation toasts. Warnings are also shown in four other places (canvas badges, Connectivity tab, Readiness tab, Validation dialog).

## In scope

- **Solve target**: the solve orchestrator (prompt 01) solves the **active flowsheet**. Add a split-button next to Solve: "Solve this flowsheet" (default, F5) and "Solve all flowsheets" (Shift+F5) which runs them sequentially and reports per flowsheet. `serializeFlowsheetForSolve(project, flowsheetId)`; `solverService` records `flowsheetId` on the solve so `applyUnitResult` writes only into that flowsheet. Unit tags are unique per project already (validator), so the backend needs no change.
- **Validation policy**: errors block (same dialog, retitled "Cannot solve yet" with the count and Go-to links). Warnings do **not** open a dialog; instead the solve proceeds and the Problems panel (below) shows them. Add a Settings > Editor option "Ask before solving with warnings" (default off) for users who want the old behaviour. Also validate on every project change (already memoised in `FlowsheetCanvas`) and show a count badge on the Problems tab.
- **Problems panel**: a new Results-dock tab "Problems" (prompt 10 will consolidate tabs; create it now as the single home for validation issues) listing errors and warnings with severity icon, flowsheet, unit/stream tag, plain-language message, and a Go-to action. This replaces the `Connectivity` and `Readiness` tabs' issue lists (keep the readiness snapshot export under File > Export). Clicking a canvas badge also opens Problems filtered to that unit.
- **Quieter feedback**: remove the "Solving…" toast; show progress in the status bar ("Solving THKR_001 (2 of 4)…"). On completion, one toast: success ("Solved 4 units in 120 ms") or failure ("Solve stopped at THKR_001: <message>" with a "Show log" action that opens the Log tab). Route all `status`/`result` audit entries to a single "Log" tab (merge today's Audit and Diagnostics into one table with columns time, level, unit, message, expandable detail) and stop toasting them.
- **Stale marker**: after a successful solve, further edits set `resultsStale` (prompt 04) and the Solve button gets a small dot to say "results out of date".

## Out of scope

Iterative convergence (14), results table redesign (10).

## Acceptance criteria

- Two flowsheets, second one active, press F5: only the second one's units change status; the first keeps its old results. Shift+F5 solves both and the log shows two sections.
- A project with a warning but no errors solves immediately; the Problems tab shows the warning with a Go-to link.
- A project with an error shows the "Cannot solve yet" dialog listing the error.
- One solve produces exactly one toast.
- The Log tab shows every backend status line with timestamps; Audit and Diagnostics tabs no longer exist.

## Verification

```
npm run check && npm test
```
Add vitest tests: `serializeFlowsheetForSolve(project, id)` picks the right flowsheet; `applyUnitResult` does not leak into other flowsheets.
