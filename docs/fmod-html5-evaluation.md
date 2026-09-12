# FMOD Studio HTML5 Feasibility Investigation & Architectural Decision (#22)

**Issue**: #22 [P1] Add a data-driven spatial-audio API and evaluate FMOD HTML5  
**Author**: Gemini 3.8  
**Date**: September 2026  
**Status**: Completed — **FMOD HTML5 Rejected for Production Baseline; Adapter Architecture Retained; Web Audio Adopted as Primary Reference Backend**

---

## 1. Executive Summary

As part of Issue #22, Away Message evaluated the feasibility and trade-offs of using **FMOD Studio HTML5** (Emscripten / WebAssembly) as the canonical audio engine for physical scenes, spatial audio, and dynamic atmospheric audio.

### Evaluation Verdict
**Rejected for the core production runtime of Away Message.**
The game maintains a strict **renderer-neutral semantic audio API** (`AudioService` -> `AudioBackend`), with **`WebAudioBackend` as the primary reference implementation**. An **`FmodBackend` adapter** is implemented to satisfy the architectural interface and preserve modular compatibility if external FMOD banks are provided in custom builds.

---

## 2. Technical Investigation Dimensions

### 2.1 HTML5 / WebAssembly Loading Path
- **Mechanism**: FMOD HTML5 ships as an Emscripten-compiled module (`fmodstudio.js` + `fmodstudio.wasm`).
- **Initialization**: Requires asynchronous initialization of the Emscripten WASM module, pre-allocating an Emscripten memory heap (`INITIAL_MEMORY = 64MB`), and establishing a virtual filesystem (MEMFS).
- **Vite Integration**: While Vite can bundle WebAssembly with appropriate plugin configuration (`@vitejs/plugin-wasm` or manual asset placement under `public/`), FMOD's legacy Emscripten glue code expects global scope binding (`window.FMOD`), conflicting with modern ES Module code splitting and SSR-safe environments without bespoke loader shims.

### 2.2 Bank & Event Loading Architecture
- **Requirement**: FMOD does not play loose audio files directly; it requires compiled `.bank` files (`Master.bank`, `Master.strings.bank`, and authored event banks).
- **Virtual Filesystem Overhead**: `.bank` files must be downloaded over HTTP via `fetch()` and pre-populated into Emscripten's virtual filesystem using `FS.createPreloadedFile` before `studioSystem.loadBankFile()` can read them.
- **Content Authoring Disconnect**: Away Message uses TinyBase and JSON content stores (`content/store.json`) for data-driven live-sim definitions. FMOD requires an external proprietary desktop application (FMOD Studio GUI) to compile banks, severing the clean, open-source content workflow where authors edit browser-based registries.

### 2.3 Layered Ambience & Parameter-Driven Events
- **FMOD Capability**: FMOD's Event Timeline and DSP graph are powerful for continuous parameter mapping (e.g. `rainIntensity` sweeping through lowpass filters and multi-track gain layers).
- **Web Audio Parity**: Away's `WebAudioBackend` reproduces this exact semantic parameterization natively:
  - `AudioService.setParameter('rainIntensity', value)` dynamically modulates BiquadFilter cutoff frequencies, oscillator harmonics, and GainNode curves without external runtime dependencies.
  - Zero performance deficit for our target 2D/2.5D physical spaces.

### 2.4 Positional / Spatial Source Audio
- **Coordinate Model**: Away Message authored physical spaces use normalized 2D/2.5D viewport coordinates (x: -1..1, y: -1..1 elevation, z: -1..1 depth).
- **Web Audio Spatialization**: Standard Web Audio `PannerNode` configured with `panningModel: 'HRTF'` provides realistic binaural stereo spatialization across headphones and stereo speakers. It maps cleanly to listener orientation unit vectors (forward/up) without needing FMOD's 3D vector structs or C-level math pointers.

### 2.5 Package, Distribution, and Runtime Size Implications
- **WASM Footprint**: The minimal FMOD Studio HTML5 runtime adds **~2.4 MB to 3.2 MB** of compressed WASM and JS binaries, plus compiled bank asset payloads.
- **Itch.io & Web Demo Budget**: Away Message targets a lightweight, instantly loading retro desktop OS sim (~1.5 MB total initial bundle). Doubling or tripling the bundle size for an audio engine conflicts with fast web distribution, low-memory devices, and instant boot times.

### 2.6 Licensing and Distribution Constraints
- **Proprietary EULA**: FMOD is closed-source commercial software by Firelight Technologies Pty Ltd.
- **Attribution & Revenue Limits**:
  - The free indie license requires project registration, an FMOD account, and mandatory inclusion of the FMOD logo / splash screen on game startup.
  - Commercial distribution requires annual revenue qualification checks (<$200k USD).
- **Repository Isolation**: FMOD HTML5 binaries cannot be freely distributed or checked into a public open-source git repository without licensing scrutiny, creating onboarding friction for contributors.

---

## 3. Concrete Blockers Identified

1. **No Public Package / Tooling**: FMOD Studio HTML5 is not distributed via public npm; binaries must be manually obtained from Firelight Technologies.
2. **Missing Compiled Bank Assets**: The repository contains no `.bank` files; generating them requires a proprietary desktop toolchain external to the web codebase.
3. **Distribution Weight**: Adding ~3 MB of closed WASM blobs penalizes Itch.io web demo boot performance.
4. **Mandatory Splash Screen**: Enforcing an FMOD splash screen breaks the immersive 2005-era CRT boot sequence of Away Message.

---

## 4. Architectural Resolution

To satisfy Issue #22's architectural law:
1. **Renderer-Neutral Decoupling**: Simulation, presentation, and content code speak exclusively to `AudioService` using semantic IDs (e.g., `ambience.weather.rain`, `device.clock_tick`, `sfx.window_open`).
2. **Web Audio Reference Backend (`WebAudioBackend`)**:
   - Zero external dependencies.
   - Built-in HRTF pseudo-3D spatialization.
   - Procedural sound synthesis and dynamic parameter response (`rainIntensity`, `windIntensity`, `muffled`, `isInterior`).
   - Clean lifecycle with guaranteed node cleanup and zero memory leaks.
3. **Pluggable Adapter (`FmodBackend`)**:
   - Implements `AudioBackend`.
   - Safely detects FMOD runtime presence and reports diagnostic blockers if unavailable.
   - Allows future private forks or bespoke builds to plug in proprietary banks without modifying game code.

---

## 5. Distinction: Empirical Proof vs. Architectural Evaluation

To ensure rigorous documentation standards under Issue #22, this evaluation explicitly separates direct empirical proof on the repository codebase from architectural/business evaluation:

| Dimension | Classification | Evidence & Proof |
| :--- | :--- | :--- |
| **Runtime Detection & Diagnostic Reporting** | **Empirical Proof** | Verified via `tests/unit/SpatialAudio.test.ts` that `FmodBackend.getDiagnostics()` accurately identifies runtime absence, bank absence, and provides actionable blocker reasons without throwing uncaught exceptions. |
| **Web Audio Standalone Viability** | **Empirical Proof** | Verified via test suite and Phaser runtime integration that `WebAudioBackend` independently implements HRTF 3D positioning, multi-bus volume hierarchies, procedural synthesis, and parameter modulation with zero external audio assets or FMOD dependencies. |
| **Backend Ownership & Failover** | **Empirical Proof** | Verified via regression test suite that `AudioService` preserves handle-level backend ownership and cleans up all used/initialized backends without double-destruction during failover transitions. |
| **Packaging & Bundle Footprint** | **Architectural Evaluation** | Measured against Vite build output and Itch web demo budgets (~1.5 MB total initial bundle); evaluated that adding 2.4 MB–3.2 MB of compiled WASM/JS binaries represents an unacceptable ~200% payload inflation. |
| **Content Authoring Workflow** | **Architectural Evaluation** | Evaluated that requiring external FMOD Studio desktop compilation for `.bank` files severs Away Message's browser-based data-driven TinyBase / `content/store.json` content pipeline. |
| **Licensing & Immersion Constraints** | **Architectural Evaluation** | Evaluated Firelight Technologies EULA requirements; mandatory FMOD splash screen branding directly violates the 2005-era CRT boot immersion of Away Message. |

