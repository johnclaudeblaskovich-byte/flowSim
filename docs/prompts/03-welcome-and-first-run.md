# Prompt 03: Welcome screen and first-run experience

**Depends on:** 01, 02.
**Effort:** M

## Goal

A new user should understand within ten seconds what FlowSim is and how to get a flowsheet solving, without reading the README. Today the app opens on an empty, species-less "Untitled Project" with the Explorer tab selected and no hint that the Unit Palette exists.

## Why

- `src/App.tsx` mounts straight into the editor with `createDefaultProject()` (no species), `leftNavTab: 'flowsheets'`.
- The canvas has no empty state.
- Project name is only editable in the wizard; `setProjectName` exists in the store with no UI. The TopBar shows a dead "U" avatar and `index.html` titles the tab "flowsim".
- No dirty-state: no unsaved indicator, no `beforeunload` warning, New Project replaces the current project silently.
- The autosave restore banner is a thin amber strip at the bottom that is easy to miss.

## In scope

- **Welcome screen** (`src/components/welcome/WelcomeScreen.tsx`) shown when the project is the untouched default and no autosave restore is pending. Content: one-sentence product description, three primary cards (New Project, Open Example, Open File), a "Recent" list (last 8 project names + timestamps, stored in localStorage by `projectIO` on save/load; opening a recent that was saved as a download shows a file picker with the name pre-filled since the browser cannot reopen downloads), and a link to the Help/shortcuts overlay (prompt 11 adds the overlay; for now link to `README.md`). Restore-autosave becomes a card on this screen ("Continue where you left off: <name>, saved 3 min ago") in addition to the banner.
- **Empty canvas state**: when the active flowsheet has zero nodes, render a centred, non-interactive hint on the canvas: "Drag a unit from the palette to start" with an arrow icon pointing at the palette, plus a secondary "or open an example" link. It disappears on first node.
- **Default left nav** becomes the Unit Palette when the active flowsheet is empty; Explorer otherwise. Add a `UnitPalette` first-time hint: highlight Feeder ("every flowsheet starts with a Feeder").
- **Guided tour** (3 to 5 steps, `localStorage['flowsim-tour-done']`): palette, canvas connect handles, Solve button, results dock. Implement with Radix Popover anchored to `data-tour="..."` attributes; no external tour library. Add "Take the tour" to the Help menu (create a minimal Help menu next to File with: Take the tour, Keyboard shortcuts (placeholder until prompt 11), README on GitHub, About).
- **Editable project name** in the TopBar: click the name to edit inline (Enter/blur commits, Escape cancels), calls `setProjectName`. Show an unsaved dot after the name when `project.modifiedAt > lastSavedAt` (track `lastSavedAt` in `useUIStore`, set by save/load).
- **Dirty guards**: `beforeunload` when dirty; New Project and Open/Open Example ask "Discard unsaved changes to <name>?" (Radix AlertDialog) when dirty.
- **Branding**: tab title "FlowSim", `<title>` updates to "<project name> - FlowSim"; replace the "U" avatar with the app version (from `package.json` via Vite `define`) in an About dialog under Help.

## Out of scope

Species management (05), backend status (04), settings (06).

## Acceptance criteria

- Fresh load shows the welcome screen; "Open Example" > "Simple Thickener Example" lands in the editor with the flowsheet visible and the Explorer showing its units.
- New Project > finish wizard: editor opens with the Unit Palette on the left and the empty-canvas hint visible; dropping a Feeder hides the hint.
- First-time tour appears once, can be skipped, and can be replayed from Help.
- Editing the project name in the TopBar updates the Explorer root and the tab title.
- Change something, press Ctrl+S: unsaved dot disappears. Change again and reload: browser prompts about unsaved changes.
- File > New Project while dirty asks for confirmation; Cancel keeps the current project.

## Verification

```
npm run check && npm test
```
Add vitest tests for the recent-projects list helper (add, dedupe by name, cap at 8) and the dirty-state derivation.
