## Delivered change
<!-- Describe the player-visible outcome or the concrete engineering acceptance boundary, not just files/commits. -->

## Canonical documentation consulted (required)
<!-- List exact repository doc paths/sections and one or two relevant decisions you followed. AGENTS.md alone is not sufficient when domain docs exist. -->
- [ ] Read root `AGENTS.md` and the relevant issue/acceptance criteria.
- Canonical docs / sections:
- Applicable architecture/product decisions:
- Conflicts or intentional changes to canonical decisions (must have explicit owner approval):

<!-- Physical-place, art, Phaser, content, room, camera, or asset PRs must also complete this section. Delete it only when genuinely not applicable. -->
### Authored world / production-art contract (when applicable)
- [ ] Read `docs/11-SPATIAL-PRESENCE-VENUES-AND-ACTOR-PRESENTATION.md` and `docs/14-FIRST-PRODUCTION-ART-AND-PLAYABLE-SLICE.md` §4.
- Place → Space → View(s) → Focus / Anchors mapping, and **why** this number of Views (single-view #167 is not a global rule):
- Shared canonical objects vs view-specific representations; mutable prop/layer strategy:
- 3D reference / camera / AI-generation consistency plan, if used (or "not used"):
- Presentation/semantic-intent boundary and targeted runtime evidence:

## Verification at this milestone
<!-- Identify exact commands/tests actually run, results, and any unexecuted or manual gate. Do not label a skipped check passed. -->
- Focused checks:
- Typecheck / build / full tests, as applicable:
- Browser / visual / audio / performance evidence, as applicable:
- Remaining risks, blockers, and human acceptance:

## Coordination
- Issue:
- Canonical working branch:
- Other open PRs / agent lanes intentionally left untouched:
