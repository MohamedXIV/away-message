import { describe, expect, it } from 'vitest';
import {
  isNearTranscriptBottom,
  shouldFollowLatestMessage,
} from '../../src/apps/pulse/utils/transcriptScroll';

describe('#223 Pulse transcript scrolling', () => {
  it('treats only the bottom band as following the newest message', () => {
    expect(isNearTranscriptBottom({ scrollHeight: 500, scrollTop: 400, clientHeight: 100 })).toBe(true);
    expect(isNearTranscriptBottom({ scrollHeight: 500, scrollTop: 350, clientHeight: 100 })).toBe(false);
    expect(isNearTranscriptBottom({ scrollHeight: 0, scrollTop: 0, clientHeight: 0 })).toBe(true);
  });

  it('follows new turns only on the newest page and when already at the bottom', () => {
    const base = { pageOffset: 0, latestSenderId: 'actor_a', latestChanged: true, nearBottom: true };
    expect(shouldFollowLatestMessage(base)).toBe(true);
    expect(shouldFollowLatestMessage({ ...base, nearBottom: false })).toBe(false);
    // Sending is an explicit action: jump to the player's own new turn.
    expect(shouldFollowLatestMessage({ ...base, nearBottom: false, latestSenderId: 'player' })).toBe(true);
    // Older history is frozen; never jump for a hidden newest message.
    expect(shouldFollowLatestMessage({ ...base, pageOffset: 30 })).toBe(false);
    expect(shouldFollowLatestMessage({ ...base, latestChanged: false })).toBe(false);
  });
});
