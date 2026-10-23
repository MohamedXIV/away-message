import type { OsIconKind } from '../../desktop/osIconKinds';
import { resolveOsIconKind } from '../../desktop/osIconKinds';
import type { WorkerInstalledShortcut } from './WorkerInstalledAppLinks';

export interface WorkerDesktopIcon {
  id: string;
  label: string;
  appId: string;
  kind: OsIconKind;
  source: 'system' | 'installed';
  disabled?: boolean;
  title?: string;
}

/** OS shell places that are part of the desktop itself. This list is
 * presentation reachability from the canonical desktop read, not a software
 * registry. Separately installed programs enter through owner-published
 * shortcuts only. */
const SYSTEM_ICONS: readonly WorkerDesktopIcon[] = [
  { id: 'sys_computer', label: 'My Computer', appId: 'fileexplorer', kind: 'computer', source: 'system' },
  { id: 'sys_browser', label: 'Voyager Browser', appId: 'browser', kind: 'browser', source: 'system' },
  { id: 'sys_notepad', label: 'Notepad', appId: 'notepad', kind: 'notepad', source: 'system' },
  { id: 'sys_terminal', label: 'Command Prompt', appId: 'terminal', kind: 'terminal', source: 'system' },
  { id: 'sys_publicweb', label: 'Town Sites', appId: 'publicweb', kind: 'web', source: 'system' },
  { id: 'sys_control', label: 'Computer & Setup', appId: 'system', kind: 'control', source: 'system' },
  { id: 'sys_mailbox', label: 'Mailbox', appId: 'mailbox', kind: 'mail', source: 'system' },
  { id: 'sys_trash', label: 'Recycle Bin', appId: 'trash', kind: 'trash', source: 'system' },
  { id: 'sys_addremove', label: 'Add/Remove Programs', appId: 'addremove', kind: 'installer', source: 'system' },
  { id: 'sys_savegame', label: 'Save / Load Game', appId: 'savegame', kind: 'save', source: 'system' },
  { id: 'sys_ailab', label: 'AI Lab Inspector', appId: 'ailab', kind: 'ailab', source: 'system' },
];

export function getWorkerSystemDesktopIcons(): readonly WorkerDesktopIcon[] {
  return SYSTEM_ICONS;
}

/** Merge canonical owner-published desktop shortcuts into the system grid.
 * Shortcuts are already gated by the owner's installed-software roster in
 * WorkerInstalledAppLinks; this function only removes duplicate launch targets
 * and keeps an honest disabled state for installed software whose Worker UI
 * has not been migrated yet. */
export function buildWorkerDesktopIcons(
  shortcuts: readonly WorkerInstalledShortcut[] = [],
): WorkerDesktopIcon[] {
  const systemLaunchIds = new Set(SYSTEM_ICONS.map(icon => icon.appId));
  const seen = new Set<string>();
  const installed: WorkerDesktopIcon[] = [];
  for (const shortcut of shortcuts) {
    if (seen.has(shortcut.id)) continue;
    seen.add(shortcut.id);
    if (shortcut.launchId && systemLaunchIds.has(shortcut.launchId)) continue;
    const launchTarget = shortcut.launchId ?? shortcut.appId;
    installed.push({
      id: `installed_${shortcut.id}`,
      label: shortcut.label,
      appId: launchTarget,
      kind: resolveOsIconKind(launchTarget),
      source: 'installed',
      disabled: !shortcut.launchId,
      title: shortcut.launchId
        ? `Open installed ${shortcut.label}`
        : `${shortcut.label}: installed software, Worker UI not migrated yet`,
    });
  }
  return [...SYSTEM_ICONS, ...installed];
}
