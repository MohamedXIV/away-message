# Issue #88 — Housing Progression Implementation Plan

## Goal
Build player-facing housing choice, rent, upgrades, and moving on top of the existing canonical authorities: Residence/Tenancy (#102), generic physical context (#103), and modular residence projection (#87). Housing must not become a second location, inventory, interaction, delivery, or renderer authority.

## Architecture boundaries
- Residence/Tenancy owns only current tenancy/home and tenancy economic terms.
- Housing offers reference canonical authored Place identities; availability/affordability filters offers rather than inventing a fixed start or abstract infinite residences.
- Property-owned fixtures remain concrete physical objects associated with their property. Player-owned belongings preserve exact object identity across moves.
- Installation/movement uses `PhysicalContextRuntime` compatibility and object-location contracts; housing does not duplicate slot legality.
- `home` resolves through current tenancy immediately after commit. Normal Place/service, physical affordance, context requirement, delivery, and spatial systems consume that Place.
- Phaser consumes the resulting canonical physical state through #87 projection only.
- Historical pre-freeze development saves are disposable; no migration shims for old residence assumptions.

## Delivery slices
1. **Offer/tenancy domain contract (RED → GREEN).** Add a pure housing progression service over authored residence candidates + current economy/tenancy inputs. Prove availability and affordability produce a constrained set with synthetic Place IDs; committing one offer creates exactly one current tenancy and charges move-in cost once.
2. **Rent/property package contract.** Represent tenancy terms and property-supplied fixture package without mirroring direct object affordances. Prove rent changes with property terms/package while player-owned decor does not alter rent.
3. **Authoritative move transaction.** Transfer eligible player-owned physical object instances to compatible target slots while property-owned fixtures stay behind. Preserve exact instance IDs; reject incompatible targets; prove no duplicate/loss on success or failure.
4. **Cross-authority consumers.** Prove semantic `home`, Place/service context, direct reachable affordances, composed requirements, and delivery routing all observe the newly committed canonical Place through their existing authorities rather than housing-specific fallbacks.
5. **Data-driven progression proof.** Use synthetic authored data to prove a better-room path and a tiny-apartment path are representable without new residence-specific renderer/interaction architecture.
6. **Final verification.** Run content check when relevant, typecheck, build, baseline guard/self-test, focused tests, full tests, exact-head GitHub Verify, complete diff/review-thread/mergeability audit before Ready/merge.

## Non-goals
No Housing Level/XP, no fixed starting room, no residence-wide `canX` booleans, no box-by-box moving simulator, no duplicated inventory/ownership graph, no renderer-owned housing truth, no #95 actor-presentation scope, and no generated-content redesign unless a concrete #88 acceptance criterion requires authored data extension.