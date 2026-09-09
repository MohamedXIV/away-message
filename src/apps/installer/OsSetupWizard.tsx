// src/apps/installer/OsSetupWizard.tsx
// Authentic retro OS installation experience driven by the authoritative physical-media transaction.

import React, { useEffect, useRef, useState } from 'react';
import type { OsVersion } from '../../engine/types';
import type { OsInstallPlan } from '../../engine/SimulationEngine';
import { useSimulationStore } from '../../store/useSimulationStore';
import { synthAudio } from '../../audio/SynthAudio';
import { soundManager } from '../../audio/SoundManager';
import type { OsInstallPhase } from '../../engine/os/OsInstallerEngine';
import { getReleaseById } from '../../engine/OsCatalog';
import { getOsPresentationProfile } from '../../desktop/host/OsPresentation';

export interface OsSetupWizardProps {
  targetOs: OsVersion;
  onClose: () => void;
}

function installModeLabel(plan: OsInstallPlan): string {
  switch (plan.mode) {
    case 'fresh':
      return 'Fresh Installation';
    case 'upgrade':
      return 'Upgrade Existing Installation';
    case 'patch':
      return 'System Update';
  }
}

function installModeDescription(plan: OsInstallPlan): string {
  switch (plan.mode) {
    case 'fresh':
      return 'Installs Orion onto the empty system drive. No previous operating system is required.';
    case 'upgrade':
      return 'Upgrades the compatible installed Orion release while preserving the existing installation.';
    case 'patch':
      return 'Applies this update to the compatible installed Orion release.';
  }
}

export const OsSetupWizard: React.FC<OsSetupWizardProps> = ({ targetOs, onClose }) => {
  const hardware = useSimulationStore((s) => s.state.hardware);
  const prepareOsInstallFromInsertedMedia = useSimulationStore(
    (s) => s.prepareOsInstallFromInsertedMedia,
  );
  const commitOsInstall = useSimulationStore((s) => s.commitOsInstall);
  const release = getReleaseById(targetOs);
  const presentation = getOsPresentationProfile(targetOs);

  const [phase, setPhase] = useState<OsInstallPhase>('checking');
  const [plan, setPlan] = useState<OsInstallPlan | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Verifying owned installer media and hardware...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const soundIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const commitStartedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const prepared = prepareOsInstallFromInsertedMedia();
      if (!prepared.success || !prepared.data) {
        setPhase('error');
        setErrorMessage(prepared.error ?? 'Setup preflight failed.');
        soundManager.play('error');
        return;
      }

      if (prepared.data.targetOs !== targetOs) {
        setPhase('error');
        setErrorMessage(
          `Inserted media targets ${prepared.data.targetOs}, not the requested ${targetOs}.`,
        );
        soundManager.play('error');
        return;
      }

      setPlan(prepared.data);
      setPhase('mode_select');
      setStatusText(`${installModeLabel(prepared.data)} is ready to begin.`);
      soundManager.play('click');
    }, 1200);

    return () => clearTimeout(timer);
  }, [prepareOsInstallFromInsertedMedia, targetOs]);

  const failInstall = (message: string) => {
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setPhase('error');
    setErrorMessage(message);
    soundManager.play('error');
  };

  const triggerRebootSequence = () => {
    setTimeout(() => {
      synthAudio.playBiosBeep();
    }, 1000);

    setTimeout(() => {
      setPhase('finished');
      synthAudio.playStartupChime(presentation.soundSchemeId);
    }, 3500);

    setTimeout(() => {
      onClose();
    }, 7000);
  };

  const handleStartInstallation = () => {
    if (!plan || commitStartedRef.current) return;

    setPhase('copying');
    setProgress(0);
    setStatusText('Preparing hard disk for file transfer...');
    synthAudio.playCdRomSpin(1500);

    soundIntervalRef.current = setInterval(() => {
      if (Math.random() > 0.4) {
        synthAudio.playDriveSeek(400);
      } else {
        synthAudio.playCdRomSpin(800);
      }
    }, 1200);

    let currentProgress = 0;
    progressIntervalRef.current = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 8) + 3;
      if (currentProgress < 35) {
        setStatusText('Copying system libraries and kernel drivers...');
      } else if (currentProgress < 70) {
        setStatusText('Installing desktop visual styles, fonts, and sound schemes...');
      } else if (currentProgress < 95) {
        setStatusText('Updating system registry and configuring file associations...');
      } else if (currentProgress >= 100) {
        currentProgress = 100;
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        if (soundIntervalRef.current) {
          clearInterval(soundIntervalRef.current);
          soundIntervalRef.current = null;
        }

        commitStartedRef.current = true;
        const committed = commitOsInstall(plan);
        if (!committed.success) {
          failInstall(committed.error ?? 'The operating system install could not be committed.');
          return;
        }

        setStatusText('Installation complete. System will now restart...');
        setTimeout(() => {
          setPhase('rebooting');
          triggerRebootSequence();
        }, 1500);
      }
      setProgress(Math.min(100, currentProgress));
    }, 450);
  };

  useEffect(() => {
    return () => {
      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#0000aa] text-white font-mono select-none flex flex-col p-6 overflow-hidden">
      <div className="bg-[#aaaaaa] text-[#0000aa] font-bold px-4 py-1.5 flex justify-between items-center shadow-md">
        <span>{release?.displayName ?? 'Orion OS'} Setup Wizard</span>
        <span className="text-xs">Version {release?.version ?? '5.0'}</span>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center p-8 max-w-3xl mx-auto w-full">
        {phase === 'checking' && (
          <div className="text-center space-y-4">
            <div className="text-xl font-bold">Checking System Configuration</div>
            <p className="text-sm text-gray-200">
              Setup is checking the inserted owned disc, installed hardware, and free disk space...
            </p>
            <div className="inline-block animate-pulse text-amber-300 font-bold">Please wait...</div>
          </div>
        )}

        {phase === 'mode_select' && plan && (
          <div className="bg-[#000088] border-2 border-white p-6 w-full space-y-6 shadow-2xl">
            <div className="text-lg font-bold border-b border-white/40 pb-2">Installation Type</div>
            <p className="text-sm text-gray-200">
              Setup detected the installation path from your current machine and inserted media.
            </p>

            <div className="p-3 border bg-white text-black border-yellow-400 font-bold">
              <div>{installModeLabel(plan)}</div>
              <div className="text-xs font-normal opacity-80">{installModeDescription(plan)}</div>
              <div className="text-xs font-normal opacity-70 mt-2">
                Estimated game time: {plan.durationMinutes} minutes
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t border-white/40">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-1.5 bg-[#aaaaaa] text-black font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartInstallation}
                className="px-6 py-1.5 bg-yellow-400 text-black font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white shadow"
              >
                Install &gt;
              </button>
            </div>
          </div>
        )}

        {phase === 'copying' && (
          <div className="w-full space-y-6">
            <div className="text-lg font-bold text-center">Installing {release?.displayName}</div>
            <div className="bg-[#000088] border-2 border-white p-6 space-y-4">
              <div className="text-sm font-semibold">{statusText}</div>
              <div className="w-full bg-[#111155] border-2 border-t-[#000022] border-l-[#000022] border-b-white border-r-white p-1 h-8 flex items-center">
                <div
                  className="bg-yellow-400 h-full transition-all duration-300 flex items-center justify-center text-xs font-bold text-black"
                  style={{ width: `${progress}%` }}
                >
                  {progress > 8 && `${progress}%`}
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-300">
                <span>Optical installer media</span>
                <span>Copying to primary hard disk</span>
              </div>
            </div>
          </div>
        )}

        {phase === 'rebooting' && (
          <div className="fixed inset-0 bg-black text-gray-300 font-mono p-8 flex flex-col justify-start space-y-2 select-none">
            <div className="text-sm">Award Modular BIOS v4.51PG, An Energy Star Ally</div>
            <div className="text-xs text-gray-400">Copyright (C) 1984-2001, Award Software, Inc.</div>
            <div className="pt-4 text-sm">Orion Motherboard Chipset Revision 2.4</div>
            <div className="text-sm">Testing Memory: {hardware.ramMB * 1024}K OK</div>
            <div className="pt-2 text-xs text-gray-400">Primary Master: IDE Hard Disk {hardware.hddTotalGB}GB</div>
            <div className="text-xs text-gray-400">Primary Slave: ATAPI Optical Drive</div>
            <div className="pt-4 text-emerald-400 text-sm font-bold animate-pulse">
              Booting from Primary Master...
            </div>
          </div>
        )}

        {phase === 'finished' && (
          <div className="fixed inset-0 bg-gradient-to-b from-[#0e1e2d] to-[#05080e] text-white flex flex-col items-center justify-center space-y-6">
            <div className="text-3xl font-bold tracking-wider">{release?.displayName}</div>
            <div className="text-sm text-gray-300">{release?.blurb ?? 'Welcome to your new desktop.'}</div>
            <div className="w-64 bg-gray-800 rounded-full h-3 overflow-hidden p-0.5 border border-gray-600">
              <div className="bg-gradient-to-r from-teal-400 to-blue-500 h-full rounded-full animate-pulse w-full" />
            </div>
            <div className="text-xs text-gray-400">Loading user preferences...</div>
          </div>
        )}

        {phase === 'error' && (
          <div className="bg-red-900 border-2 border-white p-6 w-full space-y-4 shadow-2xl">
            <div className="text-lg font-bold text-amber-300">Setup Cannot Continue</div>
            <p className="text-sm text-white">{errorMessage}</p>
            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-1.5 bg-[#aaaaaa] text-black font-bold border-2 border-t-white border-l-white border-b-black border-r-black"
              >
                Exit Setup
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#aaaaaa] text-black px-4 py-1 text-xs flex justify-between items-center shadow-inner">
        <span>F3 = Exit Setup</span>
        <span>Orion OS Setup v1.0</span>
      </div>
    </div>
  );
};
