# Content Data and Ink Integration

## 1. Content philosophy

Game content should be data-driven enough that adding:
- a program,
- a website,
- a character,
- a location,
- an observation,
does not require editing unrelated UI logic.

Do not make the evaluation build a forest of one-off hardcoded components.

---

## 2. Software definition

Suggested:

```ts
interface SoftwareDefinition {
  id: string;
  name: string;
  version: string;
  downloadFileId: string;
  downloadBytes: number;
  installedBytes: number;
  requirements: {
    minOs: number;
    minRamMb: number;
    minCpuTier: number;
  };
  memoryMb: number;
  startupCost: number;
  installer?: InstallerDefinition;
  appId?: string;
}
```

---

## 3. Website definition

Suggested:

```ts
interface WebsiteDefinition {
  id: string;
  host: string;
  title: string;
  homeRoute: string;
  requiredFlags?: string[];
  pages: WebsitePageDefinition[];
}
```

Dynamic sites can use custom React components while still registering through the same index.

---

## 4. Character definition

Suggested:

```ts
interface CharacterDefinition {
  id: string;
  displayName: string;
  handles: string[];
  scheduleId: string;
  communicationStyle: CommunicationStyle;
  presentation: CharacterPresentationRefs;
  initialRelationship: RelationshipDimensions;
}
```

Knowledge/secrets can live in narrative/world data rather than the visual definition.

---

## 5. Schedule definition

Suggested:

```ts
interface WeeklyScheduleBlock {
  days: number[];
  startMinute: number;
  endMinute: number;
  status: 'offline' | 'online' | 'away' | 'busy';
  activity?: string;
}
```

Authored events can override schedule blocks.

---

## 6. Location definition

Suggested:

```ts
interface LocationDefinition {
  id: string;
  title: string;
  viewpoints: ViewpointDefinition[];
  timeVariants: TimeVariantDefinition[];
  hotspots: HotspotDefinition[];
  ambientLayers: AmbientLayerDefinition[];
}
```

---

## 7. Observation definition

Suggested:

```ts
interface ObservationDefinition {
  id: string;
  priority: number;
  once?: boolean;
  conditions: ConditionDefinition[];
  text: string;
  effects?: EffectDefinition[];
}
```

Use this for window thoughts and small physical observations.

---

## 8. Condition/effect model

Prefer a small validated declarative model.

Condition examples:
- day >= N
- time band
- flag true
- relationship dimension threshold
- software installed
- item/file exists
- observation count
- cash threshold

Effect examples:
- set flag
- schedule event
- add contact
- unlock website
- create file
- semantic social action
- adjust money through domain action

Avoid embedding arbitrary JavaScript strings in content.

---

## 9. Ink build pipeline

Source:

```text
narrative/*.ink
```

Build-time:
- compile Ink to JSON using a compatible Ink compiler
- validate compilation
- place compiled JSON under `src/narrative/compiled/` or equivalent

Runtime:
- inkjs loads compiled story
- game sets approved external/context variables
- player advances story/choices
- adapter reads output lines and tags
- validated semantic tags become simulation actions

---

## 10. Ink variable policy

Ink may contain narrative-local variables.

Authoritative game-state values should be injected/read through the adapter.

Avoid maintaining duplicate mutable truth such as:

```text
Ink: mayaTrust = 4
Simulation: mayaTrust = 7
```

Relationship truth belongs in simulation.

Ink can receive:
`maya_trust_band = "medium"`

or a numeric read-only value for conditions.

---

## 11. Narrative effects

Use tags or a controlled bridge.

Example Ink output:

```text
Maya: maybe we could grab coffee saturday
# beat:maya_invite
# effect:appointment_offer:maya:cafe
```

The adapter parses and validates the effect.

The simulation decides:
- whether it is legal,
- what state to change,
- what appointment record to create.

Ink does not directly mutate arbitrary game objects.

---

## 12. Social-action tags

Example:

```text
# social:maya:empathy
# social:maya:tease
# social:maya:dismiss
# social:maya:remembered_detail
```

The relationship system applies tuned effects.

This keeps narrative writing semantic and balance centralized.

---

## 13. Narrative organization

Recommended:

```text
narrative/
  main.ink

  characters/
    ryan.ink
    maya.ink
    nora.ink

  arcs/
    opening.ink
    software.ink
    meeting.ink
    strange-thread.ink
    ending.ink

  ambient/
    work.ink
    window.ink
```

Keep files focused and grep-friendly.

---

## 14. Ink testing

Test:
- all included Ink compiles,
- named knots/stitches exist,
- critical beats are reachable under canonical states,
- forbidden early reveal flags are not present,
- ending can be reached from more than one reasonable progression state.

---

## 15. Content validation command

The project should expose one development command that validates:

- Zod content schemas,
- duplicate IDs,
- missing references,
- Ink compilation,
- required websites,
- required software,
- critical location asset references.

Exact command name is implementation choice.

---

## 16. Content is replaceable

Final art, names, and many lines can change later.

Stable IDs should be semantic and not tied to filenames.

Good:
`char.maya`
`software.pulse.5`
`location.cafe`

Bad:
`pretty_girl_final2`
`app7`
`bg_new_new`
