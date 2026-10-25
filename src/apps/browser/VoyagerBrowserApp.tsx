import React, { useState, useEffect, useRef, useMemo } from 'react';
import { VoyagerBrowserChrome } from './VoyagerBrowserChrome';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useSimulationApps, useSimulationChrome } from '../../store/useBoundedSimulationRead';
import { InternetRouter } from '../../internet/InternetRouter';
import { RouteMatchResult, ParsedUrl } from '../../internet/types';
import { soundManager } from '../../audio/SoundManager';
import { GeneratedSite } from '../../internet/sites/GeneratedSite';
import { aiService } from '../../ai/service';
import { loadAISettings } from '../../ai/settings';
import type { GeneratedSiteContent, AIResultMeta } from '../../ai/types';

interface HistoryEntry {
  url: string;
  title: string;
}

interface VoyagerBrowserAppProps {
  initialUrl?: string;
}

export const VoyagerBrowserApp: React.FC<VoyagerBrowserAppProps> = ({ initialUrl = 'findit.local' }) => {
  const connectionType = useSimulationChrome().connectionType;
  const installedSoftware = useSimulationApps().installedSoftware;
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);

  const [currentUrl, setCurrentUrl] = useState<string>(initialUrl);
  const [inputUrl, setInputUrl] = useState<string>(initialUrl);
  const [history, setHistory] = useState<HistoryEntry[]>([
    { url: initialUrl, title: 'FindIt Web Search' },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [statusText, setStatusText] = useState('Done');
  const [matchResult, setMatchResult] = useState<RouteMatchResult | null>(null);
  const [generatedSite, setGeneratedSite] = useState<GeneratedSiteContent | null>(null);
  const [generatedSiteMeta, setGeneratedSiteMeta] = useState<AIResultMeta | null>(null);
  const aiRequestIdRef = useRef(0);

  const router = useMemo(() => new InternetRouter(), []);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if SearchMate toolbar is installed
  const softwareList = Array.isArray(installedSoftware) ? installedSoftware : Object.values(installedSoftware || {});
  const isSearchMateInstalled = softwareList.some(
    (sw: any) => sw.appId === 'searchmate' || sw.isAdware || sw.adwarePayload?.toolbarInjected
  );

  const loadPage = (targetUrl: string, addToHistory = true) => {
    let cleanUrl = targetUrl.trim();
    if (!cleanUrl) return;

    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    router.abortCurrentLoad();

    setIsLoading(true);
    setLoadProgress(10);
    setStatusText(`Connecting to ${cleanUrl}...`);
    setMatchResult(null);
    setGeneratedSite(null);
    setGeneratedSiteMeta(null);

    const result = router.resolveRoute(cleanUrl);

    if (!connectionType) {
      setIsLoading(false);
      setLoadProgress(0);
      setStatusText('Offline — no network adapter is installed.');
      return;
    }

    router.simulatePageLoad(
      cleanUrl,
      connectionType,
      (progress) => {
        setLoadProgress(progress);
        setStatusText(`Transferring data from ${result.host}... ${progress}%`);
      },
      () => {
        const parsedUrl = result.parsedUrl;
        const resolvedUrl = parsedUrl ? parsedUrl.rawUrl : cleanUrl;
        const shouldGenerate = Boolean(result.is404 && parsedUrl?.host.endsWith('.local'));

        if (shouldGenerate && parsedUrl) {
          const requestId = ++aiRequestIdRef.current;
          setLoadProgress(96);
          setStatusText(`Generating ${parsedUrl.host}...`);
          void aiService.generateSite({
            host: parsedUrl.host,
            pathname: parsedUrl.pathname,
            worldSeed: 'away-message-demo',
            locale: 'en',
          }, loadAISettings()).then((aiResult) => {
            if (requestId !== aiRequestIdRef.current) return;
            setIsLoading(false);
            setLoadProgress(100);
            setStatusText(aiResult.meta.fallback ? 'Offline copy ready' : aiResult.meta.fromCache ? 'Cached page ready' : 'Generated page ready');
            setMatchResult(null);
            setGeneratedSite(aiResult.data);
            setGeneratedSiteMeta(aiResult.meta);
            setCurrentUrl(resolvedUrl);
            setInputUrl(resolvedUrl);

            if (addToHistory) {
              const newEntry = { url: resolvedUrl, title: aiResult.data.title };
              setHistory((prev) => [...prev.slice(0, historyIndex + 1), newEntry]);
              setHistoryIndex((prev) => prev + 1);
            }
            soundManager.play('im_recv');
          });
          return;
        }

        setIsLoading(false);
        setLoadProgress(100);
        setStatusText('Done');
        setMatchResult(result);
        setCurrentUrl(resolvedUrl);
        setInputUrl(resolvedUrl);

        if (addToHistory) {
          const newEntry = { url: resolvedUrl, title: result.pageTitle };
          setHistory((prev) => [...prev.slice(0, historyIndex + 1), newEntry]);
          setHistoryIndex((prev) => prev + 1);
        }

        soundManager.play('im_recv');
      }
    );
  };

  useEffect(() => {
    loadPage(initialUrl || 'findit.local', false);
    return () => {
      router.abortCurrentLoad();
    };
  }, []);

  useEffect(() => {
    if (initialUrl && initialUrl !== currentUrl) {
      loadPage(initialUrl, true);
    }
  }, [initialUrl]);

  const handleNavigateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadPage(inputUrl, true);
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const prevEntry = history[historyIndex - 1];
      if (prevEntry) {
        setHistoryIndex(historyIndex - 1);
        loadPage(prevEntry.url, false);
      }
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const nextEntry = history[historyIndex + 1];
      if (nextEntry) {
        setHistoryIndex(historyIndex + 1);
        loadPage(nextEntry.url, false);
      }
    }
  };

  const handleRefresh = () => {
    loadPage(currentUrl, false);
  };

  const handleHome = () => {
    loadPage('findit.local', true);
  };

  const handleSavePage = () => {
    setIsFileMenuOpen(false);
    let fileName: string;
    let pageContent: string;
    if (generatedSite) {
      fileName = `${currentUrl.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30) || 'page'}.txt`;
      if (!fileName.endsWith('.txt')) fileName += '.txt';
      pageContent = `# ${generatedSite.siteName}\n# ${generatedSite.title}\n${generatedSite.tagline}\n\n${generatedSite.sections.map((s) => `## ${s.heading}\n${s.body}\n${s.items.join('\n')}`).join('\n\n')}\n\n---\nSaved from ${currentUrl} • ${generatedSite.archetype}`;
    } else if (matchResult) {
      fileName = `${(matchResult.host || 'page').replace('.local', '')}_page.txt`;
      pageContent = `Saved page: ${matchResult.pageTitle}\nURL: ${currentUrl}\nHost: ${matchResult.host}\n\n---\nContent from ${currentUrl}`;
    } else {
      fileName = `page_${Date.now()}.txt`;
      pageContent = `Saved page from ${currentUrl}\n\n---\nNo content available.`;
    }
    // Ensure unique name if exists, but let VFS handle overwrite for now
    dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: fileName,
        path: `C:/Documents/${fileName}`,
        parentPath: 'C:/Documents',
        kind: 'text',
        sizeBytes: pageContent.length,
        content: pageContent,
        metadata: { textContent: pageContent },
      },
    });
    soundManager.play('im_send');
    setSaveNotice(`Saved ${fileName} to C:/Documents`);
    setTimeout(() => setSaveNotice(null), 2500);
  };

  const defaultParsedUrl: ParsedUrl = useMemo(() => {
    try {
      const u = new URL(currentUrl.startsWith('http') ? currentUrl : `http://${currentUrl}`);
      return {
        rawUrl: currentUrl,
        normalizedUrl: currentUrl,
        protocol: (u.protocol === 'https:' ? 'https:' : 'http:') as 'http:' | 'https:',
        host: u.hostname.toLowerCase() || 'findit.local',
        pathname: u.pathname || '/',
        pathSegments: u.pathname.split('/').filter(Boolean),
        searchParams: Object.fromEntries(u.searchParams.entries()),
        hash: u.hash || '',
      };
    } catch {
      return {
        rawUrl: currentUrl,
        normalizedUrl: currentUrl,
        protocol: 'http:' as const,
        host: 'findit.local',
        pathname: '/',
        pathSegments: [],
        searchParams: {},
        hash: '',
      };
    }
  }, [currentUrl]);

  const ActivePageComponent = matchResult?.component;

  const pageContent = generatedSite ? (
    <GeneratedSite
      url={defaultParsedUrl} navigate={(url: string) => loadPage(url, true)}
      params={{}} searchParams={{}} content={generatedSite}
      meta={generatedSiteMeta || undefined}
    />
  ) : ActivePageComponent && matchResult ? (
    <ActivePageComponent
      url={matchResult.parsedUrl || defaultParsedUrl}
      navigate={(url: string) => loadPage(url, true)}
      params={matchResult.routeParams || {}}
      searchParams={matchResult.parsedUrl?.searchParams || {}}
      onNavigate={(url: string) => loadPage(url, true)}
      queryParams={matchResult.parsedUrl?.searchParams || {}}
      routeParams={matchResult.routeParams || {}}
    />
  ) : (
    <div className="p-6 text-center text-gray-500 italic">Initializing browser engine...</div>
  );

  return <VoyagerBrowserChrome
    currentUrl={currentUrl} inputUrl={inputUrl} onInputUrlChange={setInputUrl}
    historyIndex={historyIndex} historyLength={history.length}
    isFileMenuOpen={isFileMenuOpen} setIsFileMenuOpen={setIsFileMenuOpen}
    saveNotice={saveNotice} isLoading={isLoading} loadProgress={loadProgress}
    statusText={statusText} isSearchMateInstalled={isSearchMateInstalled}
    connectionType={connectionType} content={pageContent}
    onNavigate={loadPage} onNavigateSubmit={handleNavigateSubmit}
    onBack={handleBack} onForward={handleForward}
    onRefresh={handleRefresh} onHome={handleHome} onSavePage={handleSavePage}
  />;
};
