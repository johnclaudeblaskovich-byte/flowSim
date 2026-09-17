# Prompt 12: Accessibility and visual polish

**Depends on:** 10, 11.
**Effort:** M

## Goal

Make FlowSim usable by keyboard and screen reader for everything outside the canvas drawing itself, legible at 100 % zoom, and consistent in spacing, type and colour. Add an optional dark theme.

## Why

- Icon buttons in `TopBar`, `CanvasToolbar`, `AccessWindowPanel` and `ResultsPanel` rely on tooltips/`title` with no `aria-label`.
- No `focus-visible` styling anywhere; Tailwind's default outline is reset.
- Labels at 9 px (`text-[9px]`) and 10 px are common; the palette uses 10 px labels on 22 px icons.
- Status is conveyed by colour alone (status dots, edge colours).
- Custom context menus are `div`s (prompt 11 replaces them); dialogs are Radix (good).
- `prefers-reduced-motion` is ignored; edges and panels animate.
- Colours are hard-coded hex values in several components (`UnitNodeRenderer`, `PipeEdgeRenderer`, `StatusBar`), and `index.css` defines CSS variables that nothing uses.

## In scope

- **Design tokens**: move colours into Tailwind theme extensions backed by the CSS variables in `index.css` (`bg-surface`, `text-muted`, `border-default`, `accent`, `status-*`), and use them in components instead of hex/gray-NNN literals. Add a `[data-theme="dark"]` variable set and a theme switch in Settings (system / light / dark), persisted. React Flow background, minimap, nodes, edges and Monaco theme must follow.
- **Type scale**: minimum 11 px for any text that conveys information; 10 px allowed only for non-essential chips. Palette cards get 11 px labels. Use tabular numerals (`tabular-nums`) in every numeric table.
- **Focus and roles**: `focus-visible:ring-2 ring-accent` on all interactive elements; `aria-label` on every icon-only button; `role="toolbar"` on the canvas toolbar with roving tabindex; tabs use Radix Tabs everywhere (the inspector's hand-rolled tabs included); tables get `<caption>` or `aria-label`, sortable headers get `aria-sort`; toasts announce via the Radix `Toast` live region (already) but errors should use `role="alert"`.
- **Not colour-only**: status dots get an icon or text equivalent in tooltips and the Units table; edge severity uses dash pattern plus an icon on the badge (dashed already exists; add the icon).
- **Motion**: honour `prefers-reduced-motion` for panel slides, edge stroke transitions and the tour.
- **Consistency pass**: one `Button` component (`src/components/ui/Button.tsx`, variants primary/secondary/ghost/danger, sizes sm/md) and one `IconButton`, replace the ad-hoc `className` buttons. One `Panel` header style for left panel, inspector and dock. Align paddings to a 4 px grid.
- **Zoom**: canvas readable at 100 %; node tag labels do not truncate below 12 characters (widen node or wrap).

## Out of scope

Screen-reader operability of the React Flow canvas itself (out of reach without a separate list-based editing mode; note it as a follow-up).

## Acceptance criteria

- Tab through the TopBar, left nav, palette, inspector and dock without a mouse; focus is always visible; every icon button reads sensibly in a screen reader (test with VoiceOver or NVDA).
- Switch to dark theme: canvas, nodes, edges, dialogs, Monaco and tables are all dark with AA contrast (verify with the browser's accessibility panel on at least 5 text/background pairs).
- With reduced motion enabled in the OS, panels and edges do not animate.
- No `text-[9px]` remains; `grep -r "text-\[9px\]" src` is empty.

## Verification

```
npm run check && npm test
npx playwright test    # add a smoke test under e2e/ that loads an example and takes light + dark screenshots (Chromium is preinstalled in the cloud environment; keep the test optional locally)
```
