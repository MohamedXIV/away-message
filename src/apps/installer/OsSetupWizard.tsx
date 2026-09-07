// src/apps/installer/OsSetupWizard.tsx
// Authentic retro OS installation experience: blue screen / graphical setup, animated progress,
// procedural CD/drive sounds, BIOS reboot, splash screen, and generation startup chime.

import React, { useState, useEffect, useRef } from 'react';
import type { OsVersion } from '../../engine/types';
import { useSimulationStore } from '../../store/useSimulationStore';
import { synthAudio } from '../../audio/SynthAudio';
import { soundManager } from '../../audio/SoundManager';
import { checkOsInstallEligibility, type OsInstallPhase } from '../../engine/os/OsInstallerEngine';
import { getReleaseById } from '../../engine/OsCatalog';

export interface OsSetupWizardProps {
  targetOs: OsVersion;
  onClose: () => void;
}

export const OsSetupWizard: React.FC<OsSetupWizardProps> = ({ targetOs, onClose }) => {
  const hardware = useSimulationStore((s) => s.state.hardware);
  const upgradeOs = useSimulationStore((s) => s.upgradeOs);
  const advanceTime = useSimulationStore((s) => s.advanceTime);
  const release = getReleaseById(targetOs);

  const [phase, setPhase] = useState<OsInstallPhase>('checking');
  const [mode, setMode] = useState<'upgrade' | 'clean'>('upgrade');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Verifying hardware compatibility...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sound loop timer for disk/CD activity during copy phase
  const soundIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 1: Initial Hardware Check
  useEffect(() => {
    const timer = setTimeout(() => {
      const check = checkOsInstallEligibility(targetOs, hardware);
      if (!check.ok) {
        setPhase('error');
        setErrorMessage(check.reason ?? 'Hardware does not meet minimum system requirements.');
        soundManager.play('error');
      } else {
        setPhase('mode_select');
        soundManager.play('click');
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [targetOs, hardware]);

  // Handle Starting File Copy
  const handleStartInstallation = () => {
    setPhase('copying');
    setProgress(0);
    setStatusText('Preparing hard disk for file transfer...');
    synthAudio.playCdRomSpin(1500);

    // Audio loop during installation
    soundIntervalRef.current = setInterval(() => {
      if (Math.random() > 0.4) {
        synthAudio.playDriveSeek(400);
      } else {
        synthAudio.playCdRomSpin(800);
      }
    }, 1200);

    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 8) + 3;
      if (currentProgress < 35) {
        setStatusText('Copying system libraries and kernel drivers...');
      } else if (currentProgress < 70) {
        setStatusText('Installing desktop visual styles, fonts, and sound schemes...');
      } else if (currentProgress < 95) {
        setStatusText('Updating system registry and configuring file associations...');
      } else if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(progressInterval);
        if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
        setStatusText('Installation complete. System will now restart...');

        // Advance simulation time by 25 minutes for realism
        advanceTime(25, 'Operating system installation');

        // Transition to reboot phase
        setTimeout(() => {
          setPhase('rebooting');
          triggerRebootSequence();
        }, 1500);
      }
      setProgress(Math.min(100, currentProgress));
    }, 450);
  };

  // Step 3: Simulated Reboot Sequence (BIOS -> Splash -> Desktop)
  const triggerRebootSequence = () => {
    // Phase A: Black screen with BIOS memory count
    setTimeout(() => {
      synthAudio.playBiosBeep();
    }, 1000);

    // Phase B: Splash screen
    setTimeout(() => {
      setPhase('finished');
      synthAudio.playStartupChime(targetOs);
      upgradeOs(targetOs, 0);
    }, 3500);

    // Phase C: Welcome back to desktop
    setTimeout(() => {
      onClose();
    }, 7000);
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#0000aa] text-white font-mono select-none flex flex-col p-6 overflow-hidden">
      {/* Top Banner */}
      <div className="bg-[#aaaaaa] text-[#0000aa] font-bold px-4 py-1.5 flex justify-between items-center shadow-md">
        <span>{release?.displayName ?? 'Orion OS'} Setup Wizard</span>
        <span className="text-xs">Version {release?.version ?? '5.0'}</span>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 max-w-3xl mx-auto w-full">
        {phase === 'checking' && (
          <div className="text-center space-y-4">
            <div className="text-xl font-bold">Checking System Configuration</div>
            <p className="text-sm text-gray-200">
              Setup is inspecting your hardware components, memory, and disk space...
            </p>
            <div className="inline-block animate-pulse text-amber-300 font-bold">
              Please wait...
            </div>
          </div>
        )}

        {phase === 'mode_select' && (
          <div className="bg-[#000088] border-2 border-white p-6 w-full space-y-6 shadow-2xl">
            <div className="text-lg font-bold border-b border-white/40 pb-2">
              Select Installation Type
            </div>
            <p className="text-sm text-gray-200">
              Welcome to the {release?.displayName} Setup program. Choose how you want to install this operating system:
            </p>

            <div className="space-y-3">
              <label
                className={`flex items-start gap-3 p-3 border cursor-pointer ${
                  mode === 'upgrade'
                    ? 'bg-white text-black border-yellow-400 font-bold'
                    : 'border-white/50 text-white hover:bg-white/10'
                }`}
                onClick={() => setMode('upgrade')}
              >
                <input
                  type="radio"
                  name="install_mode"
                  checked={mode === 'upgrade'}
                  onChange={() => setMode('upgrade')}
                  className="mt-1"
                />
                <div>
                  <div>Upgrade Current Installation (Recommended)</div>
                  <div className="text-xs font-normal opacity-80">
                    Preserves your existing files, documents in My Documents, and installed programs while upgrading system libraries and visual chrome.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 border cursor-pointer ${
                  mode === 'clean'
                    ? 'bg-white text-black border-yellow-400 font-bold'
                    : 'border-white/50 text-white hover:bg-white/10'
                }`}
                onClick={() => setMode('clean')}
              >
                <input
                  type="radio"
                  name="install_mode"
                  checked={mode === 'clean'}
                  onChange={() => setMode('clean')}
                  className="mt-1"
                />
                <div>
                  <div>Clean Installation (Format Hard Drive)</div>
                  <div className="text-xs font-normal opacity-80">
                    Formats the primary hard disk partition for a fresh start with factory system defaults.
                  </div>
                </div>
              </label>
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
                Next &gt;
              </button>
            </div>
          </div>
        )}

        {phase === 'copying' && (
          <div className="w-full space-y-6">
            <div className="text-lg font-bold text-center">Installing {release?.displayName}</div>
            <div className="bg-[#000088] border-2 border-white p-6 space-y-4">
              <div className="text-sm font-semibold">{statusText}</div>

              {/* Progress Bar Container */}
              <div className="w-full bg-[#111155] border-2 border-t-[#000022] border-l-[#000022] border-b-white border-r-white p-1 h-8 flex items-center">
                <div
                  className="bg-yellow-400 h-full transition-all duration-300 flex items-center justify-center text-xs font-bold text-black"
                  style={{ width: `${progress}%` }}
                >
                  {progress > 8 && `${progress}%`}
                </div>
              </div>

              <div className="flex justify-between text-xs text-gray-300">
                <span>Drive D: (Optical CD-ROM)</span>
                <span>Copying to C: (Hard Disk)</span>
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
            <div className="text-xs text-gray-400">Primary Slave: ATAPI 24X CD-ROM Drive</div>
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

      {/* Bottom Status Help Strip */}
      <div className="bg-[#aaaaaa] text-black px-4 py-1 text-xs flex justify-between items-center shadow-inner">
        <span>F3 = Exit Setup</span>
        <span>Orion OS Setup v1.0</span>
      </div>
    </div>
  );
};
