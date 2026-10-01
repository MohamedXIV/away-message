import { GROCERY_SKUS } from './DeliveryEngine';
import {
  projectPhysicalShopFocus,
  validatePhysicalShopFixtureContent,
  type PhysicalShopFocusableFixture,
  type PhysicalShopFocusProjection,
} from './PhysicalShopFocus';
import type { PhysicalShopState } from './PhysicalShopEngine';
import {
  GENERATED_ANCHORS,
  GENERATED_AUDIO_PROFILES,
  GENERATED_LIGHT_PROFILES,
  GENERATED_SHOP_FIXTURES,
  GENERATED_SHOP_SLOTS,
  GENERATED_VIEWS,
} from './worldContent.generated';

const PHYSICAL_GROCERY_PREFIX = 'corner-mart:';

export interface GeneratedPhysicalShopDefinition {
  storeId: string;
  placeId: string;
  fixtures: PhysicalShopFocusableFixture[];
  pricesByDefinitionId: Record<string, number>;
}

function physicalDefinitionId(skuId: string): string {
  return PHYSICAL_GROCERY_PREFIX + skuId;
}

export function getGeneratedPhysicalShop(placeId: string): GeneratedPhysicalShopDefinition {
  const authored = GENERATED_SHOP_FIXTURES.filter((fixture) => fixture.placeId === placeId);
  const fixtures: PhysicalShopFocusableFixture[] = authored.map((fixture) => ({
    id: fixture.id,
    kind: fixture.kind as PhysicalShopFocusableFixture['kind'],
    slots: GENERATED_SHOP_SLOTS
      .filter((slot) => slot.fixtureId === fixture.id)
      .map((slot) => ({
        id: slot.id,
        eligibleDefinitionIds: slot.eligibleSkuIds.map(physicalDefinitionId),
      })),
    focus: {
      viewId: fixture.viewId,
      environment: {
        lightProfileIds: [...fixture.lightProfileIds],
        audioProfileIds: [...fixture.audioProfileIds],
        effectTags: [...fixture.effectTags],
      },
    },
  }));

  const errors = validatePhysicalShopFixtureContent(fixtures, {
    viewIds: new Set(GENERATED_VIEWS.map((view) => view.id)),
    lightProfileIds: new Set(GENERATED_LIGHT_PROFILES.map((profile) => profile.id)),
    audioProfileIds: new Set(GENERATED_AUDIO_PROFILES.map((profile) => profile.id)),
  });
  if (errors.length > 0) {
    throw new Error('Generated physical shop content is invalid: ' + errors.join(' | '));
  }

  const pricesByDefinitionId: Record<string, number> = {};
  for (const slot of GENERATED_SHOP_SLOTS.filter((candidate) =>
    authored.some((fixture) => fixture.id === candidate.fixtureId)
  )) {
    for (const skuId of slot.eligibleSkuIds) {
      const sku = GROCERY_SKUS[skuId];
      if (!sku) throw new Error('Unknown generated shop SKU: ' + skuId);
      pricesByDefinitionId[physicalDefinitionId(skuId)] = sku.price;
    }
  }

  return { storeId: placeId, placeId, fixtures, pricesByDefinitionId };
}

export function projectGeneratedPhysicalShopFocus(
  placeId: string,
  fixtureId: string,
  state: PhysicalShopState,
): PhysicalShopFocusProjection {
  const shop = getGeneratedPhysicalShop(placeId);
  const fixture = shop.fixtures.find((candidate) => candidate.id === fixtureId);
  if (!fixture) throw new Error('Unknown generated shop fixture: ' + fixtureId);
  return projectPhysicalShopFocus(fixture, state);
}

export function getGeneratedShopFixtureAtAnchor(anchorId: string): string | null {
  return GENERATED_SHOP_FIXTURES.find((fixture) => fixture.anchorId === anchorId)?.id ?? null;
}

export function getGeneratedShopAnchor(fixtureId: string) {
  const fixture = GENERATED_SHOP_FIXTURES.find((candidate) => candidate.id === fixtureId);
  return fixture
    ? GENERATED_ANCHORS.find((anchor) => anchor.id === fixture.anchorId) ?? null
    : null;
}
