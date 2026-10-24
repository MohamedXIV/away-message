import React, { useEffect, useState } from 'react';
import type { SimulationAppRead, SimulationWebsiteRead } from '../../engine/kernel/SimulationPublication';
import { VoyagerBrowserChrome } from '../../apps/browser/VoyagerBrowserChrome';
import { DownloadHubView, DOWNLOAD_CATALOG, type DownloadItem } from '../../internet/sites/DownloadHubView';
import { getDownloadHubDynamicItems } from '../../internet/worldSiteHelpers';
import { useOsHost } from '../../desktop/host/OsHostApiContext';
import { useWindowStore } from '../../store/useWindowStore';
import { WorkerOsHostProvider } from './WorkerOsHostProvider';
import { WorkerPublicSites } from './WorkerPublicSites';
import { InGameContextMenu, type GameContextMenuState } from '../../desktop/InGameContextMenu';
import type { WorkerGameSession } from './WorkerGameSession';

function gameUrl(value: string): URL | null {
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(value) ? value : 'http://' + value);
    return u.protocol === 'http:' && u.hostname.endsWith('.local') &&
      !u.username && !u.password && !u.port && u.href.length <= 320 ? u : null;
  } catch { return null; }
}

/** The authored visual browser with only serialized public Worker facts. */
export function WorkerVoyagerPanel({ session, revision, windowId, initialUrl = 'downloadhub.local' }: {
  session: WorkerGameSession; revision: number; windowId: string; initialUrl?: string;
}) {
  const [apps, setApps] = useState<SimulationAppRead | null>(null);
  const [site, setSite] = useState<SimulationWebsiteRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all([session.read({ kind: 'apps' }), session.read({ kind: 'website' })])
      .then(([a, w]) => {
        if (active && a.revision === revision && w.revision === revision) {
          setApps(a); setSite(w);
        }
      }).catch(cause => { if (active) setError(String(cause)); });
    return () => { active = false; };
  }, [session, revision]);
  return <section data-testid="worker-voyager" className="flex h-full flex-col">
    {error && <p role="alert" className="border-b bg-red-50 p-1 text-xs text-red-800">{error}</p>}
    {apps && site ? <WorkerOsHostProvider session={session} windowId={windowId}
      appRead={apps} onError={setError}>
      <BrowserContent session={session} revision={revision} site={site} initialUrl={initialUrl} />
    </WorkerOsHostProvider> : <p role="status">Reading canonical network…</p>}
  </section>;
}

function BrowserContent({ session, revision, site, initialUrl }: {
  session: WorkerGameSession; revision: number;
  site: SimulationWebsiteRead; initialUrl: string;
}) {
  const { network } = useOsHost();
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [history, setHistory] = useState([initialUrl]);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState('Done');
  const [menuOpen, setMenuOpen] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<GameContextMenuState | null>(null);
  const navigate = (raw: string, remember = true) => {
    const url = gameUrl(raw);
    if (!url) { setStatus('Blocked: only in-game HTTP .local pages are supported'); return; }
    const next = url.hostname + url.pathname + url.search;
    setCurrentUrl(next); setInputUrl(next); setStatus(network.status === 'connected' ? 'Done' : 'Offline preview');
    if (remember) { setHistory(old => [...old.slice(0, index + 1), next]); setIndex(index + 1); }
  };
  const back = () => {
    if (index > 0) { navigate(history[index - 1]!, false); setIndex(index - 1); }
  };
  const forward = () => {
    if (index < history.length - 1) { navigate(history[index + 1]!, false); setIndex(index + 1); }
  };
  const save = () => {
    const url = gameUrl(currentUrl);
    if (!url) return;
    const name = url.hostname.replace('.local', '') + '_page.txt';
    const path = 'C:/Documents/' + name;
    const content = 'Saved in-game page: ' + currentUrl;
    void session.dispatch({ type: 'VFS_CREATE_FILE',
      file: { name, path, parentPath: 'C:/Documents', kind: 'text',
        content, sizeBytes: new TextEncoder().encode(content).length,
        metadata: { textContent: content } },
    }).then(result => setSaved(result.success ? 'Saved ' + name + ' to C:/Documents' :
      result.error || 'Save refused by owner')).catch(cause => setSaved(String(cause)));
  };
  const url = gameUrl(currentUrl);
  let content: React.ReactNode;
  if (url?.hostname === 'downloadhub.local' && url.pathname === '/') {
    content = <WorkerDownloadHub site={site}/>;
  } else if (url && (url.hostname === 'citywire.local' || url.hostname === 'jobs.local') && url.pathname === '/') {
    content = <WorkerPublicSites key={url.hostname} session={session} revision={revision}
      initialTab={url.hostname === 'jobs.local' ? 'jobs' : 'news'} />;
  } else {
    content = <div className="p-4 text-sm text-gray-800">
      <h2 className="font-bold">This local site is not ported yet.</h2>
      <p>Available: downloadhub.local, citywire.local, jobs.local.</p>
      <button type="button" onClick={() => navigate('downloadhub.local')} className="mt-2 border p-1">DownloadHub</button>
    </div>;
  }
  return <div className="h-full" data-testid="worker-voyager-page-area"
    onContextMenu={event => {
      event.preventDefault();
      event.stopPropagation();
      const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
      const link = anchor ? gameUrl(anchor.getAttribute('href') ?? '') : null;
      setContextMenu({
        x: event.clientX, y: event.clientY, label: link ? 'In-game link' : currentUrl,
        items: [
          ...(link ? [{ label: 'Open link', onSelect: () => navigate(link.href) }] : []),
          { label: 'Back', disabled: index === 0, onSelect: back },
          { label: 'Forward', disabled: index >= history.length - 1, onSelect: forward },
          { label: 'Refresh this page', onSelect: () => navigate(currentUrl, false) },
          { label: 'Home', onSelect: () => navigate('downloadhub.local') },
          { label: 'Save page to C:/Documents', onSelect: save, separatorBefore: true },
        ],
      });
    }}>
    <VoyagerBrowserChrome currentUrl={currentUrl} inputUrl={inputUrl}
    onInputUrlChange={setInputUrl} historyIndex={index} historyLength={history.length}
    isFileMenuOpen={menuOpen} setIsFileMenuOpen={setMenuOpen} saveNotice={saved}
    isLoading={false} loadProgress={100} statusText={status}
    isSearchMateInstalled={false} connectionType={network.status === 'connected' ? 'in-game' : null}
    content={content} onNavigate={navigate}
    onNavigateSubmit={e => { e.preventDefault(); navigate(inputUrl); }}
    onBack={back} onForward={forward} onRefresh={() => navigate(currentUrl, false)}
    onHome={() => navigate('downloadhub.local')} onSavePage={save} />
    <InGameContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} testId="worker-web-context-menu" />
  </div>;
}

function WorkerDownloadHub({ site }: { site: SimulationWebsiteRead }) {
  const { network } = useOsHost();
  const openWindow = useWindowStore(s => s.openWindow);
  const [category, setCategory] = useState('ALL');
  const [notice, setNotice] = useState<string | null>(null);
  const dynamic = getDownloadHubDynamicItems(site.world, site.time.day);
  const catalog: DownloadItem[] = [
    ...dynamic.map(item => ({
      id: item.id, name: item.name, category: item.category as DownloadItem['category'],
      version: item.version, fileSizeBytes: item.fileSizeBytes,
      downloadUrl: item.downloadUrl, description: item.description,
    })),
    ...DOWNLOAD_CATALOG,
  ];
  const downloads = network.transfers;
  const status = (item: DownloadItem) => downloads.find(task =>
    task.sourceId === item.id || task.fileName === item.downloadUrl.split('/').pop())?.status ?? null;
  const start = (item: DownloadItem) => {
    if (network.status !== 'connected') {
      setNotice('Offline: assemble, install OS, power on and connect first.'); return;
    }
    const url = gameUrl(item.downloadUrl);
    const name = item.downloadUrl.split('/').pop() || '';
    if (!url || url.hostname !== 'downloadhub.local' || !url.pathname.startsWith('/files/') ||
      !/^[a-z0-9._-]{1,80}$/i.test(name)) {
      setNotice('Blocked unsupported download origin'); return;
    }
    if (status(item) === 'queued' || status(item) === 'downloading') {
      setNotice('Already queued in the canonical Worker');
    } else {
      network.startDownload({ sourceId: item.id, url: item.downloadUrl,
        fileName: name, totalBytes: item.fileSizeBytes, sourceMaxKbps: 256,
        fileKind: 'installer' });
      setNotice('Download queued: ' + name + '. View progress in Computer & Setup.');
    }
    // FlashFetch is optional third-party software. The default Orion browser
    // must never grant it just to show a transfer. Use the OS-bundled
    // Computer & Setup transfer ledger until FlashFetch is actually installed.
    openWindow('system');
  };
  return <DownloadHubView
    selectedCat={category} setSelectedCat={setCategory}
    filtered={category === 'ALL' ? catalog : catalog.filter(item => item.category === category)}
    dynamicCount={dynamic.length} day={site.time.day}
    notice={notice} setNotice={setNotice} downloads={downloads}
    getDownloadStatus={status} handleDownloadFile={start}
    onOpenTransfers={() => openWindow('system')} transferLabel="Downloads" />;
}
