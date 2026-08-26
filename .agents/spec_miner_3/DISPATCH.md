# Dispatch Assignment — Spec Miner 3

**Assigned Agent**: spec_miner_3
**Role**: teamwork_preview_spec_miner
**Working Directory**: f:/_WIP/away-message/.agents/spec_miner_3/
**Parent**: orchestrator_1 (39d67808-5c38-467e-ba13-2fc112f01e1c)

## Mission
Investigate and extract the authoritative specification for:
1. Narrative, Content, and Story Progression (`docs/04_narrative_and_content.md`, `docs/README.md`)
   - 14-Day Evaluation Build narrative arc: Day-by-day story beats, character arcs, and mystery reveals
   - Buddy characters: profiles, screen names, personality, schedules (online/away/offline states across 14 days), away message lore
   - Ink integration: Ink story structure, knots, stitches, variables, branching dialogues, choice consequence flags
   - Physical / Environmental Scenes: Bedroom window, desktop desk environment, notes, cassette player, day/night lighting shifts
   - Endings & Win/Loss conditions
2. Comprehensive Testing Strategy (`docs/06_testing_strategy.md`, `ORIGINAL_REQUEST.md`)
   - Unit and integration testing requirements (Vitest)
   - Playwright E2E test scenarios, 4-tier test architecture (Tier 1: Feature Coverage, Tier 2: Boundary & Corner, Tier 3: Cross-Feature, Tier 4: Real-World Scenarios)
   - Time simulation testing tools (fast-forward, deterministic ticks)
   - Acceptance criteria and zero-mock verification standards

## Deliverable
Write a comprehensive report to `f:/_WIP/away-message/.agents/spec_miner_3/analysis.md` and a summary `handoff.md` with:
- Full day-by-day (Day 1 - Day 14) narrative structure, character schedules, and dialogue branches
- Ink script requirements and state variable index
- Physical scene descriptions and environmental interactions
- Full testing matrix, runner requirements, and E2E scenario specifications

## 2026-08-22T02:50:39Z
You are Spec Miner 3 for Away Message.
Working directory: f:/_WIP/away-message/.agents/spec_miner_3/
Read f:/_WIP/away-message/.agents/spec_miner_3/DISPATCH.md and f:/_WIP/away-message/.agents/ORIGINAL_REQUEST.md.
Investigate docs/04_narrative_and_content.md, docs/06_testing_strategy.md, docs/README.md, and all docs.

Extract and document in full detail:
1. 14-Day Evaluation Build Narrative Architecture:
   - Day-by-day story arc (Day 1 through Day 14): key events, narrative pacing, mystery developments, character interactions
   - Buddy characters: complete profile matrix (screen names, personality, schedules across 14 days, away messages, dialogue branches)
   - Ink Story Integration: inkjs narrative engine, story variables, knots, stitches, choices, divergence points, state synchronization with game state
   - Physical / Bedroom Scenes: ambient environment, desk elements, window views, lighting progression, audio cues
   - Endings & Win/Loss conditions
2. Testing Strategy & Verification:
   - Vitest unit and integration test matrices across all modules
   - Playwright E2E 4-Tier test architecture (Tier 1: Feature Coverage >= 5 per feature; Tier 2: Boundary & Corner >= 5 per feature; Tier 3: Cross-Feature combinations; Tier 4: Real-World application scenarios)
   - Test harness, deterministic time simulation runner, zero-mock criteria

Write your complete detailed findings to f:/_WIP/away-message/.agents/spec_miner_3/analysis.md and a summary handoff report in f:/_WIP/away-message/.agents/spec_miner_3/handoff.md.
When finished, send a message to orchestrator_1 with a summary of findings and the path to your handoff file.
