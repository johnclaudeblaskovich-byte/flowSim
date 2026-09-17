# Prompt 06: Display units everywhere and a real Settings dialog

**Depends on:** 01, 03.
**Effort:** M

## Goal

Honour the unit preferences the wizard already asks for, everywhere numbers are shown or typed, and give users a Settings dialog to change them (and other preferences) at any time. Replace the misleading gear icon that opens a unit enable/disable table.

## Why

- `UnitPreferences` is stored in `useUIStore` but only `NewProjectWizard` reads it. Every readout hard-codes `Qm * 3.6` t/h, `T - 273.15` °C, `P / 1000` kPa (`ResultsPanel.tsx`, `AccessWindowPanel.tsx`, `PipeEdgeRenderer.tsx`, `TrendWindow`, exports).
- `FeederAccessWindow` takes mass flow in kg/s while every result shows t/h.
- `src/lib/unitConversion.ts` (`toSI`/`fromSI`) is unused by the UI.
- `LeftNav` gear labelled "Settings" opens `SetupWindow` (enable/disable units).

## In scope

- **Formatting layer**: `src/lib/displayUnits.ts` exporting `useDisplayUnits()` (reads prefs from the store) returning `{ flow: {toDisplay, fromDisplay, label}, temperature: {...}, pressure: {...}, format(value, quantity, digits?) }`, built on `unitConversion.ts`. Extend `UnitPreferences` with `density` (kg/m³, t/m³), `massFraction` (%, fraction) and `particleSize` (µm, mm). Persist preferences to `localStorage['flowsim-preferences']` and also into the `.fsim` file (schema bump + migration) so a project opens with the units it was authored in; project value wins on load, user can override in Settings.
- **Replace every hard-coded conversion** with the hook. Table column headers must show the unit (e.g. "Mass flow (t/h)"). Inputs in access windows accept display units and store SI. Exports (Excel/CSV/report) use display units and put the unit in the header row.
- **Settings dialog** (`src/components/dialogs/SettingsDialog.tsx`, opened by the gear icon, Ctrl+, ) with tabs: *Units* (the preference radio groups), *Project* (name, description, solve mode, heat mode, solver settings that already exist on `Project.solverSettings`: max iterations, tolerance, damping, tear method, with help text saying which ones the current solver honours), *Editor* (snap-to-grid on/off + size, show minimap, show stream labels, autosave interval), *Advanced* (backend URL override for non-proxy deployments, reset tour, clear autosave). Move the existing `SetupWindow` (unit enable/disable) under Project as "Enabled units".
- **Rename** the LeftNav gear tooltip to "Settings" and make the wizard's unit step a link "You can change these later in Settings".

## Out of scope

Dark mode (12), species (05).

## Acceptance criteria

- Switch flow to kg/s in Settings: the Results dock, stream badges, access-window results, Feeder input, and an Excel export all show kg/s with matching headers; switch back to t/h and the numbers convert correctly.
- Temperature in °F round-trips: enter 100 °F in a Feeder, Settings → °C shows 37.78.
- The gear icon opens Settings; "Enabled units" is reachable inside it and still toggles units.
- Preferences survive a reload; opening an example authored in t/h while the user prefers kg/s shows t/h with a toast "Using this project's units (t/h). Change in Settings."

## Verification

```
npm run check && npm test
```
Add vitest tests for `displayUnits` round-trips for every quantity/unit pair and for the preferences migration.
