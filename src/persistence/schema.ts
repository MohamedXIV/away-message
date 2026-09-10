// v6 persistence schema facade.
// Historical table schemas and Dexie MIGRATIONS remain unchanged in schemaV5Core.ts.

export * from './schemaV5Core';

import { z } from 'zod';
import type { SimulationState } from '../engine/types';
import {
  FullSimulationSnapshotSchema as CoreFullSimulationSnapshotSchema,
  SaveSlotSchema as CoreSaveSlotSchema,
} from './schemaV5Core';
import type {
  FullSimulationSnapshot as CoreFullSimulationSnapshot,
  SaveSlotRecord as CoreSaveSlotRecord,
} from './schemaV5Core';

export type SaveSlotRecord = Omit<CoreSaveSlotRecord, 'hardwareState' | 'snapshot'> & {
  hardwareState: Omit<CoreSaveSlotRecord['hardwareState'], 'connectionType' | 'osVersion'> & {
    connectionType: 'dialup_56k' | 'dsl_256k' | 'dsl_512k' | 'dsl_1m' | null;
    osVersion: string | null;
  };
  // Historical v2-v5 documents legitimately lack v6 canonical roots until
  // slots.ts migrates them. Keep the transport transitional here; v6 writers
  // themselves export the strict canonical snapshot.
  snapshot?: SimulationState;
};

export type FullSimulationSnapshot = Omit<CoreFullSimulationSnapshot, 'saveSlot'> & {
  saveSlot: SaveSlotRecord;
};

export const SaveSlotSchema = CoreSaveSlotSchema.extend({
  hardwareState: CoreSaveSlotSchema.shape.hardwareState.extend({
    connectionType: z.enum(['dialup_56k', 'dsl_256k', 'dsl_512k', 'dsl_1m']).nullable(),
    osVersion: z.string().regex(/^Orion_/).min(3).nullable(),
  }),
});

export const FullSimulationSnapshotSchema = CoreFullSimulationSnapshotSchema.extend({
  saveSlot: SaveSlotSchema,
});
