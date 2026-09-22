import { describe, expect, it } from 'vitest';
import {
  CONTENT_INDEX_IDS,
  CONTENT_RELATIONSHIP_IDS,
  createContentModel,
} from '../../src/tools/content/model';
import {
  generateWorldRegistrySource,
  validateVenueContent,
  type ContentTables,
} from '../../src/tools/content/codegen';

function validVenueTables(): ContentTables {
  return {
    places: {
      test_cafe: {
        districtId: 'test_district',
        name: 'Test Cafe',
        transitAccess: [],
        legacyIds: [],
      },
      test_shop: {
        districtId: 'test_district',
        name: 'Test Shop',
        transitAccess: [],
        legacyIds: [],
      },
    },
    spaces: {
      test_cafe_space: { placeId: 'test_cafe', name: 'Cafe Floor', tags: [] },
      test_shop_space: { placeId: 'test_shop', name: 'Shop Floor', tags: [] },
    },
    views: {
      test_cafe_view: {
        spaceId: 'test_cafe_space',
        name: 'Cafe View',
        neighbors: [],
        assetId: '',
        tags: [],
      },
      test_shop_view: {
        spaceId: 'test_shop_space',
        name: 'Shop View',
        neighbors: [],
        assetId: '',
        tags: [],
      },
    },
    anchors: {
      test_barista_anchor: {
        viewId: 'test_cafe_view',
        name: 'Barista Anchor',
        x: 0.4,
        y: 0.5,
        tags: [],
      },
      test_customer_anchor: {
        viewId: 'test_cafe_view',
        name: 'Customer Anchor',
        x: 0.6,
        y: 0.5,
        tags: [],
      },
      test_cashier_anchor: {
        viewId: 'test_shop_view',
        name: 'Cashier Anchor',
        x: 0.5,
        y: 0.5,
        tags: [],
      },
    },
    venueStations: {
      test_barista_station: {
        placeId: 'test_cafe',
        spaceId: 'test_cafe_space',
        anchorId: 'test_barista_anchor',
        name: 'Barista Counter',
        capacity: 1,
        roleKinds: ['barista'],
        tags: ['staff'],
      },
      test_customer_station: {
        placeId: 'test_cafe',
        spaceId: 'test_cafe_space',
        anchorId: 'test_customer_anchor',
        name: 'Customer Counter',
        capacity: 1,
        roleKinds: ['customer'],
        tags: ['customer'],
      },
      test_cashier_station: {
        placeId: 'test_shop',
        spaceId: 'test_shop_space',
        anchorId: 'test_cashier_anchor',
        name: 'Cashier',
        capacity: 1,
        roleKinds: ['cashier'],
        tags: ['staff'],
      },
    },
    venueRoles: {
      test_barista_role: {
        placeId: 'test_cafe',
        name: 'Barista',
        roleKind: 'barista',
        stationIds: ['test_barista_station'],
        tags: [],
      },
      test_cashier_role: {
        placeId: 'test_shop',
        name: 'Cashier',
        roleKind: 'cashier',
        stationIds: ['test_cashier_station'],
        tags: [],
      },
    },
    activityTemplates: {
      test_coffee_activity: {
        placeId: 'test_cafe',
        name: 'Order Coffee',
        purpose: 'shop',
        activityKind: 'ordering',
        phases: [
          { id: 'order', durationMinutes: 2, stationId: 'test_customer_station' },
          { id: 'receive', durationMinutes: 2, stationId: 'test_customer_station' },
        ],
        completionOwner: 'shop',
        completionKind: 'order_ready',
        tags: [],
      },
      test_checkout_activity: {
        placeId: 'test_shop',
        name: 'Checkout',
        purpose: 'shop',
        activityKind: 'checkout',
        phases: [
          { id: 'pay', durationMinutes: 2, stationId: 'test_cashier_station' },
        ],
        completionOwner: 'shop',
        completionKind: 'checkout_ready',
        tags: [],
      },
    },
    venueServices: {
      test_coffee_service: {
        placeId: 'test_cafe',
        spaceId: 'test_cafe_space',
        name: 'Coffee Service',
        intentKinds: ['shop_for_need'],
        activityTemplateId: 'test_coffee_activity',
        requiredRoleKinds: ['barista'],
        requiredStationIds: ['test_barista_station', 'test_customer_station'],
        contextRequirements: [
          { kind: 'tool', capability: 'brew_coffee' },
          { kind: 'resource', capability: 'water' },
        ],
        tags: ['cafe'],
      },
      test_checkout_service: {
        placeId: 'test_shop',
        spaceId: 'test_shop_space',
        name: 'Checkout Service',
        intentKinds: ['shop_for_need'],
        activityTemplateId: 'test_checkout_activity',
        requiredRoleKinds: ['cashier'],
        requiredStationIds: ['test_cashier_station'],
        contextRequirements: [],
        tags: ['shop'],
      },
    },
  };
}

function clone(tables: ContentTables): ContentTables {
  return structuredClone(tables);
}

describe('authored venue content (#94)', () => {
  it('validates and deterministically emits generic cafe + shop operations', () => {
    const tables = validVenueTables();
    expect(validateVenueContent(tables)).toEqual([]);

    const source = generateWorldRegistrySource(tables);
    expect(source).toContain('GeneratedVenueRoleDef');
    expect(source).toContain('GENERATED_VENUE_ROLES');
    expect(source).toContain('GENERATED_VENUE_STATIONS');
    expect(source).toContain('GENERATED_VENUE_SERVICES');
    expect(source).toContain('GENERATED_ACTIVITY_TEMPLATES');
    expect(source).toContain('capability: "brew_coffee"');
    expect(source).toContain('stationId: "test_customer_station"');
  });

  it('rejects a station whose space belongs to another place', () => {
    const tables = clone(validVenueTables());
    tables['venueStations']!['test_barista_station']!['spaceId'] = 'test_shop_space';

    const errors = validateVenueContent(tables);
    expect(
      errors.some(
        (error) =>
          error.includes('venueStations/test_barista_station.spaceId') &&
          error.includes('test_cafe'),
      ),
    ).toBe(true);
  });

  it('rejects unknown intent kinds and cross-place activity templates', () => {
    const tables = clone(validVenueTables());
    tables['venueServices']!['test_coffee_service']!['intentKinds'] = ['invent_new_brain'];
    tables['venueServices']!['test_coffee_service']!['activityTemplateId'] =
      'test_checkout_activity';

    const errors = validateVenueContent(tables);
    expect(
      errors.some(
        (error) =>
          error.includes('venueServices/test_coffee_service.intentKinds') &&
          error.includes('CharacterIntent'),
      ),
    ).toBe(true);
    expect(
      errors.some(
        (error) =>
          error.includes('venueServices/test_coffee_service.activityTemplateId') &&
          error.includes('another place'),
      ),
    ).toBe(true);
  });

  it('rejects empty/invalid activity phases before runtime', () => {
    const tables = clone(validVenueTables());
    tables['activityTemplates']!['test_coffee_activity']!['phases'] = [];

    const errors = validateVenueContent(tables);
    expect(
      errors.some(
        (error) =>
          error.includes('activityTemplates/test_coffee_activity.phases') &&
          error.includes('at least one'),
      ),
    ).toBe(true);
  });

  it('exposes reusable TinyBase relationships and per-place indexes', () => {
    const { store, relationships, indexes } = createContentModel();

    store.setRow('places', 'test_cafe', {
      districtId: 'test_district',
      name: 'Test Cafe',
      transitAccess: [],
      legacyIds: [],
    });
    store.setRow('spaces', 'test_cafe_space', {
      placeId: 'test_cafe',
      name: 'Cafe Floor',
      tags: [],
    });
    store.setRow('views', 'test_cafe_view', {
      spaceId: 'test_cafe_space',
      name: 'Cafe View',
      neighbors: [],
      assetId: '',
      tags: [],
    });
    store.setRow('anchors', 'test_barista_anchor', {
      viewId: 'test_cafe_view',
      name: 'Barista',
      x: 0.5,
      y: 0.5,
      tags: [],
    });
    store.setRow('venueStations', 'test_barista_station', {
      placeId: 'test_cafe',
      spaceId: 'test_cafe_space',
      anchorId: 'test_barista_anchor',
      name: 'Barista Station',
      capacity: 1,
      roleKinds: ['barista'],
      tags: [],
    });
    store.setRow('venueRoles', 'test_barista_role', {
      placeId: 'test_cafe',
      name: 'Barista',
      roleKind: 'barista',
      stationIds: ['test_barista_station'],
      tags: [],
    });
    store.setRow('activityTemplates', 'test_coffee_activity', {
      placeId: 'test_cafe',
      name: 'Coffee',
      purpose: 'shop',
      activityKind: 'ordering',
      phases: [{ id: 'order', durationMinutes: 2, stationId: 'test_barista_station' }],
      completionOwner: 'shop',
      completionKind: 'order_ready',
      tags: [],
    });
    store.setRow('venueServices', 'test_coffee_service', {
      placeId: 'test_cafe',
      spaceId: 'test_cafe_space',
      name: 'Coffee Service',
      intentKinds: ['shop_for_need'],
      activityTemplateId: 'test_coffee_activity',
      requiredRoleKinds: ['barista'],
      requiredStationIds: ['test_barista_station'],
      contextRequirements: [],
      tags: [],
    });

    expect(
      relationships.getRemoteRowId(
        CONTENT_RELATIONSHIP_IDS.venueRolePlace,
        'test_barista_role',
      ),
    ).toBe('test_cafe');
    expect(
      relationships.getRemoteRowId(
        CONTENT_RELATIONSHIP_IDS.venueStationSpace,
        'test_barista_station',
      ),
    ).toBe('test_cafe_space');
    expect(
      relationships.getRemoteRowId(
        CONTENT_RELATIONSHIP_IDS.venueServiceActivityTemplate,
        'test_coffee_service',
      ),
    ).toBe('test_coffee_activity');

    expect(
      indexes.getSliceRowIds(CONTENT_INDEX_IDS.venueRolesByPlace, 'test_cafe'),
    ).toEqual(['test_barista_role']);
    expect(
      indexes.getSliceRowIds(CONTENT_INDEX_IDS.venueServicesByPlace, 'test_cafe'),
    ).toEqual(['test_coffee_service']);
  });
});
