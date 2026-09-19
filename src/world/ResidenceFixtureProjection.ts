import type {
  PhysicalObjectRuntimeState,
  PhysicalRuntimeGraph,
} from '../engine/physical/PhysicalContextRuntime';

export interface FixtureViewVisual {
  assetId: string;
  depth: number;
}

export interface FixtureVisualDefinition {
  defaultVariantId: string;
  variants: Record<string, Record<string, FixtureViewVisual>>;
}

export type FixtureVisualCatalog = Record<string, FixtureVisualDefinition>;
export type FixtureVisualSelections = Record<string, string>;

export interface FixtureVisualProjection {
  objectInstanceId: string;
  authoredPlacementId: string;
  slotId: string;
  objectDefId: string;
  variantId: string;
  assetId: string;
  depth: number;
}

export function selectFixtureVisualVariant(
  current: FixtureVisualSelections,
  objectDefId: string,
  variantId: string,
  catalog: FixtureVisualCatalog,
): FixtureVisualSelections {
  const definition = catalog[objectDefId];
  if (!definition?.variants[variantId]) {
    throw new Error(`Unknown fixture visual variant ${variantId} for ${objectDefId}.`);
  }

  return { ...current, [objectDefId]: variantId };
}

export function projectFixtureVisuals(
  viewId: string,
  state: PhysicalObjectRuntimeState,
  graph: PhysicalRuntimeGraph,
  catalog: FixtureVisualCatalog,
  selections: FixtureVisualSelections = {},
): FixtureVisualProjection[] {
  const definitions = new Map(graph.objectDefs.map((definition) => [definition.id, definition]));

  return Object.values(state.objects)
    .flatMap((object): FixtureVisualProjection[] => {
      if (object.location.kind !== 'slot' || !object.authoredPlacementId) return [];
      if (!definitions.has(object.objectDefId)) return [];

      const visualDefinition = catalog[object.objectDefId];
      if (!visualDefinition) return [];

      const variantId = selections[object.objectDefId] ?? visualDefinition.defaultVariantId;
      const viewVisual = visualDefinition.variants[variantId]?.[viewId];
      if (!viewVisual) return [];

      return [{
        objectInstanceId: object.instanceId,
        authoredPlacementId: object.authoredPlacementId,
        slotId: object.location.slotId,
        objectDefId: object.objectDefId,
        variantId,
        assetId: viewVisual.assetId,
        depth: viewVisual.depth,
      }];
    })
    .sort(
      (a, b) =>
        a.depth - b.depth ||
        a.objectInstanceId.localeCompare(b.objectInstanceId),
    );
}
