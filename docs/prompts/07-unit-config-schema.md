# Prompt 07: Schema-driven unit configuration

**Depends on:** 01, 04 (for `supportedUnitTypes` from `/health`), 06 (display units).
**Effort:** M

## Goal

Every unit that the backend can solve must be configurable from the UI, with labels, units, ranges and help text, and the palette must be honest about which units actually solve. Replace three hand-written access windows with one generic form driven by a per-unit schema.

## Why

- `AccessWindowPanel.hasUnitConfig` is true only for Filter and Thickener. Cyclone, Screen and Washer have backend parameters (`efficiency`, `d50_microns`, `liquid_split_uf`, `aperture_size_microns`, `num_decks`, `num_stages`, `wash_water_flow`, `solid_recovery_per_stage`, `wash_efficiency_per_stage`) that users cannot set.
- The palette lists 23 unit types; only 5 (plus Feeder/Sink) do anything. `FlashTank2` and `CrushingMill` exist in the type union but in no category.
- Three near-identical `ConfigRow` implementations.

## In scope

- **Unit registry** (`src/lib/unitRegistry.ts`): one entry per `UnitModelType` with `label`, `description` (one sentence, engineer-facing), `category`, `status: 'solvable' | 'passthrough' | 'planned'`, `inlets`/`outlets` (names, used by prompt 08), `configSchema: ConfigField[]` where `ConfigField = {key, label, quantity ('fraction'|'density'|'flow'|'particleSize'|'count'|'number'), default, min?, max?, step?, help}`. Populate for Filter, Thickener, Cyclone, Screen, Washer from the backend defaults in `flowsim-backend/solver/units/*.py` (keep keys identical). Feeder keeps its bespoke window. Mark everything else `planned` with a description of what it will do.
- **Generic `UnitConfigForm`** rendering a schema with the shared `ConfigRow` (prompt 01), display-unit aware (prompt 06), with a help icon per row (Radix Tooltip) and a "Reset to defaults" link. Delete `FilterAccessWindow` and `ThickenerAccessWindow`. Show the unit description at the top of the Config tab.
- **Access window tabs** become: Config (always for solvable units), Feed/DSz (Feeder), Results, Connections (rename of "Connectivity"). For `planned` units show a Config tab with the description and "This unit does not solve yet; streams pass through unchanged" (or "are not solved", matching the actual backend behaviour, which prompt 14 will change).
- **Palette honesty**: group by category as today, but render `planned` units with a muted style and a "soon" badge, and sort them after solvable ones. Tooltip on each card = description + status. A "Show planned units" toggle in the palette header (default off, remembered) hides them entirely for users who only want what works. Add `CrushingMill` and `FlashTank2` to categories.
- **Backend parity check**: a vitest test that loads `unitRegistry` and asserts, for each solvable unit, that its config keys equal the `config.get("...")` keys in the corresponding Python file (read the file from disk in the test). Also cross-check the `/health` `supportedUnitTypes` list at runtime and warn in the console if the registry and backend disagree.
- **Validator**: for solvable units, validate config values against the schema ranges (replace the ad-hoc `NON_NEGATIVE_KEYS` block) with messages that use the field label, not the key.

## Out of scope

New solver models (14), port rendering on the canvas (08).

## Acceptance criteria

- Drop a Cyclone: Config tab shows Efficiency, Cut size d50 (µm), Liquid split to underflow with defaults 80 %, 75 µm, 20 %, help tooltips, and Reset.
- Set Screen aperture to 300 µm, solve the "Vibrating Screen Example": oversize/undersize split changes accordingly.
- Palette: Tank, Pump, Valve, heat units and controllers are visibly "soon"; the toggle hides them.
- Enter 150 % recovery: inline error and a validation warning using the label "Solid recovery".
- Parity test fails if someone adds a config key on one side only.

## Verification

```
npm run check && npm test
cd flowsim-backend && python -m pytest -q
```
