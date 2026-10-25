import React, { useState, useEffect } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useWindowStore } from '../../store/useWindowStore';
import type { WindowState } from '../../store/useWindowStore';
import { soundManager } from '../../audio/SoundManager';
import type { InstallerPreview } from '../../engine/SoftwareRegistry';
import { INSTALLER_SOFTWARE_IDS } from '../../engine/InstallerFileCatalog';
import { InstallerWizardView } from './InstallerWizardView';

interface InstallerWizardProps {
  window: WindowState;
}

export const InstallerWizard: React.FC<InstallerWizardProps> = ({ window }) => {
  const engine = useSimulationStore((s) => s.engine);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const openWindow = useWindowStore((s) => s.openWindow);

  const filePath: string | undefined = window.customState?.filePath || window.customState?.initialPath;
  const fileName = filePath ? filePath.split('/').pop() || '' : '';

  const softwareId = INSTALLER_SOFTWARE_IDS[fileName] || fileName.replace('.exe', '');
  const [stage, setStage] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [session, setSession] = useState<InstallerPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [createDesktopShortcut, setCreateDesktopShortcut] = useState(true);
  const [acceptedOffers, setAcceptedOffers] = useState<Record<string, boolean>>({});

  // Preview only: mounting/closing a window never creates a hidden
  // SoftwareRegistry session or writes to the simulation owner.
  useEffect(() => {
    try {
      const s = engine.software.previewInstaller(softwareId);
      setSession(s);
      setStage(1);
      const offers: Record<string, boolean> = {};
      if (s.softwareDef.bundledOffers) {
        for (const o of s.softwareDef.bundledOffers) offers[o.id] = o.defaultChecked;
      }
      setAcceptedOffers(offers);
      setCreateDesktopShortcut(s.selectedOptions.createDesktopShortcut ?? true);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [engine, softwareId]);

  const handleNext = () => {
    if (!session) return;
    soundManager.play('click');
    const next = Math.min(6, stage + 1) as 1 | 2 | 3 | 4 | 5 | 6;
    // Compatibility check must pass before advancing past stage 2
    if (stage === 2 && !session.compatibilityResult.isCompatible) {
      setError('System requirements not met. Cannot continue.');
      return;
    }
    try {
      // Wizard pages and checkboxes are local UI state. Only the final
      // SOFTWARE_INSTALL action commits the selected options to the owner.
      setStage(next);
      setError(null);
      if (next === 5) {
        // Simulate progress
        let p = 0;
        const iv = setInterval(() => {
          p += 12 + Math.random() * 18;
          if (p >= 100) {
            p = 100;
            clearInterval(iv);
            // Complete installation
            setTimeout(() => {
              try {
                const res = engine.dispatchAction({
                  type: 'SOFTWARE_INSTALL',
                  softwareId,
                  selectedOptions: { ...acceptedOffers, createDesktopShortcut },
                });
                if (res.success) {
                  setProgress(100);
                  setStage(6);
                  soundManager.play('im_send');
                } else {
                  setError(res.error || 'Installation failed.');
                  setStage(6);
                }
              } catch (e) {
                setError((e as Error).message);
                setStage(6);
              }
            }, 400);
          }
          setProgress(Math.min(100, Math.round(p)));
        }, 220);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleBack = () => {
    if (stage > 1) {
      soundManager.play('click');
      setStage((prev) => Math.max(1, prev - 1) as any);
      setError(null);
    }
  };

  const handleCancel = () => {
    soundManager.play('click');
    closeWindow(window.id);
  };

  const handleFinish = () => {
    soundManager.play('click');
    // Optionally launch the app
    const appId = session?.softwareDef?.appId;
    if (appId) {
      // Small delay to let window close animation feel natural
      setTimeout(() => openWindow(appId), 200);
    }
    closeWindow(window.id);
  };

  return <InstallerWizardView
    fileName={fileName} stage={stage} session={session} error={error}
    progress={progress} createDesktopShortcut={createDesktopShortcut}
    setCreateDesktopShortcut={setCreateDesktopShortcut}
    acceptedOffers={acceptedOffers} setAcceptedOffers={setAcceptedOffers}
    handleNext={handleNext} handleBack={handleBack}
    handleCancel={handleCancel} handleFinish={handleFinish}
  />;
};
