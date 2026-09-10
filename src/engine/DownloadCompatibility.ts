import type { DownloadManagerType } from './types';

export interface LegacyDownloadClientProfile {
  clientId: string;
  maxConcurrent: number;
  supportsResume: boolean;
}

/**
 * Translation boundary for pre-#12 action/save metadata.
 * Concrete legacy client identities stay here; the authoritative transfer
 * scheduler consumes only neutral capability profiles.
 */
export function legacyDownloadProfile(manager?: DownloadManagerType): LegacyDownloadClientProfile {
  if (manager === 'flashfetch') {
    return {
      clientId: 'legacy-accelerated-client',
      maxConcurrent: 4,
      supportsResume: true,
    };
  }

  return {
    clientId: 'legacy-browser-client',
    maxConcurrent: 1,
    supportsResume: true,
  };
}
