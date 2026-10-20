import { useEffect, useState } from 'react';
import { RetroAmpApp, type TrackItem } from '../../apps/retroamp/RetroAmpApp';
import type { SimulationAppRead } from '../../engine/kernel/SimulationPublication';
import type { WorkerGameSession } from './WorkerGameSession';

/** Only selected audio-file bodies cross the typed Worker boundary, never VFS state. */
export function WorkerRetroAmpPanel({ session, revision }: {
  session: WorkerGameSession; revision: number;
}) {
  const [apps, setApps] = useState<SimulationAppRead | null>(null);
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setApps(null); setTracks([]);
    void Promise.all([
      session.read({ kind: 'apps' }),
      session.read({ kind: 'directory', path: 'C:/Music', limit: 16 }),
    ]).then(async ([a, directory]) => {
      if (!live || a.revision !== revision || directory.revision !== revision) return;
      setApps(a);
      if (!a.installedSoftware.some(item => item.appId === 'app.retroamp')) return;
      const candidate = directory.files.filter(file =>
        file.kind === 'audio' && /^C:\/Music\/[^/]{1,80}\.wav$/i.test(file.path)).slice(0, 8);
      const selected = await Promise.all(candidate.map(file =>
        session.read({ kind: 'file', path: file.path })));
      if (!live || selected.some(file => file.revision !== revision)) return;
      setTracks(selected.flatMap(result => {
        const file = result.file;
        if (file?.kind !== 'audio' || !file.content ||
          !/^data:audio\/wav;base64,[A-Za-z0-9+/]+={0,2}$/.test(file.content) ||
          file.content.length > 96000) return [];
        return [{ id: file.id, filePath: file.path,
          title: file.name.replace(/\.wav$/i, ''), artist: 'Local Music',
          durationSeconds: 0, bitrateKbps: 0, src: file.content }];
      }));
      setError(null);
    }).catch(cause => { if (live) setError(String(cause)); });
    return () => { live = false; };
  }, [session, revision]);

  const installed = apps?.revision === revision &&
    apps.installedSoftware.some(item => item.appId === 'app.retroamp');
  const importSample = async () => {
    setBusy(true); setError(null);
    try {
      const result = await session.dispatch({ type: 'RETROAMP_IMPORT_SAMPLE' });
      if (!result.success) throw new Error(result.error || 'WAV import refused');
      // On new files, VFS owner publishes one revision. Existing files are idempotent.
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };
  return <section data-testid="worker-retroamp" className="h-full">
    {error && <p role="alert" className="bg-red-100 p-1 text-xs text-red-900">{error}</p>}
    {apps?.revision === revision && !installed ?
      <p className="p-3 text-xs">Install RetroAmp first.</p> :
      apps?.revision === revision ?
        <RetroAmpApp tracks={tracks} onAddFile={busy ? undefined : () => { void importSample(); }} /> :
        <p role="status" className="p-3 text-xs">Reading music files from the Worker…</p>}
  </section>;
}
