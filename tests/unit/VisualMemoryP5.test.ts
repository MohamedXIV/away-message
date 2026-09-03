import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { SocialEngine, MAX_PHOTO_MEMORIES } from '../../src/engine/SocialEngine';
import { looksLikePhotoQuestion } from '../../src/apps/pulse/utils/conversationMemory';

function makeSocial(): SocialEngine {
  return new SocialEngine(new EventBus());
}

function sendPhoto(social: SocialEngine, buddyId: string, minute: number, prompt: string, caption?: string): void {
  social.sendMessage(buddyId, buddyId, 'player', 'here, took this for you', minute, false, ['photo'], undefined, prompt, caption);
}

describe('P5.5 visual memory (SocialEngine)', () => {
  let social: SocialEngine;
  beforeEach(() => { social = makeSocial(); });

  it('records buddy-sent photos as immortal shared_photo memories', () => {
    sendPhoto(social, 'maya', 1200, 'Maya at her desk, warm lamp, small photo', 'desk at midnight');
    const mems = social.getCoreMemories('maya').filter((m) => m.kind === 'shared_photo');
    expect(mems.length).toBe(1);
    expect(mems[0]!.text).toContain('desk at midnight');
    expect(mems[0]!.text).toContain('Day 1');
    expect(mems[0]!.day).toBe(1);
  });

  it(`caps photos at ${MAX_PHOTO_MEMORIES} and dedupes repeats`, () => {
    for (let i = 0; i < 5; i++) {
      sendPhoto(social, 'ryan', 1200 + i, `taco stabilize photo number ${i}`, `taco ${i}`);
    }
    expect(social.getCoreMemories('ryan').filter((m) => m.kind === 'shared_photo').length).toBe(MAX_PHOTO_MEMORIES);
    sendPhoto(social, 'nora', 1300, 'night log photo', 'logs');
    sendPhoto(social, 'nora', 1301, 'night log photo', 'logs');
    expect(social.getCoreMemories('nora').filter((m) => m.kind === 'shared_photo').length).toBe(1);
  });

  it('ignores player-sent images and text-only messages', () => {
    social.sendMessage('maya', 'player', 'maya', 'here is mine', 1200, false, [], 'http://x.local/pic', 'my pic');
    social.sendMessage('maya', 'maya', 'player', 'just text, no photo', 1201);
    expect(social.getCoreMemories('maya').filter((m) => m.kind === 'shared_photo').length).toBe(0);
  });

  it('surfaces photos in the long-term prompt context and across saves', () => {
    sendPhoto(social, 'maya', 1200, 'Maya at her desk, warm lamp', 'desk at midnight');
    expect(social.buildLongTermContext('maya')).toContain('desk at midnight');
    const restored = new SocialEngine(new EventBus(), social.getState());
    expect(restored.getCoreMemories('maya').some((m) => m.kind === 'shared_photo')).toBe(true);
  });
});

describe('P5.5 photo questions (rules)', () => {
  it('detects photo recall questions', () => {
    expect(looksLikePhotoQuestion('still have that photo?')).toBe(true);
    expect(looksLikePhotoQuestion('show me the picture again')).toBe(true);
    expect(looksLikePhotoQuestion('that shot of the desk was nice')).toBe(true);
    expect(looksLikePhotoQuestion('how was your day')).toBe(false);
    expect(looksLikePhotoQuestion('')).toBe(false);
  });
});
