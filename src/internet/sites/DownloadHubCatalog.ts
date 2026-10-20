/** Authored, read-only in-game software listings shared by both Owner and UI.
 * No React/DOM, no simulation state, no internet requests.
 */
export interface DownloadItem {
  id: string;
  name: string;
  category: 'Utilities' | 'Multimedia' | 'Internet' | 'Security';
  version: string;
  fileSizeBytes: number;
  downloadUrl: string;
  description: string;
  isAdwareBundle?: boolean;
}

export const DOWNLOAD_CATALOG: DownloadItem[] = [
  {
    id: 'pulse_52',
    name: 'Pulse Messenger 5.2 Classic',
    category: 'Internet',
    version: '5.2.1',
    fileSizeBytes: 1024 * 1024 * 6,
    downloadUrl: 'http://downloadhub.local/files/pulse52_setup.exe',
    description: 'The definitive instant messaging client with custom away messages and buddy lists.',
  },
  {
    id: 'retroamp_setup',
    name: 'RetroAmp Audio Player 2.95',
    category: 'Multimedia',
    version: '2.95',
    fileSizeBytes: 1024 * 1024 * 4,
    downloadUrl: 'http://downloadhub.local/files/retroamp_setup.exe',
    description: 'High-fidelity MP3/WAV player with 10-band equalizer and spectrum visualizer.',
  },
  {
    id: 'flashfetch_setup',
    name: 'FlashFetch Download Accelerator',
    category: 'Utilities',
    version: '3.1',
    fileSizeBytes: 1024 * 1024 * 2,
    downloadUrl: 'http://downloadhub.local/files/flashfetch_setup.exe',
    description: 'Accelerate web downloads with 8 segmented parallel connections.',
  },
  {
    id: 'zipmate_setup',
    name: 'ZipMate Archive Extractor 4.0',
    category: 'Utilities',
    version: '4.0.2',
    fileSizeBytes: 1024 * 1024 * 3,
    downloadUrl: 'http://downloadhub.local/files/zipmate_setup.exe',
    description: 'Compress and extract ZIP, TAR, and GZ archives with maximum ratio.',
  },
  {
    id: 'weatherbuddy_bundle',
    name: 'WeatherBuddy Desktop Companion',
    category: 'Internet',
    version: '3.1',
    fileSizeBytes: 1024 * 1024 * 5,
    downloadUrl: 'http://downloadhub.local/files/weatherbuddy_bundle.exe',
    description: 'Desktop frog mascot providing animated weather forecasts. Includes optional SearchMate Smart Search companion.',
    isAdwareBundle: true,
  },
  {
    id: 'safesweep_setup',
    name: 'SafeSweep Anti-Spyware 2006',
    category: 'Security',
    version: '4.2',
    fileSizeBytes: 1024 * 1024 * 7,
    downloadUrl: 'http://downloadhub.local/files/safesweep_setup.exe',
    description: 'Remove adware toolbars, tracking cookies, and spyware threats.',
  },
  {
    id: 'photobox_setup',
    name: 'PhotoBox Pro 2.0',
    category: 'Multimedia',
    version: '2.0.4',
    fileSizeBytes: 1024 * 1024 * 14,
    downloadUrl: 'http://downloadhub.local/files/photobox_setup.exe',
    description: 'Professional raster image and photo editor. (Requires Orion 6.0 + 768MB RAM)',
  },
];


