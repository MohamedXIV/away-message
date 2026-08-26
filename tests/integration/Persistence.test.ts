import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/persistence/db';
import { SaveManager } from '../../src/persistence/SaveManager';
import type { FullSimulationSnapshot } from '../../src/persistence/schema';

describe('Persistence Integration Suite (Dexie + fake-indexeddb)', () => {
  let saveManager: SaveManager;

  const createMockSnapshot = (day = 1, cash = 38): FullSimulationSnapshot => ({
    saveSlot: {
      id: 'slot_1',
      name: `Test Save Day ${day}`,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      day,
      totalMinutes: (day - 1) * 1440 + 480,
      clockState: {
        day,
        hour: 8,
        minute: 0,
        totalMinutes: (day - 1) * 1440 + 480,
        timeOfDay: 'morning',
        isPaused: false,
      },
      playerState: {
        cash,
        energy: 100,
        fatigue: 0,
        rentDueDay: 7,
        rentAmount: 140,
        rentPaid: false,
        consecutiveLateWarnings: 0,
      },
      hardwareState: {
        cpuTier: 1,
        ramMB: 512,
        hddTotalGB: 40,
        hddFreeGB: 32,
        connectionType: 'dsl_256k',
        connectionSpeedKbps: 256,
        osVersion: 'Orion_4.8',
        theme: 'orion_4_8',
        wallpaper: 'default_clouds',
      },
      narrativeFlags: {
        knows_ryan_pulse: true,
        visited_cafe: false,
      },
    },
    vfsFiles: [
      {
        id: 'vfs_file_1',
        name: 'readme.txt',
        path: 'C:/Documents/readme.txt',
        parentPath: 'C:/Documents',
        kind: 'text',
        sizeBytes: 1024,
        content: 'Welcome to Orion OS',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      },
    ],
    downloads: [
      {
        id: 'dl_pulse_52',
        sourceId: 'downloadhub',
        url: 'http://downloadhub.local/pulse52.exe',
        fileName: 'PulseSetup.exe',
        destinationPath: 'C:/Downloads/PulseSetup.exe',
        totalBytes: 8388608,
        downloadedBytes: 4194304,
        sourceMaxKbps: 512,
        status: 'downloading',
        resumable: true,
        startedAt: Date.now(),
      },
    ],
    installedSoftware: [
      {
        appId: 'voyager_browser',
        version: '1.0',
        installPath: 'C:/Program Files/Voyager',
        occupiedSizeBytes: 15728640,
        isPortable: false,
        bundledComponents: [],
        registeredInAddRemove: false,
        desktopShortcut: true,
        startMenuEntry: true,
        installedAt: Date.now(),
      },
    ],
    messages: [
      {
        id: 'msg_1',
        buddyId: 'ryan_foodcart',
        sender: 'buddy',
        text: 'hey man did you get pulse installed yet?',
        timestamp: 490,
        day: 1,
        isRead: false,
      },
    ],
    relationships: [
      {
        buddyId: 'ryan_foodcart',
        familiarity: 40,
        trust: 50,
        comfort: 50,
        respect: 40,
        annoyance: 0,
        lastInteractionDay: 1,
        unlockedNotes: [],
        flags: {},
      },
    ],
    narrativeState: [
      {
        key: 'current_knot',
        value: 'day1_ryan_intro',
        updatedAt: Date.now(),
      },
    ],
    telemetryLogs: [
      {
        id: 1,
        timestamp: Date.now(),
        gameDay: 1,
        gameMinutes: 480,
        eventType: 'game_started',
        payload: { startingCash: 38 },
      },
    ],
  });

  beforeEach(async () => {
    saveManager = new SaveManager(db);
    await saveManager.clearAll();
  });

  it('performs lossless save and load round-trip across all 8 tables', async () => {
    const originalSnapshot = createMockSnapshot(2, 95);
    await saveManager.saveGame('slot_1', 'Day 2 Save', () => originalSnapshot);

    const loadedSnapshot = await saveManager.loadGame('slot_1');

    expect(loadedSnapshot.saveSlot.day).toBe(2);
    expect(loadedSnapshot.saveSlot.playerState.cash).toBe(95);
    expect(loadedSnapshot.vfsFiles).toHaveLength(1);
    expect(loadedSnapshot.vfsFiles[0]?.name).toBe('readme.txt');
    expect(loadedSnapshot.downloads).toHaveLength(1);
    expect(loadedSnapshot.downloads[0]?.downloadedBytes).toBe(4194304);
    expect(loadedSnapshot.messages).toHaveLength(1);
    expect(loadedSnapshot.messages[0]?.isRead).toBe(false);
    expect(loadedSnapshot.relationships[0]?.trust).toBe(50);
    expect(loadedSnapshot.installedSoftware[0]?.appId).toBe('voyager_browser');
    expect(loadedSnapshot.narrativeState[0]?.key).toBe('current_knot');
  });

  it('performs auto-save with debounce on time jump', async () => {
    const snapshot = createMockSnapshot(3, 150);
    await saveManager.autoSave(() => snapshot);

    // Allow debounce timer to settle
    await new Promise((r) => setTimeout(r, 60));

    const autosave = await saveManager.loadGame('autosave');
    expect(autosave).toBeDefined();
    expect(autosave.saveSlot.day).toBe(3);
    expect(autosave.saveSlot.playerState.cash).toBe(150);
  });

  it('exports and imports valid save JSON with Zod validation', async () => {
    const original = createMockSnapshot(4, 210);
    await saveManager.saveGame('slot_1', 'Day 4 Save', () => original);

    const jsonString = await saveManager.exportSaveJson('slot_1');
    expect(typeof jsonString).toBe('string');

    // Clear DB and re-import
    await saveManager.clearAll();
    expect(await saveManager.hasSave('slot_1')).toBe(false);

    await saveManager.importSaveJson(jsonString, 'slot_imported');
    const imported = await saveManager.loadGame('slot_imported');

    expect(imported.saveSlot.day).toBe(4);
    expect(imported.saveSlot.playerState.cash).toBe(210);
    expect(imported.vfsFiles[0]?.path).toBe('C:/Documents/readme.txt');
  });

  it('rejects corrupted save JSON during import', async () => {
    const corruptedJson = JSON.stringify({
      saveSlot: { id: 'bad_slot', day: 'invalid_number' },
    });

    await expect(saveManager.importSaveJson(corruptedJson)).rejects.toThrow();
  });
});
