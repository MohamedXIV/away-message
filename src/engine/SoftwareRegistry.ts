import type {
  InstalledSoftwareRecord,
  InstallerSession,
  OsVersion,
  SoftwareDefinition,
} from './types';
import { EventBus } from './EventBus';
import { FileSystemEngine } from './FileSystemEngine';
import { isMinOsSatisfied } from './OsCatalog';
import { getPulseReleaseById } from './PulseCatalog';

export type InstallerPreview = Pick<InstallerSession, 'softwareDef' | 'compatibilityResult' | 'selectedOptions'>;

export interface HardwareInfoProvider {
  getOsVersion: () => OsVersion | null;
  getRamMb: () => number;
  getCpuTier: () => number;
}

function pulseRequirements(releaseId: string): SoftwareDefinition['requirements'] {
  const release = getPulseReleaseById(releaseId);
  if (!release) throw new Error(`Unknown Pulse release: ${releaseId}`);
  return {
    minOs: release.requirements.minOs,
    minRamMB: release.requirements.minRamMB,
    minCpuTier: 1,
    requiredDiskBytes: release.requirements.minDiskMB * 1_000_000,
  };
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
      this.loadState(initialInstalled);
    }
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
        requirements: pulseRequirements('pulse_5.2'),
        hasInstaller: true,
      },
      {
        id: 'sw_pulse_60',
        appId: 'app.pulse',
        name: 'Pulse Messenger',
        version: '6.0',
        publisher: 'Pulse Communications Inc.',
        installedBytes: 50_331_648,
        requirements: pulseRequirements('pulse_6.0'),
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
          // A period-correct small PCM music player must run on the authored
          // Scrap Yard starter PC. This is not the 512 MB PhotoBox class.
          minRamMB: 64,
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
    return Array.from(this.installedSoftware.values()).map((software) => ({
      ...software,
      shortcuts: [...software.shortcuts],
      adwarePayload: software.adwarePayload ? { ...software.adwarePayload } : undefined,
    }));
  }

  public loadState(installedSoftware: InstalledSoftwareRecord[]): void {
    this.installedSoftware.clear();
    this.activeInstallers.clear();
    for (const software of installedSoftware) {
      this.installedSoftware.set(software.id, {
        ...software,
        shortcuts: [...software.shortcuts],
        adwarePayload: software.adwarePayload ? { ...software.adwarePayload } : undefined,
      });
    }
  }

  /** Tray badge query without cloning every installed package or its metadata. */
  public hasInstalledAppIdContaining(fragment: string): boolean {
    if (!fragment) return false;
    for (const sw of this.installedSoftware.values()) {
      if (String(sw.appId).includes(fragment)) return true;
    }
    return false;
  }

  public isInstalled(appId: string): boolean {
    for (const sw of this.installedSoftware.values()) {
      if (sw.appId === appId || sw.appId === `app.${appId}` || sw.id.includes(appId)) return true;
    }
    return false;
  }

  private evaluateCompatibility(def: SoftwareDefinition): InstallerSession['compatibilityResult'] {
    const currentOs = this.hw.getOsVersion();
    const currentRam = this.hw.getRamMb();
    const currentCpu = this.hw.getCpuTier();
    const freeDisk = this.vfs.getFreeDiskBytes();

    const osPassed = currentOs !== null && isMinOsSatisfied(currentOs, def.requirements.minOs);
    const ramPassed = currentRam >= def.requirements.minRamMB;
    const cpuPassed = currentCpu >= def.requirements.minCpuTier;
    const diskPassed = freeDisk >= def.requirements.requiredDiskBytes;

    return {
      isCompatible: osPassed && ramPassed && cpuPassed && diskPassed,
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
    };
  }

  /**
   * Read-only installer preview for the React wizard and command preflight.
   * Rendering a setup window must not allocate an internal installer session.
   */
  public previewInstaller(softwareDefId: string): InstallerPreview {
    const def = this.getSoftwareDefinition(softwareDefId);
    if (!def) throw new Error(`Unknown software definition: ${softwareDefId}`);
    const initialOffers: Record<string, boolean> = {};
    for (const offer of def.bundledOffers ?? []) {
      initialOffers[offer.id] = offer.defaultChecked;
    }
    return {
      softwareDef: def,
      compatibilityResult: this.evaluateCompatibility(def),
      selectedOptions: {
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        launchOnStartup: false,
        acceptedBundledOffers: initialOffers,
      },
    };
  }

  public startInstallerWizard(softwareDefId: string): InstallerSession {
    const preview = this.previewInstaller(softwareDefId);
    const sessionId = `inst_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const session: InstallerSession = {
      sessionId,
      ...preview,
      currentStage: 1,
      destinationPath: `C:/Program Files/${preview.softwareDef.name.split(' ')[0]}`,
      installProgress: 0,
    };

    this.activeInstallers.set(sessionId, session);
    return {
      ...session,
      selectedOptions: {
        ...session.selectedOptions,
        acceptedBundledOffers: { ...session.selectedOptions.acceptedBundledOffers },
      },
    };
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

  public completeInstallation(
    sessionId: string,
    currentMinute = 0,
    optionOverrides?: Record<string, boolean>,
  ): InstalledSoftwareRecord {
    const session = this.activeInstallers.get(sessionId);
    if (!session) throw new Error(`Invalid installer session: ${sessionId}`);

    const liveCompatibility = this.evaluateCompatibility(session.softwareDef);
    if (!liveCompatibility.isCompatible) {
      throw new Error('Cannot complete installer: System requirements compatibility check failed.');
    }

    const def = session.softwareDef;
    // The action is authoritative, not a mutable copy returned by wizard
    // creation. Honor only options actually offered by this software.
    const createDesktopShortcut = typeof optionOverrides?.createDesktopShortcut === 'boolean'
      ? optionOverrides.createDesktopShortcut
      : session.selectedOptions.createDesktopShortcut;
    const acceptedOffers = { ...session.selectedOptions.acceptedBundledOffers };
    for (const offer of def.bundledOffers ?? []) {
      const override = optionOverrides?.[offer.id];
      if (typeof override === 'boolean') {
        acceptedOffers[offer.id] = override;
      }
    }
    const previousReleases = Array.from(this.installedSoftware.values()).filter(
      (software) => software.appId === def.appId,
    );
    const createdShortcuts: string[] = [];

    if (createDesktopShortcut) {
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

    const hasToolbar = acceptedOffers['searchmate_toolbar'] ?? false;
    const hasAutorun = acceptedOffers['autorun_startup'] ?? false;

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

    for (const previous of previousReleases) {
      for (const shortcutPath of previous.shortcuts) {
        if (!createdShortcuts.includes(shortcutPath)) {
          this.vfs.deletePermanently(shortcutPath);
        }
      }
      this.installedSoftware.delete(previous.id);
    }

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
