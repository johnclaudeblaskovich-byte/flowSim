# Prompt 13: Help, README and in-app docs

**Depends on:** 03 (Help menu), 07 (unit registry descriptions), 11 (shortcut registry).
**Effort:** S

## Goal

A first-time reader of the repository, and a first-time user of the app, should be able to answer "what is this, how do I run it, how do I build and solve a flowsheet, what does each unit do" without asking anyone.

## Why

- `README.md` is two sections about starting the backend; it never says what FlowSim is, has no screenshots, and its instructions are Windows-only.
- The unit models are documented only in Python docstrings.
- `examples/VERIFICATION_REPORT.md` describes the SysCAD example catalog but the in-app example dialog shows only names.

## In scope

- **README rewrite**: what FlowSim is (two paragraphs, one screenshot of a solved example), feature list, quick start for Windows/macOS/Linux using the prompt 02 scripts, "your first flowsheet" walkthrough (Feeder → Thickener → two Sinks, configure, solve, read results) with screenshots, keyboard shortcut table generated from the registry (add an `npm run docs:shortcuts` script that writes `docs/shortcuts.md`, and have CI check it is current), project file format summary, architecture diagram (frontend/backend/protocol), how to run tests, roadmap (link to `docs/UX_REVIEW.md` and the prompt package), licence placeholder.
- **Unit model reference** `docs/units/<type>.md` for every solvable unit: purpose, inlets/outlets, parameters with defaults and ranges (generated from `unitRegistry` by a script so it cannot drift), model equations in prose, worked example referencing an example project. `planned` units get a one-paragraph stub.
- **In-app help**: Help menu gets "User guide" (opens `docs/` on GitHub) and "Unit reference"; every unit's Config tab gets a "Learn more" link to its reference page; the Example Project dialog shows each example's description, key unit operations and what it demonstrates (fields already exist in `inventory.json`), plus a thumbnail (generate SVG thumbnails with the existing `exportFlowsheetSVG` via a script, store under `public/examples/thumbs/`).
- **Contributing** `CONTRIBUTING.md`: how to add a unit model end to end (Python solver, registry entry, docs page, example project, tests), and the schema-migration rule.

## Out of scope

Hosting a docs site.

## Acceptance criteria

- A colleague on macOS follows README from clone to solved example without help.
- `docs/shortcuts.md` matches the `?` dialog; CI fails if a shortcut is added without regenerating.
- Every solvable unit has a reference page reachable from its Config tab.
- The example dialog shows descriptions and thumbnails.

## Verification

```
npm run check && npm run docs:shortcuts && git diff --exit-code docs/shortcuts.md
```
