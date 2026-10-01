# Environment, Player Needs, Mood, and Game Context Authority

Status: **Canonical design direction for #128–#132**

Related issues: #128, #129, #130, #131, #132, #29

This document defines the authority boundaries for Away Message's environment/weather, player physiological/social needs, mood, and the public game-context read API.

The goal is not to bolt two new meters onto the current runtime. The goal is to correct ownership now, while pre-freeze save compatibility is still disposable, so later apps, physical-world presentation, audio, Inner Voice, Life Matrix, world events, and authored activities can consume one coherent simulation truth.

---

## 1. Why this foundation exists

The current codebase has useful pieces, but their boundaries grew incrementally:

- `WeatherEngine` is primarily a deterministic day-based weather helper rather than a complete authoritative environment service.
- `WorldEventsEngine` already owns triggered world events and exposes bounded semantic modifiers.
- Phaser's `EnvironmentManager` is a capable living-scene renderer, but presentation code must not become weather/gameplay authority.
- `EconomyEngine` currently spans finance plus energy, fatigue, hunger, health, sleep debt, social battery, and legacy compatibility concerns.
- apps and presentation layers need stable read contracts rather than importing engine implementations or re-deriving thresholds.

Keeping those seams and merely adding `mood` would turn Economy/Simulation into an increasingly coupled god object.

The approved direction is therefore:

```text
GameClock
   │
   ├─────────────────────────────┐
   │                             │
   ▼                             ▼
Base climate/weather rules   WorldEventsEngine
                                  │
                           typed bounded modifiers
                                  │
                                  ▼
                           EnvironmentEngine
                                  │
                         EnvironmentSnapshot
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
         apps/sites          Phaser/audio        Mood context


Finance authority                  PlayerNeedsEngine
  cash                              energy
  rent/bills                        fatigue
  wages/payments                    hunger
                                    health
                                    sleep debt
                                    social battery
             \                      /
              \                    /
               └── Simulation orchestration
                          │
                          ▼
                     MoodEngine
                          │
                     MoodSnapshot
                          │
       Inner Voice / UI / activities / future systems

All consumer reads converge through a stable Game Context read boundary.
```

---

## 2. Authority laws

These are non-negotiable unless the user explicitly changes direction.

### 2.1 One resolved environment truth

Any system asking "what is the weather/environment now?" must receive the same resolved semantic snapshot.

Do not allow:

- WeatherBuddy to derive one answer;
- Phaser to invent another;
- audio to infer rain independently;
- Mood to import `WeatherEngine` directly;
- world-event code to mutate presentation state.

The canonical owner is the simulation-side **Environment domain**.

### 2.2 World events publish effects, not mutations

`WorldEventsEngine` remains the authority for triggered global/world events.

It may expose typed, bounded modifiers such as:

- condition override;
- temperature delta;
- precipitation delta;
- wind delta;
- visibility delta.

It must not directly mutate Environment state or Phaser state.

`EnvironmentEngine` resolves the active modifier set deterministically and preserves source-event provenance.

### 2.3 Renderers are consumers

Phaser `EnvironmentManager` may own presentation-only transient behavior:

- rain emitters;
- droplets;
- puddle visuals;
- lightning flashes;
- lighting presentation;
- ambient motion;
- camera/view-local effects.

It does **not** own whether it is raining, how severe the canonical weather is, or whether a world event changed the environment.

Audio follows the same rule.

### 2.4 Finance is not the player's body

New work must stop expanding `EconomyEngine` into a catch-all player-state authority.

Finance owns financial truth.

Player Needs owns physiological/social-resource truth.

Mood owns psychological affect state.

Spatial systems own physical position/presence.

Inventory/physical-item systems own possessions and food item truth.

### 2.5 Mood is an independent dimension

Mood is not:

- energy;
- fatigue;
- health;
- hunger;
- social battery;
- relationship affinity;
- money;
- a presentation-only facial expression.

Those values may influence Mood, but none is a substitute for it.

A player may correctly be:

```text
Mood: good
Energy: exhausted
Social battery: empty
Hunger: fine
Health: good
```

### 2.6 No arbitrary mood deltas from consumers

Do not scatter calls equivalent to:

```ts
mood += 7;
```

through apps and gameplay code.

Discrete experiences submit semantic effects:

```ts
mood.applyEffect({
  kind: 'pleasant_social_interaction',
  sourceRef: conversationId,
});
```

The Mood domain owns magnitude, cap, duration, deduplication, stacking, and decay.

### 2.7 Cross-domain actions are orchestrated

A single player action may affect multiple authorities.

Example:

```text
work shift
  ├─ Finance → wage/payment
  ├─ Player Needs → energy/fatigue/hunger
  └─ Mood → only through explicit semantic/contextual consequences
```

Finance must not secretly own or mutate all three domains.

`SimulationEngine` or a future narrow transaction/orchestration layer coordinates these consequences.

### 2.8 Public reads use stable contracts

Apps, React UI, Phaser, audio, Inner Voice, and future systems should not need implementation imports such as:

```ts
import { WeatherEngine } from ...
import { MoodEngine } from ...
```

for ordinary reads.

They consume a stable read-only game-context boundary.

---

## 3. Environment domain

### 3.1 Base weather provider

The existing deterministic weather logic remains useful, but it is not the public authority.

It may become an internal pure provider such as:

```text
BaseClimateProvider
        ↓
EnvironmentEngine
```

The exact filename/name is implementation detail.

The base provider must remain:

- deterministic;
- open-ended;
- queryable for arbitrary simulation time;
- side-effect free;
- independent from Phaser/React.

The existing repeating authored weather pattern may remain the first provider.

### 3.2 Resolve by simulation time, not permanently by day only

The canonical Environment query boundary should accept simulation time/minutes rather than expose an API permanently constrained to `dayNumber`.

Representative shape:

```ts
interface EnvironmentQuery {
  atMinute: number;
  placeId?: string;
  districtId?: string;
}
```

The first implementation may still resolve town-wide weather. The query contract should leave room for future place/district/local effects without another API break.

### 3.3 Environment snapshot

Representative semantic result:

```ts
interface EnvironmentSnapshot {
  atMinute: number;
  day: number;

  weather: {
    condition:
      | 'clear'
      | 'overcast'
      | 'drizzle'
      | 'rain'
      | 'fog'
      | 'storm'
      | 'heat';

    temperatureF: number;
    highF: number;
    lowF: number;

    precipitation: number; // normalized 0..1
    wind: number;          // normalized 0..1
    visibility: number;    // normalized 0..1

    tags: string[];
  };

  sourceEventIds: string[];
}
```

Exact vocabulary may evolve. The principle is that consumers receive semantic information, not renderer-specific flags.

### 3.4 Forecast

Forecasting must:

- derive from the same base/environment rules;
- be deterministic;
- not mutate simulation state;
- apply known/resolved world-event modifiers only according to documented rules;
- remain bounded in horizon.

WeatherBuddy should ultimately read this API rather than reimplement its own weather truth.

### 3.5 WorldEvents integration

The modifier flow is:

```text
World event triggers
        ↓
WorldEventsEngine exposes typed environment modifiers
        ↓
EnvironmentEngine resolves base + modifiers
        ↓
EnvironmentSnapshot
```

Avoid circular ownership:

```text
Environment → WorldEvents → Environment → ...
```

The simulation orchestrator may evaluate event triggers using an environment snapshot where a rule explicitly needs it, but the dependency must remain directional and deterministic.

### 3.6 Environment events

Expose a semantic event equivalent to:

```text
environment:changed
```

Emit only when the resolved semantic snapshot changes meaningfully.

Do not fire every render frame or every simulation tick when nothing changed.

---

## 4. Player Needs domain

### 4.1 Canonical owned state

Representative state:

```ts
interface PlayerNeedsState {
  energy: number;
  fatigue: number;
  hunger: number;
  health: number;
  sleepDebt: number;
  socialBattery: number;
}
```

The exact normalized ranges may remain compatible with current game rules.

### 4.2 Owned rules

Player Needs owns:

- normal time drift;
- hunger progression;
- energy/fatigue interaction;
- sleep debt;
- sleep/rest recovery;
- health consequences from needs;
- social-battery spend/recovery;
- clamps;
- semantic derived bands/flags.

Consumers should be able to ask for a read projection such as:

```ts
interface PlayerNeedsSnapshot {
  energy: number;
  fatigue: number;
  hunger: number;
  health: number;
  sleepDebt: number;
  socialBattery: number;

  energyBand: string;
  hungerBand: string;
  exhaustion: boolean;
}
```

UI should not duplicate thresholds.

### 4.3 What Player Needs does not own

Do **not** move these legacy concerns into Player Needs:

- player physical location;
- Place/Space membership;
- transit state;
- pantry/item ownership;
- physical food inventory;
- cash;
- rent;
- wages;
- Mood.

Legacy fields may temporarily exist as compatibility projections while consumers migrate, but they must not become new authority.

### 4.4 Finance boundary

Economy may be narrowed in-place first or later renamed to a clearer Finance domain.

Canonical finance concerns include:

- cash;
- rent;
- bills;
- wage/payment validation;
- financial transactions.

Do not spend migration effort on historical development saves before save-compatibility freeze merely to preserve a bad state shape.

---

## 5. Mood domain

### 5.1 Persisted state versus read projection

Representative persisted state:

```ts
interface MoodState {
  baseline: number;
  effects: MoodEffect[];
  lastUpdatedMinute: number;
}
```

Representative resolved read model:

```ts
interface MoodSnapshot {
  value: number;
  band: 'miserable' | 'low' | 'neutral' | 'good' | 'great';
  baseline: number;
  influences: MoodInfluence[];
}
```

The resolved snapshot should explain why the value exists.

Example diagnostic/read projection:

```text
Baseline                   52
Good sleep                 +8
Severe hunger              -6
Pleasant conversation      +7
Storm discomfort           -3
Rent pressure              -8
--------------------------------
Current mood               50
```

### 5.2 Contextual influences

Contextual influences are derived from current canonical state.

Examples may include:

- severe hunger;
- exhaustion;
- poor health;
- sleep quality/debt;
- financial pressure;
- current environment/weather;
- social-battery state;
- time/activity context.

They are **reconciled**, not blindly appended.

If rain contributes `-2`, three hours of rain must not become:

```text
-2
-2
-2
-2
...
```

each tick.

The contextual influence has a stable identity and disappears/changes when context changes.

### 5.3 Transient semantic effects

Transient effects represent discrete experiences with provenance.

Examples:

- pleasant social interaction;
- argument;
- rejection;
- kept promise;
- broken promise;
- satisfying activity;
- stressful failure;
- meaningful achievement.

Representative effect:

```ts
interface MoodEffect {
  id: string;
  kind: MoodEffectKind;
  sourceRef: string;
  startedAtMinute: number;
  expiresAtMinute?: number;
}
```

Rules decide:

- magnitude;
- duration;
- decay;
- maximum stacking;
- duplicate-source behavior;
- bounds.

### 5.4 Player subjectivity

Do not hard-code universal assumptions such as:

- every player hates rain;
- every player loves clear weather;
- every player gains Mood from socializing;
- every player responds identically to solitude.

Initial rules may be simple, but the architecture should leave room for player traits/preferences/personality modifiers.

Weather/environment influence should therefore be expressed through explicit Mood rules/preferences rather than scattered condition checks.

### 5.5 Mood influence on other systems

Mood may later influence:

- Inner Voice tone/eligibility;
- expression/puppet presentation;
- activity desirability;
- dialogue flavor/options;
- work/activity modifiers where explicitly designed;
- future apps/sites.

Prefer modifiers and semantic context over hard gates.

Avoid arbitrary rules such as:

```text
Mood < 20 → cannot use computer
```

unless a future mechanic explicitly requires such a restriction.

### 5.6 NPC knowledge safety

NPCs must not magically know the player's exact private Mood number.

Mood may create visible/behavioral cues through a separate epistemic/presentation layer.

Existing knowledge-safety laws still apply.

---

## 6. Stable Game Context read API

After the underlying owners exist, expose a stable read boundary equivalent to:

```ts
interface GameContextReadApi {
  time: {
    current(): GameTime;
  };

  environment: {
    current(context?: EnvironmentContext): EnvironmentSnapshot;
    at(query: EnvironmentQuery): EnvironmentSnapshot;
    forecast(query: ForecastQuery): EnvironmentSnapshot[];
  };

  player: {
    needs(): PlayerNeedsSnapshot;
    mood(): MoodSnapshot;
  };
}
```

Exact object layout/name may follow existing `SimulationEngine` conventions.

The important rules are:

- reads are stable and read-only;
- commands/mutations remain separate;
- consumers do not depend on concrete implementation classes;
- derived semantic thresholds live with their owning domain;
- subscriptions use typed EventBus events.

---

## 7. Required real consumers

The foundation is not complete until actual consumers migrate.

### WeatherBuddy / software

Must read current weather and forecast through the public Environment/Game Context API.

No direct `WeatherEngine` import for ordinary app behavior.

### Phaser environment

Receives canonical semantic Environment data and translates it to:

- particle profiles;
- rain layers;
- window droplets;
- puddle/wetness presentation;
- light/sky treatment;
- ambient motion.

Presentation does not create weather truth.

### Audio

Rain/wind/environment ambience derives from the same Environment snapshot.

### Inner Voice

Consumes knowledge-safe semantic Mood/Needs/Environment context.

Rules still choose meaning/timing; AI only paraphrases approved thought semantics.

### Player UI

Needs/Mood display reads canonical snapshots rather than legacy flat state thresholds.

---

## 8. Persistence policy

This work occurs before save-compatibility freeze.

Therefore:

- prefer correct current-format authority over legacy-field preservation;
- breaking old development saves is acceptable;
- current-format save/reload must be deterministic;
- required transient Mood effects must survive reload;
- fully derivable contextual Mood influences do not need redundant persistence;
- incompatible pre-freeze saves may be refused/reset cleanly.

Do not add migration shims merely to preserve obsolete ownership.

---

## 9. Migration strategy

Do not attempt a giant rewrite in one commit.

Approved sequence:

1. **#129 — Environment authority**
   - create canonical Environment domain;
   - integrate typed WorldEvents modifiers;
   - preserve pure deterministic base weather;
   - establish semantic snapshot/forecast.

2. **#130 — Player Needs extraction**
   - move canonical body/social-resource state out of Economy;
   - narrow Finance ownership;
   - keep temporary compatibility projections only where current consumers require them.

3. **#131 — Mood**
   - build baseline/contextual/transient model;
   - integrate only through Environment/Needs read boundaries;
   - persist necessary transient history.

4. **#132 — Game Context + consumer migration**
   - expose stable read API;
   - migrate WeatherBuddy, Phaser, audio, Inner Voice, player UI and other applicable consumers;
   - remove obsolete compatibility paths once no live consumers remain.

5. **#29 — living-world integration gate**
   - prove the combined system in the larger physical-world acceptance scenario.

---

## 10. Compatibility and refactor policy during implementation

The user explicitly approved changing or rebuilding existing systems when that produces the cleaner long-term authority model.

Agents should therefore:

- prefer deleting accidental duplication over wrapping it forever;
- prefer bounded compatibility facades over permanent dual authority;
- update tests to the new canonical contract;
- preserve behavior that is still intended, not obsolete ownership;
- avoid branch-wide speculative rewrites unrelated to #128.

A current class/file name is not a product requirement.

---

## 11. Testing laws

At minimum prove:

### Environment

- deterministic result for same time + event state;
- base weather works without events;
- event modifier changes resolved environment without direct mutation;
- expired event restores base truth;
- conflict precedence/caps deterministic;
- forecast is read-only/deterministic;
- semantic change events are deduped.

### Player Needs

- one canonical owner;
- deterministic time drift;
- sleep/rest behavior;
- hunger/health/energy interaction;
- social battery remains independent from Mood;
- cross-domain work action affects Finance + Needs through orchestration.

### Mood

- deterministic baseline + contextual + transient resolution;
- contextual effects do not stack per tick;
- duplicate transient source handling is deterministic/idempotent where required;
- expiry/decay survives large time jumps;
- current-format save/reload works;
- influence list explains resolved value.

### Integration

One end-to-end scenario should prove:

```text
world event triggers
  → typed environment modifier
  → EnvironmentSnapshot changes
  → WeatherBuddy + Phaser/audio see the same truth
  → Mood contextual influence reconciles once
  → Inner Voice can consume safe semantic context
  → time jump expires event/effect
  → all consumers return to consistent base truth
```

---

## 12. Explicit non-goals

This foundation does **not** require:

- meteorological simulation;
- real-world weather APIs;
- per-block microclimate;
- a psychiatric simulation;
- Mood deciding all player actions;
- NPC telepathy about player Mood;
- preserving every historical development save;
- renaming every existing class before useful migration begins;
- rebuilding Phaser's visual effects that already work.

The target is clear authority and extensibility, not maximum simulation complexity.

---

## 13. Source of truth for agents

When implementation details disagree with this document during #128 work:

1. explicit current user direction wins;
2. this document defines intended authority;
3. #128–#132 define executable scope/acceptance;
4. existing code is migration input, not automatically the intended final boundary.

Do not preserve a legacy seam merely because it already exists.
