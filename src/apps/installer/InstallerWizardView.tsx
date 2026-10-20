import React from 'react';
import type { InstallerPreview } from '../../engine/SoftwareRegistry';

export interface InstallerWizardViewProps {
  fileName: string;
  stage: 1 | 2 | 3 | 4 | 5 | 6;
  session: InstallerPreview | null;
  error: string | null;
  progress: number;
  createDesktopShortcut: boolean;
  setCreateDesktopShortcut: (checked: boolean) => void;
  acceptedOffers: Record<string, boolean>;
  setAcceptedOffers: (offers: Record<string, boolean>) => void;
  handleNext: () => void;
  handleBack: () => void;
  handleCancel: () => void;
  handleFinish: () => void;
}
/** The game's unchanged authored six-screen Orion installer presentation. */
export const InstallerWizardView: React.FC<InstallerWizardViewProps> = ({
  fileName, stage, session, error, progress, createDesktopShortcut,
  setCreateDesktopShortcut, acceptedOffers, setAcceptedOffers,
  handleNext, handleBack, handleCancel, handleFinish,
}) => {
  if (error && !session) {
    return (
      <div className="w-full h-full flex flex-col bg-[#c0c0c0] p-4 font-sans text-xs">
        <div className="bg-white border border-red-600 p-4 text-red-800">
          <div className="font-bold">Installation Error</div>
          <div className="mt-1">{error}</div>
          <div className="mt-2 text-[11px] text-gray-600">File: {fileName || 'unknown'}</div>
        </div>
        <div className="mt-auto flex justify-end">
          <button onClick={handleCancel} className="orion-button px-4 py-1">Close</button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#c0c0c0] font-sans text-xs">
        <div className="text-gray-600">Preparing installer…</div>
      </div>
    );
  }

  const def = session.softwareDef;
  const compat = session.compatibilityResult;

  return (
    <div className="w-full h-full flex flex-col bg-[#c0c0c0] font-sans text-xs select-none">
      {/* Header */}
      <div className="bg-[#000080] text-white px-3 py-2 flex items-center gap-2">
        <span className="text-lg">📦</span>
        <div>
          <div className="font-bold text-sm">Setup — {def.name} {def.version}</div>
          <div className="text-[10px] text-blue-200">{def.publisher} • {def.installedBytes / (1024*1024)} MB</div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left banner */}
        <div className="w-36 bg-[#000080] text-white p-3 flex flex-col justify-between hidden md:flex">
          <div className="space-y-2">
            <div className="font-bold text-sm leading-tight">Orion<br />Installer</div>
            <div className="text-[11px] text-blue-200">Step {stage} of 6</div>
          </div>
          <div className="text-[10px] text-blue-300">C:/Downloads<br />{fileName}</div>
        </div>

        {/* Main */}
        <div className="flex-1 bg-white p-4 overflow-y-auto">
          {stage === 1 && (
            <div className="space-y-3">
              <h2 className="font-bold text-sm">Welcome to {def.name} Setup</h2>
              <p className="text-gray-700">This wizard will install <b>{def.name} {def.version}</b> by {def.publisher} on your Orion OS computer.</p>
              <p className="text-gray-600">It is recommended that you close all other applications before continuing.</p>
              <div className="bg-yellow-50 border border-yellow-300 p-2 text-[11px] text-yellow-900">
                Install size: {(def.installedBytes / (1024*1024)).toFixed(1)} MB • Destination: <span className="font-mono">C:/Program Files/{def.name.split(' ')[0]}</span>
              </div>
            </div>
          )}

          {stage === 2 && (
            <div className="space-y-3">
              <h2 className="font-bold text-sm">System Requirements Check</h2>
              <div className="space-y-2">
                <div className={`flex justify-between border p-2 ${compat.osCheck.passed ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                  <span>Operating System: need {compat.osCheck.required}</span>
                  <span className={compat.osCheck.passed ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>{compat.osCheck.passed ? '✓ Pass' : '✗ Fail'} ({compat.osCheck.current})</span>
                </div>
                <div className={`flex justify-between border p-2 ${compat.ramCheck.passed ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                  <span>Memory: need {compat.ramCheck.required} MB</span>
                  <span className={compat.ramCheck.passed ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>{compat.ramCheck.passed ? '✓ Pass' : '✗ Fail'} ({compat.ramCheck.current} MB)</span>
                </div>
                <div className={`flex justify-between border p-2 ${compat.diskCheck.passed ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                  <span>Disk: need {(compat.diskCheck.required / (1024*1024)).toFixed(1)} MB free</span>
                  <span className={compat.diskCheck.passed ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>{compat.diskCheck.passed ? '✓ Pass' : '✗ Fail'} ({(compat.diskCheck.available / (1024*1024)).toFixed(1)} MB free)</span>
                </div>
              </div>
              {!compat.isCompatible && <div className="bg-red-50 border border-red-300 p-2 text-red-800 font-bold">Requirements not met — you can still go back, but Next is blocked until you upgrade hardware/OS or free disk space.</div>}
            </div>
          )}

          {stage === 3 && (
            <div className="space-y-3">
              <h2 className="font-bold text-sm">Choose Install Location</h2>
              <p className="text-gray-600">Setup will install {def.name} in the following folder.</p>
              <div className="border border-gray-400 bg-gray-50 p-2 font-mono text-xs">C:/Program Files/{def.name.split(' ')[0]}</div>
              <p className="text-[11px] text-gray-500">To install to a different folder, type a new path. At least {(def.requirements.requiredDiskBytes / (1024*1024)).toFixed(1)} MB of free disk space is required.</p>
            </div>
          )}

          {stage === 4 && (
            <div className="space-y-3">
              <h2 className="font-bold text-sm">Select Additional Tasks</h2>
              <label className="flex items-center gap-2 border border-gray-300 p-2 bg-white hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={createDesktopShortcut} onChange={(e) => setCreateDesktopShortcut(e.target.checked)} />
                <span>Create a desktop shortcut</span>
              </label>
              {def.bundledOffers?.map((offer) => (
                <label key={offer.id} className="flex items-center gap-2 border border-gray-300 p-2 bg-white hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={!!acceptedOffers[offer.id]} onChange={(e) => setAcceptedOffers({ ...acceptedOffers, [offer.id]: e.target.checked })} />
                  <span className={offer.defaultChecked ? 'font-semibold' : ''}>{offer.name} — <span className="text-gray-600">{offer.description}</span></span>
                </label>
              ))}
              {(!def.bundledOffers || def.bundledOffers.length === 0) && <div className="text-gray-500 italic">No additional offers for this package.</div>}
            </div>
          )}

          {stage === 5 && (
            <div className="space-y-3">
              <h2 className="font-bold text-sm">Installing…</h2>
              <p className="text-gray-600">Please wait while Setup installs {def.name} on your computer.</p>
              <div className="w-full h-4 bg-gray-200 border border-gray-400 relative overflow-hidden">
                <div className="h-full bg-[#000080] transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
              <div className="font-mono text-[11px] text-gray-700">{progress}% — {progress < 30 ? 'Copying files…' : progress < 60 ? 'Creating shortcuts…' : progress < 90 ? 'Writing registry…' : 'Finalizing…'}</div>
            </div>
          )}

          {stage === 6 && (
            <div className="space-y-3">
              <h2 className="font-bold text-sm">{error ? 'Installation Failed' : 'Completing Setup'}</h2>
              {error ? (
                <div className="bg-red-50 border border-red-300 p-2 text-red-800">{error}</div>
              ) : (
                <>
                  <p className="text-gray-700"><b>{def.name}</b> has been successfully installed.</p>
                  <p className="text-gray-600">A shortcut was created on your desktop. You can launch it from there or from My Computer → Program Files.</p>
                  <div className="bg-green-50 border border-green-300 p-2 text-green-800 text-[11px]">Installed to C:/Program Files/{def.name.split(' ')[0]} • {(def.installedBytes / (1024*1024)).toFixed(1)} MB</div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-2 bg-[#dfdfdf] border-t border-gray-400">
        <div className="text-[11px] text-gray-600">File: {fileName}</div>
        <div className="flex gap-2">
          <button onClick={handleCancel} className="orion-button px-4 py-1">Cancel</button>
          {stage > 1 && stage < 5 && <button onClick={handleBack} className="orion-button px-4 py-1">‹ Back</button>}
          {stage < 5 && <button onClick={handleNext} disabled={stage === 2 && !compat.isCompatible} className="orion-button px-4 py-1 font-bold bg-[#000080] text-white disabled:opacity-50">Next ›</button>}
          {stage === 5 && <button disabled className="orion-button px-4 py-1 opacity-50">Installing…</button>}
          {stage === 6 && <button onClick={handleFinish} className="orion-button px-4 py-1 font-bold bg-[#000080] text-white">Finish</button>}
        </div>
      </div>
    </div>
  );
};
