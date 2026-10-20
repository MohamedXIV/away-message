import React, { useState, useEffect, useRef } from 'react';

export interface TrackItem {
  id: string;
  title: string;
  artist: string;
  durationSeconds: number;
  bitrateKbps: number;
  filePath: string;
  /** Genuine, bounded WAV from a specifically opened VFS file. */
  src: string;
}

const EQ_FREQUENCIES = ['60Hz', '170Hz', '310Hz', '600Hz', '1kHz', '3kHz', '6kHz', '12kHz', '14kHz', '16kHz'];

export const RetroAmpApp: React.FC<{
  tracks?: TrackItem[];
  onAddFile?: () => void;
}> = ({ tracks = [], onAddFile }) => {
  const [hiddenPaths, setHiddenPaths] = useState<string[]>([]);
  const playlist = tracks.filter(track => !hiddenPaths.includes(track.filePath));
  const audioRef = useRef<HTMLAudioElement>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const eqRef = useRef<BiquadFilterNode[]>([]);
  const panRef = useRef<StereoPannerNode | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  const [volume, setVolume] = useState(80);
  const [balance, setBalance] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isEqOpen, setIsEqOpen] = useState(true);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(true);
  const [eqGains, setEqGains] = useState<number[]>([2, 4, 3, 0, -1, 1, 3, 5, 4, 2]);

  // Visualizer animated bars (19 bars)
  const [visHeights, setVisHeights] = useState<number[]>(new Array(19).fill(2));

  const currentTrack = playlist[currentTrackIndex] ?? null;

  const setupAudioGraph = () => {
    const audio = audioRef.current;
    if (!audio || contextRef.current || typeof AudioContext === 'undefined') return;
    try {
      const context = new AudioContext();
      const input = context.createMediaElementSource(audio);
      const filters = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000]
        .map((hz, index) => {
          const filter = context.createBiquadFilter();
          filter.type = index === 0 ? 'lowshelf' : index === 9 ? 'highshelf' : 'peaking';
          filter.frequency.value = hz;
          filter.Q.value = 1;
          filter.gain.value = eqGains[index] ?? 0;
          return filter;
        });
      const pan = context.createStereoPanner();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      let node: AudioNode = input;
      for (const filter of filters) { node.connect(filter); node = filter; }
      node.connect(pan);
      pan.connect(analyser);
      analyser.connect(context.destination);
      contextRef.current = context;
      analyserRef.current = analyser;
      eqRef.current = filters;
      panRef.current = pan;
      pan.pan.value = balance / 10;
    } catch {
      // Browser media playback still works if optional WebAudio DSP is unavailable.
    }
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);
  useEffect(() => { if (panRef.current) panRef.current.pan.value = balance / 10; }, [balance]);
  useEffect(() => {
    eqRef.current.forEach((filter, i) => { filter.gain.value = eqGains[i] ?? 0; });
  }, [eqGains]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying && currentTrack) {
      void audio.play().catch(() => {
        setIsPlaying(false);
        setPlayError('Playback was blocked or the WAV could not be decoded.');
      });
    } else audio.pause();
  }, [isPlaying, currentTrack?.id, currentTrack?.src]);

  useEffect(() => {
    let frame = 0;
    if (isPlaying && analyserRef.current) {
      const analyzer = analyserRef.current;
      const samples = new Uint8Array(analyzer.frequencyBinCount);
      const draw = () => {
        analyzer.getByteFrequencyData(samples);
        setVisHeights(Array.from({ length: 19 }, (_, i) =>
          Math.max(1, Math.round((samples[Math.min(samples.length - 1,
            Math.floor(i * samples.length / 19))] ?? 0) / 255 * 20))));
        frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    } else setVisHeights(new Array(19).fill(1));
    return () => cancelAnimationFrame(frame);
  }, [isPlaying]);
  useEffect(() => () => {
    audioRef.current?.pause();
    void contextRef.current?.close();
  }, []);

  const handlePlay = () => {
    if (!currentTrack) { setPlayError('Import a real WAV into C:/Music first.'); return; }
    setupAudioGraph();
    void contextRef.current?.resume();
    setPlayError(null);
    setIsPlaying(true);
  };
  const handlePause = () => { audioRef.current?.pause(); setIsPlaying(false); };
  const handleStop = () => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setIsPlaying(false); setPlaybackSeconds(0);
  };
  const handlePrevTrack = () => {
    if (!playlist.length) return;
    setCurrentTrackIndex(i => (i > 0 ? i - 1 : playlist.length - 1));
    setPlaybackSeconds(0);
  };
  const handleNextTrack = () => {
    if (!playlist.length) return;
    setCurrentTrackIndex(i => isShuffle
      ? (i + 1 + Math.floor(Math.random() * Math.max(1, playlist.length - 1))) % playlist.length
      : (i + 1) % playlist.length);
    setPlaybackSeconds(0);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  return (
    <div className="w-full h-full bg-[#1e2022] text-[#00ff00] font-mono text-xs select-none flex flex-col p-2 gap-2 border-2 border-gray-600 shadow-2xl overflow-y-auto">
      <audio ref={audioRef} preload="metadata" src={currentTrack?.src}
        data-testid="retroamp-real-audio"
        onTimeUpdate={e => setPlaybackSeconds(e.currentTarget.currentTime)}
        onLoadedMetadata={e => setPlaybackSeconds(e.currentTarget.currentTime)}
        onEnded={() => { if (playlist.length > 1) handleNextTrack(); else setIsPlaying(false); }}
        onError={() => { if (currentTrack) setPlayError('Unsupported or corrupt WAV audio.'); setIsPlaying(false); }} />
      {playError && <p role="alert" className="text-yellow-300">{playError}</p>}
      {/* Main Player Module */}
      <div className="bg-[#2a2d32] border-2 border-gray-500 rounded p-2.5 shadow-inner">
        {/* Title Bar / Marquee */}
        <div className="bg-black border border-gray-700 p-1.5 rounded flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            <span className="bg-green-900 text-green-300 font-bold px-1 text-[10px] rounded">
              {currentTrack?.bitrateKbps ? currentTrack.bitrateKbps + ' kbps' : 'WAV'}
            </span>
            <div className="truncate text-green-400 font-bold text-xs">
              {isPlaying ? '▶' : '⏸'} {currentTrack ? `${currentTrackIndex + 1}. ${currentTrack.artist} - ${currentTrack.title}` : 'No actual audio loaded'}
            </div>
          </div>
          <span className="text-green-300 font-bold text-xs ml-2 shrink-0">
            {formatTime(playbackSeconds)} / {formatTime(audioRef.current?.duration || currentTrack?.durationSeconds || 0)}
          </span>
        </div>

        {/* Oscilloscope / Spectrum Visualizer */}
        <div className="bg-black border border-green-950 p-1.5 rounded h-12 flex items-end justify-between gap-1 mb-2">
          {visHeights.map((height, i) => (
            <div
              key={i}
              className="flex-1 bg-gradient-to-t from-green-600 via-yellow-400 to-red-500 rounded-xs transition-all duration-100"
              style={{ height: `${(height / 20) * 100}%` }}
            />
          ))}
        </div>

        {/* Transport Controls */}
        <div className="flex items-center justify-between bg-[#1f2226] p-1.5 rounded border border-gray-700">
          <div className="flex gap-1">
            <button
              onClick={handlePrevTrack}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs font-bold"
              title="Previous"
            >
              ⏮
            </button>
            {isPlaying ? (
              <button
                onClick={handlePause}
                className="px-2.5 py-1 bg-yellow-600 hover:bg-yellow-500 text-black rounded text-xs font-bold"
                title="Pause"
              >
                ⏸
              </button>
            ) : (
              <button
                onClick={handlePlay}
                className="px-2.5 py-1 bg-green-600 hover:bg-green-500 text-black rounded text-xs font-bold"
                title="Play"
              >
                ▶
              </button>
            )}
            <button
              onClick={handleStop}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs font-bold"
              title="Stop"
            >
              ⏹
            </button>
            <button
              onClick={handleNextTrack}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs font-bold"
              title="Next"
            >
              ⏭
            </button>
          </div>

          {/* Volume & Balance Sliders */}
          <div className="flex items-center gap-3 text-[10px] text-gray-300">
            <div className="flex items-center gap-1">
              <span>VOL:</span>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
              <span className="w-5 text-right">{volume}%</span>
            </div>

            <div className="flex items-center gap-1">
              <span>BAL:</span>
              <input
                type="range"
                min={-10}
                max={10}
                value={balance}
                onChange={(e) => setBalance(Number(e.target.value))}
                className="w-12 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Toggle Module Buttons */}
          <div className="flex gap-1 text-[10px]">
            <button
              onClick={() => setIsEqOpen(!isEqOpen)}
              className={`px-1.5 py-0.5 rounded font-bold ${isEqOpen ? 'bg-green-700 text-white' : 'bg-gray-700 text-gray-400'}`}
            >
              EQ
            </button>
            <button
              onClick={() => setIsPlaylistOpen(!isPlaylistOpen)}
              className={`px-1.5 py-0.5 rounded font-bold ${isPlaylistOpen ? 'bg-green-700 text-white' : 'bg-gray-700 text-gray-400'}`}
            >
              PL
            </button>
            <button
              onClick={() => setIsShuffle(!isShuffle)}
              className={`px-1.5 py-0.5 rounded font-bold ${isShuffle ? 'bg-green-700 text-white' : 'bg-gray-700 text-gray-400'}`}
            >
              SHUF
            </button>
          </div>
        </div>
      </div>

      {/* 10-Band Graphic Equalizer Module */}
      {isEqOpen && (
        <div className="bg-[#2a2d32] border-2 border-gray-500 rounded p-2 shadow-inner">
          <div className="text-[11px] font-bold text-green-400 mb-1.5 flex justify-between">
            <span>10-BAND GRAPHIC EQUALIZER</span>
            <span className="text-gray-400 text-[10px]">PRESET: LO-FI DUST</span>
          </div>
          <div className="flex justify-between items-center gap-1 bg-black p-2 rounded">
            {EQ_FREQUENCIES.map((freq, idx) => (
              <div key={freq} className="flex flex-col items-center gap-1 flex-1">
                <input
                  type="range"
                  min={-12}
                  max={12}
                  value={eqGains[idx]}
                  onChange={(e) => {
                    const nextGains = [...eqGains];
                    nextGains[idx] = Number(e.target.value);
                    setEqGains(nextGains);
                  }}
                  className="h-16 w-1 bg-gray-700 rounded appearance-none cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
                />
                <span className="text-[8px] text-gray-400">{freq}</span>
                <span className="text-[8px] text-green-500">{(eqGains[idx] || 0) > 0 ? `+${eqGains[idx]}` : eqGains[idx]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Playlist Editor Module */}
      {isPlaylistOpen && (
        <div className="bg-[#2a2d32] border-2 border-gray-500 rounded p-2 shadow-inner flex-1 flex flex-col min-h-[120px]">
          <div className="text-[11px] font-bold text-green-400 mb-1 flex justify-between items-center">
            <span>PLAYLIST ({playlist.length} TRACKS)</span>
            <span className="text-gray-400 text-[10px]">
              TOTAL: {formatTime(playlist.reduce((acc, t) => acc + t.durationSeconds, 0))}
            </span>
          </div>

          <div className="flex-1 bg-black border border-gray-700 rounded p-1 overflow-y-auto space-y-0.5 max-h-36">
            {playlist.map((track, idx) => (
              <div
                key={track.id}
                onDoubleClick={() => {
                  setCurrentTrackIndex(idx);
                  setupAudioGraph();
                  setIsPlaying(true);
                }}
                className={`flex justify-between items-center p-1 rounded text-xs cursor-pointer ${
                  idx === currentTrackIndex
                    ? 'bg-green-950 text-green-300 font-bold'
                    : 'text-gray-400 hover:bg-gray-800'
                }`}
              >
                <span className="truncate flex-1">
                  {idx + 1}. {track.artist} - {track.title}
                </span>
                <span className="text-[10px] text-gray-500 ml-2">{formatTime(track.durationSeconds)}</span>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-gray-300">Actual VFS-backed WAV only. Import makes one authored motel track; no pretend MP3 downloads.</p>
          {/* Playlist Footer */}
          <div className="flex justify-between items-center pt-1.5 text-[10px]">
            <button
              onClick={() => { setHiddenPaths([]); setCurrentTrackIndex(0); onAddFile?.(); }}
              disabled={!onAddFile}
              className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-white rounded"
            >
              + ADD WAV
            </button>
            <button
              onClick={() => { setHiddenPaths(playlist.map(track => track.filePath)); handleStop(); setCurrentTrackIndex(0); }}
              className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-white rounded"
            >
              CLEAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
