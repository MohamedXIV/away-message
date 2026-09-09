import type {
  InstalledSoftwareRecord,
  InstallerSession,
  OsVersion,
  SoftwareDefinition,
} from './types';
import { EventBus } from './EventBus';
import { FileSystemEngine } from './FileSystemEngine';
import { isMinOsSatisfied } from './OsCatalog';

export interface HardwareInfoProvider {
  getOsVersion: () => OsVersion | null;
  getRamMb: () => number;
  getCpuTier: () => number;
}

export class SoftwareRegistry {
  private catalog: Map<string, SoftwareDefinition> = new Map();
  private installedSoftware: Map<string, InstalledSoftwareRecord> = new Map();
  private activeInstallers: Map<string, InstallerSession> = new Map();
  private eventBus: EventBus;
  private vfs: FileSystemEngine;
  private hw: HardwareInfoProvider;

  constructor(
    eventBus: EventBus,
    vfs: FileSystemEngine,
    hw: HardwareInfoProvider,
    initialInstalled?: InstalledSoftwareRecord[],
  ) {
    this.eventBus = eventBus;
    this.vfs = vfs;
    this.hw = hw;
    this.registerCatalog();

    if (initialInstalled) {
      for (const sw of initialInstalled) {
        this.installedSoftware.set(sw.id, { ...sw });
      }
    } else if (this.hw.getOsVersion() !== null) {
      // Legacy Orion installs shipped Voyager. A blank disk/no-OS machine ships nothing.
      this.registerPreinstalled(
        'app.browser',
        'Voyager Browser',
        '1.0',
        16_777_216,
        'C:/Program Files/Voyager',
      );
    }
  }

  private registerPreinstalled(
    appId: string,
    name: string,
    version: string,
    bytes: number,
    path: string,
  ): void {
    const id = `sw_pre_${appId}`;
    this.installedSoftware.set(id, {
      id,
      appId,
      name,
      version,
      installedBytes: bytes,
      installPath: path,
      installedAtMinute: 0,
      isPortable: false,
      isAdware: false,
      shortcuts: ['C:/Desktop/Voyager Browser.lnk'],
    });
  }

  private registerCatalog(): void {
    const apps: SoftwareDefinition[] = [
      {
        id: 'sw_pulse_52',
        appId: 'app.pulse',
        name: 'Pulse Messenger',
        version: '5.2',
        publisher: 'Pulse Communications Inc.',
        installedBytes: 33_554_432,
        requirements: {
          minOs: 'Orion_4.8',
          minRamMB: 512,
          minCpuTier: 1,
          requiredDiskBytes: 35_000_000,
        },
        hasInstaller: true,
      },
      {
        id: 'sw_pulse_60',
        appId: 'app.pulse',
        name: 'Pulse Messenger',
        version: '6.0',
        publisher: 'Pulse Communications Inc.',
        installedBytes: 50_331_648,
        requirements: {
          minOs: 'Orion_6.0',
          minRamMB: 768,
          minCpuTier: 1,
          requiredDiskBytes: 55_000_000,
        },
        hasInstaller: true,
      },
      {
        id: 'sw_flashfetch_31',
        appId: 'app.flashfetch',
        name: 'FlashFetch Download Accelerator',
        version: '3.1',
        publisher: 'SpeedNet Tools',
        installedBytes: 12_582_912,
        requirements: {
          minOs: 'Orion_4.8',
          minRamMB: 512,
          minCpuTier: 1,
          requiredDiskBytes: 15_000_000,
        },
        hasInstaller: true,
      },
      {
        id: 'sw_retroamp_23',
        appId: 'app.retroamp',
        name: 'RetroAmp Audio Player',
        version: '2.3',
        publisher: 'NullWave Media',
        installedBytes: 15_728_640,
        requirements: {
          minOs: 'Orion_4.8',
          minRamMB: 512,
          minCpuTier: 1,
          requiredDiskBytes: 18_000_000,
        },
        hasInstaller: true,
      },
      {
        id: 'sw_zipmate_40',
        appId: 'app.zipmate',
        name: 'ZipMate Archive Manager',
        version: '4.0',
        publisher: 'ZipSoft Systems',
        installedBytes: 8_388_608,
        requirements: {
          minOs: 'Orion_4.8',
          minRamMB: 512,
          minCpuTier: 1,
          requiredDiskBytes: 10_000_000,
        },
        hasInstaller: true,
      },
      {
        id: 'sw_photobox_30',
        appId: 'app.photobox',
        name: 'PhotoBox Studio',
        version: '3.0',
        publisher: 'PixelCraft Imaging',
        installedBytes: 67_108_864,
        requirements: {
          minOs: 'Orion_6.0',
          minRamMB: 768,
          minCpuTier: 1,
          requiredDiskBytes: 70_000_000,
        },
        hasInstaller: true,
      },
      {
        id: 'sw_weatherbuddy_14',
        appId: 'app.weatherbuddy',
        name: 'WeatherBuddy Desktop Widget',
        version: '1.4',
        publisher: 'CloudSoft Direct',
        installedBytes: 6_291_456,
        requirements: {
          minOs: 'Orion_4.8',
          minRamMB: 512,
          minCpuTier: 1,
          requiredDiskBytes: 8_000_000,
        },
        hasInstaller: true,
        isAdware: true,
        bundledOffers: [
          {
            id: 'searchmate_toolbar',
            name: 'SearchMate Toolbar',
            description:
              'Install SearchMate toolbar and set default homepage to searchmate.local (Recommended)',
            defaultChecked: true,
          },
          {
            id: 'autorun_startup',
            name: 'Autorun on Startup',
            description: 'Start WeatherBuddy automatically with Orion OS',
            defaultChecked: true,
          },
        ],
      },
      {
        id: 'sw_safesweep_20',
        appId: 'app.safesweep',
        name: 'SafeSweep Anti-Spyware',
        version: '2.0',
        publisher: 'SafeNet Security Labs',
        installedBytes: 20_971_520,
        requirements: {
          minOs: 'Orion_4.8',
          minRamMB: 512,
          minCpuTier: 1,
          requiredDiskBytes: 25_000_000,
        },
        hasInstaller: true,
      },
    ];

    for (const app of apps) this.catalog.set(app.id, app);
  }

  public getCatalog(): SoftwareDefinition[] {
    return Array.from(this.catalog.values()).map((app) => ({ ...app }));
  }

  public getSoftwareDefinition(id: string): SoftwareDefinition | undefined {
    let def = this.catalog.get(id);
    if (!def) {
      def = Array.from(this.catalog.values()).find(
        (candidate) =>
          candidate.appId === id || candidate.appId === `app.${id}` || candidate.id.includes(id),
      );
    }
    return def ? { ...def } : undefined;
  }

  public getInstalledSoftware(): InstalledSoftwareRecord[] {
    return Array.from(this.installedSoftware.values()).map((software) => ({ ...software }));
  }

  public isInstalled(appId: string): boolean {
    for (const sw of this.installedSoftware.values()) {
      if (sw.appId === appId || sw.appId === `app.${appId}` || sw.id.includes(appId)) return true;
    }
    return false;
  }

  public startInstallerWizard(softwareDefId: string): InstallerSession {
    let def = this.catalog.get(softwareDefId);
    if (!def) {
      def = Array.from(this.catalog.values()).find(
        (candidate) =>
          candidate.appId === softwareDefId ||
          candidate.appId === `app.${softwareDefId}` ||
          candidate.id.includes(softwareDefId),
      );
    }
    if (!def) throw new Error(`Unknown software definition: ${softwareDefId}`);

    const currentOs = this.hw.getOsVersion();
    const currentRam = this.hw.getRamMb();
    const currentCpu = this.hw.getCpuTier();
    const freeDisk = this.vfs.getFreeDiskBytes();

    const osPassed = currentOs !== null && isMinOsSatisfied(currentOs, def.requirements.minOs);
    const ramPassed = currentRam >= def.requirements.minRamMB;
    const cpuPassed = currentCpu >= def.requirements.minCpuTier;
    const diskPassed = freeDisk >= def.requirements.requiredDiskBytes;
    const isCompatible = osPassed && ramPassed && cpuPassed && diskPassed;

    const initialOffers: Record<string, boolean> = {};
    for (const offer of def.bundledOffers ?? []) {
      initialOffers[offer.id] = offer.defaultChecked;
    }

    const sessionId = `inst_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const session: InstallerSession = {
      sessionId,
      softwareDef: def,
      currentStage: 1,
      destinationPath: `C:/Program Files/${def.name.split(' ')[0]}`,
      selectedOptions: {
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        launchOnStartup: false,
        acceptedBundledOffers: initialOffers,
      },
      compatibilityResult: {
        isCompatible,
        osCheck: {
          passed: osPassed,
          required: def.requirements.minOs,
          current: currentOs ?? 'None',
        },
        ramCheck: { passed: ramPassed, required: def.requirements.minRamMB, current: currentRam },
        cpuCheck: { passed: cpuPassed, required: def.requirements.minCpuTier, current: currentCpu },
        diskCheck: {
          passed: diskPassed,
          required: def.requirements.requiredDiskBytes,
          available: freeDisk,
        },
      },
      installProgress: 0,
    };

    this.activeInstallers.set(sessionId, session);
    return { ...session };
  }

  public advanceInstallerStage(
    sessionId: string,
    nextStage: 1 | 2 | 3 | 4 | 5 | 6,
  ): InstallerSession {
    const session = this.activeInstallers.get(sessionId);
    if (!session) throw new Error(`Invalid installer session: ${sessionId}`);

    if (nextStage > 2 && !session.compatibilityResult.isCompatible) {
      throw new Error('Cannot advance installer: System requirements check failed.');
    }

    session.currentStage = nextStage;
    return { ...session };
  }

  public completeInstallation(sessionId: string, currentMinute = 0): InstalledSoftwareRecord {
    const session = this.activeInstallers.get(sessionId);
    if (!session) throw new Error(`Invalid installer session: ${sessionId}`);
    if (!session.compatibilityResult.isCompatible) {
      throw new Error('Cannot complete installer: System requirements compatibility check failed.');
    }

    const def = session.softwareDef;
    const createdShortcuts: string[] = [];

    if (session.selectedOptions.createDesktopShortcut) {
      const shortcutPath = `C:/Desktop/${def.name}.lnk`;
      try {
        this.vfs.createFile(
          {
            name: `${def.name}.lnk`,
            path: shortcutPath,
            parentPath: 'C:/Desktop',
            kind: 'shortcut',
            sizeBytes: 1024,
            appAssociation: def.appId,
            targetPath: `${session.destinationPath}/${def.name.split(' ')[0]}.exe`,
          },
          currentMinute,
        );
      } catch {
        // Ignore if shortcut exists.
      }
      createdShortcuts.push(shortcutPath);
    }

    const hasToolbar = session.selectedOptions.acceptedBundledOffers['searchmate_toolbar'] ?? false;
    const hasAutorun = session.selectedOptions.acceptedBundledOffers['autorun_startup'] ?? false;

    const record: InstalledSoftwareRecord = {
      id: `inst_${def.id}`,
      appId: def.appId,
      name: def.name,
      version: def.version,
      installedBytes: def.installedBytes,
      installPath: session.destinationPath,
      installedAtMinute: currentMinute,
      isPortable: def.isPortable ?? false,
      isAdware: def.isAdware ?? false,
      adwarePayload: def.isAdware
        ? {
            toolbarInjected: hasToolbar,
            homepageHijacked: hasToolbar ? 'http://searchmate.local' : undefined,
            startupAutorun: hasAutorun,
          }
        : undefined,
      shortcuts: createdShortcuts,
    };

    this.installedSoftware.set(record.id, record);
    this.activeInstallers.delete(sessionId);
    this.eventBus.emit('software:installed', { software: { ...record } });
    return { ...record };
  }

  public uninstallSoftware(installedId: string): boolean {
    const record = this.installedSoftware.get(installedId);
    if (!record) return false;

    for (const shortcutPath of record.shortcuts) {
      this.vfs.deletePermanently(shortcutPath);
    }

    this.installedSoftware.delete(installedId);
    this.eventBus.emit('software:uninstalled', { software: { ...record } });
    return true;
  }
}
