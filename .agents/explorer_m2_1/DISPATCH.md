# Dispatch Assignment — Explorer M2-1

**Assigned Agent**: explorer_m2_1
**Role**: teamwork_preview_explorer
**Working Directory**: f:/_WIP/away-message/.agents/explorer_m2_1/
**Parent**: orchestrator_1 (39d67808-5c38-467e-ba13-2fc112f01e1c)

## 2026-08-22T00:23:17Z
<USER_REQUEST>
You are Explorer M2-1 for Away Message.
Working directory: f:/_WIP/away-message/.agents/explorer_m2_1/
Read:
- f:/_WIP/away-message/.agents/explorer_m2_1/DISPATCH.md
- f:/_WIP/away-message/PROJECT.md
- f:/_WIP/away-message/.agents/orchestrator_1/SCOPE_M2.md
- f:/_WIP/away-message/.agents/ORIGINAL_REQUEST.md

Design the exact architecture, components, and code blueprints for:
1. Zustand Reactive Stores: src/store/useSimulationStore.ts, src/store/useWindowStore.ts, src/store/useAudioStore.ts.
2. Window Manager: src/desktop/WindowFrame.tsx (drag, resize handles, title bar, controls), src/desktop/WindowManager.tsx, src/desktop/CRTOverlay.tsx.

Write detailed implementation designs to f:/_WIP/away-message/.agents/explorer_m2_1/analysis.md and summary handoff in f:/_WIP/away-message/.agents/explorer_m2_1/handoff.md. Send a message to orchestrator_1 when finished.
</USER_REQUEST>

## Mission
Investigate and design the technical blueprint for Milestone 2 (Part A):
1. **Zustand Reactive Stores (`src/store/`)**:
   - `useSimulationStore.ts`: Bridges `SimulationEngine` instance to React components with fine-grained selectors and action dispatchers.
   - `useWindowStore.ts`: Window management store (open, close, minimize, maximize, restore, focus/bring to front, z-index calculation, position drag, size resize, cascade positioning).
   - `useAudioStore.ts`: Sound effects trigger bindings and volume/mute controls.
2. **Window Manager Core (`src/desktop/`)**:
   - `WindowFrame.tsx`: Reusable vintage window frame with title bar, app icon, active/inactive header gradients, minimize/maximize/close buttons, drag header, 8-direction resize handles, content container.
   - `WindowManager.tsx`: Container component mapping all open windows to their respective application components with boundary clamping.
   - `CRTOverlay.tsx`: Retro scanline shader, subtle CRT curved glass border, and phosphor glow toggle.

Read `f:/_WIP/away-message/PROJECT.md`, `f:/_WIP/away-message/.agents/orchestrator_1/SCOPE_M2.md`, and `f:/_WIP/away-message/.agents/ORIGINAL_REQUEST.md`.
Write detailed technical design to `f:/_WIP/away-message/.agents/explorer_m2_1/analysis.md` and handoff to `f:/_WIP/away-message/.agents/explorer_m2_1/handoff.md`.
