# Prompt 01: Fix dead controls and data loss

**Depends on:** nothing. Run this first.
**Effort:** M

## Goal

Make every existing control in the shell do what its label says, and stop the app from destroying user work. This is the foundation for every later UX prompt: there is no point polishing a Solve button that F5 cannot trigger or an Undo that has an empty stack.

## Why (from `docs/UX_REVIEW.md`, P0 items 1-10)

1. `src/App.tsx` autosave: the 30 s interval writes the current project to `localStorage['flowsim-autosave']` from the moment the app mounts, so a previous session's autosave is overwritten by an empty project if the user does not click Restore within 30 s.
2. `src/hooks/useKeyboardShortcuts.ts`: F5 calls the store's `startSolve()` only. It never validates or calls `solverService.solve()`; status becomes "Solving" forever.
3. Stop (button and F7) calls the store's `stopSolve()` only; `solverService.stop()` is never called, so the socket stays open and later messages flip status back to converged.
4. Pause changes a label; the backend has no pause.
5. `historyStore.pushHistory()` is never called, so Ctrl+Z / Ctrl+Y do nothing.
6. `duplicateFlowsheet` copies nodes but sets `edges: []`.
7. `CanvasToolbar` Select/Pan toggle is local state never passed to React Flow.
8. File menu shows "Ctrl+N" but no handler exists; F6/F7 exist but are not shown; Ctrl+M (minimap) is undocumented.
9. `FilterAccessWindow` and `FeederAccessWindow` use `defaultValue` inputs and `AccessWindowPanel` renders them without a `key`, so switching between two units of the same type shows stale numbers.

## In scope

- **Autosave**: only start the periodic autosave after the user has either restored, dismissed, or made a change (`project.modifiedAt` newer than mount time). Never overwrite an existing autosave with a project that has zero nodes across all flowsheets. Save immediately on `beforeunload` as well as on the interval.
- **Solve orchestration**: move the "validate then solve" logic out of `TopBar.handleStartSolve` into a single exported function (for example `src/services/solveOrchestrator.ts` with `requestSolve()`, `stopSolve()`), used by the TopBar buttons, F5/F7, and later the command palette. F5 must behave exactly like clicking Solve, including the validation dialog. Expose the pending validation result through `useUIStore` so `ValidationDialog` can live in `App.tsx` rather than inside `TopBar`.
- **Stop**: `stopSolve()` closes the WebSocket, sets status to `idle`, and marks any units still `solving` as `idle`. Ignore messages that arrive for a `solveId` that is no longer active.
- **Pause**: remove the Pause button and F6 binding. (Prompt 14 may reintroduce it with a real protocol.) Remove `pauseSolve`/`paused` only if nothing else depends on them; otherwise leave the type and just remove the UI.
- **Undo/redo**: wrap the mutating actions of `useProjectStore` (add/remove/update node, edge, annotation, flowsheet operations, `setProjectName`, config edits via `updateNode`) so `pushHistory()` is called before each mutation. Cheapest reliable approach: a small helper `withHistory(fn)` applied inside the store definition, or Zustand's `subscribeWithSelector` on `project` with a debounce that coalesces drags. Position-only changes from dragging should coalesce into one history entry per drag (`onNodeDragStop` already fires once). Show Undo/Redo in the File menu with their shortcuts and disable them when the stacks are empty. Loading a project, restoring autosave, or creating a new project clears history.
- **Delete confirmation is not wanted**; undo is the safety net. But deleting a flowsheet (which has no canvas-level undo affordance) must show a Radix `AlertDialog` naming the flowsheet and its unit count.
- **Duplicate flowsheet**: copy edges too, remapping `source`/`target` (and `sourceHandle`/`targetHandle`) through the old-id to new-id map, and regenerating unique stream tags. Clear `stream` results on the copies.
- **Select/Pan**: wire the toggle to React Flow (`panOnDrag` / `selectionOnDrag` / `selectionMode`). Bind `V` to select and `H` to pan (not Space, which React Flow already uses for hold-to-pan) and update the button titles. Holding Space to pan continues to work.
- **Shortcuts**: bind Ctrl+N to the New Project wizard. Show F7 next to "Stop" in the Solve button tooltip. Add a Minimap toggle button to `CanvasToolbar` with the Ctrl+M hint. Remove the "S"/"Space" claims from titles.
- **Stale inputs**: render every access window component with `key={unit.id}` and convert `ConfigRow` in `FilterAccessWindow` and `FeederAccessWindow` to controlled inputs that keep a local string while editing and commit on blur/Enter (so typing "0." is not rejected mid-keystroke). Extract that `ConfigRow` into `src/components/accessWindow/ConfigRow.tsx` and reuse it in the Thickener window.

## Out of scope

Validation policy changes (prompt 09), display units (06), new panels (03, 05), lint cleanup outside the files you touch (02).

## Acceptance criteria

- Open the app, load an example, wait 40 s, reload the page: the restore banner appears and restoring brings the example back. Open the app fresh, do nothing for 40 s, reload: the banner still offers the earlier example (the empty project did not overwrite it).
- Press F5 on a valid example with the backend running: same behaviour as clicking Solve (validation dialog if there are warnings, then results). Press F5 with the backend stopped: same error path as clicking Solve, and the status bar does not stay on "Solving".
- Click Stop during a solve: status returns to Idle and no later toast says "Solve complete".
- The Pause button and F6 are gone.
- Drag a unit, delete it, press Ctrl+Z: it returns with its connections. Ctrl+Y removes it again. File menu shows Undo/Redo with enabled state.
- Right-click a flowsheet tab > Duplicate: the copy has the same number of edges as the original and solves independently.
- Pan mode drags the canvas without rubber-band selection; Select mode rubber-band selects. V/H switch modes; the toolbar buttons reflect the mode.
- Ctrl+N opens the wizard. The minimap button toggles the minimap.
- Click Filter A (recovery 95 %), then Filter B (recovery 80 %): the inputs show 80. Typing "0." into a field does not snap or error until you leave the field.

## Verification

```
npx tsc -b && npm test && (cd flowsim-backend && python -m pytest -q)
npm run lint -- src/App.tsx src/hooks src/store src/services/solveOrchestrator.ts src/components/canvas/CanvasToolbar.tsx src/components/accessWindow
```
Add vitest coverage for: `duplicateFlowsheet` edge remapping, the history store receiving one entry per store mutation, and the autosave guard (extract it into a pure function so it is testable).
