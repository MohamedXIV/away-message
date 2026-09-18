// src/tools/studio/hooks/useStudioStore.ts
// Reactive controller over the shared authored ContentModel.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createCheckpoints, type Store, type Tables } from 'tinybase';
import { validateContent } from '../../content/codegen';
import type { ContentModel } from '../../content/model';
import { exportStoreJson } from '../../ContentInspector';
import {
  getContentChildren,
  getContentParents,
  getPlacementSlotsInSpace,
  type ContentNodeRef,
} from '../contentGraph';
import {
  getRowErrors,
  parseFieldError,
  type FieldError,
} from '../validationFeedback';

export interface StudioStoreContext {
  model: ContentModel;
  store: Store;
  tables: Tables;
  validationErrors: string[];
  validationIssues: FieldError[];

  setCell: (tableId: string, rowId: string, cellId: string, value: unknown) => void;
  setRow: (tableId: string, rowId: string, row: Record<string, unknown>) => void;
  createRow: (tableId: string, rowId: string, row: Record<string, unknown>) => boolean;
  deleteRow: (tableId: string, rowId: string) => void;

  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  getParents: (tableId: string, rowId: string) => ContentNodeRef[];
  getChildren: (tableId: string, rowId: string) => ContentNodeRef[];
  getPlacementSlotsInSpace: (spaceId: string) => ContentNodeRef[];
  getRowDiagnostics: (tableId: string, rowId: string) => string[];

  addCharacter: (id: string, displayName: string, archetypeId: string) => boolean;
  deleteCharacter: (id: string) => void;
  addArchetype: (id: string, label: string) => boolean;
  deleteArchetype: (id: string) => void;
  addDialoguePool: (key: string) => boolean;
  deleteDialoguePool: (key: string) => void;
  addAffinitySeed: (roleA: string, roleB: string, value: number) => boolean;
  deleteAffinitySeed: (key: string) => void;

  exportJson: () => string;
}

export function useStudioStore(model: ContentModel): StudioStoreContext {
  const { store } = model;
  const checkpoints = useMemo(() => createCheckpoints(store), [store]);
  const [tables, setTables] = useState<Tables>(() => store.getTables());
  const [checkpointRevision, setCheckpointRevision] = useState(0);

  useEffect(() => {
    const listenerId = store.addTablesListener(() => {
      setTables({ ...store.getTables() });
    });
    return () => {
      store.delListener(listenerId);
    };
  }, [store]);

  const refreshCheckpoints = useCallback(() => {
    setCheckpointRevision((revision) => revision + 1);
  }, []);

  const addCheckpoint = useCallback(
    (label: string) => {
      checkpoints.addCheckpoint(label);
      refreshCheckpoints();
    },
    [checkpoints, refreshCheckpoints],
  );

  const setCell = useCallback(
    (tableId: string, rowId: string, cellId: string, value: unknown) => {
      store.setCell(tableId, rowId, cellId, value as any);
      addCheckpoint(`Edit ${tableId}/${rowId}.${cellId}`);
    },
    [store, addCheckpoint],
  );

  const setRow = useCallback(
    (tableId: string, rowId: string, row: Record<string, unknown>) => {
      store.setRow(tableId, rowId, row as any);
      addCheckpoint(`Set ${tableId}/${rowId}`);
    },
    [store, addCheckpoint],
  );

  const createRow = useCallback(
    (tableId: string, rowId: string, row: Record<string, unknown>) => {
      const cleanId = rowId.trim();
      if (!cleanId || store.getRowIds(tableId).includes(cleanId)) return false;
      store.setRow(tableId, cleanId, row as any);
      addCheckpoint(`Create ${tableId}/${cleanId}`);
      return true;
    },
    [store, addCheckpoint],
  );

  const deleteRow = useCallback(
    (tableId: string, rowId: string) => {
      if (!store.getRowIds(tableId).includes(rowId)) return;
      store.delRow(tableId, rowId);
      addCheckpoint(`Delete ${tableId}/${rowId}`);
    },
    [store, addCheckpoint],
  );

  const undo = useCallback(() => {
    checkpoints.goBackward();
    refreshCheckpoints();
  }, [checkpoints, refreshCheckpoints]);

  const redo = useCallback(() => {
    checkpoints.goForward();
    refreshCheckpoints();
  }, [checkpoints, refreshCheckpoints]);

  // Reading the checkpoint tuple after each explicit revision keeps React UI
  // state derived from TinyBase rather than maintaining a parallel undo stack.
  void checkpointRevision;
  const [backwardCheckpointIds, , forwardCheckpointIds] = checkpoints.getCheckpointIds();
  const canUndo = backwardCheckpointIds.length > 0;
  const canRedo = forwardCheckpointIds.length > 0;

  const getParents = useCallback(
    (tableId: string, rowId: string) =>
      getContentParents(model, { tableId, rowId }),
    [model],
  );

  const getChildren = useCallback(
    (tableId: string, rowId: string) =>
      getContentChildren(model, { tableId, rowId }),
    [model],
  );

  const getSlotsInSpace = useCallback(
    (spaceId: string) => getPlacementSlotsInSpace(model, spaceId),
    [model],
  );

  const addCharacter = useCallback(
    (id: string, displayName: string, archetypeId: string) => {
      const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (!cleanId || store.getRowIds('characters').includes(cleanId)) return false;

      store.transaction(() => {
        store.setRow('characters', cleanId, {
          role: cleanId,
          displayName: displayName.trim() || cleanId,
          archetypeId: archetypeId || 'regular',
          roles: [],
          reach: 'local',
          hair: 'brown',
          eyes: 'brown',
          chatColor: '#6a3fa0',
          bio: '',
          typingSpeedWpm: 70,
          languages: [{ lang: 'en', level: 5 }],
        });

        store.setRow('temperaments', cleanId, {
          shyness: 50,
          warmth: 50,
          discipline: 50,
          spontaneity: 50,
          loyalty: 50,
        });

        store.setRow('initialAffinities', cleanId, {
          familiarity: 10,
          trust: 20,
          comfort: 20,
          respect: 30,
          annoyance: 0,
          affection: 0,
          attraction: 0,
          suspicion: 0,
          resentment: 0,
        });

        store.setRow('routines', cleanId, {
          wakeMinute: 480,
          sleepMinute: 1380,
          workShift: 'day',
          preferredHangout: 'cafe',
        });

        store.setRow('artProfiles', cleanId, {
          engine: 'none',
          modelPath: '',
          expressions: {},
          defaultOutfit: 'default',
        });

        store.setRow('backstories', cleanId, {
          relationship: 'acquaintance',
          label: `Met ${displayName || cleanId} in town.`,
          lapseDays: 0,
          knowsAccounts: true,
          candidates: [],
          bioSeed: '',
        });
      });

      addCheckpoint(`Create character ${cleanId}`);
      return true;
    },
    [store, addCheckpoint],
  );

  const deleteCharacter = useCallback(
    (id: string) => {
      if (!store.getRowIds('characters').includes(id)) return;
      store.transaction(() => {
        store.delRow('characters', id);
        store.delRow('temperaments', id);
        store.delRow('initialAffinities', id);
        store.delRow('routines', id);
        store.delRow('artProfiles', id);
        store.delRow('backstories', id);
      });
      addCheckpoint(`Delete character ${id}`);
    },
    [store, addCheckpoint],
  );

  const addArchetype = useCallback(
    (id: string, label: string) => {
      const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (!cleanId || store.getRowIds('archetypes').includes(cleanId)) return false;

      store.setRow('archetypes', cleanId, {
        label: label.trim() || cleanId,
        description: 'Archetype description.',
        personaHint: 'Persona voice hint.',
        vocabulary: [],
        defaultInterests: [],
        defaultSong: '',
        typingSpeedWpm: 70,
      });
      addCheckpoint(`Create archetype ${cleanId}`);
      return true;
    },
    [store, addCheckpoint],
  );

  const deleteArchetype = useCallback(
    (id: string) => {
      if (!store.getRowIds('archetypes').includes(id)) return;
      store.delRow('archetypes', id);
      addCheckpoint(`Delete archetype ${id}`);
    },
    [store, addCheckpoint],
  );

  const addDialoguePool = useCallback(
    (key: string) => {
      const cleanKey = key.trim();
      if (!cleanKey || store.getRowIds('dialoguePools').includes(cleanKey)) return false;

      store.setRow('dialoguePools', cleanKey, {
        lines: ['Line 1', 'Line 2'],
        version: 1,
      });
      addCheckpoint(`Create dialogue pool ${cleanKey}`);
      return true;
    },
    [store, addCheckpoint],
  );

  const deleteDialoguePool = useCallback(
    (key: string) => {
      if (!store.getRowIds('dialoguePools').includes(key)) return;
      store.delRow('dialoguePools', key);
      addCheckpoint(`Delete dialogue pool ${key}`);
    },
    [store, addCheckpoint],
  );

  const addAffinitySeed = useCallback(
    (roleA: string, roleB: string, value: number) => {
      const key = `${roleA.trim()}__${roleB.trim()}`;
      if (
        !roleA.trim() ||
        !roleB.trim() ||
        store.getRowIds('affinitySeeds').includes(key)
      ) {
        return false;
      }

      store.setRow('affinitySeeds', key, {
        roleA: roleA.trim(),
        roleB: roleB.trim(),
        value: Math.max(-100, Math.min(100, Math.round(value))),
      });
      addCheckpoint(`Create affinity seed ${key}`);
      return true;
    },
    [store, addCheckpoint],
  );

  const deleteAffinitySeed = useCallback(
    (key: string) => {
      if (!store.getRowIds('affinitySeeds').includes(key)) return;
      store.delRow('affinitySeeds', key);
      addCheckpoint(`Delete affinity seed ${key}`);
    },
    [store, addCheckpoint],
  );

  const validationErrors = useMemo(() => validateContent(tables), [tables]);
  const validationIssues = useMemo(
    () => validationErrors.map(parseFieldError),
    [validationErrors],
  );

  const getRowDiagnostics = useCallback(
    (tableId: string, rowId: string) =>
      getRowErrors(validationErrors, tableId, rowId),
    [validationErrors],
  );

  const exportJson = useCallback(() => exportStoreJson(tables), [tables]);

  return {
    model,
    store,
    tables,
    validationErrors,
    validationIssues,
    setCell,
    setRow,
    createRow,
    deleteRow,
    canUndo,
    canRedo,
    undo,
    redo,
    getParents,
    getChildren,
    getPlacementSlotsInSpace: getSlotsInSpace,
    getRowDiagnostics,
    addCharacter,
    deleteCharacter,
    addArchetype,
    deleteArchetype,
    addDialoguePool,
    deleteDialoguePool,
    addAffinitySeed,
    deleteAffinitySeed,
    exportJson,
  };
}
