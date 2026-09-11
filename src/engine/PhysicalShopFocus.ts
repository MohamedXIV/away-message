import type { PhysicalShopFixtureDefinition, PhysicalShopState } from './PhysicalShopEngine';

export type PhysicalShopFixtureKind =
  | 'shelf'
  | 'fridge'
  | 'freezer'
  | 'counterDisplay'
  | 'rack'
  | 'bin'
  | 'cashierCounter';

export interface PhysicalShopFocusEnvironment {
  /** Generic authored lighting profiles consumed by the world renderer. */
  lightProfileIds: readonly string[];
  /** Generic authored audio profiles consumed by the world audio layer. */
  audioProfileIds: readonly string[];
  /** Renderer-neutral semantic effects such as condensation or dust. */
  effectTags: readonly string[];
}

export interface PhysicalShopFocusDefinition {
  /** Authored Living World view shown while this fixture is focused. */
  viewId: string;
  environment: PhysicalShopFocusEnvironment;
}

/**
 * Content-derived fixture contract. #28 and later stores author these records;
 * this domain layer only consumes them and never creates renderer objects.
 */
export interface PhysicalShopFocusableFixture extends PhysicalShopFixtureDefinition {
  kind: PhysicalShopFixtureKind;
  focus: PhysicalShopFocusDefinition;
}

export interface PhysicalShopContentRefs {
  viewIds: ReadonlySet<string>;
  lightProfileIds: ReadonlySet<string>;
  audioProfileIds: ReadonlySet<string>;
}

export interface PhysicalShopFocusProjection {
  fixtureId: string;
  kind: PhysicalShopFixtureKind;
  viewId: string;
  slots: Array<{ slotId: string; itemInstanceId: string | null }>;
  environment: {
    lightProfileIds: string[];
    audioProfileIds: string[];
    effectTags: string[];
  };
}

const EFFECT_TAG = /^[a-z][a-z0-9_-]{0,31}$/;

/**
 * Content validation boundary for the reusable shop fixture contract.
 * Invalid authored references fail loudly; runtime projection never repairs them.
 */
export function validatePhysicalShopFixtureContent(
  fixtures: readonly PhysicalShopFocusableFixture[],
  refs: PhysicalShopContentRefs,
): string[] {
  const errors: string[] = [];
  const fixtureIds = new Set<string>();

  for (const fixture of fixtures) {
    if (fixtureIds.has(fixture.id)) {
      errors.push(`shopFixtures/${fixture.id}.id: duplicate fixture id.`);
    }
    fixtureIds.add(fixture.id);

    if (!refs.viewIds.has(fixture.focus.viewId)) {
      errors.push(`shopFixtures/${fixture.id}.focus.viewId: unknown view ${fixture.focus.viewId}.`);
    }

    for (const profileId of fixture.focus.environment.lightProfileIds) {
      if (!refs.lightProfileIds.has(profileId)) {
        errors.push(
          `shopFixtures/${fixture.id}.focus.environment.lightProfileIds: unknown light profile ${profileId}.`,
        );
      }
    }

    for (const profileId of fixture.focus.environment.audioProfileIds) {
      if (!refs.audioProfileIds.has(profileId)) {
        errors.push(
          `shopFixtures/${fixture.id}.focus.environment.audioProfileIds: unknown audio profile ${profileId}.`,
        );
      }
    }

    for (const tag of fixture.focus.environment.effectTags) {
      if (!EFFECT_TAG.test(tag)) {
        errors.push(
          `shopFixtures/${fixture.id}.focus.environment.effectTags: invalid semantic effect tag ${tag}.`,
        );
      }
    }
  }

  return errors;
}

/**
 * Renderer-neutral projection of one authored focusable fixture over the exact
 * persisted shop state. Missing stock is an empty slot; this function has no
 * authority to create, move, purchase, or otherwise mutate an item.
 */
export function projectPhysicalShopFocus(
  fixture: PhysicalShopFocusableFixture,
  state: PhysicalShopState,
): PhysicalShopFocusProjection {
  return {
    fixtureId: fixture.id,
    kind: fixture.kind,
    viewId: fixture.focus.viewId,
    slots: fixture.slots.map((slot) => ({
      slotId: slot.id,
      itemInstanceId: state.stockBySlot[slot.id] ?? null,
    })),
    environment: {
      lightProfileIds: [...fixture.focus.environment.lightProfileIds],
      audioProfileIds: [...fixture.focus.environment.audioProfileIds],
      effectTags: [...fixture.focus.environment.effectTags],
    },
  };
}
