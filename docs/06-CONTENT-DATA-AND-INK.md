# Content Data and Governed Narrative Integration

## 1. Content philosophy

Game content should be data-driven enough that adding:
- a program,
- a website,
- a character,
- a location,
- an observation,
does not require editing unrelated UI logic.

Do not make the sandbox build a forest of one-off hardcoded components.

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

## 9. Governed narrative/content pipeline

Narrative-facing content is optional sandbox content, not a required campaign script.

Authorable definitions may describe:
- characters and roles;
- dialogue pools/persona hints;
- world events;
- knowledge/disclosure constraints;
- semantic interaction options;
- optional local story/event templates.

Generated or authored text must never become a second database for simulation truth.

## 10. Narrative variable policy

Narrative surfaces read approved projections from simulation.

Prefer generic actor/state lookups:

```
relationship(actorId, "trust")
actor_has_role(actorId, "diner-staff")
player_knows(placeId)
world_flag("festival_active")
```

Do not create special variables such as `mayaTrust` or other fixed-cast fields.

## 11. Semantic effects

Text/content may request only validated semantic actions, for example:

```
# effect:appointment_offer:<actorId>:<placeId>
# effect:discover_place:<placeId>
# effect:discover_site:<siteId>
# social:<actorId>:empathy
```

Owning domain systems validate and commit the actual result.

## 12. Social-action tags

Social tags target the actor involved in the current interaction, not a sacred named NPC.

```
# social:<actorId>:empathy
# social:<actorId>:tease_playful
# social:<actorId>:dismissive
# social:<actorId>:remembered_detail
```

## 13. Narrative organization

Organize optional content by capability, place, event, archetype or reusable interaction template where practical.

Avoid directory/file layouts that imply a fixed mandatory cast or linear day-by-day campaign.

## 14. Narrative testing

Test:
- knowledge safety;
- semantic effect validation;
- actor-agnostic role/capability resolution;
- deterministic consequence ownership;
- provider failure/fallback behavior;
- save/reload of relevant social/world state.

Do not test that every save follows the same named-character arc.

## 15. Content validation command

Content validation/codegen remains mandatory where authorable data is involved. Invalid cross-references should fail before runtime.

## 16. Content is replaceable

The architecture must tolerate content replacement.

A character can be renamed, replaced or removed. A place can be promoted from light to rich presentation. A website or job can disappear. These changes must not require rewriting unrelated engines.

The old fixed 14-day/fixed-cast experiment has no authority over current content design.
