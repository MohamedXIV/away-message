// src/tools/studio/hooks/useStudioStore.ts
// Reactive store controller for Content Studio.

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Store, Tables } from 'tinybase';
import { validateContent } from '../../content/codegen';
import { exportStoreJson } from '../../ContentInspector';

export interface StudioStoreContext {
  store: Store;
  tables: Tables;
  validationErrors: string[];
  setCell: (tableId: string, rowId: string, cellId: string, value: unknown) => void;
  setRow: (tableId: string, rowId: string, row: Record<string, unknown>) => void;
  deleteRow: (tableId: string, rowId: string) => void;
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

export function useStudioStore(store: Store): StudioStoreContext {
  const [tables, setTables] = useState<Tables>(() => store.getTables());

  useEffect(() => {
    const listenerId = store.addTablesListener(() => {
      setTables({ ...store.getTables() });
    });
    return () => {
      store.delListener(listenerId);
    };
  }, [store]);

  const setCell = useCallback((tableId: string, rowId: string, cellId: string, value: unknown) => {
    store.setCell(tableId, rowId, cellId, value as any);
  }, [store]);

  const setRow = useCallback((tableId: string, rowId: string, row: Record<string, unknown>) => {
    store.setRow(tableId, rowId, row as any);
  }, [store]);

  const deleteRow = useCallback((tableId: string, rowId: string) => {
    store.delRow(tableId, rowId);
  }, [store]);

  const addCharacter = useCallback((id: string, displayName: string, archetypeId: string) => {
    const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanId || tables['characters']?.[cleanId]) return false;

    store.transaction(() => {
      store.setRow('characters', cleanId, {
        role: cleanId,
        displayName: displayName.trim() || cleanId,
        archetypeId: archetypeId || 'regular',
        roles: '[]',
        reach: 'local',
        hair: 'brown',
        eyes: 'brown',
        chatColor: '#6a3fa0',
        bio: '',
        typingSpeedWpm: 70,
        languages: JSON.stringify([{ lang: 'en', level: 5 }]),
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
        expressions: '{}',
        defaultOutfit: 'default',
      });

      store.setRow('backstories', cleanId, {
        relationship: 'acquaintance',
        label: `Met ${displayName || cleanId} in town.`,
        lapseDays: 0,
        knowsAccounts: true,
        candidates: '[]',
        bioSeed: '',
      });
    });

    return true;
  }, [store, tables]);

  const deleteCharacter = useCallback((id: string) => {
    store.transaction(() => {
      store.delRow('characters', id);
      store.delRow('temperaments', id);
      store.delRow('initialAffinities', id);
      store.delRow('routines', id);
      store.delRow('artProfiles', id);
      store.delRow('backstories', id);
    });
  }, [store]);

  const addArchetype = useCallback((id: string, label: string) => {
    const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanId || tables['archetypes']?.[cleanId]) return false;

    store.setRow('archetypes', cleanId, {
      label: label.trim() || cleanId,
      description: 'Archetype description.',
      personaHint: 'Persona voice hint.',
      vocabulary: '[]',
      defaultInterests: '[]',
      defaultSong: '',
      typingSpeedWpm: 70,
    });
    return true;
  }, [store, tables]);

  const deleteArchetype = useCallback((id: string) => {
    store.delRow('archetypes', id);
  }, [store]);

  const addDialoguePool = useCallback((key: string) => {
    const cleanKey = key.trim();
    if (!cleanKey || tables['dialoguePools']?.[cleanKey]) return false;

    store.setRow('dialoguePools', cleanKey, {
      lines: JSON.stringify(['Line 1', 'Line 2']),
      version: 1,
    });
    return true;
  }, [store, tables]);

  const deleteDialoguePool = useCallback((key: string) => {
    store.delRow('dialoguePools', key);
  }, [store]);

  const addAffinitySeed = useCallback((roleA: string, roleB: string, value: number) => {
    const key = `${roleA.trim()}__${roleB.trim()}`;
    if (!roleA.trim() || !roleB.trim() || tables['affinitySeeds']?.[key]) return false;

    store.setRow('affinitySeeds', key, {
      roleA: roleA.trim(),
      roleB: roleB.trim(),
      value: Math.max(-100, Math.min(100, Math.round(value))),
    });
    return true;
  }, [store, tables]);

  const deleteAffinitySeed = useCallback((key: string) => {
    store.delRow('affinitySeeds', key);
  }, [store]);

  const validationErrors = useMemo(() => {
    return validateContent(tables);
  }, [tables]);

  const exportJson = useCallback(() => {
    return exportStoreJson(tables);
  }, [tables]);

  return {
    store,
    tables,
    validationErrors,
    setCell,
    setRow,
    deleteRow,
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
