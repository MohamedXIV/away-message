import type { ActionResult, SimulationAction } from '../types';
import type { CoreDomainOwners } from './CoreDomainOwners';

/**
 * OS workstation commands over existing DownloadManager, VFS and Software
 * Registry authorities. No additional filesystem, download queue or
 * installation store is constructed.
 *
 * Unsupported actions return null so the single dispatcher can continue;
 * supported actions always produce an ActionResult (including failures).
 */
export class DesktopStorageCommands {
  constructor(
    private readonly owners: Pick<CoreDomainOwners, 'world' | 'downloads' | 'vfs' | 'software' | 'telemetry'>,
    private readonly publishState: () => void,
  ) {}

  public dispatch(action: SimulationAction, currentMinutes: number): ActionResult | null {
    switch (action.type) {
      case 'DOWNLOAD_START': {
        // P6.4 lenient teeth: overdue rent pauses NEW downloads (browsing still works)
        if (this.owners.world.getFlag('rent_overdue')) {
          return { success: false, error: 'Download line paused by property management — settle your residence rent to resume.' };
        }
        try {
          const task = this.owners.downloads.startDownload({
            sourceId: action.sourceId,
            sourceUrl: action.url,
            fileName: action.fileName,
            totalBytes: action.totalBytes,
            sourceMaxKbps: action.sourceMaxKbps,
            fileKind: action.fileKind,
            appAssociation: action.appAssociation,
            manager: action.manager,
            currentMinute: currentMinutes,
          });
          this.publishState();
          return { success: true, data: task };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'DOWNLOAD_PAUSE': {
        const ok = this.owners.downloads.pauseDownload(action.taskId);
        // A rejected/duplicate command did not mutate the canonical queue.
        if (ok) this.publishState();
        return { success: ok };
      }

      case 'DOWNLOAD_RESUME': {
        const ok = this.owners.downloads.resumeDownload(action.taskId);
        // A rejected/duplicate command did not mutate the canonical queue.
        if (ok) this.publishState();
        return { success: ok };
      }

      case 'DOWNLOAD_CANCEL': {
        const ok = this.owners.downloads.cancelDownload(action.taskId);
        // A rejected/duplicate command did not mutate the canonical queue.
        if (ok) this.publishState();
        return { success: ok };
      }

      case 'VFS_CREATE_FILE': {
        // Only the download owner can mint successful-transfer provenance.
        if (action.file.metadata && 'downloadTaskId' in action.file.metadata) {
          return { success: false, error: 'Download receipts are owner-only metadata.' };
        }
        try {
          const file = this.owners.vfs.createFile(action.file, currentMinutes);
          this.publishState();
          return { success: true, data: file };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'VFS_DELETE_FILE': {
        const ok = this.owners.vfs.deletePermanently(action.path);
        if (ok) this.publishState();
        return { success: ok };
      }

      case 'VFS_MOVE_TRASH': {
        try {
          const trashed = this.owners.vfs.moveToTrash(action.path, currentMinutes);
          this.publishState();
          return { success: true, data: trashed };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'VFS_RESTORE_TRASH': {
        try {
          const restored = this.owners.vfs.restoreFromTrash(action.trashPath, currentMinutes);
          this.publishState();
          return { success: true, data: restored };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'VFS_EMPTY_TRASH': {
        // A zero-byte file still changes the filesystem when removed: use
        // entry count, not the returned reclaimed-byte total, to detect no-op.
        const hasEntries = this.owners.vfs.listDirectoryMetadata('C:/Trash').length > 0;
        if (!hasEntries) return { success: true, data: { bytesReclaimed: 0 } };
        const reclaimed = this.owners.vfs.emptyTrash();
        this.publishState();
        return { success: true, data: { bytesReclaimed: reclaimed } };
      }

      case 'SOFTWARE_INSTALL': {
        try {
          const preview = this.owners.software.previewInstaller(action.softwareId);
          if (!preview.compatibilityResult.isCompatible) {
            return {
              success: false,
              error: 'Software incompatible with current system specifications.',
            };
          }
          // The ephemeral session starts only once preflight succeeds.
          // Commit options directly to the canonical registry, never to the
          // detached wizard return value (which previously ignored opt-outs).
          const wizard = this.owners.software.startInstallerWizard(action.softwareId);
          const installed = this.owners.software.completeInstallation(
            wizard.sessionId, currentMinutes, action.selectedOptions,
          );
          this.owners.telemetry.logEvent('software', 'installed', currentMinutes, {
            softwareId: action.softwareId,
          });
          this.publishState();
          return { success: true, data: installed };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'SOFTWARE_UNINSTALL': {
        const ok = this.owners.software.uninstallSoftware(action.installedId);
        if (!ok) return { success: false };
        this.owners.telemetry.logEvent('software', 'uninstalled', currentMinutes, {
          installedId: action.installedId,
        });
        this.publishState();
        return { success: true };
      }

      default:
        return null;
    }
  }
}
