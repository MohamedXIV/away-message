import React, { useState, useEffect } from 'react';
import { soundManager } from '../../audio/SoundManager';

interface TrackItem {
  id: string;
  title: string;
  artist: string;
  durationSeconds: number;
  bitrateKbps: number;
  filePath: string;
}

const DEFAULT_PLAYLIST: TrackItem[] = [
  {
    id: 'tr_1',
    title: 'Rain Over Motel (Lo-Fi Cut)',
    artist: 'wanderer06',
    durationSeconds: 184,
    bitrateKbps: 192,
    filePath: 'C:/Music/rain_over_motel.mp3',
  },
  {
    id: 'tr_2',
    title: 'Late Night Dialup Drone',
    artist: 'nocturne_labs',
    durationSeconds: 245,
    bitrateKbps: 128,
    filePath: 'C:/Music/dialup_drone.mp3',
  },
  {
    id: 'tr_3',
    title: 'Neon Blinds & Puddle Glare',
    artist: 'maya_x',
    durationSeconds: 160,
    bitrateKbps: 256,
    filePath: 'C:/Music/neon_blinds.mp3',
  },
  {
    id: 'tr_4',
    title: '4th Street Diner Echoes',
    artist: 'tacocart_ryan',
    durationSeconds: 210,
    bitrateKbps: 320,
    filePath: 'C:/Music/diner_echoes.mp3',
  },
];

const EQ_FREQUENCIES = ['60Hz', '170Hz', '310Hz', '600Hz', '1kHz', '3kHz', '6kHz', '12kHz', '14kHz', '16kHz'];

export const RetroAmpApp: React.FC = () => {
  const [playlist, setPlaylist] = useState<TrackItem[]>(DEFAULT_PLAYLIST);
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

  const currentTrack = playlist[currentTrackIndex] || playlist[0] || DEFAULT_PLAYLIST[0]!;

  // Playback timer & visualizer loop
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setPlaybackSeconds((prev) => {
          if (prev >= currentTrack.durationSeconds) {
            handleNextTrack();
            return 0;
          }
          return prev + 1;
        });

        // Animate visualizer spectrum
        setVisHeights((_) =>
          Array.from({ length: 19 }, () => Math.floor(Math.random() * 18) + 2)
        );
      }, 1000);
    } else {
      setVisHeights(new Array(19).fill(1));
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, currentTrack]);

  const handlePlay = () => {
    setIsPlaying(true);
    soundManager.play('im_recv');
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setPlaybackSeconds(0);
  };

  const handlePrevTrack = () => {
    setCurrentTrackIndex((prev) => (prev > 0 ? prev - 1 : playlist.length - 1));
    setPlaybackSeconds(0);
  };

  const handleNextTrack = () => {
    if (isShuffle) {
      const nextIdx = Math.floor(Math.random() * playlist.length);
      setCurrentTrackIndex(nextIdx);
    } else {
      setCurrentTrackIndex((prev) => (prev < playlist.length - 1 ? prev + 1 : 0));
    }
    setPlaybackSeconds(0);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  return (
    <div className="w-full h-full bg-[#1e2022] text-[#00ff00] font-mono text-xs select-none flex flex-col p-2 gap-2 border-2 border-gray-600 shadow-2xl overflow-y-auto">
      {/* Main Player Module */}
      <div className="bg-[#2a2d32] border-2 border-gray-500 rounded p-2.5 shadow-inner">
        {/* Title Bar / Marquee */}
        <div className="bg-black border border-gray-700 p-1.5 rounded flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            <span className="bg-green-900 text-green-300 font-bold px-1 text-[10px] rounded">
              {currentTrack.bitrateKbps} kbps
            </span>
            <div className="truncate text-green-400 font-bold text-xs">
              {isPlaying ? '▶' : '⏸'} {currentTrackIndex + 1}. {currentTrack.artist} - {currentTrack.title}
            </div>
          </div>
          <span className="text-green-300 font-bold text-xs ml-2 shrink-0">
            {formatTime(playbackSeconds)} / {formatTime(currentTrack.durationSeconds)}
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

          {/* Playlist Footer */}
          <div className="flex justify-between items-center pt-1.5 text-[10px]">
            <button
              onClick={() => {
                setPlaylist((prev) => [
                  ...prev,
                  {
                    id: `tr_${Date.now()}`,
                    title: 'New Track from C:/Music',
                    artist: 'Unknown',
                    durationSeconds: 195,
                    bitrateKbps: 192,
                    filePath: 'C:/Music/new_track.mp3',
                  },
                ]);
              }}
              className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-white rounded"
            >
              + ADD FILE
            </button>
            <button
              onClick={() => setPlaylist([])}
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
