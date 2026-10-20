import { useEffect, useState } from 'react';
import { PhotoBoxView } from '../../apps/photobox/PhotoBoxView';
import type { SimulationAppRead, SimulationFileRead } from '../../engine/kernel/SimulationPublication';
import type { WorkerGameSession } from './WorkerGameSession';

/** The only PhotoBox writer is the game Worker; the UI previews one selected VFS SVG. */
export function WorkerPhotoBoxPanel({ session, revision, initialPath }: {
  session: WorkerGameSession; revision: number; initialPath?: string;
}) {
  const [apps, setApps] = useState<SimulationAppRead | null>(null);
  const [file, setFile] = useState<SimulationFileRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void session.read({ kind: 'apps' }).then(result => {
      if (live && result.revision === revision) { setApps(result); setError(null); }
    }).catch(cause => { if (live) setError(String(cause)); });
    return () => { live = false; };
  }, [session, revision]);
  useEffect(() => {
    let live = true; setFile(null);
    if (!initialPath) return () => { live = false; };
    void session.read({ kind: 'file', path: initialPath }).then(result => {
      if (live && result.revision === revision) setFile(result);
    }).catch(cause => { if (live) setError(String(cause)); });
    return () => { live = false; };
  }, [session, revision, initialPath]);
  const installed = apps?.revision === revision &&
    apps.installedSoftware.some(app => app.appId === 'app.photobox');
  const stored = file?.revision === revision ? file.file : null;
  const savedSvg = stored?.kind === 'image' && typeof stored.content === 'string' &&
    stored.content.length < 16384 &&
    stored.content.startsWith('<svg xmlns="http://www.w3.org/2000/svg"') &&
    stored.content.includes('aria-label="PhotoBox ') ? stored.content : null;
  return <section data-testid="worker-photobox" className="h-full">
    {error && <p role="alert" className="bg-red-100 p-1 text-xs text-red-800">{error}</p>}
    {apps?.revision === revision && !installed ? (
      <p className="p-3 text-xs">PhotoBox must be installed on this computer.</p>
    ) : apps?.revision === revision ? (
      <div className="flex h-full flex-col">
        {initialPath && <div data-testid="worker-photobox-saved-preview"
          className="border-b bg-[#23262b] p-2 text-xs text-white">
          {savedSvg ? <div className="flex items-center gap-3">
            <img className="h-20 w-32 rounded object-contain" alt="Saved SVG artwork"
              src={'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(savedSvg)} />
            <span>Opened saved VFS artwork: {initialPath}</span>
          </div> : <p>Selected image is not a readable PhotoBox illustration.</p>}
        </div>}
        <div className="min-h-0 flex-1">
          <PhotoBoxView currentOsId={apps.os.currentOsId} ramMb={apps.hardware.ramMB}
            onExport={(scene, filters) => session.dispatch({
              type: 'PHOTOBOX_EXPORT_ARTWORK', scene, filters,
            })} />
        </div>
      </div>
    ) : <p role="status" className="p-3 text-xs">Checking PhotoBox installation…</p>}
  </section>;
}
