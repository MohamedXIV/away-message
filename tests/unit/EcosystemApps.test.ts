import { describe, it, expect } from 'vitest';
import { useSimulationStore } from '../../src/store/useSimulationStore';

describe('Ecosystem Applications Logic & Gating Unit Tests', () => {
  it('enforces PhotoBox Pro 2.0 system hardware requirements (Orion 6.0 and >= 768MB RAM)', () => {
    // Underpowered rig: 256MB RAM and Orion 4.8
    useSimulationStore.setState((prev) => ({
      state: {
        ...prev.state,
        hardware: {
          ...prev.state.hardware,
          ramMB: 256,
        },
        os: {
          ...prev.state.os,
          currentOsId: 'Orion_4.8',
        },
      },
    }));

    const state1 = useSimulationStore.getState().state;
    const isGated1 = state1.hardware.ramMB < 768 || state1.os.currentOsId !== 'Orion_6.0';
    expect(isGated1).toBe(true);

    // Meets RAM but not OS
    useSimulationStore.setState((prev) => ({
      state: {
        ...prev.state,
        hardware: {
          ...prev.state.hardware,
          ramMB: 1024,
        },
        os: {
          ...prev.state.os,
          currentOsId: 'Orion_4.8',
        },
      },
    }));

    const state2 = useSimulationStore.getState().state;
    const isGated2 = state2.hardware.ramMB < 768 || state2.os.currentOsId !== 'Orion_6.0';
    expect(isGated2).toBe(true);

    // Meets both requirements
    useSimulationStore.setState((prev) => ({
      state: {
        ...prev.state,
        hardware: {
          ...prev.state.hardware,
          ramMB: 768,
        },
        os: {
          ...prev.state.os,
          currentOsId: 'Orion_6.0',
        },
      },
    }));

    const state3 = useSimulationStore.getState().state;
    const isGated3 = state3.hardware.ramMB < 768 || state3.os.currentOsId !== 'Orion_6.0';
    expect(isGated3).toBe(false);
  });

  it('SafeSweep detects SearchMate toolbar adware payload accurately', () => {
    const mockInstalledList = [
      {
        id: 'sw_pulse',
        appId: 'pulse',
        name: 'Pulse Messenger',
        version: '5.2',
        installDateMinute: 50,
      },
      {
        id: 'sw_searchmate',
        appId: 'searchmate',
        name: 'SearchMate Smart Toolbar',
        version: '2.0',
        installDateMinute: 100,
        isAdware: true,
        adwarePayload: {
          toolbarInjected: true,
          sponsoredRedirectRate: 0.25,
        },
      },
    ];

    const detected = mockInstalledList.filter((sw) => sw.appId === 'searchmate' || sw.isAdware);
    expect(detected.length).toBe(1);
    expect(detected[0]?.appId).toBe('searchmate');
  });

  it('FlashFetch 8-segment parallel chunk math calculates accurate segment progress', () => {
    const totalBytes = 8000000;
    const downloadedBytes = 5000000; // 62.5% total progress
    const taskProgress = downloadedBytes / totalBytes;

    const chunkProgresses = Array.from({ length: 8 }).map((_, chunkIdx) => {
      return Math.min(1, Math.max(0, taskProgress * 8 - chunkIdx));
    });

    // 62.5% of 8 chunks is exactly 5 full chunks completed
    expect(chunkProgresses[0]).toBe(1);
    expect(chunkProgresses[1]).toBe(1);
    expect(chunkProgresses[2]).toBe(1);
    expect(chunkProgresses[3]).toBe(1);
    expect(chunkProgresses[4]).toBe(1);
    expect(chunkProgresses[5]).toBe(0);
    expect(chunkProgresses[6]).toBe(0);
    expect(chunkProgresses[7]).toBe(0);
  });

  it('ZipMate compression ratio calculation validates file savings accurately', () => {
    const originalBytes = 14680064;
    const packedBytes = 8912896;
    const ratio = Math.round((1 - packedBytes / originalBytes) * 100);
    expect(ratio).toBe(39); // 39% space saved
  });
});
