// src/tools/studio/ContentStudioShell.tsx
// Main window and navigation shell for the visual Content Studio.

import React, { useState } from 'react';
import type { Store } from 'tinybase';
import { CONTENT_VERSION } from '../../engine/coreBuddies.generated';
import { useStudioStore } from './hooks/useStudioStore';
import type { StudioTab } from './types';
import { CharactersTab } from './tabs/CharactersTab';
import { ArchetypesTab } from './tabs/ArchetypesTab';
import { DialoguePoolsTab } from './tabs/DialoguePoolsTab';
import { AffinitySeedsTab } from './tabs/AffinitySeedsTab';
import { WorldBasicsTab } from './tabs/WorldBasicsTab';
import { TransitTab } from './tabs/TransitTab';
import { PhysicalDefinitionsTab } from './tabs/PhysicalDefinitionsTab';
import { ScenesTab } from './tabs/ScenesTab';
import { AssetsTab } from './tabs/AssetsTab';
import { ProfilesTab } from './tabs/ProfilesTab';
import { RawInspectorTab } from './tabs/RawInspectorTab';
import { ValidationErrorsModal } from './components/ValidationErrorsModal';

interface Props {
  store: Store;
}

export const ContentStudioShell: React.FC<Props> = ({ store }) => {
  const studio = useStudioStore(store);

  const [activeTab, setActiveTab] = useState<StudioTab>('characters');
  const [isMinimized, setIsMinimized] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4000);
  };

  const handleDownload = () => {
    try {
      const jsonStr = studio.exportJson();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'store.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast('Downloaded store.json — overwrite content/store.json & run npm run content:pull');
    } catch {
      showToast('Export failed in this environment.');
    }
  };

  const handleCopyJson = () => {
    try {
      const jsonStr = studio.exportJson();
      navigator.clipboard.writeText(jsonStr).then(() => {
        showToast('Copied entire store.json to clipboard!');
      });
    } catch {
      showToast('Copy failed.');
    }
  };

  const charCount = Object.keys(studio.tables['characters'] ?? {}).length;
  const archCount = Object.keys(studio.tables['archetypes'] ?? {}).length;
  const poolCount = Object.keys(studio.tables['dialoguePools'] ?? {}).length;
  const seedCount = Object.keys(studio.tables['affinitySeeds'] ?? {}).length;
  const worldCount =
    Object.keys(studio.tables['districts'] ?? {}).length +
    Object.keys(studio.tables['places'] ?? {}).length;
  const transitCount =
    Object.keys(studio.tables['transitStops'] ?? {}).length +
    Object.keys(studio.tables['busLines'] ?? {}).length;
  const physicalCount =
    Object.keys(studio.tables['items'] ?? {}).length +
    Object.keys(studio.tables['containers'] ?? {}).length;
  const sceneCount =
    Object.keys(studio.tables['spaces'] ?? {}).length +
    Object.keys(studio.tables['views'] ?? {}).length +
    Object.keys(studio.tables['anchors'] ?? {}).length +
    Object.keys(studio.tables['interactions'] ?? {}).length;
  const assetCount = Object.keys(studio.tables['assets'] ?? {}).length;
  const profileCount =
    Object.keys(studio.tables['lightProfiles'] ?? {}).length +
    Object.keys(studio.tables['audioProfiles'] ?? {}).length +
    Object.keys(studio.tables['ambientProfiles'] ?? {}).length;
  const errorCount = studio.validationErrors.length;

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 left-4 z-[300]">
        <div className="flex items-center gap-2 rounded-lg border border-purple-500 bg-[#160b28] px-3 py-2 text-xs text-purple-100 shadow-2xl backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold">Content Studio</span>
          <span className="text-[10px] text-purple-400 font-mono">v{CONTENT_VERSION}</span>

          {errorCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setIsMinimized(false);
                setShowValidationModal(true);
              }}
              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-300 border border-red-800"
            >
              {errorCount} Issues
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="ml-2 rounded bg-purple-600 hover:bg-purple-500 px-2 py-0.5 font-bold text-white shadow"
          >
            Maximize
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#0d0718] text-purple-100 font-sans select-none overflow-hidden">
      <header className="h-12 border-b border-purple-800/60 bg-[#15092a] px-4 flex items-center justify-between gap-4 shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300">
              Away Message
            </span>
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-700/60 text-purple-200">
              Studio
            </span>
          </div>
          <span className="text-[10px] font-mono text-purple-400">v{CONTENT_VERSION}</span>
        </div>

        <nav className="flex items-center gap-1 bg-[#100720] p-1 rounded-lg border border-purple-900/60 overflow-x-auto max-w-[65vw]">
          {[
            { id: 'characters', label: 'Characters', count: charCount },
            { id: 'archetypes', label: 'Archetypes', count: archCount },
            { id: 'world', label: 'World', count: worldCount },
            { id: 'transit', label: 'Transit', count: transitCount },
            { id: 'physical', label: 'Physical', count: physicalCount },
            { id: 'scenes', label: 'Scenes', count: sceneCount },
            { id: 'assets', label: 'Assets', count: assetCount },
            { id: 'profiles', label: 'Profiles', count: profileCount },
            { id: 'dialoguePools', label: 'Dialogue Pools', count: poolCount },
            { id: 'affinitySeeds', label: 'Affinity Seeds', count: seedCount },
            { id: 'raw', label: 'Raw DB' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as StudioTab)}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-purple-700 text-white shadow'
                    : 'text-gray-400 hover:text-purple-200 hover:bg-purple-950/40'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-purple-900/80 text-purple-200' : 'bg-purple-950 text-gray-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {errorCount === 0 ? (
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
              <span>&check;</span>
              <span>Valid</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowValidationModal(true)}
              className="flex items-center gap-1 text-[11px] font-bold text-red-300 bg-red-950/60 border border-red-700/80 px-2.5 py-0.5 rounded animate-pulse hover:bg-red-900/60 transition-colors"
            >
              <span>!</span>
              <span>{errorCount} Issues</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyJson}
            className="rounded border border-purple-700/60 bg-purple-950/60 hover:bg-purple-900/60 px-2.5 py-1 text-xs font-semibold text-purple-200 shadow transition-colors"
          >
            Copy JSON
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="rounded bg-purple-700 hover:bg-purple-600 px-3 py-1 text-xs font-bold text-white shadow transition-colors"
          >
            Export store.json
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-purple-950/50"
            title="Minimize Studio"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </header>

      {toastMessage && (
        <div className="bg-purple-900/90 border-b border-purple-700 px-4 py-1.5 text-xs text-center text-purple-100 font-medium flex items-center justify-center gap-2">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-purple-300 hover:text-white font-bold ml-2"
          >
            &times;
          </button>
        </div>
      )}

      <main className="flex-1 overflow-hidden">
        {activeTab === 'characters' && <CharactersTab studio={studio} />}
        {activeTab === 'archetypes' && <ArchetypesTab studio={studio} />}
        {activeTab === 'dialoguePools' && <DialoguePoolsTab studio={studio} />}
        {activeTab === 'affinitySeeds' && <AffinitySeedsTab studio={studio} />}
        {activeTab === 'world' && <WorldBasicsTab studio={studio} />}
        {activeTab === 'transit' && <TransitTab studio={studio} />}
        {activeTab === 'physical' && <PhysicalDefinitionsTab studio={studio} />}
        {activeTab === 'scenes' && <ScenesTab studio={studio} />}
        {activeTab === 'assets' && <AssetsTab studio={studio} />}
        {activeTab === 'profiles' && <ProfilesTab studio={studio} />}
        {activeTab === 'raw' && <RawInspectorTab studio={studio} />}
      </main>


      <ValidationErrorsModal
        isOpen={showValidationModal}
        errors={studio.validationErrors}
        onClose={() => setShowValidationModal(false)}
      />
    </div>
  );
};
