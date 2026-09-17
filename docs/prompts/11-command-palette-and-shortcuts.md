# Prompt 11: Command palette and keyboard shortcut reference

**Depends on:** 01, 03 (Help menu), 10 (View menu).
**Effort:** S

## Goal

Every action reachable from a keyboard, every shortcut discoverable, one registry as the source of truth so menus, tooltips and the cheat sheet never drift again.

## Why

- Shortcuts are scattered across `useKeyboardShortcuts.ts`, `FlowsheetCanvas.tsx` (Ctrl+M), `CanvasToolbar` titles, and `TopBar` menu labels; they drifted (Ctrl+N advertised but unbound, F6/F7 bound but hidden).
- `FindDialog` (Ctrl+F) only finds units and streams; there is no way to run a command by name.

## In scope

- **Command registry** (`src/services/commands.ts`): `registerCommand({id, title, group, shortcut?, when?: () => boolean, run})`. Register every File/View/Solve/Edit action and the canvas tools. `useKeyboardShortcuts` becomes a generic dispatcher over the registry (ignore when typing in inputs, respect `when`). Menus and tooltips render `shortcut` from the registry (format for the platform: ⌘ on macOS, Ctrl elsewhere).
- **Command palette** (Ctrl+K / Ctrl+Shift+P): fuzzy search over commands *and* the existing Find results (units, streams, flowsheets, species). Selecting a unit selects it and opens the inspector; selecting a command runs it. Replace `FindDialog` with this (keep Ctrl+F opening the palette in "find" mode).
- **Cheat sheet**: `?` (Shift+/) and Help > Keyboard shortcuts open a dialog listing commands grouped by area, generated from the registry.
- **Canvas-focused shortcuts**: Delete/Backspace (already), Ctrl+A select all, Ctrl+D duplicate selected units (with connections between them), arrow keys nudge selection by grid size (Shift = 10×), Ctrl+0 fit view, Ctrl+= / Ctrl+- zoom, Ctrl+M minimap, V/H tools. React Flow handles some of these; make the registry entries call into React Flow where it already does.
- **Context menus**: rebuild the node, edge and flowsheet-tab context menus on Radix `ContextMenu` so they get keyboard navigation and Escape for free; entries come from the registry where applicable.

## Out of scope

Rebinding shortcuts by the user.

## Acceptance criteria

- Ctrl+K, type "solve all", Enter: solves all flowsheets. Type "THKR": lists the unit; Enter selects it.
- `?` shows every shortcut; each one in it actually works; the File and View menus show the same shortcuts.
- Right-click a node, use arrow keys and Enter to choose "Delete".
- Select two connected units, Ctrl+D: a copy appears offset, with the connection between them, new unique tags.

## Verification

```
npm run check && npm test
```
Add a vitest test that every registered command with a `shortcut` has a unique binding and that no two commands share an id.
