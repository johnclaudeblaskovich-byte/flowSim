# Prompt 02: Green checks, cross-platform scripts, CI

**Depends on:** 01 (so lint fixes do not collide with the orchestrator refactor).
**Effort:** S

## Goal

Every later prompt ends with "run lint, typecheck, tests". Today `npm run lint` fails with 31 errors, the backend tests need an undeclared dependency, and `npm run dev:backend` only works on Windows. Make the repo's own quality gate trustworthy on all three platforms and enforce it in CI.

## Why

- `npm run lint`: 31 errors / 3 warnings. Categories: React Compiler `react-hooks/static-components` (components defined inside render: `TH` in `ResultsPanel.tsx`, `RadioGroup` in `NewProjectWizard.tsx`), `react-hooks/set-state-in-effect` (`App.tsx`, `FindDialog.tsx`, `DxfMappingDialog.tsx`, `ReactionFileEditor.tsx`), `react-refresh/only-export-components` (`PipeEdgeRenderer.tsx`, `symbols.tsx`), `no-unused-vars` (`interpreter.ts`, `parser.ts`, `exportService.ts`), `no-useless-escape` (`ReactionFileEditor.tsx`), `exhaustive-deps` warnings.
- `flowsim-backend/tests/test_websocket_solver.py` imports `fastapi.testclient`, which needs `httpx2`; `requirements.txt` does not list it or pytest.
- `package.json` scripts `dev:backend` and `install:backend` point at `scripts\*.cmd`.
- No `.github/workflows`.

## In scope

- Fix every lint error properly (hoist inner components to module level and pass props; move effect-driven state into derived values or event handlers; move non-component exports such as `defaultEdgeOptions` and symbol maps into non-component modules; drop unused parameters). Do not disable rules globally. A targeted `eslint-disable-next-line` with a one-line justification is acceptable only where the React Compiler rule is a false positive.
- Add `flowsim-backend/requirements-dev.txt` (`pytest`, `httpx2`, plus anything else the tests need) and reference it from the README and CI.
- Replace the `.cmd` scripts with a Node launcher `scripts/backend.mjs` that finds `py`, `python3` or `python`, supports `install` and `start` subcommands, and works on Windows, macOS and Linux. Keep the `.cmd` files only if you make them thin wrappers around the Node script, otherwise delete them. Update `package.json`: `dev:backend`, `install:backend`, add `check` (`tsc -b && eslint . && vitest run`) and `test:backend`.
- Add `.github/workflows/ci.yml` with two jobs: `frontend` (Node 22: `npm ci`, `npm run check`, `npm run build`) and `backend` (Python 3.11: install requirements + dev requirements, `pytest -q`). Cache npm and pip.
- Add a `sync-examples` npm script (Node) that copies `examples/**/*.fsim` and `inventory.json` into `public/examples/`, and a CI step that fails if the two trees differ (so the duplication cannot drift).
- Delete the stray tracked `__pycache__` files if any remain (`git ls-files | grep pyc`).

## Out of scope

Behavioural changes to the UI. If fixing a lint error requires a behaviour decision, keep current behaviour and note it.

## Acceptance criteria

- `npm run check` exits 0 with zero warnings.
- `npm run dev:backend` starts uvicorn on macOS/Linux/Windows with only Python 3 installed.
- `cd flowsim-backend && pip install -r requirements.txt -r requirements-dev.txt && python -m pytest -q` passes without extra manual installs.
- CI workflow runs green on the PR.
- `npm run sync-examples` is idempotent and CI catches a drifted example file.

## Verification

```
npm run check && npm run build
cd flowsim-backend && python -m pytest -q
npm run sync-examples && git status --porcelain public/examples   # must be empty
```
