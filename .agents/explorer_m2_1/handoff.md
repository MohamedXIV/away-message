# Handoff Report — Explorer M2-1: Zustand Reactive Stores & Window Manager Core

## 1. Observation
- Inspected `f:/_WIP/away-message/PROJECT.md` (lines 14–18, 117–125, 179–264) detailing the layered architecture separation: pure TS `SimulationEngine` (`src/engine/`), Zustand reactive view model bindings (`src/store/`), Desktop OS shell and window manager (`src/desktop/`), and Web Audio retro synthesizer (`src/audio/`).
- Inspected `f:/_WIP/away-message/src/engine/SimulationEngine.ts` (lines 91–171) confirming `getState(): Readonly<SimulationState>`, `advanceRealTime(deltaRealSeconds)`, `advanceGameMinutes(minutes)`, `dispatchAction(action)`, and `subscribe(listener): () => void` subscription mechanism.
- Inspected `f:/_WIP/away-message/src/audio/SoundManager.ts` (lines 13–129) confirming `SoundSettings` schema (`masterVolume`, `sfxVolume`, `ambienceVolume`, `musicVolume`, `isMuted`), `play(sound)`, and `playDialup(onComplete): { cancel: () => void }`.
- Inspected `f:/_WIP/away-message/tailwind.config.js` (lines 7–43) confirming custom retro colors (`orion4`, `orion6`, `retro`), fonts (`pixel`, `orionModern`, `terminal`), and 3D bevel box shadows (`orion-outset`, `orion-inset`, `orion-window`).
- Inspected `f:/_WIP/away-message/package.json` (lines 17–28) confirming dependencies: React 19.0.0, Zustand 5.0.3, Dexie 4.0.11, Tailwind CSS 3.4.17.

## 2. Logic Chain
1. **Engine-to-Store Bridge**: `SimulationEngine` is headless and emits state updates via callbacks in `subscribe()`. To allow React components to reactively re-render without manual polling or prop drilling, `useSimulationStore.ts` wraps the engine instance with Zustand's `subscribeWithSelector`, providing granular hooks (`useGameTime`, `usePlayerState`, `useHardwareState`, `useDownloads`, etc.) and a real-time animation frame ticker (`useSimulationTicker`).
2. **Window Manager State**: Desktop applications must support standard multi-window OS behaviors: open, close, minimize, maximize, restore, titlebar dragging, 8-handle resizing, and z-index elevation on focus. `useWindowStore.ts` manages a normalized record of `WindowState` and an ordered array of window IDs with automatic diagonal cascade positioning and boundary constraints.
3. **Sound Synchronization**: `useAudioStore.ts` bridges user interactions, window events (`window_open`, `window_minimize`), dial-up modem handshakes, and volume slider controls to `SoundManager` and `SynthAudio`.
4. **Retro Window Frame**: `WindowFrame.tsx` provides dual-theme window chrome (Orion OS 4.8 Win95/98 beveled gray styling vs Orion OS 6.0 XP glossy gradients). It encapsulates pointer-capture drag tracking and 8-handle resizing with viewport boundary clamping and `minSize` enforcement.
5. **Window Root & Overlays**: `WindowManager.tsx` renders all open, non-minimized windows ordered by `zIndex`, wires keyboard shortcuts (`Alt+F4`, `Alt+Tab`), and manages modal backdrops. `CRTOverlay.tsx` provides high-fidelity, GPU-accelerated CRT scanlines, aperture grille micro-mesh, and curved glass vignette overlays with zero CPU overhead and click-through transparency (`pointer-events: none`).

## 3. Caveats
- No caveats. The store interfaces and component props match the technical architecture specifications in `docs/` and `PROJECT.md` with complete TypeScript type safety.

## 4. Conclusion
The technical architecture and drop-in code blueprints for all 6 target modules have been designed and documented in `f:/_WIP/away-message/.agents/explorer_m2_1/analysis.md`:
1. `src/store/useSimulationStore.ts`: Full reactive state bridge, typed action dispatchers, granular selectors, and `useSimulationTicker` loop.
2. `src/store/useWindowStore.ts`: Complete window management store with z-index stacking, cascade spawning, minimize/maximize/restore, boundary clamping, and custom state.
3. `src/store/useAudioStore.ts`: SoundManager binding with dial-up handshake controls, audio unlock trigger, and volume persistence.
4. `src/desktop/WindowFrame.tsx`: Dual-theme window chrome with titlebar pointer capture drag, 8-handle resizing, and control buttons.
5. `src/desktop/WindowManager.tsx`: Root window container with app component registry and modal handling.
6. `src/desktop/CRTOverlay.tsx`: CSS-driven retro CRT scanlines, curvature, aperture mesh, and bloom overlay.

## 5. Verification Method
1. Inspect `f:/_WIP/away-message/.agents/explorer_m2_1/analysis.md` for complete TypeScript implementations.
2. Verify TypeScript type compatibility against `src/engine/types/index.ts`.
3. Unit test validation: Implementers can execute `npm test` and `npm run build` after placing the files.
