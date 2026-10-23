import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { getReleaseById } from '../../engine/OsCatalog';
import type { OsInstallPlan } from '../../engine/kernel/ComputerOwnershipRuntime';
import type { SimulationAppRead, SimulationDesktopRead } from '../../engine/kernel/SimulationPublication';
import { getOrionInstallerPresentation } from '../../desktop/host/OrionInstallerPresentation';
import type { WorkerGameSession } from './WorkerGameSession';

interface Props {
  session: WorkerGameSession;
  revision: number;
  desktop: SimulationDesktopRead;
}

/** The physical computer before it has an installed Orion OS. DOS is a
 * real player-operated, keyboard-first *presentation* over canonical Worker
 * equipment, owned media and OS installation. Never a second OS owner. */
export function WorkerPreOrionShell({ session, revision, desktop }: Props) {
  const [apps, setApps] = useState<SimulationAppRead | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>([
    'Oakhaven Compatible DOS 1.0',
    'Copyright (c) 2006 Oakhaven Computer Works.',
    'No Orion installation found. Type HELP for commands.',
  ]);
  const [plan, setPlan] = useState<OsInstallPlan | null>(null);
  const [stage, setStage] = useState(0);
  const prompt = useRef<HTMLInputElement>(null);
  const historyEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void session.read({ kind: 'apps' }).then(data => {
      if (alive && data.revision === revision) setApps(data);
    }).catch(error => { if (alive) setNotice(String(error)); });
    return () => { alive = false; };
  }, [session, revision]);

  useEffect(() => {
    if (!plan) historyEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [history, plan]);

  const record = (lines: string | string[]) => {
    setHistory(prev => [...prev, ...(typeof lines === 'string' ? [lines] : lines)].slice(-55));
  };

  async function physical(operation: () => Promise<{ success: boolean; error?: string }>, success: string) {
    setBusy(true);
    setNotice(null);
    try {
      const result = await operation();
      if (!result.success) throw new Error(result.error || 'The hardware owner rejected the operation.');
      setNotice(success);
      record(success);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setNotice(message);
      record('ERROR: ' + message);
    } finally {
      setBusy(false);
    }
  }

  async function execute(raw: string) {
    const text = raw.trim();
    if (!text) return;
    record('C:\\> ' + text);
    const [verb, ...args] = text.toUpperCase().split(/\s+/);
    switch (verb) {
      case 'HELP':
        record(['HELP  VER  CLS  DIR  MEDIA  INSERT <N>  EJECT  SETUP', 'Only original owned optical media can install Orion.']);
        break;
      case 'VER':
        record('Oakhaven Compatible DOS 1.0 — base boot environment');
        break;
      case 'CLS':
        setHistory([]);
        break;
      case 'DIR':
        if (args[0]?.startsWith('D:')) {
          const media = desktop.bootMediaItems.find(item => item.location === 'inserted');
          record(media ? ['D:\\  ' + media.catalogItemId, 'SETUP.EXE    (owned optical disc)'] : 'Drive D: not ready — insert a physical disc.');
        } else {
          record(['Directory of C:\\', ...desktop.desktopFiles.slice(0, 16).map(file => file.name), '<DIR>  DOS', 'Use DIR D: for installed optical media.']);
        }
        break;
      case 'MEDIA':
        record(desktop.bootMediaItems.length
          ? desktop.bootMediaItems.map((item, index) => `${index + 1}. ${item.catalogItemId} [${item.location}]`)
          : ['No owned OS discs available. Acquire a real disc first.']);
        break;
      case 'INSERT': {
        const index = Number(args[0]) - 1;
        const item = desktop.bootMediaItems[index];
        if (!item || !Number.isInteger(index)) { record('Invalid disc number. Run MEDIA first.'); break; }
        await physical(() => session.hardware({ kind: 'insertMedia', instanceId: item.instanceId }),
          'Optical drive accepted owned disc: ' + item.catalogItemId);
        break;
      }
      case 'EJECT':
        await physical(() => session.hardware({ kind: 'ejectMedia' }), 'Optical disc ejected.');
        break;
      case 'SETUP':
      case 'INSTALL':
      case 'D:\\SETUP.EXE': {
        setBusy(true);
        try {
          const result = await session.hardware({ kind: 'prepareOs' });
          if (!result.success || !result.data) throw new Error(result.error || 'Setup media verification failed.');
          setStage(0);
          setPlan(result.data);
          record('Verified owned OS disc. Setup is ready.');
        } catch (err) {
          record('ERROR: ' + (err instanceof Error ? err.message : String(err)));
        } finally { setBusy(false); }
        break;
      }
      default:
        record('Bad command or file name: ' + verb + '. Type HELP.');
    }
  }

  async function beginInstall() {
    if (!plan) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await session.hardware({ kind: 'startOs', plan });
      if (!result.success) throw new Error(result.error || 'OS setup could not start.');
      record('Copying and configuring Orion: the game clock tracks each step.');
      setPlan(null);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  }

  async function advanceInstall() {
    setBusy(true);
    setNotice(null);
    try {
      const result = await session.hardware({ kind: 'advanceOs' });
      if (!result.success) throw new Error(result.error || 'Could not continue the installation.');
      if (!result.data) record('OS setup completed. Restart into Orion.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  }

  async function cancelInstall() {
    await physical(() => session.hardware({ kind: 'cancelOs' }),
      'Setup canceled. Spent game minutes are not refunded.');
    setPlan(null);
  }

  // Without an assembled/powered machine, this is a physical workbench, not
  // an Orion desktop or an active DOS terminal.
  if (desktop.pcBootState !== 'no_boot_device') {
    return (
      <section data-testid="worker-physical-hardware-bench"
        className="flex min-h-80 flex-col gap-3 border border-neutral-600 bg-[#252422] p-4 text-[#f1e4c8]">
        <h2 className="text-lg font-bold">Computer &amp; Setup — physical workbench</h2>
        <p role="status">{desktop.pcBootState === 'powered_off'
          ? 'Computer powered off. No OS is running.'
          : 'No computer is booted. Purchase and assemble a real machine first.'}</p>
        <p className="text-xs">Only the real owned hardware and media are available here. There is no fake OS or Pulse.</p>
        <div className="flex flex-wrap gap-2">
          {desktop.pcBootState === 'no_computer' && (
            <button type="button" disabled={busy}
              onClick={() => void physical(
                () => session.dispatch({ type: 'STORE_PURCHASE_ITEM', storeId: 'silicon_spares', skuId: 'bundle_scrapyard' }),
                'Purchased the physical Scrap Yard computer bundle')}
              className="rounded border border-amber-500 px-3 py-2 text-sm">Purchase starter hardware bundle ($35)</button>
          )}
          {desktop.pcBootState === 'awaiting_setup' && (
            <button type="button" disabled={busy} onClick={() => void physical(
              () => session.hardware({ kind: 'setup' }), 'Computer assembled at home')}
              className="rounded border border-amber-500 px-3 py-2 text-sm">Assemble owned package</button>
          )}
          {desktop.pcBootState === 'powered_off' && apps?.computer.assembled && (
            <button type="button" disabled={busy} onClick={() => void physical(
              () => session.hardware({ kind: 'power', poweredOn: true }), 'Power on: booting DOS')}
              className="rounded border border-amber-500 px-3 py-2 text-sm">Power on</button>
          )}
        </div>
        {notice && <p role="status" className="text-sm">{notice}</p>}
      </section>
    );
  }

  const media = desktop.bootMediaItems.find(item => item.location === 'inserted');
  const installation = desktop.osInstallation;
  const effectivePlan = installation ?? plan;
  const edition = effectivePlan ? getOrionInstallerPresentation(effectivePlan.targetOs) : null;
  const release = effectivePlan ? getReleaseById(effectivePlan.targetOs) : null;
  return (
    <section data-testid="worker-dos-boot" aria-label="Booted DOS computer"
      className="flex min-h-[420px] flex-col gap-3 border-4 border-[#777] bg-[#080a08] p-4 font-mono text-[#a6ffb1]">
      <div className="flex justify-between border-b border-[#45704d] pb-2 text-xs">
        <strong>DOS 1.0 — C:\\</strong>
        <span data-testid="worker-dos-media">{media ? 'D: ' + media.catalogItemId : 'D: NO DISC'}</span>
      </div>
      {!effectivePlan ? (
        <>
          <div data-testid="worker-dos-transcript" className="flex-1 space-y-1 overflow-y-auto text-xs">
            {history.map((entry, i) => <p key={i} className="whitespace-pre-wrap">{entry}</p>)}
            <div ref={historyEnd} />
          </div>
          <form className="flex items-center gap-2 border-t border-[#30523b] pt-3"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              const current = command;
              setCommand('');
              void execute(current).finally(() => prompt.current?.focus());
            }}>
            <label htmlFor="dos-command" className="shrink-0 text-sm">C:\\&gt;</label>
            <input id="dos-command" ref={prompt} value={command} onChange={event => setCommand(event.target.value)}
              autoFocus disabled={busy} aria-label="DOS command"
              autoComplete="off" spellCheck={false}
              className="w-full min-w-0 bg-transparent text-sm text-[#d8ffd8] outline-none" />
          </form>
          <p className="text-xs opacity-70">HELP · MEDIA · INSERT 1 · DIR D: · SETUP. No internet or Orion apps in DOS.</p>
        </>
      ) : edition && effectivePlan && (
        <div data-testid="worker-orion-installer" data-installer-edition={edition.edition}
          className={'flex min-h-[330px] flex-1 flex-col gap-3 p-3 ' + edition.frameClass}>
          <header className={edition.titleClass}>
            <h2 className="text-lg">{edition.heading}</h2>
            <p className="text-xs opacity-80">{edition.subtitle}</p>
          </header>
          <div className="flex flex-1 flex-col justify-between gap-3 px-2 py-2">
            <div>
              <p className="mb-2 text-sm font-bold">{installation
                ? 'Installing from physical disc — saved progress'
                : `Step ${stage + 1} / ${edition.stages.length}: ${edition.stages[stage]}`}</p>
              <p className="text-sm">Verified owned disc: {media?.catalogItemId ?? effectivePlan.mediaInstanceId}</p>
              <p className="text-sm">Target: {release?.displayName ?? effectivePlan.targetOs} ({release?.codename ?? 'system'})</p>
              <p className="text-sm">Install mode: {effectivePlan.mode} · required disk: {(effectivePlan.installSizeBytes / 1_000_000_000).toFixed(1)} GB</p>
              <p className="mt-2 text-sm">Estimated installation: {effectivePlan.durationMinutes} minutes of game time, based on your actual computer.</p>
              {installation ? (
                <div data-testid="worker-os-install-progress" aria-label="OS installation progress">
                  <p className="font-bold">{installation.elapsedMinutes} of {installation.durationMinutes} world minutes spent</p>
                  <div role="progressbar" aria-label="Orion file setup" aria-valuenow={installation.elapsedMinutes}
                    aria-valuemin={0} aria-valuemax={installation.durationMinutes}
                    className="mt-2 h-4 overflow-hidden border border-current bg-black/20">
                    <div className="h-full bg-current opacity-60"
                      style={{ width: `${Math.round(100 * installation.elapsedMinutes / installation.durationMinutes)}%` }} />
                  </div>
                  <p className="mt-2 text-xs">Progress belongs to your saved PC. Power loss or a removed CD pauses setup;
                    reinsert the same owned disc to resume without repeating elapsed work.</p>
                </div>
              ) : (
                <p className="mt-3 text-xs opacity-80">
                  Verify the owned disc and choose setup stages. Starting will save progress before copying;
                  each subsequent step spends actual world minutes.
                </p>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" disabled={busy}
                onClick={() => installation ? void cancelInstall() : setPlan(null)}
                className={edition.buttonClass}>Cancel / DOS</button>
              {installation ? (
                <button type="button" disabled={busy} onClick={() => void advanceInstall()}
                  className={edition.buttonClass}>{busy ? 'Working…' : 'Advance installation'}</button>
              ) : (
                <>
                  {stage > 0 && <button type="button" disabled={busy} onClick={() => setStage(v => v - 1)}
                    className={edition.buttonClass}>Back</button>}
                  {stage < edition.stages.length - 1 ? (
                    <button type="button" disabled={busy} onClick={() => setStage(v => v + 1)}
                      className={edition.buttonClass}>Next</button>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => void beginInstall()}
                      className={edition.buttonClass}>{busy ? 'Starting…' : 'Begin installation'}</button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {notice && <p role="alert" className="text-xs text-amber-300">{notice}</p>}
    </section>
  );
}
