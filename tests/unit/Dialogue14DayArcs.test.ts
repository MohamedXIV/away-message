import { describe, it, expect } from 'vitest';
import { ALL_STORY_KNOTS, getStoryKnotsByCharacter } from '../../src/narrative/data/allKnots';
import { RYAN_14DAY_KNOTS } from '../../src/narrative/data/ryanArcs';
import { MAYA_14DAY_KNOTS } from '../../src/narrative/data/mayaArcs';
import { NORA_14DAY_KNOTS } from '../../src/narrative/data/noraArcs';
import { HENDERSON_14DAY_KNOTS } from '../../src/narrative/data/hendersonArcs';

describe('14-Day Branching Narrative Arcs Test Suite', () => {
  it('contains authored knots spanning all 14 days', () => {
    const daysCovered = new Set(ALL_STORY_KNOTS.map((k) => k.day).filter((d): d is number => d !== undefined));
    for (let day = 1; day <= 14; day++) {
      expect(daysCovered.has(day)).toBe(true);
    }
  });

  describe('Character 1: Ryan (Food Cart Coworker & Practical Guide)', () => {
    it('has complete 14-day coverage for Ryan', () => {
      const ryanKnots = getStoryKnotsByCharacter('ryan');
      expect(ryanKnots.length).toBeGreaterThanOrEqual(14);

      const days = new Set(ryanKnots.map((k) => k.day).filter((d): d is number => d !== undefined));
      for (let day = 1; day <= 14; day++) {
        expect(days.has(day)).toBe(true);
      }
    });

    it('covers key Ryan milestones (Day 3 Adware, Day 4 Shift, Day 7 Rent, Day 8 OS 6, Day 14 Toast)', () => {
      const day3Knot = RYAN_14DAY_KNOTS.find((k) => k.day === 3);
      expect(day3Knot?.lines.some((l) => l.text.toLowerCase().includes('weatherbuddy'))).toBe(true);

      const day4Knot = RYAN_14DAY_KNOTS.find((k) => k.day === 4);
      expect(day4Knot?.lines.some((l) => l.text.toLowerCase().includes('shift'))).toBe(true);

      const day7Knot = RYAN_14DAY_KNOTS.find((k) => k.day === 7);
      expect(day7Knot?.lines.some((l) => l.text.toLowerCase().includes('rent'))).toBe(true);

      const day8Knot = RYAN_14DAY_KNOTS.find((k) => k.day === 8);
      expect(day8Knot?.lines.some((l) => l.text.toLowerCase().includes('os 6'))).toBe(true);

      const day14Knot = RYAN_14DAY_KNOTS.find((k) => k.day === 14);
      expect(day14Knot?.lines.some((l) => l.text.toLowerCase().includes('survived two weeks'))).toBe(true);
    });
  });

  describe('Character 2: Maya (Primary Emotional & Social Arc)', () => {
    it('has complete 14-day coverage for Maya', () => {
      const mayaKnots = getStoryKnotsByCharacter('maya');
      expect(mayaKnots.length).toBeGreaterThanOrEqual(14);

      const days = new Set(mayaKnots.map((k) => k.day).filter((d): d is number => d !== undefined));
      for (let day = 1; day <= 14; day++) {
        expect(days.has(day)).toBe(true);
      }
    });

    it('schedules the Day 11 Café Appointment in Day 10 dialogue', () => {
      const day10Knot = MAYA_14DAY_KNOTS.find((k) => k.day === 10);
      expect(day10Knot).toBeDefined();

      const acceptChoice = day10Knot?.choices?.find((c) => c.id === 'c_m10_yes');
      expect(acceptChoice).toBeDefined();
      expect(
        acceptChoice?.tags?.some((t) => t.includes('# schedule:appointment:maya_cafe:11'))
      ).toBe(true);
    });

    it('creates photo download file in Day 6 dialogue', () => {
      const day6Knot = MAYA_14DAY_KNOTS.find((k) => k.day === 6);
      expect(day6Knot).toBeDefined();

      const choice = day6Knot?.choices?.[0];
      expect(
        choice?.tags?.some((t) => t.includes('# effect:file:create:C:/Downloads/maya_rain_neon.jpg'))
      ).toBe(true);
    });

    it('has Day 12 post-meeting away message reference', () => {
      const day12Knot = MAYA_14DAY_KNOTS.find((k) => k.day === 12);
      expect(day12Knot?.lines.some((l) => l.text.toLowerCase().includes('away message'))).toBe(true);
    });
  });

  describe('Character 3: Nora (Lore & Technical Forensics)', () => {
    it('has complete 14-day coverage for Nora', () => {
      const noraKnots = getStoryKnotsByCharacter('nora');
      expect(noraKnots.length).toBeGreaterThanOrEqual(14);

      const days = new Set(noraKnots.map((k) => k.day).filter((d): d is number => d !== undefined));
      for (let day = 1; day <= 14; day++) {
        expect(days.has(day)).toBe(true);
      }
    });

    it('unlocks NightBoard Thread 104 on Day 4 and Search Term on Day 5', () => {
      const day4Knot = NORA_14DAY_KNOTS.find((k) => k.day === 4);
      expect(
        day4Knot?.choices?.some((c) =>
          c.tags?.some((t) => t.includes('# unlock:website:nightboard_thread_104'))
        )
      ).toBe(true);

      const day5Knot = NORA_14DAY_KNOTS.find((k) => k.day === 5);
      expect(
        day5Knot?.choices?.some((c) =>
          c.tags?.some((t) => t.includes('# unlock:search_term:canal_hum'))
        )
      ).toBe(true);
    });

    it('creates emergency archive file on Day 13 and completes node verification on Day 14', () => {
      const day13Knot = NORA_14DAY_KNOTS.find((k) => k.day === 13);
      expect(
        day13Knot?.choices?.some((c) =>
          c.tags?.some((t) => t.includes('# effect:file:create:C:/Downloads/canal_archive_2001.txt'))
        )
      ).toBe(true);

      const day14Knot = NORA_14DAY_KNOTS.find((k) => k.day === 14);
      expect(
        day14Knot?.choices?.some((c) =>
          c.tags?.some((t) => t.includes('# effect:flag:nora_arc_completed:true'))
        )
      ).toBe(true);
    });
  });

  describe('Character 4: Mr. Henderson (Landlord & Rent Obligations)', () => {
    it('has structured 14-day schedule and rent checkpoints for Henderson', () => {
      const hendersonKnots = getStoryKnotsByCharacter('henderson');
      expect(hendersonKnots.length).toBeGreaterThanOrEqual(8);

      const day5Knot = HENDERSON_14DAY_KNOTS.find((k) => k.day === 5);
      expect(day5Knot?.lines.some((l) => l.text.includes('$140.00'))).toBe(true);

      const day7Knot = HENDERSON_14DAY_KNOTS.find((k) => k.day === 7);
      expect(day7Knot?.lines.some((l) => l.text.includes('Day 7 rent reconciliation'))).toBe(true);

      const day12Knot = HENDERSON_14DAY_KNOTS.find((k) => k.day === 12);
      expect(day12Knot?.lines.some((l) => l.text.includes('Week 2 rent'))).toBe(true);

      const day14Knot = HENDERSON_14DAY_KNOTS.find((k) => k.day === 14);
      expect(day14Knot?.lines.some((l) => l.text.includes('evaluation concluded'))).toBe(true);
    });
  });

  describe('Story Choices & Structural Integrity', () => {
    it('ensures every choice has valid text and recognized socialAction or targetKnot', () => {
      const validSocialActions = new Set([
        'empathy',
        'remembered_detail',
        'tease_playful',
        'dismissive',
        'vulnerable_share',
        'work_camaraderie',
        'intellectual_curiosity',
      ]);

      for (const knot of ALL_STORY_KNOTS) {
        if (knot.choices) {
          for (const choice of knot.choices) {
            expect(choice.text.length).toBeGreaterThan(0);
            if (choice.socialAction) {
              expect(validSocialActions.has(choice.socialAction)).toBe(true);
            }
          }
        }
      }
    });
  });
});
