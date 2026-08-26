import React, { useState } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { InstalledSoftwareRecord } from '../../engine/types';

export const AddRemoveApp: React.FC = () => {
  const installedSoftware = useSimulationStore((s) => s.state.installedSoftware);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isUninstalling, setIsUninstalling] = useState<boolean>(false);

  const nonPortableSoftware = installedSoftware.filter((sw) => !sw.isPortable);

  const handleUninstall = (program: InstalledSoftwareRecord) => {
    if (window.confirm(`Are you sure you want to completely remove ${program.name} from your computer?`)) {
      setIsUninstalling(true);
      setTimeout(() => {
        dispatchAction({ type: 'SOFTWARE_UNINSTALL', installedId: program.id });
        setSelectedId(null);
        setIsUninstalling(false);
      }, 400);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#c0c0c0] text-black font-sans text-xs select-none">
      {/* Top Banner */}
      <div className="p-3 bg-[#dfdfdf] border-b border-gray-500 flex items-center gap-3">
        <span className="text-3xl">💻</span>
        <div>
          <h2 className="font-bold text-sm">Add/Remove Programs</h2>
          <p className="text-gray-600 text-[11px]">
            To uninstall a program or change its installed components, select it from the list and click Remove.
          </p>
        </div>
      </div>

      {/* Program List */}
      <div className="flex-1 p-3 overflow-y-auto">
        <div className="bg-white border border-gray-400 rounded h-full overflow-y-auto p-1 space-y-1">
          {nonPortableSoftware.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              No installed programs found.
            </div>
          ) : (
            nonPortableSoftware.map((sw) => {
              const isSelected = selectedId === sw.id;
              const sizeMB = (sw.installedBytes / (1024 * 1024)).toFixed(1);

              return (
                <div
                  key={sw.id}
                  onClick={() => setSelectedId(sw.id)}
                  className={`p-2 rounded border cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50 border-blue-500'
                      : 'border-transparent hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📦</span>
                      <div>
                        <div className="font-bold text-gray-800">{sw.name}</div>
                        <div className="text-[11px] text-gray-500">Version {sw.version}</div>
                      </div>
                    </div>
                    <div className="text-right font-mono text-gray-700">
                      <div>{sizeMB} MB</div>
                    </div>
                  </div>

                  {/* Expanded Action Panel */}
                  {isSelected && (
                    <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between bg-white p-2 rounded">
                      <div className="text-[11px] text-gray-600">
                        {sw.isAdware ? (
                          <span className="text-amber-600 font-semibold">⚠️ Bundled components detected (SearchMate toolbar)</span>
                        ) : (
                          <span>Installed at {sw.installPath}</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUninstall(sw)}
                          disabled={isUninstalling}
                          className="orion-button text-red-700 bg-red-50 hover:bg-red-100 font-semibold"
                        >
                          {isUninstalling ? 'Uninstalling...' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-3 py-1.5 bg-[#dfdfdf] border-t border-gray-400 text-[11px] text-gray-600 flex justify-between">
        <span>{nonPortableSoftware.length} program(s) installed</span>
        <span>
          Total Space Occupied:{' '}
          {(nonPortableSoftware.reduce((a, s) => a + s.installedBytes, 0) / (1024 * 1024)).toFixed(1)} MB
        </span>
      </div>
    </div>
  );
};
