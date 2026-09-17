# FlowSim UX Improvement Prompt Package

Fourteen self-contained prompts for Claude Code (or any coding agent), each turning one finding cluster from `docs/UX_REVIEW.md` into a shippable change.

## How to use

1. Open a fresh Claude Code session in the repo root.
2. Paste the full contents of `00-project-context.md`, then the full contents of one numbered prompt.
3. Let the agent finish, review the diff, run the verification block at the bottom of the prompt, merge.
4. Move to the next prompt. Each prompt assumes the previous ones are merged, but says so explicitly under "Depends on".

Run them in order the first time. Prompts 01 and 02 unblock everything else (dead controls, data loss, and a red lint gate). Prompts 03 to 09 are the user-facing core. 10 to 13 are consolidation and polish. 14 is the engine work and is the largest.

## Index

| # | Prompt | Effort | Fixes review items |
|---|---|---|---|
| 01 | [Fix dead controls and data loss](01-fix-dead-controls-and-data-loss.md) | M | P0 #1-#10 |
| 02 | [Green checks, cross-platform scripts, CI](02-green-checks-and-ci.md) | S | lint failure, Windows-only scripts, missing test deps |
| 03 | [Welcome screen and first-run experience](03-welcome-and-first-run.md) | M | #11 (entry), #19, #30 |
| 04 | [Backend connection status and safe solving](04-backend-connection-status.md) | S | #17, #18, #24 (connection copy), #25 |
| 05 | [Species management panel](05-species-management.md) | M | #11, #27 |
| 06 | [Display units everywhere and a real Settings dialog](06-display-units-and-settings.md) | M | #12, #23 (gear icon) |
| 07 | [Schema-driven unit configuration](07-unit-config-schema.md) | M | #10, #13, #14, #36 |
| 08 | [Named ports and visible routing](08-named-ports-and-routing.md) | L | #15, #24 (routing copy), #35 |
| 09 | [Solve flow: active flowsheet, non-blocking validation, quieter feedback](09-solve-flow-and-validation.md) | M | #6, #16, #26 |
| 10 | [Results dock consolidation and inspector](10-results-consolidation.md) | M | #21, #22, #29 |
| 11 | [Command palette and keyboard shortcut reference](11-command-palette-and-shortcuts.md) | S | #9, #31 |
| 12 | [Accessibility and visual polish](12-accessibility-and-polish.md) | M | #28, #30 |
| 13 | [Help, README and in-app docs](13-help-and-docs.md) | S | #33, #34, #13 (docs side) |
| 14 | [Solver engine: pass-through units and recycle loops](14-solver-engine.md) | L | #13, #4, #25, #32 |

Effort: S = under half a day, M = a day, L = several days.

## Conventions every prompt follows

- **Frozen context header.** `00-project-context.md` is pasted first, unchanged. If the codebase drifts, update that one file rather than every prompt.
- **Scope box.** Each prompt lists what is in and out of scope so the agent does not widen the change.
- **Acceptance criteria** are user-visible behaviours, written so a reviewer can check them by hand.
- **Verification block** is the exact set of commands that must pass before the change is considered done.
- **No schema changes without a migration.** Any change to the `Project` type bumps `CURRENT_PROJECT_SCHEMA_VERSION` in `src/services/projectSchema.ts` and adds a migration step, and all 12 example projects must still load.
