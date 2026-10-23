import { useEffect, useState } from 'react';
import type { SimulationInstallerRead } from '../../engine/kernel/SimulationPublication';
import { InstallerWizardView } from '../../apps/installer/InstallerWizardView';
import { useWindowStore } from '../../store/useWindowStore';
import type { WorkerGameSession } from './WorkerGameSession';

export function WorkerInstallerPanel({ session, revision, windowId, filePath }: {
  session: WorkerGameSession; revision: number; windowId: string; filePath?: string;
}) {
  const closeWindow = useWindowStore(s => s.closeWindow);
  const openWindow = useWindowStore(s => s.openWindow);
  const [read, setRead] = useState<SimulationInstallerRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [shortcut, setShortcut] = useState(true);
  const [offers, setOffers] = useState<Record<string, boolean>>({});
  const name = filePath?.split('/').pop() ?? '';
  useEffect(() => {
    let active = true;
    if (!filePath) { setError('Open a completed .exe from My Computer → Downloads.'); return () => { active = false; }; }
    void session.read({ kind: 'installer', filePath }).then(data => {
      if (!active || data.revision !== revision) return;
      setRead(data);
      if (!data.ready) { setError(data.reason ?? 'Installer unavailable'); return; }
      setError(null);
      setShortcut(data.preview?.selectedOptions.createDesktopShortcut ?? true);
      setOffers(old => Object.keys(old).length ? old :
        Object.fromEntries((data.preview?.softwareDef.bundledOffers ?? []).map(o => [o.id, o.defaultChecked])));
    }).catch(cause => { if (active) setError(String(cause)); });
    return () => { active = false; };
  }, [session, revision, filePath]);

  const next = () => {
    if (!read?.ready || !read.preview || busy) return;
    if (stage === 2 && !read.preview.compatibilityResult.isCompatible) {
      setError('System requirements not met.'); return;
    }
    if (stage < 4) { setStage((stage + 1) as 1 | 2 | 3 | 4); return; }
    if (stage !== 4 || !filePath) return;
    setStage(5); setProgress(0); setBusy(true); setError(null);
    void session.dispatch({ type: 'SOFTWARE_INSTALL_FROM_DOWNLOAD', filePath,
      selectedOptions: { ...offers, createDesktopShortcut: shortcut },
    }).then(result => {
      setProgress(result.success ? 100 : 0);
      setInstalled(result.success);
      setError(result.success ? null : result.error || 'Canonical installation refused.');
      setStage(6);
    }).catch(cause => {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStage(6);
    }).finally(() => setBusy(false));
  };
  const finish = () => {
    closeWindow(windowId);
    if (!installed || error) return;
    const appId = read?.preview?.softwareDef.appId;
    if (appId === 'app.pulse') openWindow('pulse');
    else if (appId === 'app.flashfetch') openWindow('flashfetch');
    else if (appId === 'app.retroamp') openWindow('retroamp');
  };
  return <section data-testid="worker-installer" className="h-full">
    <InstallerWizardView fileName={name} stage={stage}
      session={read?.ready ? read.preview : null} error={error}
      progress={progress} createDesktopShortcut={shortcut}
      setCreateDesktopShortcut={setShortcut} acceptedOffers={offers}
      setAcceptedOffers={setOffers} handleNext={next}
      handleBack={() => { if (!busy && stage > 1 && stage < 5) {
        setStage((stage - 1) as 1 | 2 | 3 | 4); setError(null);
      } }}
      handleCancel={() => closeWindow(windowId)} handleFinish={finish} />
  </section>;
}
