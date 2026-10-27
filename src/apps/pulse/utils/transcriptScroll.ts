export interface TranscriptMetrics {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}

export const TRANSCRIPT_BOTTOM_THRESHOLD = 40;

export function isNearTranscriptBottom(
  metrics: TranscriptMetrics,
  threshold = TRANSCRIPT_BOTTOM_THRESHOLD,
): boolean {
  return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight <= threshold;
}

export interface LatestMessageFollowInput {
  pageOffset: number;
  latestSenderId: string;
  latestChanged: boolean;
  nearBottom: boolean;
}

/** Follow new turns only on the newest page, and only if the player is already
 * at the bottom or sent the message. Reading older history must stay put. */
export function shouldFollowLatestMessage(input: LatestMessageFollowInput): boolean {
  if (!input.latestChanged || input.pageOffset !== 0) return false;
  return input.nearBottom || input.latestSenderId === 'player';
}
