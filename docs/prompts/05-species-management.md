# Prompt 05: Species management panel

**Depends on:** 01, 03.
**Effort:** M

## Goal

Let users add, remove and inspect the chemical species of a project at any time, from the left nav, instead of only during the New Project wizard. Species are the first thing the validator complains about and today there is no way to fix that complaint without starting over.

## Why

- `src/App.tsx` renders "Species management coming soon." for the `species` nav tab.
- `projectValidator.ts` errors with "No species selected. Add species via File > New Project wizard."
- `src/lib/speciesCatalog.ts` has 26 entries with no molecular weight or density; `solveProtocol.inferMolecularWeight` returns 0.1 kg/mol for everything except water. The examples use `Ore_Solid`, which is not in the catalog.
- `FeederAccessWindow` lets users type arbitrary custom species IDs that never become project species.

## In scope

- **Catalog upgrade** (`speciesCatalog.ts`): add `molecularWeight` (g/mol) and `density` (kg/m³) for every entry, add `Ore_Solid` (generic gangue, 2700 kg/m³) and a handful of common process solids (Gypsum, Hematite, Magnetite, Chalcopyrite, Gibbsite). Add a `ProjectSpecies` type (`{id, name, formula, phase, molecularWeight, density, source: 'catalog'|'custom'}`) and change `Project.selectedSpecies: string[]` to `Project.species: ProjectSpecies[]` **with a schema migration** (bump `CURRENT_PROJECT_SCHEMA_VERSION`, map old IDs through the catalog, fall back to a custom entry with guessed phase and default MW/density). Keep a `selectedSpeciesIds` selector for callers that only need IDs. Use real MW in `buildFeederStream`.
- **Species panel** (`src/components/panels/SpeciesPanel.tsx`) replacing the stub: list of project species with phase badge, formula, MW, "used in N feeders" count; Add from catalog (searchable, grouped by category, multi-select); Add custom (name, formula, phase, MW, density, all validated); Edit custom species; Remove with a guard when a Feeder references it ("Used by FDR_001. Remove it from that feeder first" with a link that opens the feeder).
- **Feeder integration**: `FeederAccessWindow` "Add project component" list comes from project species only; the "Custom component" input becomes "Add new species…" which opens the same Add-custom dialog and adds the species to the project first. Unknown species IDs in loaded projects appear in the panel flagged "not in project" with a one-click "Add to project".
- **Validator copy**: "This project has no species. Open the Species panel to add some." with a `fix` action that switches the left nav to Species. Extend `ValidationDialog` "Go to" buttons to support such actions.
- **Wizard**: step 2 reuses the same catalog picker component as the panel.
- **Explorer**: show a "Species (N)" node under the project root that switches to the panel.

## Out of scope

Thermodynamic property polynomials, reactions, phase equilibrium.

## Acceptance criteria

- Open an example, go to the Species tab: the panel lists Water and Ore_Solid with MW and density populated from the catalog.
- Add "Sulfuric Acid" from the catalog; it appears immediately in the Feeder's "Add project component" list.
- Try to remove Water while a Feeder uses it: blocked with a link to that feeder.
- New empty project, drop a Feeder and a Thickener, press Solve: the validation error names the Species panel and its button opens it.
- All 12 examples still load (migration) and still solve with the same mass balance.

## Verification

```
npm run check && npm test
```
Add vitest tests for the migration (old `selectedSpecies` → `species`) and for `buildFeederStream` using catalog molecular weights.
