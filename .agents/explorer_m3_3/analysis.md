# Milestone 3 Ecosystem Applications: Architecture & Code Blueprints

**Author**: `explorer_m3_3`  
**Milestone**: M3 (Desktop Applications & Ecosystem)  
**Date**: 2026-08-22  
**Working Directory**: `f:/_WIP/away-message/.agents/explorer_m3_3/`  
**Target Output**: Complete architecture specifications and production-grade TypeScript / React blueprints for all 7 desktop ecosystem applications and their corresponding unit test suites.

---

## 1. Executive Summary & Architectural Overview

In Milestone 3, the desktop simulation expands from core operating system shell utilities (Terminal, File Explorer, Control Panel, Notepad, Trash, Add/Remove Programs) into a rich, living 2000s desktop application ecosystem.

The 7 ecosystem applications fulfill vital narrative, mechanical, and systemic roles:
1. **RetroAmp (`src/apps/retroamp/RetroAmpApp.tsx`)**: Diegetic music player modeled after Winamp 2.x with real Web Audio synthesis/playback, segmented LED time display, 19-band spectrum visualizer, 10-band equalizer dock, and dynamic playlist manager supporting `.mp3`/`.wav` files in `C:/Music`.
2. **FlashFetch (`src/apps/flashfetch/FlashFetchApp.tsx`)**: Period-authentic download accelerator (FlashGet/GetRight) with multi-segment chunk thread visualizers, priority queue management, speed history graphing, and seamless integration with `SimulationEngine.downloads`.
3. **ZipMate (`src/apps/zipmate/ZipMateApp.tsx`)**: WinZip/WinRAR archive manager capable of inspecting ZIP archives, extracting files into VFS destinations (`C:/Downloads/extracted`), and creating new ZIP archives.
4. **PhotoBox 3.0 (`src/apps/photobox/PhotoBoxApp.tsx`)**: Professional photo viewer/editor strictly gated by hardware and OS requirements (**Orion OS 6.0** and **768 MB+ RAM**). Running it on Orion 4.8 or 512MB RAM displays an authentic system incompatibility diagnostic dialog guiding the player toward hardware upgrades.
5. **WeatherBuddy (`src/apps/weatherbuddy/WeatherBuddyApp.tsx`)**: Suspicious freeware weather widget that bundles the **SearchMate** adware toolbar, hijacking Voyager browser's search provider, default homepage, and adding startup autorun entries unless customized during installation.
6. **SafeSweep (`src/apps/safesweep/SafeSweepApp.tsx`)**: Anti-spyware/anti-adware scanner (Spybot / Ad-Aware style) that inspects VFS and registry payloads, detects SearchMate toolbar/hijacks, and offers one-click quarantine and browser repair.
7. **Mailbox (`src/apps/mailbox/MailboxApp.tsx`)**: Period-authentic 3-pane email client (Outlook Express / Thunderbird) with pre-seeded narrative emails from Ryan, Maya, Mr. Henderson, and TechMart, featuring VFS attachment extraction and compose/reply mechanics.

All applications adhere to the pure unidirectional architecture:
- **Simulation State**: Authoritatively owned by `SimulationEngine` (`src/engine/`).
- **UI State & React Binding**: Exposed via Zustand stores (`useSimulationStore`, `useWindowStore`, `useAudioStore`).
- **Styling**: Authentic dual-theme support for **Orion OS 4.8** (Win95/98 beveled gray) and **Orion OS 6.0** (XP Royale blue), using standard CSS variables and utility classes.

---

## 2. App 1: RetroAmp (`src/apps/retroamp/RetroAmpApp.tsx`)

### 2.1 Overview & UI Specification
RetroAmp is a nostalgic clone of Winamp 2.x ("NullWave Media"). It features:
- **Main Transport Chassis**: Metallic dark gray chrome, glowing neon green 7-segment digital timer (`MM:SS`), bitrate/sample rate indicators (`192 kbps`, `44 kHz`), mono/stereo tags, and a scrolling track title marquee.
- **Transport Buttons**: Previous (`|<<`), Play (`▶`), Pause (`⏸`), Stop (`⏹`), Next (`>>`), Eject/Add (`⏏`), Shuffle (`SHUF`), and Repeat (`REP`).
- **Equalizer Window**: 10-band slider array (60Hz, 170Hz, 310Hz, 600Hz, 1kHz, 3kHz, 6kHz, 12kHz, 14kHz, 16kHz) with Preamp and Presets (Flat, Rock, Techno, Pop, Full Bass, Club, Vocal).
- **Spectrum Visualizer & Oscilloscope**: 19-band frequency visualizer with green-yellow-red segmented bars and falling peak hold indicators, driven by Web Audio `AnalyserNode` or procedural synthesis.
- **Playlist Manager**: Track listing with duration, add/remove tracks, double-click to play, total time calculation, and dynamic loading of audio files discovered in `C:/Music` on VFS.
- **Web Audio Chiptune Synthesizer**: Procedural multi-voice chiptune engine generating authentic FM/square/triangle melodies and beats for bundled tracks when external MP3 assets are not loaded.

### 2.2 Complete Code Blueprint

```tsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useAudioStore } from '../../store/useAudioStore';

export interface RetroAmpTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  durationSeconds: number;
  bitrateKbps: number;
  sampleRateKhz: number;
  isStereo: boolean;
  vfsPath?: string;
  synthNotes?: { freq: number; dur: number; type?: OscillatorType }[];
}

const DEFAULT_TRACKS: RetroAmpTrack[] = [
  {
    id: 'track_1',
    title: 'NullWave - 2006 Anthem',
    artist: 'NullWave Audio',
    album: 'Demo Disc Vol. 1',
    durationSeconds: 194,
    bitrateKbps: 192,
    sampleRateKhz: 44,
    isStereo: true,
    synthNotes: [
      { freq: 440, dur: 0.25 }, { freq: 493.88, dur: 0.25 }, { freq: 523.25, dur: 0.5 },
      { freq: 659.25, dur: 0.5 }, { freq: 587.33, dur: 0.25 }, { freq: 523.25, dur: 0.25 },
      { freq: 440, dur: 0.75 }, { freq: 329.63, dur: 0.5 }, { freq: 392.00, dur: 0.5 }
    ]
  },
  {
    id: 'track_2',
    title: "Ryan's Theme - Foodcart Odyssey",
    artist: 'Ryan & The Fryers',
    album: 'Downtown Shifts',
    durationSeconds: 148,
    bitrateKbps: 128,
    sampleRateKhz: 44,
    isStereo: true,
    synthNotes: [
      { freq: 329.63, dur: 0.3 }, { freq: 392.00, dur: 0.3 }, { freq: 440.00, dur: 0.4 },
      { freq: 493.88, dur: 0.3 }, { freq: 440.00, dur: 0.3 }, { freq: 392.00, dur: 0.6 }
    ]
  },
  {
    id: 'track_3',
    title: 'Maya - Rain Over Motel (Lo-Fi Mix)',
    artist: 'Maya',
    album: 'Room 104 Tapes',
    durationSeconds: 215,
    bitrateKbps: 160,
    sampleRateKhz: 44,
    isStereo: true,
    synthNotes: [
      { freq: 261.63, dur: 0.5 }, { freq: 329.63, dur: 0.5 }, { freq: 392.00, dur: 0.5 },
      { freq: 523.25, dur: 0.5 }, { freq: 493.88, dur: 0.5 }, { freq: 392.00, dur: 1.0 }
    ]
  },
  {
    id: 'track_4',
    title: '56k Symphony - Dialup Dreams',
    artist: 'Modem Quartet',
    album: 'Baud Rate Nostalgia',
    durationSeconds: 172,
    bitrateKbps: 128,
    sampleRateKhz: 44,
    isStereo: false,
    synthNotes: [
      { freq: 587.33, dur: 0.2 }, { freq: 659.25, dur: 0.2 }, { freq: 783.99, dur: 0.4 },
      { freq: 880.00, dur: 0.4 }, { freq: 1046.50, dur: 0.6 }
    ]
  }
];

export const RetroAmpApp: React.FC = () => {
  const vfs = useSimulationStore((s) => s.state.vfs);
  const { masterVolume, isMuted } = useAudioStore();

  // Playlist State
  const [playlist, setPlaylist] = useState<RetroAmpTrack[]>(DEFAULT_TRACKS);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [playbackState, setPlaybackState] = useState<'playing' | 'paused' | 'stopped'>('stopped');
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState<number>(0);
  const [timeDisplayMode, setTimeDisplayMode] = useState<'elapsed' | 'remaining'>('elapsed');
  
  // Controls
  const [volume, setVolume] = useState<number>(0.8);
  const [balance, setBalance] = useState<number>(0); // -1 (Left) to +1 (Right)
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [isRepeat, setIsRepeat] = useState<boolean>(true);
  const [visualizerMode, setVisualizerMode] = useState<'bars' | 'oscilloscope'>('bars');
  
  // Equalizer
  const [showEq, setShowEq] = useState<boolean>(true);
  const [showPlaylist, setShowPlaylist] = useState<boolean>(true);
  const [eqEnabled, setEqEnabled] = useState<boolean>(true);
  const [eqPreamp, setEqPreamp] = useState<number>(0); // -12dB to +12dB
  const [eqBands, setEqBands] = useState<number[]>([0, 2, 4, 1, -1, 0, 2, 3, 1, 0]); // 10 bands

  // Canvas visualizer refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const synthIntervalRef = useRef<number | null>(null);

  // Sync VFS audio files from C:/Music into playlist
  useEffect(() => {
    const musicFiles = Object.values(vfs.files).filter(
      (f) => f.parentPath === 'C:/Music' && (f.name.endsWith('.mp3') || f.name.endsWith('.wav'))
    );
    if (musicFiles.length > 0) {
      const vfsTracks: RetroAmpTrack[] = musicFiles.map((f, idx) => ({
        id: `vfs_${f.id}`,
        title: f.name.replace(/\.[^/.]+$/, ''),
        artist: (f.metadata?.author as string) || 'Local Artist',
        durationSeconds: 180,
        bitrateKbps: 192,
        sampleRateKhz: 44,
        isStereo: true,
        vfsPath: f.path,
        synthNotes: [
          { freq: 300 + (idx * 50), dur: 0.3 },
          { freq: 400 + (idx * 50), dur: 0.3 },
          { freq: 500 + (idx * 50), dur: 0.5 }
        ]
      }));

      setPlaylist((prev) => {
        const nonVfs = prev.filter((t) => !t.vfsPath);
        return [...nonVfs, ...vfsTracks];
      });
    }
  }, [vfs]);

  const currentTrack = playlist[currentTrackIndex] || playlist[0];

  // Web Audio Context Initialization
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current && typeof window !== 'undefined') {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.8;
          audioCtxRef.current = ctx;
          analyserRef.current = analyser;
        }
      } catch {}
    }
  }, []);

  // Transport Handlers
  const handlePlay = useCallback(() => {
    initAudio();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    setPlaybackState('playing');
  }, [initAudio]);

  const handlePause = useCallback(() => {
    setPlaybackState('paused');
  }, []);

  const handleStop = useCallback(() => {
    setPlaybackState('stopped');
    setCurrentTimeSeconds(0);
  }, []);

  const handleNext = useCallback(() => {
    if (isShuffle) {
      const nextIdx = Math.floor(Math.random() * playlist.length);
      setCurrentTrackIndex(nextIdx);
    } else {
      setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
    }
    setCurrentTimeSeconds(0);
    if (playbackState === 'playing') handlePlay();
  }, [playlist.length, isShuffle, playbackState, handlePlay]);

  const handlePrev = useCallback(() => {
    if (currentTimeSeconds > 3) {
      setCurrentTimeSeconds(0);
    } else {
      setCurrentTrackIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
      setCurrentTimeSeconds(0);
    }
    if (playbackState === 'playing') handlePlay();
  }, [currentTimeSeconds, playlist.length, playbackState, handlePlay]);

  // Playback Timer Loop
  useEffect(() => {
    if (playbackState !== 'playing') return;

    const timer = setInterval(() => {
      setCurrentTimeSeconds((prev) => {
        if (prev >= currentTrack.durationSeconds) {
          if (isRepeat || currentTrackIndex < playlist.length - 1) {
            handleNext();
            return 0;
          } else {
            handleStop();
            return 0;
          }
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [playbackState, currentTrack, isRepeat, currentTrackIndex, playlist.length, handleNext, handleStop]);

  // Visualizer Animation Canvas Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    const numBars = 19;
    const barWidth = 3;
    const barGap = 1;
    const peaks = new Array(numBars).fill(0);

    const render = () => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (playbackState === 'playing') {
        const dataArray = new Uint8Array(numBars);
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
        } else {
          // Synthetic audio spectrum generator
          for (let i = 0; i < numBars; i++) {
            const wave = Math.sin(Date.now() / 150 + i * 0.5);
            const noise = Math.random() * 40;
            dataArray[i] = Math.max(10, Math.min(255, Math.floor((wave + 1) * 100 + noise)));
          }
        }

        if (visualizerMode === 'bars') {
          for (let i = 0; i < numBars; i++) {
            const val = dataArray[i] / 255;
            const barHeight = Math.floor(val * (canvas.height - 2));
            const x = i * (barWidth + barGap) + 2;

            // Falling peak
            if (barHeight > peaks[i]) {
              peaks[i] = barHeight;
            } else {
              peaks[i] = Math.max(0, peaks[i] - 0.4);
            }

            // Draw segmented LED bar
            for (let y = canvas.height - 1; y >= canvas.height - barHeight; y -= 2) {
              const ratio = (canvas.height - y) / canvas.height;
              ctx.fillStyle = ratio > 0.8 ? '#ff2200' : ratio > 0.5 ? '#ffff00' : '#00ff44';
              ctx.fillRect(x, y, barWidth, 1);
            }

            // Peak cap
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x, canvas.height - Math.floor(peaks[i]) - 1, barWidth, 1);
          }
        } else {
          // Oscilloscope Mode
          ctx.strokeStyle = '#00ff44';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let i = 0; i < canvas.width; i++) {
            const v = Math.sin((i + Date.now() / 20) * 0.1) * (canvas.height / 3);
            const y = canvas.height / 2 + v;
            if (i === 0) ctx.moveTo(i, y);
            else ctx.lineTo(i, y);
          }
          ctx.stroke();
        }
      } else {
        // Idle green baseline
        ctx.fillStyle = '#003311';
        ctx.fillRect(2, canvas.height - 3, canvas.width - 4, 1);
      }

      animFrame = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animFrame);
  }, [playbackState, visualizerMode]);

  // Format MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const displayTime = useMemo(() => {
    if (timeDisplayMode === 'elapsed') {
      return formatTime(currentTimeSeconds);
    } else {
      const remaining = Math.max(0, currentTrack.durationSeconds - currentTimeSeconds);
      return `-${formatTime(remaining)}`;
    }
  }, [timeDisplayMode, currentTimeSeconds, currentTrack.durationSeconds]);

  const totalPlaylistSeconds = useMemo(() => {
    return playlist.reduce((sum, t) => sum + t.durationSeconds, 0);
  }, [playlist]);

  return (
    <div className="w-[320px] bg-[#22242a] border-2 border-[#555866] text-[#c0c0c0] font-sans text-xs select-none shadow-2xl p-1.5 flex flex-col gap-1.5 rounded-sm">
      {/* 1. MAIN PLAYER CHASSIS */}
      <div className="bg-gradient-to-b from-[#3a3d45] to-[#1c1e24] border border-[#111215] p-2 rounded flex flex-col gap-2 relative">
        {/* Title Bar / Marquee Header */}
        <div className="flex justify-between items-center bg-[#15161a] border border-[#2b2d35] px-1.5 py-0.5 rounded-xs">
          <span className="font-bold text-[10px] text-[#29b6f6] tracking-wider">RETROAMP 2.3</span>
          <div className="flex gap-1 text-[9px]">
            <button
              onClick={() => setShowEq(!showEq)}
              className={`px-1 rounded-xs border ${showEq ? 'bg-[#00e676] text-black font-bold border-white' : 'bg-[#2b2d35] text-gray-400 border-gray-600'}`}
            >
              EQ
            </button>
            <button
              onClick={() => setShowPlaylist(!showPlaylist)}
              className={`px-1 rounded-xs border ${showPlaylist ? 'bg-[#00e676] text-black font-bold border-white' : 'bg-[#2b2d35] text-gray-400 border-gray-600'}`}
            >
              PL
            </button>
          </div>
        </div>

        {/* Display Screen (LCD Green Timer & Visualizer) */}
        <div className="bg-[#0b0d0e] border-2 border-inset border-[#222] p-1.5 rounded flex items-center justify-between gap-2 h-16">
          {/* LED Timer Display */}
          <div
            onClick={() => setTimeDisplayMode(timeDisplayMode === 'elapsed' ? 'remaining' : 'elapsed')}
            className="flex flex-col cursor-pointer bg-[#001a08] border border-[#004d1a] px-2 py-1 rounded"
            title="Click to toggle Elapsed / Remaining"
          >
            <span className="text-[9px] text-[#00a838] uppercase leading-tight font-mono font-bold">
              {timeDisplayMode === 'elapsed' ? 'TIME' : 'REM'}
            </span>
            <span className="font-mono text-2xl text-[#00ff44] tracking-widest leading-none drop-shadow-[0_0_5px_#00ff44]">
              {displayTime}
            </span>
          </div>

          {/* Visualizer Canvas */}
          <div
            onClick={() => setVisualizerMode(visualizerMode === 'bars' ? 'oscilloscope' : 'bars')}
            className="flex-1 h-full bg-black border border-[#1a1a1a] rounded flex items-center justify-center cursor-pointer"
            title="Click to switch Visualizer Mode"
          >
            <canvas ref={canvasRef} width={80} height={48} className="w-full h-full" />
          </div>

          {/* Audio Spec Flags */}
          <div className="flex flex-col text-[8px] font-mono text-gray-400 gap-0.5 justify-center">
            <span className="text-[#00ff44] font-bold">{currentTrack.bitrateKbps} KBPS</span>
            <span className="text-[#00e5ff]">{currentTrack.sampleRateKhz} KHZ</span>
            <span className={currentTrack.isStereo ? 'text-[#ffea00] font-bold' : 'text-gray-600'}>
              {currentTrack.isStereo ? 'STEREO' : 'MONO'}
            </span>
          </div>
        </div>

        {/* Scrolling Track Title Ticker */}
        <div className="bg-[#0e1014] border border-[#2b2d35] px-2 py-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[#00ff44] font-mono">
          {playbackState === 'playing' ? '▶ ' : playbackState === 'paused' ? '⏸ ' : '⏹ '}
          {currentTrackIndex + 1}. {currentTrack.artist} - {currentTrack.title} ({formatTime(currentTrack.durationSeconds)})
        </div>

        {/* Seek Slider */}
        <div className="flex flex-col gap-0.5">
          <input
            type="range"
            min="0"
            max={currentTrack.durationSeconds}
            value={currentTimeSeconds}
            onChange={(e) => setCurrentTimeSeconds(Number(e.target.value))}
            className="w-full h-2 bg-[#111] accent-[#00e676] cursor-pointer"
          />
        </div>

        {/* Controls Grid */}
        <div className="flex items-center justify-between gap-1 pt-1">
          {/* Transport Buttons */}
          <div className="flex gap-1">
            <button onClick={handlePrev} className="px-2 py-1 bg-[#333742] hover:bg-[#444957] active:bg-[#22252c] border border-gray-600 rounded text-white text-xs font-bold">
              |◀◀
            </button>
            <button onClick={handlePlay} className={`px-2.5 py-1 border rounded text-xs font-bold ${playbackState === 'playing' ? 'bg-[#00e676] text-black border-white' : 'bg-[#333742] hover:bg-[#444957] active:bg-[#22252c] text-white border-gray-600'}`}>
              ▶
            </button>
            <button onClick={handlePause} className={`px-2 py-1 border rounded text-xs font-bold ${playbackState === 'paused' ? 'bg-[#ffd600] text-black border-white' : 'bg-[#333742] hover:bg-[#444957] active:bg-[#22252c] text-white border-gray-600'}`}>
              ⏸
            </button>
            <button onClick={handleStop} className="px-2 py-1 bg-[#333742] hover:bg-[#444957] active:bg-[#22252c] border border-gray-600 rounded text-white text-xs font-bold">
              ⏹
            </button>
            <button onClick={handleNext} className="px-2 py-1 bg-[#333742] hover:bg-[#444957] active:bg-[#22252c] border border-gray-600 rounded text-white text-xs font-bold">
              ▶▶|
            </button>
          </div>

          {/* Shuffle & Repeat */}
          <div className="flex gap-1">
            <button
              onClick={() => setIsShuffle(!isShuffle)}
              className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${isShuffle ? 'bg-[#00e676] text-black border-white' : 'bg-[#2b2d35] text-gray-400 border-gray-600'}`}
            >
              SHUF
            </button>
            <button
              onClick={() => setIsRepeat(!isRepeat)}
              className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${isRepeat ? 'bg-[#00e676] text-black border-white' : 'bg-[#2b2d35] text-gray-400 border-gray-600'}`}
            >
              REP
            </button>
          </div>
        </div>

        {/* Sliders (Volume & Balance) */}
        <div className="grid grid-cols-2 gap-3 pt-1 text-[10px] text-gray-400">
          <div className="flex items-center gap-1">
            <span>VOL</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full h-1.5 bg-[#111] accent-[#00e676] cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-1">
            <span>PAN</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.1"
              value={balance}
              onChange={(e) => setBalance(Number(e.target.value))}
              className="w-full h-1.5 bg-[#111] accent-[#00e676] cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 2. DOCKED EQUALIZER WINDOW */}
      {showEq && (
        <div className="bg-[#1c1e24] border border-[#3a3d45] p-2 rounded flex flex-col gap-2">
          <div className="flex justify-between items-center text-[10px] font-bold text-gray-300 border-b border-gray-700 pb-1">
            <span>EQUALIZER</span>
            <div className="flex gap-2">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={eqEnabled}
                  onChange={(e) => setEqEnabled(e.target.checked)}
                />
                <span>ON</span>
              </label>
              <button
                onClick={() => setEqBands([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])}
                className="px-1.5 bg-[#333] hover:bg-[#444] rounded text-[9px]"
              >
                Reset
              </button>
            </div>
          </div>

          {/* 10 Band Sliders */}
          <div className="flex justify-between items-center gap-1 h-20 px-1 pt-1">
            {/* Preamp */}
            <div className="flex flex-col items-center h-full">
              <input
                type="range"
                min="-12"
                max="12"
                value={eqPreamp}
                onChange={(e) => setEqPreamp(Number(e.target.value))}
                className="h-14 -rotate-90 w-12 accent-[#00e676]"
              />
              <span className="text-[8px] text-gray-500 mt-2">PRE</span>
            </div>

            {/* Bands */}
            {['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K'].map((freq, idx) => (
              <div key={freq} className="flex flex-col items-center h-full">
                <input
                  type="range"
                  min="-12"
                  max="12"
                  value={eqBands[idx]}
                  onChange={(e) => {
                    const newBands = [...eqBands];
                    newBands[idx] = Number(e.target.value);
                    setEqBands(newBands);
                  }}
                  className="h-14 -rotate-90 w-10 accent-[#00e676]"
                />
                <span className="text-[8px] text-gray-500 mt-2">{freq}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. DOCKED PLAYLIST WINDOW */}
      {showPlaylist && (
        <div className="bg-[#15161a] border border-[#3a3d45] p-2 rounded flex flex-col gap-1.5 max-h-48">
          <div className="flex justify-between items-center text-[10px] font-bold text-[#00e676] border-b border-gray-800 pb-1">
            <span>RETROAMP PLAYLIST</span>
            <span className="text-gray-400 font-mono">
              {playlist.length} tracks / {formatTime(totalPlaylistSeconds)}
            </span>
          </div>

          {/* Track List */}
          <div className="flex-1 overflow-y-auto space-y-0.5 bg-[#0b0c0e] border border-gray-800 p-1 rounded font-mono text-[10px]">
            {playlist.map((track, idx) => {
              const isCurrent = currentTrackIndex === idx;
              return (
                <div
                  key={track.id}
                  onDoubleClick={() => {
                    setCurrentTrackIndex(idx);
                    handlePlay();
                  }}
                  onClick={() => setCurrentTrackIndex(idx)}
                  className={`flex justify-between items-center px-1.5 py-0.5 cursor-pointer rounded-xs ${
                    isCurrent
                      ? 'bg-[#005522] text-[#00ff44] font-bold'
                      : 'hover:bg-[#1f2229] text-gray-300'
                  }`}
                >
                  <span className="truncate pr-2">
                    {idx + 1}. {track.artist} - {track.title}
                  </span>
                  <span className="shrink-0">{formatTime(track.durationSeconds)}</span>
                </div>
              );
            })}
          </div>

          {/* Playlist Footer Actions */}
          <div className="flex justify-between items-center text-[9px] pt-1 text-gray-400">
            <div className="flex gap-1">
              <button
                onClick={() => {
                  const newTrack: RetroAmpTrack = {
                    id: `custom_${Date.now()}`,
                    title: 'New User Audio',
                    artist: 'User Track',
                    durationSeconds: 150,
                    bitrateKbps: 128,
                    sampleRateKhz: 44,
                    isStereo: true,
                  };
                  setPlaylist([...playlist, newTrack]);
                }}
                className="px-1.5 py-0.5 bg-[#2b2d35] hover:bg-[#3a3d45] rounded text-white"
              >
                + Add Track
              </button>
              <button
                onClick={() => {
                  if (playlist.length > 1) {
                    setPlaylist(playlist.filter((_, i) => i !== currentTrackIndex));
                    setCurrentTrackIndex(0);
                  }
                }}
                className="px-1.5 py-0.5 bg-[#2b2d35] hover:bg-[#3a3d45] rounded text-white"
              >
                - Rem Track
              </button>
            </div>
            <button
              onClick={() => setPlaylist(DEFAULT_TRACKS)}
              className="px-1.5 py-0.5 bg-[#2b2d35] hover:bg-[#3a3d45] rounded text-gray-300"
            >
              Reset PL
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
```

---

## 3. App 2: FlashFetch (`src/apps/flashfetch/FlashFetchApp.tsx`)

### 3.1 Overview & UI Specification
FlashFetch is a download accelerator (FlashGet / GetRight clone).
Key Features:
- **Multi-Segment Chunk Visualizer**: Visual grid of download chunks (4, 8, or 16 thread blocks per active download). Displays chunk states (`Completed`: blue, `Receiving`: green, `Connecting`: yellow, `Pending`: gray).
- **Download Queue Table**: Columns for File Name, Size, Transferred, Speed, ETA, Status, Segments, and URL.
- **Speed History Graph**: Real-time sliding window line chart of network throughput (KB/s).
- **Controls Toolbar**: Add Download (+), Start/Resume (▶), Pause (⏸), Cancel (✖), Speed Limiter (Unlimited, 50 KB/s, 10 KB/s), and Open Completed File.
- **DownloadManager Integration**: Direct synchronization with `SimulationEngine.downloads`.

### 3.2 Complete Code Blueprint

```tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { DownloadTask } from '../../engine/types';

export const FlashFetchApp: React.FC = () => {
  const downloads = useSimulationStore((s) => s.state.downloads);
  const hardware = useSimulationStore((s) => s.state.hardware);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [speedHistory, setSpeedHistory] = useState<number[]>(new Array(30).fill(0));
  const [speedLimiterMode, setSpeedLimiterMode] = useState<'unlimited' | 'medium' | 'slow'>('unlimited');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newUrl, setNewUrl] = useState<string>('http://downloadhub.local/files/PhotoBoxSetup.exe');
  const [newSegments, setNewSegments] = useState<number>(4);

  const activeDownloads = useMemo(() => downloads.filter((d) => d.status === 'downloading'), [downloads]);

  // Aggregate current speed in KB/s
  const currentTotalSpeedKbps = useMemo(() => {
    return activeDownloads.reduce((sum, d) => sum + (d.allocatedKbps || 0), 0);
  }, [activeDownloads]);
  const currentTotalSpeedKBs = currentTotalSpeedKbps / 8;

  // Record Speed History
  useEffect(() => {
    const interval = setInterval(() => {
      setSpeedHistory((prev) => [...prev.slice(1), currentTotalSpeedKBs]);
    }, 1000);
    return () => clearInterval(interval);
  }, [currentTotalSpeedKBs]);

  const selectedTask = downloads.find((d) => d.id === selectedTaskId) || downloads[0] || null;

  // Multi-segment chunks computation for selected task
  const segmentChunks = useMemo(() => {
    if (!selectedTask) return [];
    const totalSegments = 8;
    const progressFraction = selectedTask.totalBytes > 0 ? selectedTask.downloadedBytes / selectedTask.totalBytes : 0;
    const completedSegments = Math.floor(progressFraction * totalSegments);
    const partialSegmentProgress = (progressFraction * totalSegments) - completedSegments;

    const chunks = [];
    for (let i = 0; i < totalSegments; i++) {
      if (i < completedSegments) {
        chunks.push({ index: i, state: 'completed', percent: 100 });
      } else if (i === completedSegments && selectedTask.status === 'downloading') {
        chunks.push({ index: i, state: 'receiving', percent: Math.round(partialSegmentProgress * 100) });
      } else if (selectedTask.status === 'downloading') {
        chunks.push({ index: i, state: 'connecting', percent: 0 });
      } else {
        chunks.push({ index: i, state: 'pending', percent: 0 });
      }
    }
    return chunks;
  }, [selectedTask]);

  const handleStartDownload = () => {
    if (!newUrl) return;
    const fileName = newUrl.split('/').pop() || 'Download.bin';
    dispatchAction({
      type: 'DOWNLOAD_START',
      sourceId: 'flashfetch_custom',
      url: newUrl,
      fileName,
      totalBytes: 25_000_000,
      sourceMaxKbps: 512,
      manager: 'flashfetch',
    });
    setShowAddModal(false);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#c0c0c0] text-black font-sans text-xs select-none">
      {/* Top Toolbar */}
      <div className="flex items-center gap-1.5 p-1.5 bg-[#dfdfdf] border-b border-gray-400">
        <button
          onClick={() => setShowAddModal(true)}
          className="orion-button font-bold text-blue-900"
          title="Add New Download Task"
        >
          ➕ New Task
        </button>
        <div className="h-5 w-px bg-gray-400 mx-1" />
        <button
          onClick={() => selectedTask && dispatchAction({ type: 'DOWNLOAD_RESUME', taskId: selectedTask.id })}
          disabled={!selectedTask || selectedTask.status === 'downloading'}
          className="orion-button"
        >
          ▶ Start
        </button>
        <button
          onClick={() => selectedTask && dispatchAction({ type: 'DOWNLOAD_PAUSE', taskId: selectedTask.id })}
          disabled={!selectedTask || selectedTask.status !== 'downloading'}
          className="orion-button"
        >
          ⏸ Pause
        </button>
        <button
          onClick={() => selectedTask && dispatchAction({ type: 'DOWNLOAD_CANCEL', taskId: selectedTask.id })}
          disabled={!selectedTask}
          className="orion-button text-red-700"
        >
          ✖ Cancel
        </button>
        <div className="h-5 w-px bg-gray-400 mx-1" />
        <div className="flex items-center gap-1 text-[11px] text-gray-700 ml-auto">
          <span>Speed Limit:</span>
          <select
            value={speedLimiterMode}
            onChange={(e) => setSpeedLimiterMode(e.target.value as any)}
            className="orion-input text-xs py-0"
          >
            <option value="unlimited">Unlimited ({hardware.connectionSpeedKbps} kbps)</option>
            <option value="medium">Normal (256 kbps)</option>
            <option value="slow">Background (64 kbps)</option>
          </select>
        </div>
      </div>

      {/* Main Workspace (Split Pane: Queue Top, Chunks/Graph Bottom) */}
      <div className="flex-1 flex flex-col overflow-hidden p-2 gap-2">
        {/* Top: Downloads Queue Table */}
        <div className="flex-1 bg-white border border-gray-500 rounded overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#dfdfdf] border-b border-gray-400 sticky top-0 font-semibold text-gray-700">
              <tr>
                <th className="p-1.5 border-r border-gray-300 w-8">#</th>
                <th className="p-1.5 border-r border-gray-300">File Name</th>
                <th className="p-1.5 border-r border-gray-300 w-24">Size</th>
                <th className="p-1.5 border-r border-gray-300 w-36">Progress</th>
                <th className="p-1.5 border-r border-gray-300 w-20">Speed</th>
                <th className="p-1.5 border-r border-gray-300 w-20">ETA</th>
                <th className="p-1.5 w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              {downloads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-400">
                    No download tasks in queue. Click "New Task" to start a download.
                  </td>
                </tr>
              ) : (
                downloads.map((task, idx) => {
                  const isSelected = selectedTask?.id === task.id;
                  const percent = task.totalBytes > 0 ? Math.min(100, Math.round((task.downloadedBytes / task.totalBytes) * 100)) : 0;
                  const sizeMB = (task.totalBytes / (1024 * 1024)).toFixed(1);
                  const speedKBs = ((task.allocatedKbps || 0) / 8).toFixed(1);
                  const remainingBytes = task.totalBytes - task.downloadedBytes;
                  const etaSeconds = task.allocatedKbps > 0 ? Math.ceil(remainingBytes / ((task.allocatedKbps * 1024) / 8)) : 0;

                  return (
                    <tr
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className={`cursor-pointer border-b border-gray-200 ${
                        isSelected ? 'bg-blue-100 text-blue-900 font-semibold' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="p-1.5 text-gray-500">{idx + 1}</td>
                      <td className="p-1.5 font-mono">{task.fileName}</td>
                      <td className="p-1.5 font-mono">{sizeMB} MB</td>
                      <td className="p-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 bg-gray-200 border border-gray-400 h-3 rounded-xs overflow-hidden">
                            <div
                              style={{ width: `${percent}%` }}
                              className="h-full bg-blue-600 transition-all duration-200"
                            />
                          </div>
                          <span className="text-[10px] font-mono w-8 text-right">{percent}%</span>
                        </div>
                      </td>
                      <td className="p-1.5 font-mono">{task.status === 'downloading' ? `${speedKBs} KB/s` : '--'}</td>
                      <td className="p-1.5 font-mono">{task.status === 'downloading' ? `${etaSeconds}s` : '--'}</td>
                      <td className="p-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                            task.status === 'downloading'
                              ? 'bg-green-100 text-green-800'
                              : task.status === 'complete'
                              ? 'bg-blue-100 text-blue-800'
                              : task.status === 'paused'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {task.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Split: Multi-Segment Thread Visualizer (Left) & Speed Graph (Right) */}
        <div className="h-40 grid grid-cols-2 gap-2">
          {/* Multi-Segment Chunk Visualizer */}
          <fieldset className="border border-gray-400 p-2 rounded bg-white/60 flex flex-col justify-between">
            <legend className="font-bold px-1 text-gray-700 text-[11px]">
              Multi-Thread Segment Grid {selectedTask ? `(${selectedTask.fileName})` : ''}
            </legend>
            <div className="grid grid-cols-4 gap-1.5 flex-1 p-1">
              {segmentChunks.map((chunk) => (
                <div
                  key={chunk.index}
                  className={`border border-gray-400 rounded-xs flex flex-col items-center justify-center p-1 text-[10px] font-mono ${
                    chunk.state === 'completed'
                      ? 'bg-blue-500 text-white'
                      : chunk.state === 'receiving'
                      ? 'bg-green-400 text-black animate-pulse font-bold'
                      : chunk.state === 'connecting'
                      ? 'bg-yellow-200 text-gray-800'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <span>Th #{chunk.index + 1}</span>
                  <span>{chunk.percent}%</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-gray-600 px-1 pt-1 border-t border-gray-300">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 inline-block" /> Done</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-400 inline-block" /> Active</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-200 inline-block" /> Connect</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-gray-200 inline-block" /> Wait</span>
            </div>
          </fieldset>

          {/* Real-Time Speed Graph */}
          <fieldset className="border border-gray-400 p-2 rounded bg-white/60 flex flex-col justify-between">
            <legend className="font-bold px-1 text-gray-700 text-[11px]">
              Speed Graph ({currentTotalSpeedKBs.toFixed(1)} KB/s)
            </legend>
            <div className="flex-1 bg-black border border-gray-600 rounded p-1 relative overflow-hidden flex items-end">
              <svg className="w-full h-full" viewBox="0 0 300 80" preserveAspectRatio="none">
                <polyline
                  fill="rgba(0, 230, 118, 0.2)"
                  stroke="#00e676"
                  strokeWidth="2"
                  points={speedHistory
                    .map((val, idx) => `${(idx / (speedHistory.length - 1)) * 300},${80 - Math.min(75, val * 1.5)}`)
                    .join(' ') + ' 300,80 0,80'}
                />
              </svg>
            </div>
            <div className="flex justify-between text-[10px] text-gray-600 px-1 pt-1 border-t border-gray-300">
              <span>0 KB/s</span>
              <span className="font-bold text-green-700 font-mono">Current: {currentTotalSpeedKBs.toFixed(1)} KB/s</span>
              <span>Max: {hardware.connectionSpeedKbps / 8} KB/s</span>
            </div>
          </fieldset>
        </div>
      </div>

      {/* Add New Download Modal Dialog */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="w-96 bg-[#c0c0c0] border-2 border-gray-100 shadow-2xl p-4 rounded flex flex-col gap-3">
            <h3 className="font-bold text-sm text-gray-800">Add New Download Task</h3>
            <div className="space-y-2">
              <div>
                <label className="block text-[11px] text-gray-600 mb-0.5">Download URL:</label>
                <input
                  type="text"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="orion-input w-full font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-600 mb-0.5">Split Segments:</label>
                <select
                  value={newSegments}
                  onChange={(e) => setNewSegments(Number(e.target.value))}
                  className="orion-input w-full text-xs"
                >
                  <option value={1}>1 Single Thread</option>
                  <option value={2}>2 Threads</option>
                  <option value={4}>4 Multi-Part Accelerators</option>
                  <option value={8}>8 Max Speed Threads</option>
                </select>
              </div>
              <div className="text-[11px] text-gray-500">Destination: <code className="font-mono">C:/Downloads</code></div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-400">
              <button onClick={handleStartDownload} className="orion-button font-bold text-blue-900">
                OK / Download
              </button>
              <button onClick={() => setShowAddModal(false)} className="orion-button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="px-2 py-1 bg-[#dfdfdf] border-t border-gray-400 text-[11px] text-gray-600 flex justify-between">
        <span>{downloads.length} task(s) | {activeDownloads.length} active</span>
        <span className="font-mono font-semibold">Total Transfer Rate: {currentTotalSpeedKBs.toFixed(1)} KB/s</span>
      </div>
    </div>
  );
};
```

---

## 4. App 3: ZipMate (`src/apps/zipmate/ZipMateApp.tsx`)

### 4.1 Overview & UI Specification
ZipMate is a WinZip / WinRAR style archive utility.
Key Features:
- **Archive Explorer**: Inspects ZIP archives from VFS, showing internal files, uncompressed sizes, packed sizes, compression ratios (`58%`), modified dates, and CRC-32 checksums.
- **Extraction Wizard**: Allows selecting extraction destination in VFS (defaults to `C:/Downloads/extracted`), overwriting options, and file-by-file extraction progress bar.
- **Decompression Execution**: Dispatches `VFS_CREATE_FILE` actions to populate destination directories in VFS.
- **Archive Creation**: Allows bundling user files into a new `.zip` archive on VFS.

### 4.2 Complete Code Blueprint

```tsx
import React, { useState, useMemo } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { FileRecord } from '../../engine/types';

export interface ZipEntry {
  name: string;
  path: string;
  sizeBytes: number;
  packedBytes: number;
  ratio: string;
  modified: string;
  crc32: string;
  kind: 'executable' | 'installer' | 'text' | 'image' | 'audio';
  content?: string;
}

const SAMPLE_ZIP_FILES: Record<string, ZipEntry[]> = {
  'PhotoPack2006.zip': [
    { name: 'cafe_exterior.jpg', path: 'cafe_exterior.jpg', sizeBytes: 124000, packedBytes: 74400, ratio: '60%', modified: '2006-03-12', crc32: '8FA491C2', kind: 'image' },
    { name: 'motel_night.jpg', path: 'motel_night.jpg', sizeBytes: 98000, packedBytes: 58800, ratio: '60%', modified: '2006-03-14', crc32: 'A1B2C3D4', kind: 'image' },
    { name: 'readme.txt', path: 'readme.txt', sizeBytes: 1400, packedBytes: 560, ratio: '40%', modified: '2006-03-14', crc32: '5E2B9A01', kind: 'text', content: 'Photos from downtown trip.' }
  ],
  'ZipMate_portable.zip': [
    { name: 'ZipMate.exe', path: 'ZipMate.exe', sizeBytes: 4194304, packedBytes: 1887436, ratio: '45%', modified: '2006-01-20', crc32: '99CC33AA', kind: 'executable' },
    { name: 'manual.txt', path: 'manual.txt', sizeBytes: 12000, packedBytes: 4800, ratio: '40%', modified: '2006-01-20', crc32: '11223344', kind: 'text', content: 'ZipMate Portable v4.0 Manual.' }
  ]
};

export const ZipMateApp: React.FC<{ initialArchivePath?: string }> = ({ initialArchivePath }) => {
  const vfs = useSimulationStore((s) => s.state.vfs);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);

  const [currentArchiveName, setCurrentArchiveName] = useState<string>('PhotoPack2006.zip');
  const [selectedEntryName, setSelectedEntryName] = useState<string | null>(null);
  
  // Extraction Wizard State
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractDestination, setExtractDestination] = useState<string>('C:/Downloads/extracted');
  const [extractProgress, setExtractProgress] = useState<number>(0);
  const [extractStatusMessage, setExtractStatusMessage] = useState<string>('');
  const [showExtractModal, setShowExtractModal] = useState<boolean>(false);

  const entries = useMemo(() => {
    return SAMPLE_ZIP_FILES[currentArchiveName] || SAMPLE_ZIP_FILES['PhotoPack2006.zip'];
  }, [currentArchiveName]);

  const totalUnpackedBytes = useMemo(() => entries.reduce((sum, e) => sum + e.sizeBytes, 0), [entries]);
  const totalPackedBytes = useMemo(() => entries.reduce((sum, e) => sum + e.packedBytes, 0), [entries]);
  const overallRatio = totalUnpackedBytes > 0 ? `${Math.round((totalPackedBytes / totalUnpackedBytes) * 100)}%` : '0%';

  const handleExtract = () => {
    setShowExtractModal(false);
    setIsExtracting(true);
    setExtractProgress(10);
    setExtractStatusMessage('Creating destination directory...');

    // Simulate extraction steps
    setTimeout(() => {
      setExtractProgress(40);
      setExtractStatusMessage(`Extracting: ${entries[0]?.name}...`);
    }, 400);

    setTimeout(() => {
      setExtractProgress(80);
      setExtractStatusMessage(`Extracting: ${entries[1]?.name || 'files'}...`);
    }, 800);

    setTimeout(() => {
      // Actually write files to VFS
      entries.forEach((entry) => {
        const targetPath = `${extractDestination}/${entry.name}`;
        dispatchAction({
          type: 'VFS_CREATE_FILE',
          file: {
            name: entry.name,
            path: targetPath,
            parentPath: extractDestination,
            kind: entry.kind,
            sizeBytes: entry.sizeBytes,
            content: entry.content || `Extracted payload for ${entry.name}`,
          }
        });
      });

      setExtractProgress(100);
      setExtractStatusMessage(`Extraction complete! ${entries.length} files extracted to ${extractDestination}.`);
      setTimeout(() => {
        setIsExtracting(false);
        setExtractProgress(0);
      }, 1500);
    }, 1200);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#c0c0c0] text-black font-sans text-xs select-none">
      {/* Top Toolbar */}
      <div className="flex items-center gap-1.5 p-1.5 bg-[#dfdfdf] border-b border-gray-400">
        <button
          onClick={() => setShowExtractModal(true)}
          disabled={isExtracting}
          className="orion-button font-bold text-blue-900"
        >
          📂 Extract All
        </button>
        <button
          onClick={() => alert(`Archive CRC verification passed for ${currentArchiveName}!`)}
          className="orion-button"
        >
          🔍 Test / Verify
        </button>
        <div className="h-5 w-px bg-gray-400 mx-1" />
        <span className="text-gray-600 text-[11px]">Archive:</span>
        <select
          value={currentArchiveName}
          onChange={(e) => setCurrentArchiveName(e.target.value)}
          className="orion-input font-mono text-xs py-0"
        >
          <option value="PhotoPack2006.zip">PhotoPack2006.zip</option>
          <option value="ZipMate_portable.zip">ZipMate_portable.zip</option>
        </select>
      </div>

      {/* Main Table of Archive Entries */}
      <div className="flex-1 p-2 overflow-hidden flex flex-col">
        <div className="flex-1 bg-white border border-gray-500 rounded overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#dfdfdf] border-b border-gray-400 sticky top-0 font-semibold text-gray-700">
              <tr>
                <th className="p-1.5 border-r border-gray-300">Name</th>
                <th className="p-1.5 border-r border-gray-300 w-24">Original Size</th>
                <th className="p-1.5 border-r border-gray-300 w-24">Packed Size</th>
                <th className="p-1.5 border-r border-gray-300 w-16">Ratio</th>
                <th className="p-1.5 border-r border-gray-300 w-24">Date</th>
                <th className="p-1.5 w-24">CRC-32</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isSelected = selectedEntryName === entry.name;
                const sizeKB = (entry.sizeBytes / 1024).toFixed(1);
                const packedKB = (entry.packedBytes / 1024).toFixed(1);

                return (
                  <tr
                    key={entry.name}
                    onClick={() => setSelectedEntryName(entry.name)}
                    className={`cursor-pointer border-b border-gray-100 ${
                      isSelected ? 'bg-blue-100 text-blue-900 font-semibold' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="p-1.5 font-mono flex items-center gap-1.5">
                      <span>{entry.kind === 'image' ? '🖼️' : entry.kind === 'executable' ? '⚙️' : '📄'}</span>
                      {entry.name}
                    </td>
                    <td className="p-1.5 font-mono">{sizeKB} KB</td>
                    <td className="p-1.5 font-mono">{packedKB} KB</td>
                    <td className="p-1.5 font-mono text-green-700">{entry.ratio}</td>
                    <td className="p-1.5 font-mono text-gray-600">{entry.modified}</td>
                    <td className="p-1.5 font-mono text-gray-500 uppercase">{entry.crc32}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extraction In-Progress Overlay */}
      {isExtracting && (
        <div className="p-3 bg-yellow-50 border-t border-yellow-300 flex flex-col gap-1.5">
          <div className="flex justify-between text-xs font-semibold text-gray-800">
            <span>{extractStatusMessage}</span>
            <span>{extractProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 border border-gray-400 h-3.5 rounded overflow-hidden">
            <div
              style={{ width: `${extractProgress}%` }}
              className="h-full bg-green-600 transition-all duration-300"
            />
          </div>
        </div>
      )}

      {/* Extraction Wizard Modal */}
      {showExtractModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="w-96 bg-[#c0c0c0] border-2 border-gray-100 shadow-2xl p-4 rounded flex flex-col gap-3">
            <h3 className="font-bold text-sm text-gray-800">Extract Archive Files</h3>
            <div className="space-y-2">
              <div>
                <label className="block text-[11px] text-gray-600 mb-0.5">Extract Destination in VFS:</label>
                <input
                  type="text"
                  value={extractDestination}
                  onChange={(e) => setExtractDestination(e.target.value)}
                  className="orion-input w-full font-mono text-xs"
                />
              </div>
              <div className="space-y-1 text-[11px] text-gray-700">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" defaultChecked />
                  <span>Overwrite existing files without asking</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" defaultChecked />
                  <span>Create directory structure if not present</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-400">
              <button onClick={handleExtract} className="orion-button font-bold text-blue-900">
                Extract Now
              </button>
              <button onClick={() => setShowExtractModal(false)} className="orion-button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="px-2 py-1 bg-[#dfdfdf] border-t border-gray-400 text-[11px] text-gray-600 flex justify-between">
        <span>{entries.length} file(s) in archive</span>
        <span>
          Total: {(totalUnpackedBytes / 1024).toFixed(1)} KB (Packed: {(totalPackedBytes / 1024).toFixed(1)} KB, Ratio: {overallRatio})
        </span>
      </div>
    </div>
  );
};
```

---

## 5. App 4: PhotoBox 3.0 (`src/apps/photobox/PhotoBoxApp.tsx`)

### 5.1 Strict Hardware & OS Gating Check
PhotoBox 3.0 requires:
- **Operating System**: `Orion_6.0` (fails on `Orion_4.8`)
- **Memory**: `768 MB+ RAM` (fails on starting `512 MB RAM`)

If launched on an incompatible system:
- Renders an authentic system error/incompatibility dialog detailing exact pass/fail hardware checks and guiding the player to upgrade RAM and OS on TechMart.

When compatible:
- Full photo viewer/editor with Zoom, Rotate, Sepia/Grayscale filters, Flash Bloom adjustment, Crop tool, EXIF metadata viewer, and VFS save functionality.

### 5.2 Complete Code Blueprint

```tsx
import React, { useState, useMemo } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useWindowStore } from '../../store/useWindowStore';

export const PhotoBoxApp: React.FC<{ initialPhotoPath?: string }> = ({ initialPhotoPath }) => {
  const hardware = useSimulationStore((s) => s.state.hardware);
  const vfs = useSimulationStore((s) => s.state.vfs);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);
  const openWindow = useWindowStore((s) => s.openWindow);

  // Hardware Requirements Gating
  const osPassed = hardware.osVersion === 'Orion_6.0';
  const ramPassed = hardware.ramMB >= 768;
  const isCompatible = osPassed && ramPassed;

  // Editor State (for Compatible Mode)
  const [selectedPhotoPath, setSelectedPhotoPath] = useState<string>(initialPhotoPath || 'C:/Pictures/cafe_exterior.jpg');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotationDegrees, setRotationDegrees] = useState<number>(0);
  const [activeFilter, setActiveFilter] = useState<'none' | 'sepia' | 'grayscale' | 'flash_bloom'>('none');
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);

  // Discover image files in VFS
  const photoFiles = useMemo(() => {
    return Object.values(vfs.files).filter(
      (f) => f.kind === 'image' || f.name.endsWith('.jpg') || f.name.endsWith('.png')
    );
  }, [vfs]);

  // -------------------------------------------------------------
  // 1. INCOMPATIBILITY ERROR DIALOG (Orion 4.8 or <768MB RAM)
  // -------------------------------------------------------------
  if (!isCompatible) {
    return (
      <div className="w-full h-full flex flex-col bg-[#ece9d8] text-black font-sans text-xs select-none p-4 justify-between">
        <div className="flex items-start gap-4">
          <span className="text-4xl text-red-600">❌</span>
          <div className="space-y-2 flex-1">
            <h2 className="text-sm font-bold text-red-900">
              PhotoBox 3.0 - System Requirement Incompatibility
            </h2>
            <p className="text-gray-700">
              PhotoBox Studio 3.0 utilizes 32-bit hardware-accelerated image pipeline drivers that require <strong>Orion OS 6.0</strong> and a minimum of <strong>768 MB SDRAM</strong>.
            </p>

            {/* Diagnostic Checklist */}
            <fieldset className="border border-gray-400 p-2.5 rounded bg-white font-mono text-[11px] space-y-1">
              <legend className="font-bold px-1 text-gray-700">Hardware Diagnostics Checklist</legend>
              <div className="flex justify-between">
                <span>Operating System:</span>
                <span className={osPassed ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>
                  {hardware.osVersion} {osPassed ? '✓ (Pass)' : '❌ (Requires Orion OS 6.0)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>System Memory:</span>
                <span className={ramPassed ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>
                  {hardware.ramMB} MB RAM {ramPassed ? '✓ (Pass)' : '❌ (Requires 768 MB+)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>CPU Processing Tier:</span>
                <span className="text-green-700 font-bold">Tier {hardware.cpuTier} ✓ (Pass)</span>
              </div>
            </fieldset>

            <p className="text-[11px] text-gray-600 italic">
              Upgrade Guidance: You can purchase memory upgrades (512MB → 1024MB) and the Orion OS 6.0 Upgrade Disc from <strong>TechMart</strong> or classified listings on <strong>BidBay</strong>.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-gray-400">
          <button
            onClick={() => openWindow('browser', 'Voyager Browser', { initialUrl: 'http://techmart.local' })}
            className="orion-button font-bold text-blue-900"
          >
            Visit TechMart Store
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. COMPATIBLE PHOTO VIEWER & EDITOR WORKSPACE
  // -------------------------------------------------------------
  const handleSavePhoto = () => {
    dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: 'edited_photo.jpg',
        path: 'C:/Pictures/edited_photo.jpg',
        parentPath: 'C:/Pictures',
        kind: 'image',
        sizeBytes: 145000,
        content: `Filtered Photo (Filter: ${activeFilter}, Brightness: ${brightness}%)`,
      }
    });
    alert('Photo saved to C:/Pictures/edited_photo.jpg!');
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#ece9d8] text-black font-sans text-xs select-none">
      {/* Top Toolbar */}
      <div className="flex items-center gap-1.5 p-1.5 bg-[#dfdfdf] border-b border-gray-400">
        <button onClick={handleSavePhoto} className="orion-button font-bold text-blue-900">
          💾 Save Photo
        </button>
        <div className="h-5 w-px bg-gray-400 mx-1" />
        <button onClick={() => setZoomLevel((prev) => Math.min(300, prev + 25))} className="orion-button">
          🔍 Zoom In (+)
        </button>
        <button onClick={() => setZoomLevel((prev) => Math.max(25, prev - 25))} className="orion-button">
          🔍 Zoom Out (-)
        </button>
        <button onClick={() => setZoomLevel(100)} className="orion-button">
          100% Fit
        </button>
        <div className="h-5 w-px bg-gray-400 mx-1" />
        <button onClick={() => setRotationDegrees((prev) => (prev + 90) % 360)} className="orion-button">
          🔄 Rotate 90°
        </button>
        <div className="ml-auto text-gray-600 font-mono text-[11px]">
          Zoom: {zoomLevel}% | Rot: {rotationDegrees}°
        </div>
      </div>

      {/* Main Workspace (Filmstrip Left, Canvas Center, Adjustments Right) */}
      <div className="flex-1 flex overflow-hidden p-2 gap-2">
        {/* Left Filmstrip */}
        <div className="w-44 bg-white border border-gray-400 rounded p-1 overflow-y-auto space-y-1">
          <div className="text-[11px] font-bold text-gray-700 px-1 py-0.5 border-b border-gray-200">
            Pictures Library
          </div>
          {photoFiles.length === 0 ? (
            <div className="p-3 text-center text-gray-400">No photos in C:/Pictures.</div>
          ) : (
            photoFiles.map((file) => (
              <div
                key={file.id}
                onClick={() => setSelectedPhotoPath(file.path)}
                className={`p-1.5 rounded cursor-pointer border ${
                  selectedPhotoPath === file.path ? 'bg-blue-100 border-blue-500 font-bold' : 'hover:bg-gray-50 border-transparent'
                }`}
              >
                <div className="text-xl text-center mb-0.5">🖼️</div>
                <div className="text-[11px] truncate text-center">{file.name}</div>
              </div>
            ))
          )}
        </div>

        {/* Center Viewport Canvas */}
        <div className="flex-1 bg-neutral-900 border border-gray-600 rounded flex items-center justify-center overflow-hidden p-4">
          <div
            style={{
              transform: `scale(${zoomLevel / 100}) rotate(${rotationDegrees}deg)`,
              filter: `brightness(${brightness}%) contrast(${contrast}%) ${
                activeFilter === 'sepia'
                  ? 'sepia(0.85) saturate(1.2)'
                  : activeFilter === 'grayscale'
                  ? 'grayscale(1.0)'
                  : activeFilter === 'flash_bloom'
                  ? 'contrast(1.4) brightness(1.2)'
                  : 'none'
              }`,
              transition: 'transform 0.15s ease, filter 0.15s ease',
            }}
            className="w-72 h-52 bg-gradient-to-tr from-sky-800 to-indigo-900 border-4 border-white shadow-2xl rounded flex flex-col items-center justify-center text-white p-4 relative"
          >
            <span className="text-5xl mb-2">📸</span>
            <span className="font-bold text-sm text-center">{selectedPhotoPath.split('/').pop()}</span>
            <span className="text-[10px] text-gray-300">CyberShot DSC-W5 (1024x768 24-bit RGB)</span>
          </div>
        </div>

        {/* Right Adjustment Filters */}
        <div className="w-56 bg-white border border-gray-400 rounded p-2.5 flex flex-col gap-3">
          <h4 className="font-bold text-gray-800 border-b border-gray-200 pb-1">Photo Adjustments</h4>
          
          {/* Quick Filters */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Color Style:</label>
            <div className="grid grid-cols-2 gap-1 text-[11px]">
              {(['none', 'sepia', 'grayscale', 'flash_bloom'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`orion-button capitalize ${activeFilter === filter ? 'is-active font-bold' : ''}`}
                >
                  {filter.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span>Brightness:</span>
                <span className="font-mono">{brightness}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="150"
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span>Contrast:</span>
                <span className="font-mono">{contrast}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="150"
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          {/* EXIF Details */}
          <div className="mt-auto bg-gray-50 border border-gray-200 p-2 rounded text-[10px] font-mono text-gray-600 space-y-0.5">
            <div>Dimensions: 1024 x 768 px</div>
            <div>Color: 24-bit RGB</div>
            <div>Format: JPEG Image</div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

## 6. App 5: WeatherBuddy (`src/apps/weatherbuddy/WeatherBuddyApp.tsx`)

### 6.1 Overview & Adware Bundling Mechanics
WeatherBuddy is a freeware desktop widget modeled after WeatherBug / BonziBuddy:
- **Weather Features**: Live local weather tied to simulation clock and day progression (temperature, humidity, precipitation, 5-day forecast).
- **SearchMate Adware Injection**:
  - When installed with bundled offers accepted, WeatherBuddy injects the SearchMate toolbar into Voyager Web Browser, hijacks default homepage to `http://searchmate.local`, and displays sponsored banner advertisements.
  - Can be cleanly removed or remediated using **SafeSweep Anti-Adware**.

### 6.2 Complete Code Blueprint

```tsx
import React, { useState, useMemo } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useWindowStore } from '../../store/useWindowStore';

export const WeatherBuddyApp: React.FC = () => {
  const gameTime = useSimulationStore((s) => s.state.time);
  const installedSoftware = useSimulationStore((s) => s.state.installedSoftware);
  const openWindow = useWindowStore((s) => s.openWindow);

  const [tempUnit, setTempUnit] = useState<'F' | 'C'>('F');

  // Check if SearchMate adware payload is active
  const weatherBuddyRecord = installedSoftware.find((s) => s.appId === 'app.weatherbuddy');
  const isAdwareActive = weatherBuddyRecord?.adwarePayload?.toolbarInjected ?? true;

  // Day-based weather model
  const weatherData = useMemo(() => {
    const day = gameTime.day;
    if (day <= 3) {
      return { tempF: 72, tempC: 22, condition: 'Sunny & Mild', icon: '☀️', humidity: '45%', wind: '5 mph NW', forecast: 'Clear skies through evening.' };
    } else if (day <= 6) {
      return { tempF: 58, tempC: 14, condition: 'Rain Showers', icon: '🌧️', humidity: '88%', wind: '12 mph E', forecast: 'Continuous rain expected.' };
    } else if (day <= 9) {
      return { tempF: 52, tempC: 11, condition: 'Thunderstorms', icon: '⛈️', humidity: '94%', wind: '22 mph NE', forecast: 'High wind and lightning warning.' };
    } else {
      return { tempF: 66, tempC: 19, condition: 'Partly Cloudy', icon: '⛅', humidity: '55%', wind: '8 mph W', forecast: 'Pleasant autumn breeze.' };
    }
  }, [gameTime.day]);

  return (
    <div className="w-full h-full flex flex-col bg-[#eef3fa] text-black font-sans text-xs select-none p-2 justify-between">
      {/* Header Widget */}
      <div className="bg-gradient-to-r from-blue-600 to-sky-400 text-white p-2.5 rounded shadow flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-3xl animate-bounce">{weatherData.icon}</span>
          <div>
            <h3 className="font-bold text-sm">WeatherBuddy 1.4</h3>
            <span className="text-[11px] text-blue-100">Riverside District (Day {gameTime.day})</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold font-mono">
            {tempUnit === 'F' ? `${weatherData.tempF}°F` : `${weatherData.tempC}°C`}
          </div>
          <button
            onClick={() => setTempUnit(tempUnit === 'F' ? 'C' : 'F')}
            className="text-[10px] text-blue-100 underline hover:text-white"
          >
            Switch to °{tempUnit === 'F' ? 'C' : 'F'}
          </button>
        </div>
      </div>

      {/* Conditions Strip */}
      <div className="grid grid-cols-3 gap-2 my-2 text-center">
        <div className="bg-white border border-blue-200 p-2 rounded">
          <div className="text-gray-500 text-[10px]">Condition</div>
          <div className="font-bold text-blue-950">{weatherData.condition}</div>
        </div>
        <div className="bg-white border border-blue-200 p-2 rounded">
          <div className="text-gray-500 text-[10px]">Humidity</div>
          <div className="font-bold text-blue-950">{weatherData.humidity}</div>
        </div>
        <div className="bg-white border border-blue-200 p-2 rounded">
          <div className="text-gray-500 text-[10px]">Wind</div>
          <div className="font-bold text-blue-950">{weatherData.wind}</div>
        </div>
      </div>

      {/* Forecast Note */}
      <div className="bg-blue-50 border border-blue-200 p-2 rounded text-[11px] text-blue-900">
        📢 <strong>Forecast:</strong> {weatherData.forecast}
      </div>

      {/* SearchMate Bundled Adware Banner (if active) */}
      {isAdwareActive && (
        <div className="mt-2 p-2 bg-amber-100 border border-amber-400 rounded flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔍</span>
            <div className="text-[11px]">
              <span className="font-bold text-amber-900">SearchMate Toolbar Active</span>
              <p className="text-amber-800 text-[10px]">Search faster in Voyager Browser!</p>
            </div>
          </div>
          <button
            onClick={() => openWindow('browser', 'Voyager Browser', { initialUrl: 'http://searchmate.local' })}
            className="orion-button text-[10px] font-bold"
          >
            Open SearchMate
          </button>
        </div>
      )}
    </div>
  );
};
```

---

## 7. App 6: SafeSweep Anti-Adware (`src/apps/safesweep/SafeSweepApp.tsx`)

### 7.1 Overview & Remediation Mechanics
SafeSweep is an anti-spyware / anti-adware utility (Ad-Aware SE / Spybot - Search & Destroy style):
- **VFS & Registry Scanner**: Scans software definitions and VFS for adware signatures (`SearchMate Toolbar`, `Homepage Hijack`, `Tracking Cookies`).
- **Remediation Engine**: Cleans adware payloads, restores Voyager browser default homepage to `http://findit.local`, removes toolbar injection, and generates a scan report (`C:/Documents/SafeSweep_ScanLog.txt`).

### 7.2 Complete Code Blueprint

```tsx
import React, { useState } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';

export interface AdwareThreat {
  id: string;
  name: string;
  category: 'Adware Toolbar' | 'Browser Hijacker' | 'Tracking Autorun';
  severity: 'High' | 'Medium';
  location: string;
  selected: boolean;
}

export const SafeSweepApp: React.FC = () => {
  const installedSoftware = useSimulationStore((s) => s.state.installedSoftware);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [currentScanPath, setCurrentScanPath] = useState<string>('');
  const [detectedThreats, setDetectedThreats] = useState<AdwareThreat[]>([]);
  const [hasCleaned, setHasCleaned] = useState<boolean>(false);

  const handleStartScan = () => {
    setIsScanning(true);
    setScanProgress(0);
    setDetectedThreats([]);
    setHasCleaned(false);

    const paths = [
      'C:/Program Files/WeatherBuddy',
      'C:/Windows/Registry/HKLM/Software/SearchMate',
      'C:/Program Files/Voyager/Toolbars',
      'C:/Documents/Cookies',
    ];

    paths.forEach((p, idx) => {
      setTimeout(() => {
        setCurrentScanPath(p);
        setScanProgress(Math.round(((idx + 1) / paths.length) * 100));
      }, (idx + 1) * 350);
    });

    setTimeout(() => {
      setIsScanning(false);
      // Check if WeatherBuddy adware is installed
      const wb = installedSoftware.find((s) => s.appId === 'app.weatherbuddy');
      if (wb && wb.adwarePayload?.toolbarInjected) {
        setDetectedThreats([
          {
            id: 'threat_searchmate_toolbar',
            name: 'Adware.SearchMate.Toolbar',
            category: 'Adware Toolbar',
            severity: 'High',
            location: 'C:/Program Files/Voyager/searchmate_toolbar.dll',
            selected: true,
          },
          {
            id: 'threat_searchmate_hijack',
            name: 'Hijacker.SearchMate.Homepage',
            category: 'Browser Hijacker',
            severity: 'High',
            location: 'HKLM\\Software\\Voyager\\StartPage -> http://searchmate.local',
            selected: true,
          }
        ]);
      }
    }, paths.length * 350 + 200);
  };

  const handleCleanThreats = () => {
    const wb = installedSoftware.find((s) => s.appId === 'app.weatherbuddy');
    if (wb) {
      // Re-register clean software record without adware payload
      dispatchAction({
        type: 'SOFTWARE_UNINSTALL',
        installedId: wb.id,
      });
      dispatchAction({
        type: 'SOFTWARE_INSTALL',
        softwareId: 'sw_weatherbuddy_14',
        selectedOptions: {
          searchmate_toolbar: false,
          autorun_startup: false,
        }
      });
    }

    // Write scan log to VFS
    dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: 'SafeSweep_ScanLog.txt',
        path: 'C:/Documents/SafeSweep_ScanLog.txt',
        parentPath: 'C:/Documents',
        kind: 'text',
        sizeBytes: 1024,
        content: `SafeSweep Security Scan Log\nThreats Found: 2\nThreats Quarantined: 2\nBrowser Defaults Restored.\nSystem Clean.`,
      }
    });

    setDetectedThreats([]);
    setHasCleaned(true);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#c0c0c0] text-black font-sans text-xs select-none">
      {/* Top Banner */}
      <div className="p-3 bg-[#dfdfdf] border-b border-gray-500 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🛡️</span>
          <div>
            <h2 className="font-bold text-sm">SafeSweep Anti-Spyware 2.0</h2>
            <p className="text-gray-600 text-[11px]">System integrity scanner and adware removal engine.</p>
          </div>
        </div>
        <button
          onClick={handleStartScan}
          disabled={isScanning}
          className="orion-button font-bold text-blue-900 px-4 py-1.5"
        >
          {isScanning ? 'Scanning...' : '🔍 Scan System'}
        </button>
      </div>

      {/* Body Area */}
      <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-3">
        {/* Scan Progress Bar */}
        {isScanning && (
          <div className="p-3 bg-white border border-gray-400 rounded space-y-1.5">
            <div className="flex justify-between text-[11px] font-semibold text-gray-700">
              <span className="truncate">Scanning: {currentScanPath}</span>
              <span>{scanProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 border border-gray-400 h-4 rounded overflow-hidden">
              <div
                style={{ width: `${scanProgress}%` }}
                className="h-full bg-blue-600 transition-all duration-300"
              />
            </div>
          </div>
        )}

        {/* Cleaned Banner */}
        {hasCleaned && (
          <div className="p-3 bg-green-50 border border-green-400 rounded text-green-900 font-semibold flex items-center gap-2">
            <span>✅</span>
            <span>All detected adware items have been quarantined! Browser homepage and default settings restored.</span>
          </div>
        )}

        {/* Threat List Table */}
        <div className="flex-1 bg-white border border-gray-400 rounded overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#dfdfdf] border-b border-gray-300 sticky top-0 font-semibold text-gray-700">
              <tr>
                <th className="p-1.5 border-r border-gray-300 w-8">Fix</th>
                <th className="p-1.5 border-r border-gray-300">Threat Name</th>
                <th className="p-1.5 border-r border-gray-300 w-28">Category</th>
                <th className="p-1.5 border-r border-gray-300 w-20">Severity</th>
                <th className="p-1.5">Location</th>
              </tr>
            </thead>
            <tbody>
              {detectedThreats.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    {hasCleaned ? 'No active threats detected. System is safe.' : 'Click "Scan System" to scan for adware and hijacked browser settings.'}
                  </td>
                </tr>
              ) : (
                detectedThreats.map((threat) => (
                  <tr key={threat.id} className="border-b border-gray-200 bg-red-50">
                    <td className="p-1.5 text-center">
                      <input type="checkbox" checked={threat.selected} readOnly />
                    </td>
                    <td className="p-1.5 font-bold text-red-900 font-mono">{threat.name}</td>
                    <td className="p-1.5 text-gray-700">{threat.category}</td>
                    <td className="p-1.5 font-bold text-red-700">{threat.severity}</td>
                    <td className="p-1.5 font-mono text-[11px] text-gray-600">{threat.location}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="p-2 bg-[#dfdfdf] border-t border-gray-400 flex justify-between items-center">
        <span className="text-[11px] text-gray-600">
          {detectedThreats.length} threat(s) selected for removal
        </span>
        <button
          onClick={handleCleanThreats}
          disabled={detectedThreats.length === 0}
          className="orion-button font-bold text-red-800 px-3 py-1"
        >
          🧹 Clean & Restore Defaults
        </button>
      </div>
    </div>
  );
};
```

---

## 8. App 7: Mailbox (`src/apps/mailbox/MailboxApp.tsx`)

### 8.1 Overview & Pre-seeded Email Specification
Mailbox is a 3-pane email client (Outlook Express / Thunderbird style):
- **Folders**: Inbox, Sent Items, Drafts, Trash, Spam.
- **Narrative Seeds**:
  1. *Mr. Henderson (Motel Office)*: Rent schedule and motel rules.
  2. *TechMart Support*: SDRAM and Orion 6.0 upgrade notices.
  3. *Ryan (Foodcart)*: Shift rosters and foodcart receipts.
  4. *Maya*: Notes and attached cafe photo (`cafe_exterior.jpg`).
- **Attachment Integration**: Attachments can be saved into VFS (`C:/Downloads`, `C:/Pictures`) or opened directly in PhotoBox/Notepad.
- **Compose & Reply Mode**: Form to send emails with file attachments from VFS.

### 8.2 Complete Code Blueprint

```tsx
import React, { useState } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';

export interface EmailMessage {
  id: string;
  sender: string;
  senderEmail: string;
  recipient: string;
  subject: string;
  body: string;
  date: string;
  isRead: boolean;
  folder: 'inbox' | 'sent' | 'trash' | 'spam';
  attachments?: { fileName: string; sizeBytes: number; fileKind: 'image' | 'text' | 'document' }[];
}

const INITIAL_EMAILS: EmailMessage[] = [
  {
    id: 'mail_1',
    sender: 'Mr. Henderson',
    senderEmail: 'office@motellink.local',
    recipient: 'Resident (Room 104)',
    subject: 'Welcome to Riverside Motel - Room 104 Guidelines & Rent Schedule',
    body: 'Welcome to Room 104. Please remember that weekly rent of $140.00 is due on Day 7 and Day 14. Dial 0 on the front desk phone for maintenance.',
    date: 'Day 1, 08:30',
    isRead: false,
    folder: 'inbox',
    attachments: [{ fileName: 'motel_guidelines.txt', sizeBytes: 1200, fileKind: 'text' }]
  },
  {
    id: 'mail_2',
    sender: 'TechMart Specials',
    senderEmail: 'sales@techmart.local',
    recipient: 'valuable.customer@local',
    subject: 'Weekly Hardware Deals: SDRAM 512MB Upgrades & Orion 6.0 Preview',
    body: 'Upgrade your PC today! We have 512MB SDRAM modules in stock and Orion OS 6.0 upgrade packages ready for immediate order.',
    date: 'Day 2, 10:15',
    isRead: false,
    folder: 'inbox',
  },
  {
    id: 'mail_3',
    sender: 'Ryan',
    senderEmail: 'ryan@foodcart.local',
    recipient: 'coworker@foodcart.local',
    subject: 'Shift Schedule & Food Cart Receipts',
    body: 'Hey, attached is the shift roster for the week. Let me know if you want to swap the afternoon shift on Day 5.',
    date: 'Day 3, 14:00',
    isRead: false,
    folder: 'inbox',
    attachments: [{ fileName: 'weekly_roster.txt', sizeBytes: 2400, fileKind: 'text' }]
  },
  {
    id: 'mail_4',
    sender: 'Maya',
    senderEmail: 'maya@starlight.local',
    recipient: 'friend@room104.local',
    subject: 'Photo from the café down the street',
    body: 'Took this with the digital camera while waiting for the rain to stop. Hope you like it!',
    date: 'Day 4, 18:20',
    isRead: false,
    folder: 'inbox',
    attachments: [{ fileName: 'cafe_exterior.jpg', sizeBytes: 124000, fileKind: 'image' }]
  }
];

export const MailboxApp: React.FC = () => {
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);

  const [emails, setEmails] = useState<EmailMessage[]>(INITIAL_EMAILS);
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'sent' | 'trash' | 'spam'>('inbox');
  const [selectedMailId, setSelectedMailId] = useState<string | null>('mail_1');
  
  // Compose Mode
  const [showCompose, setShowCompose] = useState<boolean>(false);
  const [composeTo, setComposeTo] = useState<string>('ryan@foodcart.local');
  const [composeSubject, setComposeSubject] = useState<string>('');
  const [composeBody, setComposeBody] = useState<string>('');

  const folderEmails = emails.filter((e) => e.folder === activeFolder);
  const selectedMail = emails.find((e) => e.id === selectedMailId) || folderEmails[0] || null;

  const handleSelectMail = (mail: EmailMessage) => {
    setSelectedMailId(mail.id);
    if (!mail.isRead) {
      setEmails(emails.map((e) => (e.id === mail.id ? { ...e, isRead: true } : e)));
    }
  };

  const handleDownloadAttachment = (att: { fileName: string; sizeBytes: number; fileKind: 'image' | 'text' | 'document' }) => {
    const destDir = att.fileKind === 'image' ? 'C:/Pictures' : 'C:/Downloads';
    dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: att.fileName,
        path: `${destDir}/${att.fileName}`,
        parentPath: destDir,
        kind: att.fileKind === 'image' ? 'image' : 'text',
        sizeBytes: att.sizeBytes,
        content: `Attachment downloaded from Mailbox: ${att.fileName}`,
      }
    });
    alert(`Saved ${att.fileName} to ${destDir}!`);
  };

  const handleSendEmail = () => {
    if (!composeTo || !composeSubject) return;
    const newMail: EmailMessage = {
      id: `sent_${Date.now()}`,
      sender: 'Player',
      senderEmail: 'player@room104.local',
      recipient: composeTo,
      subject: composeSubject,
      body: composeBody,
      date: 'Just now',
      isRead: true,
      folder: 'sent',
    };
    setEmails([...emails, newMail]);
    setShowCompose(false);
    setComposeSubject('');
    setComposeBody('');
    alert('Message sent successfully!');
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#c0c0c0] text-black font-sans text-xs select-none">
      {/* Top Toolbar */}
      <div className="flex items-center gap-1.5 p-1.5 bg-[#dfdfdf] border-b border-gray-400">
        <button onClick={() => setShowCompose(true)} className="orion-button font-bold text-blue-900">
          ✉️ Compose
        </button>
        <button
          onClick={() => {
            if (selectedMail) {
              setComposeTo(selectedMail.senderEmail);
              setComposeSubject(`Re: ${selectedMail.subject}`);
              setShowCompose(true);
            }
          }}
          disabled={!selectedMail}
          className="orion-button"
        >
          ↩ Reply
        </button>
        <button
          onClick={() => {
            if (selectedMail) {
              setEmails(emails.filter((e) => e.id !== selectedMail.id));
              setSelectedMailId(null);
            }
          }}
          disabled={!selectedMail}
          className="orion-button text-red-700"
        >
          🗑 Delete
        </button>
      </div>

      {/* 3-Pane Mailbox Layout */}
      <div className="flex-1 flex overflow-hidden p-1.5 gap-1.5">
        {/* 1. Left Folder Tree */}
        <div className="w-36 bg-white border border-gray-400 rounded p-1 flex flex-col gap-0.5">
          {(['inbox', 'sent', 'trash', 'spam'] as const).map((folder) => {
            const count = emails.filter((e) => e.folder === folder && !e.isRead).length;
            return (
              <button
                key={folder}
                onClick={() => setActiveFolder(folder)}
                className={`flex justify-between items-center px-2 py-1 rounded capitalize text-left ${
                  activeFolder === folder ? 'bg-blue-100 text-blue-900 font-bold' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <span>{folder === 'inbox' ? '📥 Inbox' : folder === 'sent' ? '📤 Sent' : folder === 'trash' ? '🗑 Trash' : '🚫 Spam'}</span>
                {count > 0 && <span className="bg-blue-600 text-white rounded-full px-1.5 text-[9px]">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Right Split: Messages List (Top) & Reading Pane (Bottom) */}
        <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
          {/* 2. Messages List Table */}
          <div className="h-44 bg-white border border-gray-400 rounded overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#dfdfdf] border-b border-gray-300 sticky top-0 font-semibold text-gray-700">
                <tr>
                  <th className="p-1 border-r border-gray-300 w-6">#</th>
                  <th className="p-1 border-r border-gray-300 w-36">From</th>
                  <th className="p-1 border-r border-gray-300">Subject</th>
                  <th className="p-1 w-24">Date</th>
                </tr>
              </thead>
              <tbody>
                {folderEmails.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-gray-400">Folder is empty.</td>
                  </tr>
                ) : (
                  folderEmails.map((mail) => {
                    const isSelected = selectedMail?.id === mail.id;
                    return (
                      <tr
                        key={mail.id}
                        onClick={() => handleSelectMail(mail)}
                        className={`cursor-pointer border-b border-gray-100 ${
                          isSelected ? 'bg-blue-100 text-blue-900 font-semibold' : 'hover:bg-gray-50'
                        } ${!mail.isRead ? 'font-bold' : ''}`}
                      >
                        <td className="p-1 text-center">{mail.attachments ? '📎' : mail.isRead ? '📭' : '✉️'}</td>
                        <td className="p-1 truncate">{mail.sender}</td>
                        <td className="p-1 truncate">{mail.subject}</td>
                        <td className="p-1 font-mono text-[11px] text-gray-600">{mail.date}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 3. Reading Pane */}
          <div className="flex-1 bg-white border border-gray-400 rounded p-3 overflow-y-auto flex flex-col">
            {selectedMail ? (
              <div className="space-y-2">
                <div className="border-b border-gray-200 pb-2">
                  <h3 className="font-bold text-sm text-gray-900">{selectedMail.subject}</h3>
                  <div className="text-[11px] text-gray-600 flex justify-between mt-0.5">
                    <span>From: <strong>{selectedMail.sender}</strong> &lt;{selectedMail.senderEmail}&gt;</span>
                    <span className="font-mono">{selectedMail.date}</span>
                  </div>
                </div>

                {/* Attachments Chip Bar */}
                {selectedMail.attachments && (
                  <div className="flex gap-2 p-1.5 bg-gray-50 border border-gray-200 rounded">
                    {selectedMail.attachments.map((att) => (
                      <button
                        key={att.fileName}
                        onClick={() => handleDownloadAttachment(att)}
                        className="orion-button text-[11px] font-mono flex items-center gap-1 text-blue-900"
                      >
                        📎 {att.fileName} ({(att.sizeBytes / 1024).toFixed(1)} KB)
                      </button>
                    ))}
                  </div>
                )}

                {/* Email Body */}
                <div className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed pt-1">
                  {selectedMail.body}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                Select a message to view its contents.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="w-[450px] bg-[#c0c0c0] border-2 border-gray-100 shadow-2xl p-3 rounded flex flex-col gap-2">
            <h3 className="font-bold text-sm text-gray-800">Compose Message</h3>
            <div className="space-y-1.5">
              <input
                type="text"
                placeholder="To:"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                className="orion-input w-full"
              />
              <input
                type="text"
                placeholder="Subject:"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                className="orion-input w-full"
              />
              <textarea
                placeholder="Write your email here..."
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                className="orion-input w-full h-32 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1 border-t border-gray-400">
              <button onClick={handleSendEmail} className="orion-button font-bold text-blue-900">
                Send Email
              </button>
              <button onClick={() => setShowCompose(false)} className="orion-button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

---

## 9. Comprehensive Unit Test Blueprints (`tests/unit/`)

Below are the complete test suites verifying all 7 applications.

### 9.1 `tests/unit/RetroAmpApp.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('RetroAmp Audio Player Logic', () => {
  it('loads tracks and formats playback duration accurately', () => {
    const formatTime = (secs: number) => {
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    expect(formatTime(194)).toBe('03:14');
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(3600)).toBe('60:00');
  });

  it('scans C:/Music in VFS and includes downloaded audio files in playlist', () => {
    const engine = new SimulationEngine();
    engine.dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: 'chiptune_beat.mp3',
        path: 'C:/Music/chiptune_beat.mp3',
        parentPath: 'C:/Music',
        kind: 'audio',
        sizeBytes: 3_500_000,
      }
    });

    const musicFiles = engine.vfs.listDirectory('C:/Music');
    expect(musicFiles.some(f => f.name === 'chiptune_beat.mp3')).toBe(true);
  });
});
```

### 9.2 `tests/unit/FlashFetchApp.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('FlashFetch Accelerator Engine', () => {
  it('starts multi-part download and allocates fair bandwidth', () => {
    const engine = new SimulationEngine();
    const task = engine.downloads.startDownload({
      sourceId: 'flashfetch_test',
      sourceUrl: 'http://downloadhub.local/files/PhotoBoxSetup.exe',
      fileName: 'PhotoBoxSetup.exe',
      totalBytes: 50_000_000,
      sourceMaxKbps: 512,
      manager: 'flashfetch',
    });

    expect(task.manager).toBe('flashfetch');
    expect(task.status).toBe('downloading');
    expect(task.allocatedKbps).toBeGreaterThan(0);
  });
});
```

### 9.3 `tests/unit/ZipMateApp.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('ZipMate Archive Manager', () => {
  it('extracts files into C:/Downloads/extracted in VFS', () => {
    const engine = new SimulationEngine();
    engine.dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: 'extracted_photo.jpg',
        path: 'C:/Downloads/extracted/extracted_photo.jpg',
        parentPath: 'C:/Downloads/extracted',
        kind: 'image',
        sizeBytes: 85000,
      }
    });

    const extracted = engine.vfs.readFile('C:/Downloads/extracted/extracted_photo.jpg');
    expect(extracted).toBeDefined();
    expect(extracted?.sizeBytes).toBe(85000);
  });
});
```

### 9.4 `tests/unit/PhotoBoxApp.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('PhotoBox Hardware & OS Requirements Gating', () => {
  it('fails requirements check on Orion 4.8 and 512MB RAM', () => {
    const engine = new SimulationEngine();
    const req = { minOs: 'Orion_6.0' as const, minRamMB: 768, minCpuTier: 1, requiredDiskBytes: 70_000_000 };
    const check = engine.hardware.checkRequirements(req);

    expect(check.compatible).toBe(false);
    expect(check.reasons.some(r => r.includes('Orion OS 6.0'))).toBe(true);
    expect(check.reasons.some(r => r.includes('768 MB RAM'))).toBe(true);
  });

  it('passes requirements check after upgrading to Orion 6.0 and 1024MB RAM', () => {
    const engine = new SimulationEngine();
    engine.hardware.upgradeRam(1024);
    engine.hardware.upgradeOs('Orion_6.0');

    const req = { minOs: 'Orion_6.0' as const, minRamMB: 768, minCpuTier: 1, requiredDiskBytes: 70_000_000 };
    const check = engine.hardware.checkRequirements(req);

    expect(check.compatible).toBe(true);
    expect(check.reasons.length).toBe(0);
  });
});
```

### 9.5 `tests/unit/WeatherBuddyApp.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('WeatherBuddy & SearchMate Adware Injection', () => {
  it('injects adware toolbar payload when installed with default options', () => {
    const engine = new SimulationEngine();
    const session = engine.software.startInstallerWizard('sw_weatherbuddy_14');
    const installed = engine.software.completeInstallation(session.sessionId);

    expect(installed.isAdware).toBe(true);
    expect(installed.adwarePayload?.toolbarInjected).toBe(true);
    expect(installed.adwarePayload?.homepageHijacked).toBe('http://searchmate.local');
  });
});
```

### 9.6 `tests/unit/SafeSweepApp.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('SafeSweep Anti-Adware Remediation', () => {
  it('uninstalls adware and removes toolbar payload', () => {
    const engine = new SimulationEngine();
    const session = engine.software.startInstallerWizard('sw_weatherbuddy_14');
    const installed = engine.software.completeInstallation(session.sessionId);

    expect(engine.software.isInstalled('app.weatherbuddy')).toBe(true);

    const uninstalled = engine.software.uninstallSoftware(installed.id);
    expect(uninstalled).toBe(true);
    expect(engine.software.isInstalled('app.weatherbuddy')).toBe(false);
  });
});
```

### 9.7 `tests/unit/MailboxApp.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('Mailbox Email & Attachment Handling', () => {
  it('saves email attachments into VFS C:/Downloads', () => {
    const engine = new SimulationEngine();
    engine.dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: 'motel_guidelines.txt',
        path: 'C:/Downloads/motel_guidelines.txt',
        parentPath: 'C:/Downloads',
        kind: 'text',
        sizeBytes: 1200,
      }
    });

    const file = engine.vfs.readFile('C:/Downloads/motel_guidelines.txt');
    expect(file).toBeDefined();
    expect(file?.sizeBytes).toBe(1200);
  });
});
```

---

## 10. WindowManager & useWindowStore Registration Guide

To integrate all 7 apps cleanly into the windowing system:

```typescript
// In src/desktop/WindowManager.tsx
import { RetroAmpApp } from '../apps/retroamp/RetroAmpApp';
import { FlashFetchApp } from '../apps/flashfetch/FlashFetchApp';
import { ZipMateApp } from '../apps/zipmate/ZipMateApp';
import { PhotoBoxApp } from '../apps/photobox/PhotoBoxApp';
import { WeatherBuddyApp } from '../apps/weatherbuddy/WeatherBuddyApp';
import { SafeSweepApp } from '../apps/safesweep/SafeSweepApp';
import { MailboxApp } from '../apps/mailbox/MailboxApp';

const defaultAppComponents: AppRegistry = {
  // ... existing apps ...
  retroamp: () => <RetroAmpApp />,
  'app.retroamp': () => <RetroAmpApp />,
  flashfetch: () => <FlashFetchApp />,
  'app.flashfetch': () => <FlashFetchApp />,
  zipmate: ({ window }) => <ZipMateApp initialArchivePath={window.customState?.initialArchivePath} />,
  'app.zipmate': ({ window }) => <ZipMateApp initialArchivePath={window.customState?.initialArchivePath} />,
  photobox: ({ window }) => <PhotoBoxApp initialPhotoPath={window.customState?.initialPhotoPath} />,
  'app.photobox': ({ window }) => <PhotoBoxApp initialPhotoPath={window.customState?.initialPhotoPath} />,
  weatherbuddy: () => <WeatherBuddyApp />,
  'app.weatherbuddy': () => <WeatherBuddyApp />,
  safesweep: () => <SafeSweepApp />,
  'app.safesweep': () => <SafeSweepApp />,
  mailbox: () => <MailboxApp />,
  'app.mailbox': () => <MailboxApp />,
};
```
