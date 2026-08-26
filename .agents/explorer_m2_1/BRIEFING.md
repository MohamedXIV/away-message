# BRIEFING — 2026-08-22T00:25:00Z

## Mission
Design architecture, component structure, and exact code blueprints for Zustand reactive stores (`useSimulationStore`, `useWindowStore`, `useAudioStore`) and Window Manager core (`WindowFrame`, `WindowManager`, `CRTOverlay`) for Milestone 2.

## 🔒 My Identity
- Archetype: explorer
- Roles: teamwork_preview_explorer
- Working directory: f:/_WIP/away-message/.agents/explorer_m2_1
- Original parent: 39d67808-5c38-467e-ba13-2fc112f01e1c
- Milestone: M2

## 🔒 Key Constraints
- Read-only investigation — do NOT modify engine or app source code directly during exploration.
- Produce comprehensive blueprint in `analysis.md` and structured 5-component report in `handoff.md`.
- Ensure zero-latency reactive state synchronization between `SimulationEngine` and React components.
- Ensure pixel-perfect adherence to Orion OS 4.8 / Orion OS 6.0 design specs and Web Audio sound triggers.

## Current Parent
- Conversation ID: 39d67808-5c38-467e-ba13-2fc112f01e1c
- Updated: 2026-08-22T00:25:00Z

## Investigation State
- **Explored paths**: `PROJECT.md`, `SCOPE_M2.md`, `ORIGINAL_REQUEST.md`, `docs/02-WORLD-ART-AND-PRESENTATION.md`, `docs/03-COMPUTER-OS-AND-SOFTWARE.md`, `docs/05-TECHNICAL-ARCHITECTURE.md`, `src/engine/*`, `src/audio/*`, `src/persistence/*`
- **Key findings**:
  1. `SimulationEngine` uses pub/sub `events: EventBus` and `subscribe(listener)` method emitting `Readonly<SimulationState>`. Realtime clock is stepped via `advanceRealTime(delta)`.
  2. `useSimulationStore` bridges `SimulationEngine` instance to Zustand, maintaining full state snapshot with optimized granular selectors and action dispatchers (`dispatchAction`), along with `useSimulationTicker` loop.
  3. `useWindowStore` provides robust z-index stacking, cascade spawn algorithm (staggering new windows by 26px within viewport bounds), minimized/maximized state transitions, clamping within desktop boundary, and custom state management per window.
  4. `useAudioStore` connects sound effects with volume/mute controls to `SoundManager`.
  5. `WindowFrame.tsx` delivers retro titlebar with double-click maximize/restore, draggable titlebar with boundary constraints via PointerCapture, 8 resize handles (`n`, `s`, `e`, `w`, `ne`, `nw`, `se`, `sw`) with minWidth/minHeight clamping, and active/inactive theme styling (Orion 4.8 vs Orion 6.0).
  6. `WindowManager.tsx` maps registered window IDs to React components, managing focus on click, keyboard navigation (`Alt+F4`, `Alt+Tab`), and modal layers.
  7. `CRTOverlay.tsx` provides retro CRT scanlines, aperture grille subpixel mesh, subtle radial barrel distortion/vignette, and phosphor bloom toggles.
- **Unexplored areas**: None. All target requirements designed and validated.

## Key Decisions Made
- Zustand stores use `subscribeWithSelector` middleware for maximum selector performance and reactivity.
- `useSimulationStore` maintains a reactive bridge with `SimulationEngine`, handling `requestAnimationFrame` ticking with tab visibility delta clamping.
- `WindowFrame` pointer events use `setPointerCapture` on titlebar and resize handles for 60fps tracking without losing cursor outside frame or over child iframes.
- Window coordinates account for taskbar height (28px / 32px) so maximized windows and cascade layouts remain within the accessible workspace.

## Artifact Index
- `analysis.md` — Detailed technical architecture and code blueprints for all 6 target modules
- `handoff.md` — 5-component handoff report for Orchestrator and Implementers
- `progress.md` — Liveness heartbeat and progress log
