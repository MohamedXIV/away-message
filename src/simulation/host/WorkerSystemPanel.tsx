import { useEffect, useState } from 'react';
import type {
  SimulationAppRead, SimulationDesktopRead,
} from '../../engine/kernel/SimulationPublication';
import type { OsInstallPlan } from '../../engine/kernel/ComputerOwnershipRuntime';
import type { SimulationHardwareCommand } from './SimulationHostProtocol';
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
        if (!result.data) throw new Error('Owner supplied no installation plan');
        setPlan(result.data);
        setNotice('OS install preflight accepted by the Worker');
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
      if (!result.success) throw new Error(result.error || 'Canonical action refused');
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
    catch { setNotice('Enter an in-game .local HTTP address'); return; }
    if (parsed.protocol !== 'http:' || !parsed.hostname.endsWith('.local')) {
      setNotice('Only the authored in-game .local network is supported');
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
    }, 'Download queued by the Worker').then(() => setUrl(''));
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
          }, 'Purchased the owned Scrap Yard bundle for the room')}>
          Purchase starter hardware bundle ($35)
        </button>
        <button className={button} disabled={busy || desktop?.pcBootState !== 'awaiting_setup'}
          onClick={() => void hardware({ kind: 'setup' }, 'Computer assembled at home')}>
          Assemble owned package
        </button>
        <button className={button} disabled={busy || !apps?.computer.assembled}
          onClick={() => void hardware({
            kind: 'power', poweredOn: !apps?.computer.poweredOn,
          }, apps?.computer.poweredOn ? 'Computer powered off' : 'Computer powered on')}>
          {apps?.computer.poweredOn ? 'Power off' : 'Power on'}
        </button>
      </div>
      <h3 className="font-semibold">Owned OS installation media</h3>
      <div className="flex flex-wrap gap-2">
        {(desktop?.bootMediaItems ?? []).map(item => (
          <div key={item.instanceId} className="rounded border border-gray-400 p-2">
            {item.catalogItemId} ({item.location})
            <button className={'ml-2 ' + button}
              disabled={busy || item.location === 'inserted'}
              onClick={() => void hardware({ kind: 'insertMedia', instanceId: item.instanceId },
                'Owned disc inserted')}>
              Insert disc
            </button>
          </div>
        ))}
        {desktop?.bootMediaItems.length === 0 && <span>No owned boot media</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy}
          onClick={() => void hardware({ kind: 'ejectMedia' }, 'Disc ejected')}>Eject disc</button>
        <button className={button} disabled={busy}
          onClick={() => void hardware({ kind: 'prepareOs' }, 'OS preflight complete')}>
          Verify OS installer
        </button>
      </div>
      {plan && (
        <div className="rounded border border-blue-700 bg-blue-50 p-2"
          data-testid="worker-os-plan">
          <p>Owner-verified {plan.mode}: {plan.targetOs} · {plan.durationMinutes} game minutes</p>
          <button className={button} disabled={busy}
            onClick={() => void hardware({ kind: 'commitOs', plan }, 'OS installed by Worker')}>
            Commit verified OS installation
          </button>
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

      <h3 className="border-t border-gray-400 pt-2 font-semibold">In-game DownloadManager</h3>
      <form onSubmit={createSimulatedDownload} className="flex gap-2">
        <input aria-label="In-game download URL" value={url}
          placeholder="http://downloadhub.local/files/example.zip"
          onChange={event => setUrl(event.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-500 p-1" />
        <button className={button} disabled={busy}>Download</button>
      </form>
      <p className="text-gray-700">These are simulated game files, not external network requests.</p>
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
