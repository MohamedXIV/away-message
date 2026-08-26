import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { GameClock } from '../../src/engine/GameClock';
import { EconomyEngine } from '../../src/engine/EconomyEngine';
import { FileSystemEngine } from '../../src/engine/FileSystemEngine';
import { DownloadManager } from '../../src/engine/DownloadManager';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('Adversarial Stress Test Suite — Milestone 1 Engine', () => {
  // =========================================================================
  // 1. GAME CLOCK ADVERSARIAL STRESS
  // =========================================================================
  describe('GameClock: Temporal Arithmetic & Discrete Jump Stress', () => {
    it('proves mathematical equivalence between a single 10,000-minute discrete jump and 10,000 1-minute ticks', () => {
      const clockDiscrete = new GameClock({ initialDay: 1, initialHour: 8, initialMinute: 0 });
      const clockIterative = new GameClock({ initialDay: 1, initialHour: 8, initialMinute: 0 });

      // Discrete jump
      const jumpResult = clockDiscrete.advanceMinutes(10000);

      // Iterative ticks
      let daysChangedCount = 0;
      for (let i = 0; i < 10000; i++) {
        const tick = clockIterative.advanceMinutes(1);
        if (tick.dayChanged) {
          daysChangedCount++;
        }
      }

      const timeDiscrete = clockDiscrete.getTime();
      const timeIterative = clockIterative.getTime();

      expect(timeDiscrete.totalMinutes).toBe(timeIterative.totalMinutes);
      expect(timeDiscrete.day).toBe(timeIterative.day);
      expect(timeDiscrete.hour).toBe(timeIterative.hour);
      expect(timeDiscrete.minute).toBe(timeIterative.minute);
      expect(timeDiscrete.timeOfDay).toBe(timeIterative.timeOfDay);
      expect(timeDiscrete.isWeekend).toBe(timeIterative.isWeekend);
      expect(jumpResult.daysSkipped).toBe(daysChangedCount);
      expect(timeDiscrete.totalMinutes).toBe(480 + 10000);
      expect(timeDiscrete.day).toBe(8);
      expect(timeDiscrete.hour).toBe(6);
      expect(timeDiscrete.minute).toBe(40);
      expect(timeDiscrete.timeOfDay).toBe('morning');
    });

    it('survives massive extreme time jump of 1,000,000 minutes (~694 days) without overflow or NaN', () => {
      const clock = new GameClock({ initialDay: 1, initialHour: 0, initialMinute: 0 });
      const jump = clock.advanceMinutes(1_000_000);

      const time = clock.getTime();
      expect(Number.isFinite(time.totalMinutes)).toBe(true);
      expect(Number.isFinite(time.day)).toBe(true);
      expect(Number.isFinite(time.hour)).toBe(true);
      expect(Number.isFinite(time.minute)).toBe(true);
      expect(jump.daysSkipped).toBe(Math.floor(1_000_000 / 1440));
      expect(time.hour).toBeGreaterThanOrEqual(0);
      expect(time.hour).toBeLessThanOrEqual(23);
      expect(time.minute).toBeGreaterThanOrEqual(0);
      expect(time.minute).toBeLessThanOrEqual(59);
    });

    it('accurately accumulates fractional real-time ticks under 50,000 rapid small delta ticks', () => {
      const clock = new GameClock({ initialDay: 1, initialHour: 8, initialMinute: 0, timeScaleMinutesPerRealSecond: 1.0 });
      let totalElapsedMinutes = 0;

      // 50,000 ticks of 0.02 seconds = 1,000 seconds = 1,000 game minutes
      for (let i = 0; i < 50000; i++) {
        const tick = clock.tickRealTime(0.02);
        totalElapsedMinutes += tick.elapsedMinutes;
      }

      expect(totalElapsedMinutes).toBe(1000);
      expect(clock.getTime().totalMinutes).toBe(1480); // 480 + 1000
    });

    it('strictly preserves paused state and suppresses fractional accumulation during pause', () => {
      const clock = new GameClock();
      clock.setPaused(true);

      for (let i = 0; i < 1000; i++) {
        const res = clock.tickRealTime(10.5);
        expect(res.elapsedMinutes).toBe(0);
      }

      expect(clock.getTime().totalMinutes).toBe(480);

      // Unpause and verify no stored fractional burst occurs
      clock.setPaused(false);
      const firstTick = clock.tickRealTime(0.5);
      expect(firstTick.elapsedMinutes).toBe(0);
      const secondTick = clock.tickRealTime(0.5);
      expect(secondTick.elapsedMinutes).toBe(1);
      expect(clock.getTime().totalMinutes).toBe(481);
    });

    it('verifies exact boundary transitions for all 5 time-of-day phases and 365 days of weekend calculations', () => {
      // Phase boundaries:
      // Morning: 06:00 (360) to 11:59 (719)
      expect(GameClock.calculateGameTime(359).timeOfDay).toBe('late_night');
      expect(GameClock.calculateGameTime(360).timeOfDay).toBe('morning');
      expect(GameClock.calculateGameTime(719).timeOfDay).toBe('morning');
      expect(GameClock.calculateGameTime(720).timeOfDay).toBe('day');

      // Day: 12:00 (720) to 17:59 (1079)
      expect(GameClock.calculateGameTime(1079).timeOfDay).toBe('day');
      expect(GameClock.calculateGameTime(1080).timeOfDay).toBe('evening');

      // Evening: 18:00 (1080) to 21:59 (1319)
      expect(GameClock.calculateGameTime(1319).timeOfDay).toBe('evening');
      expect(GameClock.calculateGameTime(1320).timeOfDay).toBe('night');

      // Night: 22:00 (1320) to 02:59 (179)
      expect(GameClock.calculateGameTime(1439).timeOfDay).toBe('night');
      expect(GameClock.calculateGameTime(0).timeOfDay).toBe('night');
      expect(GameClock.calculateGameTime(179).timeOfDay).toBe('night');
      expect(GameClock.calculateGameTime(180).timeOfDay).toBe('late_night');

      // Late night: 03:00 (180) to 05:59 (359)
      expect(GameClock.calculateGameTime(359).timeOfDay).toBe('late_night');

      // 365 Days weekend mapping check
      for (let day = 1; day <= 365; day++) {
        const totalMinutes = (day - 1) * 1440 + 480;
        const time = GameClock.calculateGameTime(totalMinutes);
        const dayMod7 = ((day - 1) % 7) + 1;
        const expectedWeekend = dayMod7 === 6 || dayMod7 === 7;
        expect(time.isWeekend).toBe(expectedWeekend);
      }
    });
  });

  // =========================================================================
  // 2. ECONOMY ENGINE ADVERSARIAL STRESS
  // =========================================================================
  describe('EconomyEngine: Financial Boundaries, Arithmetic & Energy Stress', () => {
    let eventBus: EventBus;
    let economy: EconomyEngine;

    beforeEach(() => {
      eventBus = new EventBus();
      economy = new EconomyEngine(eventBus);
    });

    it('strictly prohibits negative cash under boundary overspend attempts and invalid arguments', () => {
      expect(economy.getCash()).toBe(38.0);

      // Overspend by 1 cent
      const overspend = economy.spendCash(38.01, 'Overdraft attempt');
      expect(overspend).toBe(false);
      expect(economy.getCash()).toBe(38.0);

      // Negative spend and negative earn
      expect(economy.spendCash(-50, 'Negative spend')).toBe(true);
      expect(economy.getCash()).toBe(38.0); // No change

      economy.earnCash(-50, 'Negative earn');
      expect(economy.getCash()).toBe(38.0); // No change
    });

    it('maintains 2-decimal precision across 10,000 high-frequency micro transactions without floating drift', () => {
      for (let i = 0; i < 1000; i++) {
        economy.earnCash(0.07, 'micro');
        economy.spendCash(0.03, 'micro');
      }

      expect(economy.getCash()).toBe(78.0);
      const str = economy.getCash().toString();
      expect(str.split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
    });

    it('handles cascading late rent fees across multiple unpaid day transitions', () => {
      expect(economy.getState().rentAmount).toBe(140.0);
      expect(economy.getState().rentDueDay).toBe(7);

      for (let day = 2; day <= 7; day++) {
        economy.handleDayTransition(day);
      }
      expect(economy.getState().rentAmount).toBe(140.0);

      // Days 8 through 14 transitions without paying -> +$15 per day
      for (let day = 8; day <= 14; day++) {
        economy.handleDayTransition(day);
      }
      // 7 days late: 140 + (7 * 15) = 245
      expect(economy.getState().rentAmount).toBe(245.0);
    });

    it('resets rent cycle and amount to $140 for Day 14 when Day 7 rent is successfully paid', () => {
      economy.earnCash(200.0, 'Payday');
      const paid = economy.payRent();
      expect(paid.success).toBe(true);
      expect(economy.getState().rentPaid).toBe(true);

      economy.handleDayTransition(8);
      expect(economy.getState().rentDueDay).toBe(14);
      expect(economy.getState().rentPaid).toBe(false);
      expect(economy.getState().rentAmount).toBe(140.0);
    });

    it('clamps energy and fatigue under extreme drains and restorations', () => {
      economy.consumeEnergy(1_000_000);
      expect(economy.getState().energy).toBe(0);
      expect(economy.getEnergyStatus()).toBe('Exhausted');

      economy.restoreEnergy(1_000_000);
      expect(economy.getState().energy).toBe(100);
      expect(economy.getEnergyStatus()).toBe('Rested');

      economy.addFatigue(500);
      expect(economy.getState().fatigue).toBe(100);

      economy.addFatigue(-500);
      expect(economy.getState().fatigue).toBe(0);
    });

    it('stress-tests work shift boundary conditions at exact energy thresholds', () => {
      // Energy = 14: Rejected
      economy.consumeEnergy(86);
      expect(economy.getState().energy).toBe(14);
      const shift14 = economy.performWorkShift();
      expect(shift14.success).toBe(false);
      expect(shift14.error).toContain('Too exhausted');

      // Energy = 15: Allowed, consumes 45 energy (because < 30) -> clamps to 0
      economy.restoreEnergy(1);
      expect(economy.getState().energy).toBe(15);
      const shift15 = economy.performWorkShift();
      expect(shift15.success).toBe(true);
      expect(shift15.energySpent).toBe(45);
      expect(economy.getState().energy).toBe(0);

      // Energy = 30: Consumes 35 energy
      economy.restoreEnergy(30);
      expect(economy.getState().energy).toBe(30);
      const shift30 = economy.performWorkShift();
      expect(shift30.success).toBe(true);
      expect(shift30.energySpent).toBe(35);
      expect(economy.getState().energy).toBe(0);
    });
  });

  // =========================================================================
  // 3. FILE SYSTEM ENGINE ADVERSARIAL STRESS
  // =========================================================================
  describe('FileSystemEngine: 40GB Quota, Path Normalization & Trash Lifecycle Stress', () => {
    let eventBus: EventBus;
    let vfs: FileSystemEngine;

    beforeEach(() => {
      eventBus = new EventBus();
      vfs = new FileSystemEngine(eventBus);
    });

    it('enforces hard 40GB capacity limit and rejects file creations exceeding free disk space by 1 byte', () => {
      const freeSpace = vfs.getFreeDiskBytes();
      expect(freeSpace).toBeGreaterThan(6_000_000_000); // ~6.65 GB free

      expect(() => {
        vfs.createFile({
          name: 'TooBig.iso',
          path: 'C:/Downloads/TooBig.iso',
          parentPath: 'C:/Downloads',
          kind: 'archive',
          sizeBytes: freeSpace + 1,
        });
      }).toThrow('Disk Full');

      vfs.createFile({
        name: 'ExactFit.iso',
        path: 'C:/Downloads/ExactFit.iso',
        parentPath: 'C:/Downloads',
        kind: 'archive',
        sizeBytes: freeSpace,
      });

      expect(vfs.getFreeDiskBytes()).toBe(0);

      expect(() => {
        vfs.createFile({
          name: 'Tiny.txt',
          path: 'C:/Documents/Tiny.txt',
          parentPath: 'C:/Documents',
          kind: 'text',
          sizeBytes: 1,
        });
      }).toThrow('Disk Full');
    });

    it('documents path normalization behavior for root and subdirectories', () => {
      const messySubdir = '  C:\\\\Downloads//Subdir///file.txt  ';
      expect(vfs.normalizePath(messySubdir)).toBe('C:/Downloads/Subdir/file.txt');

      const trailingSlash = 'C:/Documents/MyFolder/';
      expect(vfs.normalizePath(trailingSlash)).toBe('C:/Documents/MyFolder');

      // Note: normalizePath currently keeps 'C:/' when given 'C:\\' due to length > 3 check
      const rootPath = 'C:\\';
      expect(vfs.normalizePath(rootPath)).toBe('C:/');
    });

    it('proves trash movement does NOT release disk space until emptyTrash is invoked', () => {
      const initialFree = vfs.getFreeDiskBytes();
      const fileSize = 50_000_000; // 50 MB

      vfs.createFile({
        name: 'HeavyData.dat',
        path: 'C:/Downloads/HeavyData.dat',
        parentPath: 'C:/Downloads',
        kind: 'executable',
        sizeBytes: fileSize,
      });

      expect(vfs.getFreeDiskBytes()).toBe(initialFree - fileSize);

      // Move to trash
      vfs.moveToTrash('C:/Downloads/HeavyData.dat');
      expect(vfs.getFreeDiskBytes()).toBe(initialFree - fileSize);

      // Empty trash
      const reclaimed = vfs.emptyTrash();
      expect(reclaimed).toBe(fileSize);
      expect(vfs.getFreeDiskBytes()).toBe(initialFree);
    });

    it('stress-tests trash restoration errors, invalid paths, and parent directory validation', () => {
      expect(() => vfs.restoreFromTrash('C:/Trash/NonExistent.txt')).toThrow('File not in trash');

      vfs.createFile({
        name: 'Orphan.txt',
        path: 'C:/Desktop/Orphan.txt',
        parentPath: 'C:/Desktop',
        kind: 'text',
        sizeBytes: 100,
      });

      vfs.moveToTrash('C:/Desktop/Orphan.txt');

      // Attempting to restore non-trash path throws
      expect(() => vfs.restoreFromTrash('C:/Desktop/Orphan.txt')).toThrow('File not in trash');

      // Valid restore succeeds
      const restored = vfs.restoreFromTrash('C:/Trash/Orphan.txt');
      expect(restored.path).toBe('C:/Desktop/Orphan.txt');
      expect(vfs.readFile('C:/Desktop/Orphan.txt')).toBeDefined();
    });

    it('demonstrates duplicate name collision behavior when trashing files with same name from different folders', () => {
      vfs.createFile({
        name: 'Collision.txt',
        path: 'C:/Documents/Collision.txt',
        parentPath: 'C:/Documents',
        kind: 'text',
        sizeBytes: 100,
        content: 'From Documents',
      });
      vfs.createFile({
        name: 'Collision.txt',
        path: 'C:/Desktop/Collision.txt',
        parentPath: 'C:/Desktop',
        kind: 'text',
        sizeBytes: 200,
        content: 'From Desktop',
      });

      // Trash first file
      vfs.moveToTrash('C:/Documents/Collision.txt');
      expect(vfs.readFile('C:/Trash/Collision.txt')?.metadata?.originalTrashPath).toBe('C:/Documents/Collision.txt');

      // Trash second file with same name -> overwrites C:/Trash/Collision.txt key
      vfs.moveToTrash('C:/Desktop/Collision.txt');
      expect(vfs.readFile('C:/Trash/Collision.txt')?.metadata?.originalTrashPath).toBe('C:/Desktop/Collision.txt');

      // Restoring now restores the second file to Desktop
      const restored = vfs.restoreFromTrash('C:/Trash/Collision.txt');
      expect(restored.path).toBe('C:/Desktop/Collision.txt');
      expect(vfs.readFile('C:/Documents/Collision.txt')).toBeUndefined();
    });

    it('executes 200 rapid file CRUD operations without hierarchy desynchronization', () => {
      for (let i = 0; i < 200; i++) {
        const name = `file_${i}.txt`;
        const path = `C:/Documents/${name}`;
        vfs.createFile({
          name,
          path,
          parentPath: 'C:/Documents',
          kind: 'text',
          sizeBytes: 1024,
          content: `Content ${i}`,
        });

        vfs.updateFile(path, { content: `Updated ${i}` });
        if (i % 2 === 0) {
          vfs.moveToTrash(path);
        }
      }

      const docs = vfs.listDirectory('C:/Documents');
      expect(docs.length).toBe(101); // 1 initial Readme.txt + 100 remaining files

      const trashed = vfs.listDirectory('C:/Trash');
      expect(trashed.length).toBe(100);

      const reclaimed = vfs.emptyTrash();
      expect(reclaimed).toBe(100 * 1024);
      expect(vfs.listDirectory('C:/Trash').length).toBe(0);
    });
  });

  // =========================================================================
  // 4. DOWNLOAD MANAGER ADVERSARIAL STRESS
  // =========================================================================
  describe('DownloadManager: Concurrency Gating, Water-Filling & Rapid Cycle Stress', () => {
    let eventBus: EventBus;
    let vfs: FileSystemEngine;
    let downloadManager: DownloadManager;
    let connectionSpeedKbps: number;

    beforeEach(() => {
      eventBus = new EventBus();
      vfs = new FileSystemEngine(eventBus);
      connectionSpeedKbps = 256; // 32 KB/s
      downloadManager = new DownloadManager({
        eventBus,
        vfs,
        getConnectionSpeedKbps: () => connectionSpeedKbps,
      });
    });

    it('enforces strict concurrency limits (1 browser, 4 FlashFetch) across 15 simultaneous tasks', () => {
      const browserTasks = [];
      for (let i = 0; i < 5; i++) {
        browserTasks.push(
          downloadManager.startDownload({
            sourceId: `b_${i}`,
            sourceUrl: `http://site.local/b_${i}.exe`,
            fileName: `b_${i}.exe`,
            totalBytes: 1_000_000,
            sourceMaxKbps: 512,
            manager: 'browser',
          })
        );
      }

      const flashTasks = [];
      for (let i = 0; i < 10; i++) {
        flashTasks.push(
          downloadManager.startDownload({
            sourceId: `f_${i}`,
            sourceUrl: `http://site.local/f_${i}.zip`,
            fileName: `f_${i}.zip`,
            totalBytes: 1_000_000,
            sourceMaxKbps: 512,
            manager: 'flashfetch',
          })
        );
      }

      const allActive = downloadManager.getActiveDownloads();
      const activeBrowser = allActive.filter(t => t.manager === 'browser');
      const activeFlash = allActive.filter(t => t.manager === 'flashfetch');

      expect(activeBrowser.length).toBe(1);
      expect(activeFlash.length).toBe(4);
      expect(allActive.length).toBe(5);
    });

    it('auto-drains a queue of 5 sequential browser downloads over a single discrete time jump', () => {
      const tasks = [];
      for (let i = 0; i < 5; i++) {
        tasks.push(
          downloadManager.startDownload({
            sourceId: `seq_${i}`,
            sourceUrl: `http://site.local/seq_${i}.exe`,
            fileName: `seq_${i}.exe`,
            totalBytes: 196_608,
            sourceMaxKbps: 512,
            manager: 'browser',
          })
        );
      }

      // Advance 1 game minute (60 seconds)
      downloadManager.advanceTime(1, 1);

      for (const t of tasks) {
        const taskState = downloadManager.getTask(t.id);
        expect(taskState?.status).toBe('complete');
        expect(taskState?.downloadedBytes).toBe(196_608);
        expect(vfs.readFile(`C:/Downloads/${t.fileName}`)).toBeDefined();
      }

      expect(downloadManager.getActiveDownloads().length).toBe(0);
    });

    it('correctly executes water-filling bandwidth allocation with heterogeneous server throttling', () => {
      const t1 = downloadManager.startDownload({
        sourceId: 't1',
        sourceUrl: 'http://site.local/t1.zip',
        fileName: 't1.zip',
        totalBytes: 50_000_000,
        sourceMaxKbps: 32,
        manager: 'flashfetch',
      });
      const t2 = downloadManager.startDownload({
        sourceId: 't2',
        sourceUrl: 'http://site.local/t2.zip',
        fileName: 't2.zip',
        totalBytes: 50_000_000,
        sourceMaxKbps: 64,
        manager: 'flashfetch',
      });
      const t3 = downloadManager.startDownload({
        sourceId: 't3',
        sourceUrl: 'http://site.local/t3.zip',
        fileName: 't3.zip',
        totalBytes: 50_000_000,
        sourceMaxKbps: 1000,
        manager: 'flashfetch',
      });
      const t4 = downloadManager.startDownload({
        sourceId: 't4',
        sourceUrl: 'http://site.local/t4.zip',
        fileName: 't4.zip',
        totalBytes: 50_000_000,
        sourceMaxKbps: 1000,
        manager: 'flashfetch',
      });

      expect(downloadManager.getTask(t1.id)?.allocatedKbps).toBe(32);
      expect(downloadManager.getTask(t2.id)?.allocatedKbps).toBe(64);
      expect(downloadManager.getTask(t3.id)?.allocatedKbps).toBe(80);
      expect(downloadManager.getTask(t4.id)?.allocatedKbps).toBe(80);
    });

    it('endures 500 rapid pause/resume cycles without corrupting downloaded bytes or state machine', () => {
      const task = downloadManager.startDownload({
        sourceId: 'rapid_toggle',
        sourceUrl: 'http://site.local/rapid.iso',
        fileName: 'rapid.iso',
        totalBytes: 100_000_000,
        sourceMaxKbps: 512,
        resumable: true,
      });

      downloadManager.advanceTime(1, 1);
      const initialBytes = downloadManager.getTask(task.id)!.downloadedBytes;
      expect(initialBytes).toBeGreaterThan(0);

      for (let i = 0; i < 500; i++) {
        downloadManager.pauseDownload(task.id);
        expect(downloadManager.getTask(task.id)?.status).toBe('paused');
        expect(downloadManager.getTask(task.id)?.downloadedBytes).toBe(initialBytes);

        downloadManager.resumeDownload(task.id);
        expect(downloadManager.getTask(task.id)?.status).toBe('downloading');
        expect(downloadManager.getTask(task.id)?.downloadedBytes).toBe(initialBytes);
      }

      downloadManager.advanceTime(1, 2);
      expect(downloadManager.getTask(task.id)!.downloadedBytes).toBeGreaterThan(initialBytes);
    });

    it('resets non-resumable download progress to 0 on resume', () => {
      const task = downloadManager.startDownload({
        sourceId: 'non_resumable',
        sourceUrl: 'http://site.local/fragile.bin',
        fileName: 'fragile.bin',
        totalBytes: 10_000_000,
        sourceMaxKbps: 512,
        resumable: false,
      });

      downloadManager.advanceTime(1, 1);
      expect(downloadManager.getTask(task.id)!.downloadedBytes).toBeGreaterThan(0);

      downloadManager.pauseDownload(task.id);
      downloadManager.resumeDownload(task.id);

      expect(downloadManager.getTask(task.id)?.downloadedBytes).toBe(0);
    });

    it('verifies concurrent download behavior when cumulative size exceeds available disk space', () => {
      const freeSpace = vfs.getFreeDiskBytes(); // ~6.65 GB
      const file1Size = Math.floor(freeSpace * 0.7); // 70% of free space
      const file2Size = Math.floor(freeSpace * 0.7); // 70% of free space (Cumulative: 140%)

      // Both start successfully because each is < freeSpace at start time
      const t1 = downloadManager.startDownload({
        sourceId: 't1_large',
        sourceUrl: 'http://site.local/large1.iso',
        fileName: 'large1.iso',
        totalBytes: file1Size,
        sourceMaxKbps: 512,
        manager: 'flashfetch',
      });
      const t2 = downloadManager.startDownload({
        sourceId: 't2_large',
        sourceUrl: 'http://site.local/large2.iso',
        fileName: 'large2.iso',
        totalBytes: file2Size,
        sourceMaxKbps: 512,
        manager: 'flashfetch',
      });

      // Advance time enough for both to finish
      downloadManager.advanceTime(10000, 10000);

      // t1 created the file in VFS
      expect(downloadManager.getTask(t1.id)?.status).toBe('complete');
      expect(vfs.readFile('C:/Downloads/large1.iso')).toBeDefined();
      // t2 finished download task but VFS file creation threw Disk Full (silently caught)
      expect(downloadManager.getTask(t2.id)?.status).toBe('complete');
      expect(vfs.readFile('C:/Downloads/large2.iso')).toBeUndefined();
    });
  });

  // =========================================================================
  // 5. INTEGRATED SIMULATION & MULTI-SYSTEM STRESS
  // =========================================================================
  describe('SimulationEngine: Integrated High-Entropy 14-Day Simulation Stress', () => {
    it('executes a full 14-day continuous lifecycle with mixed work shifts, rent payments, downloads and sleep cycles', () => {
      const sim = new SimulationEngine();

      expect(sim.getState().time.day).toBe(1);
      expect(sim.getState().player.cash).toBe(38.0);

      sim.dispatchAction({
        type: 'DOWNLOAD_START',
        sourceId: 'pulse_dl',
        url: 'http://downloadhub.local/PulseSetup.exe',
        fileName: 'PulseSetup.exe',
        totalBytes: 5_000_000,
        sourceMaxKbps: 512,
        manager: 'browser',
      });

      const shift1 = sim.dispatchAction({ type: 'PLAYER_WORK_SHIFT', durationMinutes: 240, wage: 62.0 });
      expect(shift1.success).toBe(true);
      expect(sim.getState().player.cash).toBe(100.0);

      sim.dispatchAction({ type: 'PLAYER_INTERACT_ROOM', activity: 'tea' });
      sim.dispatchAction({ type: 'PLAYER_REST_OR_SLEEP', wakeHour: 8 });
      expect(sim.getState().time.day).toBe(2);
      expect(sim.getState().player.energy).toBe(100);

      const dl = sim.getState().downloads.find(d => d.fileName === 'PulseSetup.exe');
      expect(dl?.status).toBe('complete');
      expect(sim.getState().vfs.files['C:/Downloads/PulseSetup.exe']).toBeDefined();

      for (let day = 2; day <= 6; day++) {
        sim.dispatchAction({ type: 'PLAYER_WORK_SHIFT', durationMinutes: 240, wage: 62.0 });
        sim.dispatchAction({ type: 'PLAYER_REST_OR_SLEEP', wakeHour: 8 });
      }

      expect(sim.getState().time.day).toBe(7);
      expect(sim.getState().player.cash).toBeGreaterThan(300);

      const rentPay = sim.dispatchAction({ type: 'PLAYER_PAY_RENT' });
      expect(rentPay.success).toBe(true);

      sim.dispatchAction({ type: 'PLAYER_REST_OR_SLEEP', wakeHour: 8 });
      expect(sim.getState().time.day).toBe(8);
      expect(sim.getState().player.rentDueDay).toBe(14);
      expect(sim.getState().player.rentAmount).toBe(140.0);

      while (sim.getState().time.day < 14) {
        sim.dispatchAction({ type: 'PLAYER_REST_OR_SLEEP', wakeHour: 8 });
      }

      expect(sim.getState().time.day).toBe(14);

      const snapshot = sim.exportSnapshot();
      const simRestored = new SimulationEngine();
      simRestored.loadSnapshot(snapshot);

      expect(simRestored.getState().time.day).toBe(14);
      expect(simRestored.getState().player.cash).toBe(sim.getState().player.cash);
      expect(simRestored.getState().vfs.files['C:/Downloads/PulseSetup.exe']).toBeDefined();
    });
  });
});
