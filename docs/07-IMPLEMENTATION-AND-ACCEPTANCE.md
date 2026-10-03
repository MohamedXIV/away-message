# Implementation Milestones, Acceptance, and Testing — Open-Ended Sandbox

This document defines acceptance for the current Away Message product direction.

> Away Message is an open-ended sandbox. There is no canonical final day, ending, fixed protagonist NPC, mandatory named-character path, required social encounter, or completion transition.

## 1. Definition of a healthy sandbox build

A build is healthy when a player can start a new save and continue indefinitely while the simulation remains coherent.

The player must be able to:
1. choose/receive a valid current residence without a sacred room ID;
2. obtain and use computer hardware through real ownership/setup rules;
3. work, earn, spend and face recurring obligations;
4. discover/download/install/use software through the fake internet;
5. leave the PC while downloads, schedules, messages and world state continue;
6. discover a dynamic roster of people without requiring specific named NPCs;
7. build relationships and memories through governed social rules;
8. use local walking/transit between known places;
9. experience optional truthful in-person encounters when state permits;
10. personalize/move residence while preserving exact belongings;
11. save/reload current-format state without losing meaningful truth;
12. continue beyond any arbitrary day count without completion semantics.

## 2. Critical simulation continuity

- [ ] One authoritative clock exists and is monotonic.
- [ ] PC, world, jobs, downloads, transit and social systems share the same time.
- [ ] Time jumps advance all relevant systems through the canonical path.
- [ ] Background systems do not pause merely because their UI is hidden.
- [ ] Residence/Tenancy belongs to simulation truth.
- [ ] Character physical/device/online presence stays coherent.
- [ ] Active travel continues without requiring a visible travel scene.
- [ ] No fixed day triggers a product ending or completion mode.

## 3. Computer and software progression

- [ ] Hardware/software ownership is real state, not decorative UI.
- [ ] Downloads create real files and continue in background.
- [ ] Installers validate requirements and consume storage.
- [ ] Compatibility failures can be resolved through real upgrades.
- [ ] Installed/portable/uninstalled states remain distinct.
- [ ] Internet speed materially affects transfer timing.
- [ ] PC setup resolves a capable current residence/work surface, never a sacred room ID.

## 4. Dynamic social sandbox

- [ ] The roster may vary by save/content.
- [ ] No product rule requires any specific named NPC.
- [ ] Roles/capabilities/state drive work, meetings, services and opportunities.
- [ ] Relationship dimensions are hidden simulation truth.
- [ ] Characters may initiate interactions according to truthful context.
- [ ] Messages can arrive while the player is away.
- [ ] Physical meetings are optional outcomes of schedules, knowledge, relationship and location—not scripted campaign gates.
- [ ] A character may be renamed, replaced, absent, never discovered or never met without invalidating the save.
- [ ] AI never owns canonical timing, knowledge, relationships, location, money, items or consequences.

## 5. Internet and discovery

- [ ] Fake URL routing works for authored local sites.
- [ ] Search accepts free text and curated/systemic discovery.
- [ ] Sites can expose software, people, jobs, housing, places and clues.
- [ ] Knowledge gating prevents undiscovered world truth from leaking.
- [ ] Different sites retain distinct period-authentic identities.
- [ ] Generated/AI surfaces are validated, fictional and era-bounded.

## 6. World, residence and daily life

- [ ] `home` resolves from current Residence/Tenancy state.
- [ ] Missing facilities remain genuinely unavailable locally.
- [ ] Player-owned belongings retain exact identity/location.
- [ ] Landlord/property fixtures remain a distinct ownership domain.
- [ ] Moving residence preserves eligible belongings without duplication/loss.
- [ ] Town geography uses stable district/place identities.
- [ ] Districts are groupings over one simulation, not levels.
- [ ] Walking/transit consume authoritative time/cost exactly once.
- [ ] Bus stops/lines/service/waits/fares come from generated simulation data.
- [ ] Living-place presentation reflects time/weather/world state without creating it.

## 7. Narrative and AI

- [ ] Rules decide; AI paraphrases.
- [ ] AI output is schema-validated and knowledge-safe.
- [ ] Offline/template fallback keeps the simulation healthy when providers fail.
- [ ] Authored narrative content, when present, is optional and actor/state driven.
- [ ] No fixed authored arc is required for normal sandbox progression.
- [ ] No canonical "ending reached" condition is required.

## 8. Persistence

Historical development saves remain disposable until an explicit future save-compatibility freeze.

Current-format saves must:
- round-trip without corruption;
- preserve current residence, belongings, hardware/software, social state, character state, knowledge and active travel;
- reject incompatible/newer formats cleanly.

## 9. Automated tests

Maintain strong pure-logic coverage for:
- clock/time advancement;
- downloads/files/software;
- economy/body state;
- residence/ownership/physical interactions;
- schedules/Life Matrix/character intent;
- relationships/memory/knowledge;
- transit/travel;
- persistence;
- content validation/codegen.

Tests must use generic actors/roles unless a named fixture is specifically the thing being tested. A fixture name is never product authority.

## 10. End-to-end scenarios

E2E coverage should prove representative sandbox loops rather than one canonical campaign:
- new save → residence → PC/software loop;
- background download + leaving/returning;
- work/economy/recurring obligations;
- housing improvement/move;
- dynamic social contact and optional in-person encounter;
- district + bus continuity;
- save/reload during meaningful active state;
- long-running time advancement with no ending/completion transition.

## 11. Quality bar

- [ ] No recurring console errors.
- [ ] No critical placeholder UI that fakes state.
- [ ] No renderer creates canonical simulation truth.
- [ ] No permanent `home -> room_104` authority.
- [ ] No named NPC is architectural authority.
- [ ] No fixed day is a product completion gate.
- [ ] No transit result is fabricated by presentation.
- [ ] No duplicate relationship/appointment/job/event/transit authority exists.
- [ ] Core play survives AI/provider failure through bounded fallbacks.
- [ ] Content validation catches invalid authored references before runtime.

## 12. Telemetry and diagnostics

Telemetry is optional local diagnostic data, not a completion certificate.

Useful fields include:
- real play time;
- game days elapsed (unbounded);
- PC vs physical-world time;
- software/download activity;
- money/work/rent history;
- residence history and moves;
- contacts discovered/interacted with;
- places/districts visited;
- walking/transit usage;
- important systemic events.

Do not emit a percentage-complete score, final-day certificate, or "ending reached" requirement for the sandbox.

## 13. The questions the sandbox must answer

Across different saves:
1. Is ordinary life interesting even without a scripted plot?
2. Does residence progression feel material?
3. Do computer/software upgrades change behavior rather than only numbers?
4. Does the fake internet reward curiosity?
5. Do dynamic characters feel like people with lives rather than quest dispensers?
6. Do relationships emerge differently across saves?
7. Does the town feel coherent without continuous open-world traversal?
8. Do time, money, housing and travel create useful trade-offs?
9. Do online and physical life strengthen each other?
10. Is there a reason to keep playing because the sandbox keeps generating meaningful situations?

If the answer requires a specific named character or fixed day, the system is too scripted.


## 14. Production Phase A playable-art gate

Before broad final-art/content scaling, prove one representative production slice.

The slice should include:
- a real cheap residence with modular stateful fixtures/props;
- visible PC/belonging setup;
- window/street atmosphere;
- one production modular character through the real CharacterRenderer seam;
- one hero public place;
- bus stop + bus interior;
- time/weather/lighting/ambient-motion/audio integration.

Acceptance should exercise a short real loop:

```text
home → PC/window → leave → public place → actor → transit → home → time/weather change → save/reload
```

The gate is both technical and experiential.

Automated evidence should cover deterministic state and runtime integration where possible.

Local evidence should judge:
- visual readability/coherence;
- character/environment fit;
- fixture-swap correctness;
- weather/wetness/light behavior;
- audible ambience/spatial behavior;
- no obvious duplicate canvases/audio/listeners;
- acceptable target-browser frame pacing;
- console sanity.

Issue #140 remains the canonical local living-world visual/audio/target-device acceptance gate and should be completed against this representative production slice rather than placeholders where practical.

Passing this gate authorizes **content scaling**, not a declaration that every future asset/style choice is frozen.
