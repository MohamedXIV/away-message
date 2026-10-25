import { useEffect, useState } from 'react';
import type {
  SimulationAppRead, SimulationDesktopRead,
} from '../../engine/kernel/SimulationPublication';
import type { OsInstallPlan } from '../../engine/kernel/ComputerOwnershipRuntime';
import type { SimulationHardwareCommand } from './SimulationHostProtocol';
import { getOrionInstallerPresentation } from '../../desktop/host/OrionInstallerPresentation';
import type { WorkerGameSession } from './WorkerGameSession';

/**
 * Physically owned computer, installer media and the canonical download queue.
 * Never reconstructs hardware, OS, installers or download progress in React.
 * Owner-side preflight always runs before an OS install commit.
 */
export function WorkerSystemPanel({
  session, revision,
}: {
  session: WorkerGameSession;
  revision: number;
}) {
  const [apps, setApps] = useState<SimulationAppRead | null>(null);
  const [desktop, setDesktop] = useState<SimulationDesktopRead | null>(null);
  const [plan, setPlan] = useState<OsInstallPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [url, setUrl] = useState('');

  useEffect(() => {
    let alive = true;
    void Promise.all([session.read({ kind: 'apps' }), session.read({ kind: 'desktop' })])
      .then(([a, d]) => {
        if (!alive || a.revision !== revision || d.revision !== revision) return;
        setApps(a);
        setDesktop(d);
      })
      .catch(error => { if (alive) setNotice(String(error)); });
    return () => { alive = false; };
  }, [revision, session]);

  // The Worker clock produces unrelated revisions every game minute.
  // Do not discard an OS preflight just because time progressed while the
  // player reads it. Owner.commitOsInstall always revalidates inserted media,
  // hardware and the selected installation plan atomically.

  const hardware = async (command: SimulationHardwareCommand, label: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await session.hardware(command);
      if (!result.success) throw new Error(result.error || label + ' was rejected');
      if (command.kind === 'prepareOs') {
        if (!result.data) throw new Error('Unable to prepare setup. Check the installation disc.');
        setPlan(result.data);
        setNotice('Installation disc verified. Ready to continue setup.');
      } else {
        setPlan(null);
        setNotice(label);
      }
    } catch (error) {
      setPlan(null);
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const dispatch = async (
    action: Parameters<WorkerGameSession['dispatch']>[0], label: string,
  ) => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await session.dispatch(action);
      if (!result.success) throw new Error(result.error || 'This action could not be completed');
      setNotice(label);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const createSimulatedDownload = (event: React.FormEvent) => {
    event.preventDefault();
    // The legacy DownloadManager simulates in-game .local downloads, not
    // arbitrary web fetches or real browser network access.
    const cleaned = url.trim();
    let parsed: URL;
    try { parsed = new URL(cleaned); }
    catch { setNotice('Enter a valid website address.'); return; }
    if (parsed.protocol !== 'http:' || !parsed.hostname.endsWith('.local')) {
      setNotice('This address cannot be reached.');
      return;
    }
    const fileName = decodeURIComponent(parsed.pathname.split('/').at(-1) || '');
    if (!/^[a-z0-9._-]{1,80}$/i.test(fileName)) {
      setNotice('A simple downloadable file name is required');
      return;
    }
    void dispatch({
      type: 'DOWNLOAD_START', sourceId: 'worker_browser',
      url: parsed.href, fileName, totalBytes: 1024 * 1024 * 5,
      sourceMaxKbps: 256, manager: 'browser',
    }, 'Download added to queue').then(() => setUrl(''));
  };

  const button = 'rounded border border-gray-500 bg-[#eee] px-2 py-1 text-xs disabled:opacity-40';
  return (
    <section data-testid="worker-system-panel"
      className="flex h-full flex-col gap-3 overflow-y-auto bg-[#ece9d8] p-3 text-black text-xs">
      <h2 className="text-sm font-bold">Computer · owned hardware / installer media</h2>
      <div data-testid="worker-boot-state">
        Computer: {desktop?.pcBootState ?? 'loading'} · Orion OS: {desktop?.osVersion ?? 'not installed'}
      </div>
      <div>
        <p>CPU: {apps?.hardware.cpuName ?? '—'} · RAM: {apps?.hardware.ramMB ?? 0} MB</p>
        <p>Free disk: {apps?.hardware.hddFreeGB ?? 0} GB ·
          Network: {apps?.hardware.connectionSpeedKbps ?? 0} kbps</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy || desktop?.pcBootState !== 'no_computer'}
          onClick={() => void dispatch({
            type: 'STORE_PURCHASE_ITEM', storeId: 'silicon_spares', skuId: 'bundle_scrapyard',
          }, 'Scrap Yard computer bundle purchased')}>
          Purchase starter hardware bundle ($35)
        </button>
        <button className={button} disabled={busy || desktop?.pcBootState !== 'awaiting_setup'}
          onClick={() => void hardware({ kind: 'setup' }, 'Computer assembled at home')}>
          Assemble computer
        </button>
        <button className={button} disabled={busy || !apps?.computer.assembled}
          onClick={() => void hardware({
            kind: 'power', poweredOn: !apps?.computer.poweredOn,
          }, apps?.computer.poweredOn ? 'Computer powered off' : 'Computer powered on')}>
          {apps?.computer.poweredOn ? 'Power off' : 'Power on'}
        </button>
      </div>
      <h3 className="border-t border-gray-400 pt-2 font-semibold">Silicon &amp; Spares · physical upgrades</h3>
      <p>Retail parts and OS media are delivered as owned physical items. Nothing is pre-installed.</p>
      <div data-testid="worker-os-upgrade-store" className="flex flex-wrap gap-2">
        <button className={button} disabled={busy} onClick={() => void dispatch({
          type: 'STORE_PURCHASE_ITEM', storeId: 'silicon_spares', skuId: 'part_ram_128mb',
        }, 'Purchased physical 128MB RAM; shut down the PC to fit it')}>
          Buy 128MB RAM ($32)
        </button>
        <button className={button} disabled={busy} onClick={() => void dispatch({
          type: 'STORE_PURCHASE_ITEM', storeId: 'silicon_spares', skuId: 'disc_orion_50',
        }, 'Orion 5.0 setup CD purchased. Insert the disc to install.')}>
          Buy Orion 5.0 setup CD ($29)
        </button>
      </div>
      <p>RAM: {apps?.hardware.ramMB ?? 0} MB. Shut down and use the physical workbench
        to install purchased components. Check your system requirements before installing.</p>
      <h3 className="font-semibold">Installation discs</h3>
      <div className="flex flex-wrap gap-2">
        {(desktop?.bootMediaItems ?? []).map(item => (
          <div key={item.instanceId} data-testid={'worker-owned-cd-' + item.catalogItemId}
            className="rounded border border-gray-400 p-2">
            {item.catalogItemId} ({item.location})
            <button className={'ml-2 ' + button}
              disabled={busy || item.location === 'inserted'}
              onClick={() => void hardware({ kind: 'insertMedia', instanceId: item.instanceId },
                'Owned disc inserted')}>
              Insert disc
            </button>
          </div>
        ))}
        {desktop?.bootMediaItems.length === 0 && <span>No installation discs available</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy}
          onClick={() => void hardware({ kind: 'ejectMedia' }, 'Disc ejected')}>Eject disc</button>
        <button className={button} disabled={busy}
          onClick={() => void hardware({ kind: 'prepareOs' }, 'OS preflight complete')}>
          Verify OS installer
        </button>
      </div>
      {plan && !desktop?.osInstallation && (
        <div className={'border p-3 ' + getOrionInstallerPresentation(plan.targetOs).frameClass}
          data-testid="worker-os-plan">
          <p className="font-bold">{getOrionInstallerPresentation(plan.targetOs).heading}</p>
          <p>{plan.mode === 'upgrade' ? 'Upgrade' : 'Install'}: {plan.targetOs} · Estimated {plan.durationMinutes} minutes</p>
          <p className="my-2 text-xs">Keep the installation disc inserted until setup finishes.</p>
          <button className={getOrionInstallerPresentation(plan.targetOs).buttonClass} disabled={busy}
            onClick={() => void hardware({ kind: 'startOs', plan }, 'OS installation started')}>
            Begin installation
          </button>
        </div>
      )}
      {desktop?.osInstallation && (
        <div data-testid="worker-system-os-install-progress"
          data-installer-edition={getOrionInstallerPresentation(desktop.osInstallation.targetOs).edition}
          className={'border p-3 ' + getOrionInstallerPresentation(desktop.osInstallation.targetOs).frameClass}>
          <strong>{getOrionInstallerPresentation(desktop.osInstallation.targetOs).heading}</strong>
          <p>Copying and configuring from owned disc: {desktop.osInstallation.elapsedMinutes} /
            {desktop.osInstallation.durationMinutes} minutes</p>
          <progress className="w-full" aria-label="Orion installation progress"
            value={desktop.osInstallation.elapsedMinutes} max={desktop.osInstallation.durationMinutes} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={getOrionInstallerPresentation(desktop.osInstallation.targetOs).buttonClass}
              disabled={busy} onClick={() => void hardware({ kind: 'advanceOs' }, 'Installation advanced')}>
              Advance installation
            </button>
            <button className={getOrionInstallerPresentation(desktop.osInstallation.targetOs).buttonClass}
              disabled={busy} onClick={() => void hardware({ kind: 'cancelOs' }, 'Installation canceled')}>
              Cancel installation
            </button>
          </div>
        </div>
      )}

      <h3 className="border-t border-gray-400 pt-2 font-semibold">Installed programs</h3>
      {(apps?.installedSoftware ?? []).map(item => (
        <div key={item.id} className="flex items-center justify-between gap-2">
          <span>{item.name} {item.version}</span>
          <button className={button} disabled={busy}
            onClick={() => void dispatch({ type: 'SOFTWARE_UNINSTALL', installedId: item.id },
              'Uninstalled ' + item.name)}>Uninstall {item.name}</button>
        </div>
      ))}
      {apps?.installedSoftware.length === 0 && <span>No installed programs</span>}

      <h3 className="border-t border-gray-400 pt-2 font-semibold">Downloads</h3>
      <form onSubmit={createSimulatedDownload} className="flex gap-2">
        <input aria-label="Download URL" value={url}
          placeholder="http://downloadhub.local/files/example.zip"
          onChange={event => setUrl(event.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-500 p-1" />
        <button className={button} disabled={busy}>Download</button>
      </form>
      <p className="text-gray-700">Downloads are saved to your computer.</p>
      {(apps?.downloads ?? []).map(task => (
        <div key={task.id} className="flex flex-wrap items-center gap-2 border-b border-gray-300 py-1">
          <span>{task.fileName} · {task.status} ·
            {Math.floor((task.downloadedBytes / Math.max(1, task.totalBytes)) * 100)}%</span>
          {task.status === 'downloading' && (
            <button className={button} disabled={busy} onClick={() =>
              void dispatch({ type: 'DOWNLOAD_PAUSE', taskId: task.id }, 'Download paused')
            }>Pause</button>
          )}
          {task.status === 'paused' && (
            <button className={button} disabled={busy} onClick={() =>
              void dispatch({ type: 'DOWNLOAD_RESUME', taskId: task.id }, 'Download resumed')
            }>Resume</button>
          )}
          {(task.status === 'paused' || task.status === 'downloading' || task.status === 'queued') && (
            <button className={button} disabled={busy} onClick={() =>
              void dispatch({ type: 'DOWNLOAD_CANCEL', taskId: task.id }, 'Download cancelled')
            }>Cancel</button>
          )}
        </div>
      ))}
      {notice && <p role="status" data-testid="worker-system-notice"
        className="rounded bg-white p-2">{notice}</p>}
    </section>
  );
}
