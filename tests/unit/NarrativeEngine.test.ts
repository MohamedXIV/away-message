import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { NarrativeEngine } from '../../src/narrative/NarrativeEngine';
import { parseNarrativeTag, parseAllNarrativeTags } from '../../src/narrative/tagParser';
import { ALL_STORY_KNOTS } from '../../src/narrative/data/allKnots';

describe('NarrativeEngine & Semantic Tag Subsystem Test Suite', () => {
  let simEngine: SimulationEngine;
  let narrativeEngine: NarrativeEngine;

  beforeEach(() => {
    simEngine = new SimulationEngine();
    narrativeEngine = new NarrativeEngine(ALL_STORY_KNOTS);
  });

  describe('1. Semantic Tag Parser', () => {
    it('parses # beat:<id> tags', () => {
      const parsed = parseNarrativeTag('# beat:maya_day1_complete');
      expect(parsed.type).toBe('beat');
      if (parsed.type === 'beat') {
        expect(parsed.beatId).toBe('maya_day1_complete');
      }
    });

    it('parses # effect:flag:<k>:<v> tags with boolean, number, and string types', () => {
      const boolTag = parseNarrativeTag('# effect:flag:maya_shared_photo:true');
      expect(boolTag.type).toBe('effect_flag');
      if (boolTag.type === 'effect_flag') {
        expect(boolTag.key).toBe('maya_shared_photo');
        expect(boolTag.value).toBe(true);
      }

      const numTag = parseNarrativeTag('# effect:flag:clutter_level:5');
      if (numTag.type === 'effect_flag') {
        expect(numTag.key).toBe('clutter_level');
        expect(numTag.value).toBe(5);
      }

      const strTag = parseNarrativeTag('# effect:flag:active_theme:vintage');
      if (strTag.type === 'effect_flag') {
        expect(strTag.key).toBe('active_theme');
        expect(strTag.value).toBe('vintage');
      }
    });

    it('parses # effect:money:<spend|earn>:<amount>:<reason> tags', () => {
      const spendTag = parseNarrativeTag('# effect:money:spend:4:bought_coffee');
      expect(spendTag.type).toBe('effect_money');
      if (spendTag.type === 'effect_money') {
        expect(spendTag.action).toBe('spend');
        expect(spendTag.amount).toBe(4);
        expect(spendTag.reason).toBe('bought_coffee');
      }

      const earnTag = parseNarrativeTag('# effect:money:earn:20:foodcart_shift');
      if (earnTag.type === 'effect_money') {
        expect(earnTag.action).toBe('earn');
        expect(earnTag.amount).toBe(20);
        expect(earnTag.reason).toBe('foodcart_shift');
      }
    });

    it('parses # effect:file:<create|delete>:<path>:<kind> tags', () => {
      const fileTag = parseNarrativeTag('# effect:file:create:C:/Downloads/canal.wav:audio');
      expect(fileTag.type).toBe('effect_file');
      if (fileTag.type === 'effect_file') {
        expect(fileTag.action).toBe('create');
        expect(fileTag.path).toBe('C:/Downloads/canal.wav');
        expect(fileTag.kind).toBe('audio');
      }
    });

    it('parses # effect:view:switch:<view> tags', () => {
      const viewTag = parseNarrativeTag('# effect:view:switch:cafe');
      expect(viewTag.type).toBe('effect_view');
      if (viewTag.type === 'effect_view') {
        expect(viewTag.view).toBe('cafe');
      }
    });

    it('parses # social:<buddyId>:<action> tags', () => {
      const socialTag = parseNarrativeTag('# social:maya:vulnerable_share');
      expect(socialTag.type).toBe('social');
      if (socialTag.type === 'social') {
        expect(socialTag.buddyId).toBe('maya');
        expect(socialTag.action).toBe('vulnerable_share');
      }
    });

    it('parses # schedule:appointment:<id>:<day>:<sMin>:<eMin>:<loc>:<desc> tags', () => {
      const schedTag = parseNarrativeTag(
        '# schedule:appointment:maya_cafe:11:900:960:cafe:Coffee with Maya'
      );
      expect(schedTag.type).toBe('schedule_appointment');
      if (schedTag.type === 'schedule_appointment') {
        expect(schedTag.appointmentId).toBe('maya_cafe');
        expect(schedTag.day).toBe(11);
        expect(schedTag.startMinute).toBe(900);
        expect(schedTag.endMinute).toBe(960);
        expect(schedTag.location).toBe('cafe');
        expect(schedTag.description).toBe('Coffee with Maya');
      }
    });

    it('parses # unlock:<targetType>:<targetId> tags', () => {
      const unlockTag = parseNarrativeTag('# unlock:website:nightboard_thread_104');
      expect(unlockTag.type).toBe('unlock');
      if (unlockTag.type === 'unlock') {
        expect(unlockTag.targetType).toBe('website');
        expect(unlockTag.targetId).toBe('nightboard_thread_104');
      }
    });

    it('parses array of tags cleanly', () => {
      const tags = [
        '# beat:test_beat',
        '# effect:flag:visited:true',
        '# social:ryan:work_camaraderie',
      ];
      const parsed = parseAllNarrativeTags(tags);
      expect(parsed.length).toBe(3);
      expect(parsed[0]?.type).toBe('beat');
      expect(parsed[1]?.type).toBe('effect_flag');
      expect(parsed[2]?.type).toBe('social');
    });
  });

  describe('2. Snapshot Context Injection', () => {
    it('injects read-only simulation state variables accurately', () => {
      const snapshot = narrativeEngine.injectContext(simEngine.getState());

      expect(snapshot.sim_current_day).toBe(1);
      expect(snapshot.sim_player_cash).toBe(38);
      expect(snapshot.sim_os_version).toBeNull();
      expect(snapshot.sim_ram_mb).toBe(0);
      expect(snapshot.sim_photobox_installed).toBe(false);
      expect(snapshot.sim_maya_familiarity).toBe(10);
      expect(snapshot.sim_maya_trust).toBe(20);
      expect(snapshot.sim_ryan_familiarity).toBe(40);
      expect(snapshot.sim_nora_familiarity).toBe(5);
      expect(snapshot.sim_henderson_familiarity).toBe(30);
    });

    it('updates snapshot variables when simulation state changes', () => {
      simEngine.dispatchAction({ type: 'PLAYER_EARN_CASH', amount: 50, reason: 'test' });
      const hardwareResult = simEngine.dispatchAction({ type: 'HARDWARE_UPGRADE_RAM', ramMB: 1024, cost: 0 });

      const updatedSnap = narrativeEngine.injectContext(simEngine.getState());
      expect(updatedSnap.sim_player_cash).toBe(88);
      expect(hardwareResult.success).toBe(false);
      expect(updatedSnap.sim_ram_mb).toBe(0);
    });
  });

  describe('3. Condition Evaluation & Knot Eligibility', () => {
    it('evaluates flag conditions correctly', () => {
      narrativeEngine.setFlag('unlocked_mystery', true);
      narrativeEngine.injectContext(simEngine.getState());

      expect(
        narrativeEngine.evaluateCondition({
          type: 'flag',
          key: 'unlocked_mystery',
          op: '==',
          value: true,
        })
      ).toBe(true);

      expect(
        narrativeEngine.evaluateCondition({
          type: 'flag',
          key: 'unknown_flag',
          op: '==',
          value: true,
        })
      ).toBe(false);
    });

    it('evaluates day and cash conditions', () => {
      narrativeEngine.injectContext(simEngine.getState());

      expect(narrativeEngine.evaluateCondition({ type: 'day', op: '==', value: 1 })).toBe(true);
      expect(narrativeEngine.evaluateCondition({ type: 'day', op: '>=', value: 2 })).toBe(false);
      expect(narrativeEngine.evaluateCondition({ type: 'cash', op: '>=', value: 30 })).toBe(true);
      expect(narrativeEngine.evaluateCondition({ type: 'cash', op: '>=', value: 100 })).toBe(false);
    });

    it('evaluates relationship requirement conditions', () => {
      narrativeEngine.injectContext(simEngine.getState());

      expect(
        narrativeEngine.evaluateCondition({
          type: 'relationship',
          buddyId: 'maya',
          dimension: 'trust',
          op: '>=',
          value: 20,
        })
      ).toBe(true);

      expect(
        narrativeEngine.evaluateCondition({
          type: 'relationship',
          buddyId: 'maya',
          dimension: 'trust',
          op: '>=',
          value: 50,
        })
      ).toBe(false);
    });

    it('checks knot eligibility against day and prerequisite filters', () => {
      narrativeEngine.injectContext(simEngine.getState());

      const knotDay1 = narrativeEngine.getKnot('maya_day1_greeting');
      expect(knotDay1).toBeDefined();
      if (knotDay1) {
        expect(narrativeEngine.isKnotEligible(knotDay1)).toBe(true);
      }

      const knotDay10 = narrativeEngine.getKnot('maya_day10');
      expect(knotDay10).toBeDefined();
      if (knotDay10) {
        // Should not be eligible on Day 1
        expect(narrativeEngine.isKnotEligible(knotDay10)).toBe(false);
      }
    });
  });

  describe('4. External Function Bindings', () => {
    it('executes bound external functions correctly', () => {
      narrativeEngine.injectContext(simEngine.getState());
      narrativeEngine.setFlag('test_str_flag', 'hello_world');
      narrativeEngine.setFlag('test_num_flag', 42);

      expect(narrativeEngine.hasFlag('test_str_flag')).toBe(true);
      expect(narrativeEngine.hasFlag('non_existent')).toBe(false);
      expect(narrativeEngine.getFlag('test_str_flag')).toBe('hello_world');
      expect(narrativeEngine.getFlag('test_num_flag')).toBe(42);
    });
  });

  describe('5. Lossless State Serialization & Restoration', () => {
    it('serializes and restores visited knots, beats, and flags', () => {
      narrativeEngine.startKnot('maya_day1_greeting');
      narrativeEngine.setFlag('custom_key', 'persisted_val');
      narrativeEngine.markBeatCompleted('test_beat_99');

      const savedState = narrativeEngine.getState();
      expect(savedState.completedBeats).toContain('test_beat_99');
      expect(savedState.visitedKnotIds).toContain('maya_day1_greeting');
      expect(savedState.flags['custom_key']).toBe('persisted_val');

      const freshEngine = new NarrativeEngine(ALL_STORY_KNOTS);
      freshEngine.restoreState(savedState);

      expect(freshEngine.isBeatCompleted('test_beat_99')).toBe(true);
      expect(freshEngine.getFlag('custom_key')).toBe('persisted_val');
    });
  });
});
