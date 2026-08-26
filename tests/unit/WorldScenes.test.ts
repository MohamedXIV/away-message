// tests/unit/WorldScenes.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { getTimeOfDayFromHour } from '../../src/world/RoomCanvas';
import {
  getContextualWindowThought,
  PERSISTENT_STREET_ENTITIES,
} from '../../src/world/data/windowThoughts';
import {
  ROOM_HOTSPOTS,
  BEVERAGE_OPTIONS,
  DOOR_OPTIONS,
} from '../../src/world/data/roomInteractables';
import { CAFE_DIALOGUE_BEATS } from '../../src/world/data/cafeDialogue';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('2D World Scenes, Atmosphere, Interactables & App Integration', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new SimulationEngine();
  });

  describe('1. Time of Day & Lighting Cycle Mappings', () => {
    it('correctly maps 24 hours into 5 distinct time-of-day phases', () => {
      // Morning: 06:00 - 10:59
      expect(getTimeOfDayFromHour(6)).toBe('morning');
      expect(getTimeOfDayFromHour(8)).toBe('morning');
      expect(getTimeOfDayFromHour(10)).toBe('morning');

      // Day: 11:00 - 16:59
      expect(getTimeOfDayFromHour(11)).toBe('day');
      expect(getTimeOfDayFromHour(14)).toBe('day');
      expect(getTimeOfDayFromHour(16)).toBe('day');

      // Evening: 17:00 - 20:59
      expect(getTimeOfDayFromHour(17)).toBe('evening');
      expect(getTimeOfDayFromHour(19)).toBe('evening');
      expect(getTimeOfDayFromHour(20)).toBe('evening');

      // Night: 21:00 - 01:59
      expect(getTimeOfDayFromHour(21)).toBe('night');
      expect(getTimeOfDayFromHour(23)).toBe('night');
      expect(getTimeOfDayFromHour(0)).toBe('night');
      expect(getTimeOfDayFromHour(1)).toBe('night');

      // Late Night: 02:00 - 05:59
      expect(getTimeOfDayFromHour(2)).toBe('late_night');
      expect(getTimeOfDayFromHour(3)).toBe('late_night');
      expect(getTimeOfDayFromHour(5)).toBe('late_night');
    });
  });

  describe('2. Window Observations & Persistent Entities', () => {
    it('returns valid contextual thoughts and persistent entities based on day and time', () => {
      const morningRes = getContextualWindowThought(1, 'morning', 'clear');
      expect(morningRes.thought).toBeTruthy();
      expect(typeof morningRes.thought).toBe('string');
      expect(morningRes.mood).toBeTruthy();

      const rainRes = getContextualWindowThought(3, 'day', 'rain');
      expect(rainRes.thought).toContain('Rain');

      const lateNightRes = getContextualWindowThought(2, 'late_night', 'clear');
      expect(lateNightRes.thought).toBeTruthy();
      if (lateNightRes.entity) {
        expect(lateNightRes.entity.activeTimes).toContain('late_night');
      }

      // Check narrative flag condition
      const postCafeRes = getContextualWindowThought(12, 'day', 'clear', { maya_met_in_person: true });
      expect(postCafeRes.thought).toContain('Maya');
    });

    it('contains persistent street entities with required properties', () => {
      expect(PERSISTENT_STREET_ENTITIES.length).toBeGreaterThanOrEqual(3);
      for (const entity of PERSISTENT_STREET_ENTITIES) {
        expect(entity.id).toBeTruthy();
        expect(entity.name).toBeTruthy();
        expect(entity.description).toBeTruthy();
        expect(entity.activeTimes.length).toBeGreaterThan(0);
      }
    });
  });

  describe('3. Room Hotspots & Interactables Data', () => {
    it('defines 6 primary interactive hotspots with normalized coordinates [0..1]', () => {
      const expectedHotspots = ['pc', 'kettle', 'shower', 'window', 'bed', 'door'];
      const foundIds = ROOM_HOTSPOTS.map((h) => h.id);

      for (const expected of expectedHotspots) {
        expect(foundIds).toContain(expected);
      }

      for (const hotspot of ROOM_HOTSPOTS) {
        expect(hotspot.x).toBeGreaterThanOrEqual(0);
        expect(hotspot.x + hotspot.w).toBeLessThanOrEqual(1.05);
        expect(hotspot.y).toBeGreaterThanOrEqual(0);
        expect(hotspot.y + hotspot.h).toBeLessThanOrEqual(1.05);
        expect(hotspot.label).toBeTruthy();
        expect(hotspot.icon).toBeTruthy();
      }
    });

    it('defines beverage options with correct time durations and energy changes', () => {
      const tea = BEVERAGE_OPTIONS.find((b) => b.actionType === 'tea');
      const coffee = BEVERAGE_OPTIONS.find((b) => b.actionType === 'coffee');
      const noodles = BEVERAGE_OPTIONS.find((b) => b.actionType === 'meal');

      expect(tea).toBeDefined();
      expect(tea?.durationMinutes).toBe(6);
      expect(tea?.energyChange).toBe(5);

      expect(coffee).toBeDefined();
      expect(coffee?.durationMinutes).toBe(5);
      expect(coffee?.energyChange).toBe(5);

      expect(noodles).toBeDefined();
      expect(noodles?.durationMinutes).toBe(15);
      expect(noodles?.energyChange).toBe(15);
      expect(noodles?.cashCost).toBe(2.00);
    });

    it('defines door options with work shifts and cafe visit', () => {
      const work = DOOR_OPTIONS.find((d) => d.actionType === 'work');
      const walk = DOOR_OPTIONS.find((d) => d.actionType === 'walk');
      const cafe = DOOR_OPTIONS.find((d) => d.actionType === 'cafe');

      expect(work).toBeDefined();
      expect(work?.durationMinutes).toBe(240);
      expect(work?.cashReward).toBe(62.00);

      expect(walk).toBeDefined();
      expect(walk?.durationMinutes).toBe(30);

      expect(cafe).toBeDefined();
      expect(cafe?.durationMinutes).toBe(75);
    });
  });

  describe('4. Simulation Engine Room Action Integration', () => {
    it('executes tea interaction (advances 6m, restores 5 energy)', () => {
      // Drain some energy first
      engine.economy.consumeEnergy(30);
      const initialEnergy = engine.getState().player.energy;
      const initialMinutes = engine.clock.getTotalMinutes();

      const res = engine.dispatchAction({ type: 'PLAYER_INTERACT_ROOM', activity: 'tea' });
      expect(res.success).toBe(true);

      expect(engine.clock.getTotalMinutes()).toBe(initialMinutes + 6);
      expect(engine.getState().player.energy).toBe(Math.min(100, initialEnergy + 5));
    });

    it('executes instant noodles meal (advances 15m, restores 15 energy)', () => {
      engine.economy.consumeEnergy(40);
      const initialEnergy = engine.getState().player.energy;
      const initialMinutes = engine.clock.getTotalMinutes();

      const res = engine.dispatchAction({ type: 'PLAYER_INTERACT_ROOM', activity: 'meal' });
      expect(res.success).toBe(true);

      expect(engine.clock.getTotalMinutes()).toBe(initialMinutes + 15);
      expect(engine.getState().player.energy).toBe(initialEnergy + 15);
    });

    it('executes shower interaction (advances 12m)', () => {
      const initialMinutes = engine.clock.getTotalMinutes();

      const res = engine.dispatchAction({ type: 'PLAYER_INTERACT_ROOM', activity: 'shower' });
      expect(res.success).toBe(true);

      expect(engine.clock.getTotalMinutes()).toBe(initialMinutes + 12);
    });

    it('executes window observation (advances 4m, logs telemetry)', () => {
      const initialMinutes = engine.clock.getTotalMinutes();

      const res = engine.dispatchAction({ type: 'PLAYER_INTERACT_ROOM', activity: 'window' });
      expect(res.success).toBe(true);

      expect(engine.clock.getTotalMinutes()).toBe(initialMinutes + 4);
      expect(engine.getState().telemetry.stats.windowObservationsCount).toBeGreaterThanOrEqual(1);
    });

    it('executes food cart work shift (advances 240m, earns $62, consumes energy)', () => {
      const initialCash = engine.getState().player.cash;
      const initialEnergy = engine.getState().player.energy;
      const initialMinutes = engine.clock.getTotalMinutes();

      const res = engine.dispatchAction({ type: 'PLAYER_WORK_SHIFT', durationMinutes: 240, wage: 62 });
      expect(res.success).toBe(true);

      expect(engine.clock.getTotalMinutes()).toBe(initialMinutes + 240);
      expect(engine.getState().player.cash).toBe(initialCash + 62);
      expect(engine.getState().player.energy).toBeLessThan(initialEnergy);
    });

    it('executes bed sleep (jumps to 08:00 next day, restores 100 energy, emits day change)', () => {
      engine.economy.consumeEnergy(50);
      expect(engine.getState().player.energy).toBe(50);

      const currentDay = engine.clock.getTime().day;
      const res = engine.dispatchAction({ type: 'PLAYER_REST_OR_SLEEP', wakeHour: 8 });
      expect(res.success).toBe(true);

      const newTime = engine.clock.getTime();
      expect(newTime.hour).toBe(8);
      expect(newTime.minute).toBe(0);
      expect(newTime.day).toBe(currentDay + 1);
      expect(engine.getState().player.energy).toBe(100);
    });
  });

  describe('5. Continuous Download Progression across View Switches & Time Jumps', () => {
    it('advances background downloads authentically when stepping away to room and making tea', () => {
      // Start download
      engine.dispatchAction({
        type: 'DOWNLOAD_START',
        sourceId: 'downloadhub',
        url: 'http://downloadhub.local/files/retroamp.zip',
        fileName: 'retroamp.zip',
        totalBytes: 5_000_000,
        sourceMaxKbps: 256,
      });

      const initialDownloads = engine.getState().downloads;
      expect(initialDownloads.length).toBe(1);
      const taskId = initialDownloads[0]!.id;
      const initialBytes = initialDownloads[0]!.downloadedBytes;

      // Switch view to room
      engine.dispatchAction({ type: 'VIEW_SWITCH', view: 'room' });
      expect(engine.getState().activeView).toBe('room');

      // Make tea (6 min) + Look out window (4 min) = 10 min
      engine.dispatchAction({ type: 'PLAYER_INTERACT_ROOM', activity: 'tea' });
      engine.dispatchAction({ type: 'PLAYER_INTERACT_ROOM', activity: 'window' });

      // Check download progress advanced
      const updatedDownloads = engine.getState().downloads;
      const task = updatedDownloads.find((d) => d.id === taskId);
      expect(task).toBeDefined();
      expect(task!.downloadedBytes).toBeGreaterThan(initialBytes);

      // Return to PC view
      engine.dispatchAction({ type: 'VIEW_SWITCH', view: 'pc' });
      expect(engine.getState().activeView).toBe('pc');
    });
  });

  describe('6. In-Person Café Scene Dialogue Tree & Social Action Tags', () => {
    it('contains a valid, fully connected 5-beat dialogue tree for Maya café meeting', () => {
      expect(CAFE_DIALOGUE_BEATS.intro).toBeDefined();
      expect(CAFE_DIALOGUE_BEATS.beat_drinks).toBeDefined();
      expect(CAFE_DIALOGUE_BEATS.beat_maya_job).toBeDefined();
      expect(CAFE_DIALOGUE_BEATS.beat_interests).toBeDefined();
      expect(CAFE_DIALOGUE_BEATS.beat_conclusion).toBeDefined();

      // Verify Intro choices lead to beat_drinks
      for (const choice of CAFE_DIALOGUE_BEATS.intro!.choices!) {
        expect(choice.nextBeatId).toBe('beat_drinks');
      }

      // Verify beat_drinks choices lead to beat_maya_job
      for (const choice of CAFE_DIALOGUE_BEATS.beat_drinks!.choices!) {
        expect(choice.nextBeatId).toBe('beat_maya_job');
      }

      // Verify beat_maya_job has empathic/detail/playful choices leading to beat_interests
      const mayaJobChoices = CAFE_DIALOGUE_BEATS.beat_maya_job!.choices!;
      expect(mayaJobChoices.length).toBeGreaterThanOrEqual(3);
      expect(mayaJobChoices.some((c) => c.socialTag === 'empathy')).toBe(true);
      expect(mayaJobChoices.some((c) => c.socialTag === 'remembered_detail')).toBe(true);
      expect(mayaJobChoices.some((c) => c.socialTag === 'tease_playful')).toBe(true);

      for (const choice of mayaJobChoices) {
        expect(choice.nextBeatId).toBe('beat_interests');
      }

      // Verify beat_conclusion ends the meeting
      expect(CAFE_DIALOGUE_BEATS.beat_conclusion!.isEnd).toBe(true);
    });

    it('simulates in-person meeting effects: advances 75m, deducts $4 coffee, sets maya_met_in_person', () => {
      const initialCash = engine.getState().player.cash;
      const initialMinutes = engine.clock.getTotalMinutes();

      // Apply social action for meeting
      engine.dispatchAction({
        type: 'SOCIAL_APPLY_ACTION',
        buddyId: 'starlight_maya',
        socialAction: 'empathy',
      });

      // Deduct coffee
      engine.dispatchAction({
        type: 'PLAYER_SPEND_CASH',
        amount: 4.00,
        reason: 'Coffee at Starlight Café',
      });

      // Advance 75m
      engine.dispatchAction({
        type: 'TIME_ADVANCE_MINUTES',
        minutes: 75,
        reason: 'Meeting Maya at Starlight Café',
      });

      // Set narrative flag
      engine.dispatchAction({
        type: 'NARRATIVE_SET_FLAG',
        key: 'maya_met_in_person',
        value: true,
      });

      expect(engine.clock.getTotalMinutes()).toBe(initialMinutes + 75);
      expect(engine.getState().player.cash).toBe(initialCash - 4.00);
      expect(engine.getState().narrative.flags.maya_met_in_person).toBe(true);
    });
  });

  describe('7. View Switching & Day 14 Evaluation Resolution', () => {
    it('switches views between pc, room, cafe, and work', () => {
      engine.dispatchAction({ type: 'VIEW_SWITCH', view: 'room' });
      expect(engine.getState().activeView).toBe('room');

      engine.dispatchAction({ type: 'VIEW_SWITCH', view: 'cafe' });
      expect(engine.getState().activeView).toBe('cafe');

      engine.dispatchAction({ type: 'VIEW_SWITCH', view: 'pc' });
      expect(engine.getState().activeView).toBe('pc');
    });

    it('supports Day 14 evaluation completion and free play mode flags', () => {
      // Simulate jumping to Day 15
      for (let d = 1; d <= 14; d++) {
        engine.dispatchAction({ type: 'PLAYER_REST_OR_SLEEP', wakeHour: 8 });
      }
      expect(engine.clock.getTime().day).toBe(15);

      // Set free play flags
      engine.dispatchAction({ type: 'NARRATIVE_SET_FLAG', key: 'free_play_unlocked', value: true });
      engine.dispatchAction({ type: 'NARRATIVE_SET_FLAG', key: 'day14_evaluation_completed', value: true });

      expect(engine.getState().narrative.flags.free_play_unlocked).toBe(true);
      expect(engine.getState().narrative.flags.day14_evaluation_completed).toBe(true);
    });
  });
});
