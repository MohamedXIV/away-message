import { Story } from 'inkjs';
import { SimulationState } from '../engine/types';
import {
  StoryKnot,
  StoryChoice,
  NarrativeCondition,
  NarrativeContextSnapshot,
  NarrativeEngineState,
  ParsedNarrativeTag,
} from './types';
import { parseAllNarrativeTags } from './tagParser';

export class NarrativeEngine {
  private story: Story | null = null;
  private knots: Map<string, StoryKnot> = new Map();
  private visitedKnotIds: Set<string> = new Set();
  private completedBeats: Set<string> = new Set();
  private activeBeatId: string | null = null;
  private flags: Map<string, boolean | number | string> = new Map();
  private currentKnotId: string | null = null;
  private boundFunctions: Map<string, (...args: any[]) => any> = new Map();
  private contextSnapshot: NarrativeContextSnapshot | null = null;

  constructor(inkJson?: any, knots?: StoryKnot[]) {
    if (knots && knots.length > 0) {
      this.registerKnots(knots);
    }
    if (inkJson) {
      this.loadInkJson(inkJson);
    }
    this.setupDefaultExternalFunctions();
  }

  public registerKnots(knots: StoryKnot[]): void {
    for (const knot of knots) {
      this.knots.set(knot.id, knot);
    }
  }

  public registerKnot(knot: StoryKnot): void {
    this.knots.set(knot.id, knot);
  }

  public getKnot(id: string): StoryKnot | undefined {
    return this.knots.get(id);
  }

  public getAllKnots(): StoryKnot[] {
    return Array.from(this.knots.values());
  }

  public loadInkJson(inkJson: any): void {
    try {
      this.story = new Story(inkJson);
      this.bindStoryExternalFunctions();
      if (this.contextSnapshot) {
        this.injectSnapshotIntoStory(this.contextSnapshot);
      }
    } catch (err) {
      console.warn('Could not initialize inkjs.Story from JSON:', err);
    }
  }

  private setupDefaultExternalFunctions(): void {
    this.bindExternalFunction('has_flag', (key: string) => {
      return this.hasFlag(key);
    });

    this.bindExternalFunction('get_flag_string', (key: string) => {
      const val = this.flags.get(key);
      return val !== undefined ? String(val) : '';
    });

    this.bindExternalFunction('get_flag_number', (key: string) => {
      const val = this.flags.get(key);
      return typeof val === 'number' ? val : 0;
    });

    this.bindExternalFunction('is_installed', (appId: string) => {
      if (!this.contextSnapshot) return false;
      if (appId === 'photobox') return this.contextSnapshot.sim_photobox_installed;
      if (appId === 'weatherbuddy') return this.contextSnapshot.sim_weatherbuddy_installed;
      if (appId === 'safesweep') return this.contextSnapshot.sim_safesweep_installed;
      if (appId === 'flashfetch') return this.contextSnapshot.sim_flashfetch_installed;
      if (appId === 'zipmate') return this.contextSnapshot.sim_zipmate_installed;
      if (appId === 'retroamp') return this.contextSnapshot.sim_retroamp_installed;
      return false;
    });

    this.bindExternalFunction('get_relationship', (buddyId: string, dimension: string) => {
      if (!this.contextSnapshot) return 0;
      const dimMap: Record<string, Record<string, number>> = {
        familiarity: this.contextSnapshot.sim_buddies_familiarity,
        trust: this.contextSnapshot.sim_buddies_trust,
        comfort: this.contextSnapshot.sim_buddies_comfort,
        respect: this.contextSnapshot.sim_buddies_respect,
        annoyance: this.contextSnapshot.sim_buddies_annoyance,
      };
      return dimMap[dimension]?.[buddyId] ?? 0;
    });
  }

  public bindExternalFunction(name: string, func: (...args: any[]) => any): void {
    this.boundFunctions.set(name, func);
    if (this.story) {
      try {
        this.story.BindExternalFunction(name, func);
      } catch {
        // May already be bound
      }
    }
  }

  private bindStoryExternalFunctions(): void {
    if (!this.story) return;
    for (const [name, func] of this.boundFunctions.entries()) {
      try {
        this.story.BindExternalFunction(name, func);
      } catch {
        // Ignore if already bound
      }
    }
  }

  /**
   * Builds snapshot of simulation state and injects it into the story runtime.
   */
  public injectContext(state: SimulationState): NarrativeContextSnapshot {
    const isInstalled = (appId: string): boolean => {
      return state.installedSoftware.some((s) => s.appId === appId);
    };

    const sim_buddies_familiarity: Record<string, number> = {};
    const sim_buddies_trust: Record<string, number> = {};
    const sim_buddies_comfort: Record<string, number> = {};
    const sim_buddies_respect: Record<string, number> = {};
    const sim_buddies_annoyance: Record<string, number> = {};

    for (const [buddyId, rel] of Object.entries(state.social.relationships)) {
      sim_buddies_familiarity[buddyId] = rel.familiarity;
      sim_buddies_trust[buddyId] = rel.trust;
      sim_buddies_comfort[buddyId] = rel.comfort;
      sim_buddies_respect[buddyId] = rel.respect;
      sim_buddies_annoyance[buddyId] = rel.annoyance;
    }

    const flags: Record<string, boolean | number | string> = {
      ...state.narrative.flags,
    };
    for (const [k, v] of this.flags.entries()) {
      flags[k] = v;
    }

    const snapshot: NarrativeContextSnapshot = {
      sim_current_day: state.time.day,
      sim_current_time_minute: state.time.minute + state.time.hour * 60,
      sim_time_of_day: state.time.timeOfDay,
      sim_player_cash: state.player.cash,
      sim_player_energy: state.player.energy,
      sim_player_fatigue: state.player.fatigue,
      sim_os_version: state.hardware.osVersion,
      sim_ram_mb: state.hardware.ramMB,
      sim_connection_type: state.hardware.connectionType,
      sim_photobox_installed: isInstalled('photobox'),
      sim_weatherbuddy_installed: isInstalled('weatherbuddy'),
      sim_safesweep_installed: isInstalled('safesweep'),
      sim_flashfetch_installed: isInstalled('flashfetch'),
      sim_zipmate_installed: isInstalled('zipmate'),
      sim_retroamp_installed: isInstalled('retroamp'),
      sim_rent_paid: state.player.rentPaid,
      sim_internet_paid: state.player.internetBillPaid,
      sim_buddies_familiarity,
      sim_buddies_trust,
      sim_buddies_comfort,
      sim_buddies_respect,
      sim_buddies_annoyance,
      sim_maya_familiarity: sim_buddies_familiarity['maya'] ?? 10,
      sim_maya_trust: sim_buddies_trust['maya'] ?? 20,
      sim_maya_comfort: sim_buddies_comfort['maya'] ?? 30,
      sim_maya_respect: sim_buddies_respect['maya'] ?? 40,
      sim_maya_annoyance: sim_buddies_annoyance['maya'] ?? 0,
      sim_ryan_familiarity: sim_buddies_familiarity['ryan'] ?? 40,
      sim_ryan_trust: sim_buddies_trust['ryan'] ?? 50,
      sim_ryan_comfort: sim_buddies_comfort['ryan'] ?? 50,
      sim_ryan_respect: sim_buddies_respect['ryan'] ?? 40,
      sim_ryan_annoyance: sim_buddies_annoyance['ryan'] ?? 0,
      sim_nora_familiarity: sim_buddies_familiarity['nora'] ?? 5,
      sim_nora_trust: sim_buddies_trust['nora'] ?? 15,
      sim_nora_comfort: sim_buddies_comfort['nora'] ?? 20,
      sim_nora_respect: sim_buddies_respect['nora'] ?? 50,
      sim_nora_annoyance: sim_buddies_annoyance['nora'] ?? 0,
      sim_henderson_familiarity: sim_buddies_familiarity['henderson'] ?? 30,
      sim_henderson_trust: sim_buddies_trust['henderson'] ?? 30,
      sim_henderson_comfort: sim_buddies_comfort['henderson'] ?? 20,
      sim_henderson_respect: sim_buddies_respect['henderson'] ?? 40,
      sim_henderson_annoyance: sim_buddies_annoyance['henderson'] ?? 10,
      flags,
      completedBeats: Array.from(new Set([...state.narrative.completedBeats, ...this.completedBeats])),
    };

    this.contextSnapshot = snapshot;
    this.injectSnapshotIntoStory(snapshot);
    return snapshot;
  }

  private injectSnapshotIntoStory(snapshot: NarrativeContextSnapshot): void {
    if (!this.story) return;

    try {
      const vars = this.story.variablesState;
      if (!vars) return;

      const keys: Array<keyof NarrativeContextSnapshot> = [
        'sim_current_day',
        'sim_current_time_minute',
        'sim_time_of_day',
        'sim_player_cash',
        'sim_player_energy',
        'sim_player_fatigue',
        'sim_os_version',
        'sim_ram_mb',
        'sim_connection_type',
        'sim_photobox_installed',
        'sim_weatherbuddy_installed',
        'sim_safesweep_installed',
        'sim_flashfetch_installed',
        'sim_zipmate_installed',
        'sim_retroamp_installed',
        'sim_rent_paid',
        'sim_internet_paid',
        'sim_maya_familiarity',
        'sim_maya_trust',
        'sim_maya_comfort',
        'sim_maya_respect',
        'sim_maya_annoyance',
        'sim_ryan_familiarity',
        'sim_ryan_trust',
        'sim_ryan_comfort',
        'sim_ryan_respect',
        'sim_ryan_annoyance',
        'sim_nora_familiarity',
        'sim_nora_trust',
        'sim_nora_comfort',
        'sim_nora_respect',
        'sim_nora_annoyance',
        'sim_henderson_familiarity',
        'sim_henderson_trust',
        'sim_henderson_comfort',
        'sim_henderson_respect',
        'sim_henderson_annoyance',
      ];

      for (const k of keys) {
        if (k in vars) {
          vars[k as string] = snapshot[k];
        }
      }
    } catch {
      // Ink variable injection may skip undefined story variables
    }
  }

  public evaluateCondition(cond: NarrativeCondition, snapshot?: NarrativeContextSnapshot): boolean {
    const snap = snapshot || this.contextSnapshot;
    if (!snap) return true;

    switch (cond.type) {
      case 'flag': {
        const flagVal = cond.key ? (snap.flags[cond.key] ?? this.flags.get(cond.key)) : undefined;
        if (cond.op === '==' || !cond.op) return flagVal === cond.value;
        if (cond.op === '!=') return flagVal !== cond.value;
        if (cond.op === '>=') return Number(flagVal) >= Number(cond.value);
        if (cond.op === '<=') return Number(flagVal) <= Number(cond.value);
        if (cond.op === '>') return Number(flagVal) > Number(cond.value);
        if (cond.op === '<') return Number(flagVal) < Number(cond.value);
        return false;
      }

      case 'day': {
        const day = snap.sim_current_day;
        const target = Number(cond.value ?? 1);
        if (cond.op === '==' || !cond.op) return day === target;
        if (cond.op === '>=') return day >= target;
        if (cond.op === '<=') return day <= target;
        if (cond.op === '>') return day > target;
        if (cond.op === '<') return day < target;
        if (cond.op === '!=') return day !== target;
        return false;
      }

      case 'time': {
        const timeMin = snap.sim_current_time_minute;
        const target = Number(cond.value ?? 0);
        if (cond.op === '>=') return timeMin >= target;
        if (cond.op === '<=') return timeMin <= target;
        if (cond.op === '>') return timeMin > target;
        if (cond.op === '<') return timeMin < target;
        return timeMin === target;
      }

      case 'cash': {
        const cash = snap.sim_player_cash;
        const target = Number(cond.value ?? 0);
        if (cond.op === '>=') return cash >= target;
        if (cond.op === '<=') return cash <= target;
        if (cond.op === '>') return cash > target;
        if (cond.op === '<') return cash < target;
        return cash === target;
      }

      case 'os': {
        return snap.sim_os_version === cond.value;
      }

      case 'ram': {
        const ram = snap.sim_ram_mb;
        const target = Number(cond.value ?? 512);
        if (cond.op === '>=') return ram >= target;
        if (cond.op === '<=') return ram <= target;
        return ram === target;
      }

      case 'installed': {
        if (cond.appId === 'photobox') return snap.sim_photobox_installed;
        if (cond.appId === 'weatherbuddy') return snap.sim_weatherbuddy_installed;
        if (cond.appId === 'safesweep') return snap.sim_safesweep_installed;
        if (cond.appId === 'flashfetch') return snap.sim_flashfetch_installed;
        if (cond.appId === 'zipmate') return snap.sim_zipmate_installed;
        if (cond.appId === 'retroamp') return snap.sim_retroamp_installed;
        return false;
      }

      case 'relationship': {
        if (!cond.buddyId || !cond.dimension) return false;
        const dimMap: Record<string, Record<string, number>> = {
          familiarity: snap.sim_buddies_familiarity,
          trust: snap.sim_buddies_trust,
          comfort: snap.sim_buddies_comfort,
          respect: snap.sim_buddies_respect,
          annoyance: snap.sim_buddies_annoyance,
        };
        const curVal = dimMap[cond.dimension]?.[cond.buddyId] ?? 0;
        const target = Number(cond.value ?? 0);
        if (cond.op === '>=') return curVal >= target;
        if (cond.op === '<=') return curVal <= target;
        if (cond.op === '>') return curVal > target;
        if (cond.op === '<') return curVal < target;
        return curVal === target;
      }

      case 'beat_completed': {
        const beatId = cond.beatId || String(cond.value);
        return snap.completedBeats.includes(beatId);
      }

      default:
        return true;
    }
  }

  public isKnotEligible(knot: StoryKnot, snapshot?: NarrativeContextSnapshot): boolean {
    const snap = snapshot || this.contextSnapshot;
    if (!snap) return true;

    // Check Day constraint
    if (knot.day !== undefined && knot.day !== snap.sim_current_day) {
      return false;
    }

    // Check Time Window
    if (knot.timeWindow) {
      const curMin = snap.sim_current_time_minute;
      if (curMin < knot.timeWindow.startMinute || curMin > knot.timeWindow.endMinute) {
        return false;
      }
    }

    // Check Required Beat
    if (knot.requiredBeatId && !snap.completedBeats.includes(knot.requiredBeatId)) {
      return false;
    }

    // Check Prerequisites
    if (knot.prerequisites) {
      for (const req of knot.prerequisites) {
        if (!this.evaluateCondition(req, snap)) {
          return false;
        }
      }
    }

    return true;
  }

  public isChoiceAvailable(choice: StoryChoice, snapshot?: NarrativeContextSnapshot): boolean {
    const snap = snapshot || this.contextSnapshot;
    if (!snap) return true;

    if (choice.requiredFamiliarity !== undefined) {
      const fam = snap.sim_maya_familiarity;
      if (fam < choice.requiredFamiliarity) return false;
    }

    if (choice.requiredTrust !== undefined) {
      const tr = snap.sim_maya_trust;
      if (tr < choice.requiredTrust) return false;
    }

    if (choice.conditionFlag && !snap.flags[choice.conditionFlag]) {
      return false;
    }

    if (choice.conditions) {
      for (const cond of choice.conditions) {
        if (!this.evaluateCondition(cond, snap)) {
          return false;
        }
      }
    }

    return true;
  }

  public startKnot(knotId: string): StoryKnot | null {
    const knot = this.knots.get(knotId);
    if (!knot) return null;

    this.currentKnotId = knotId;
    this.visitedKnotIds.add(knotId);

    // Process top-level tags on knot
    if (knot.tags) {
      this.processTags(knot.tags);
    }

    return knot;
  }

  public processTags(tags: string[]): ParsedNarrativeTag[] {
    const parsed = parseAllNarrativeTags(tags);
    for (const tag of parsed) {
      if (tag.type === 'beat') {
        this.activeBeatId = tag.beatId;
        this.completedBeats.add(tag.beatId);
      } else if (tag.type === 'effect_flag') {
        this.flags.set(tag.key, tag.value);
        if (this.contextSnapshot) {
          this.contextSnapshot.flags[tag.key] = tag.value;
        }
      }
    }
    return parsed;
  }

  public getAvailableChoices(knotId?: string): StoryChoice[] {
    const targetKnotId = knotId || this.currentKnotId;
    if (!targetKnotId) return [];

    const knot = this.knots.get(targetKnotId);
    if (!knot || !knot.choices) return [];

    return knot.choices.filter((choice) => this.isChoiceAvailable(choice));
  }

  public setFlag(key: string, value: boolean | number | string): void {
    this.flags.set(key, value);
    if (this.contextSnapshot) {
      this.contextSnapshot.flags[key] = value;
    }
  }

  public getFlag(key: string): boolean | number | string | undefined {
    return this.flags.get(key) ?? this.contextSnapshot?.flags[key];
  }

  public hasFlag(key: string): boolean {
    const val = this.getFlag(key);
    return val !== undefined && val !== false;
  }

  public markBeatCompleted(beatId: string): void {
    this.completedBeats.add(beatId);
    if (this.contextSnapshot && !this.contextSnapshot.completedBeats.includes(beatId)) {
      this.contextSnapshot.completedBeats.push(beatId);
    }
  }

  public isBeatCompleted(beatId: string): boolean {
    return this.completedBeats.has(beatId) || (this.contextSnapshot?.completedBeats.includes(beatId) ?? false);
  }

  public getState(): NarrativeEngineState {
    const flagsObj: Record<string, boolean | number | string> = {};
    for (const [k, v] of this.flags.entries()) flagsObj[k] = v;

    let storyStateJson: string | undefined;
    if (this.story) {
      try {
        storyStateJson = this.story.state.ToJson();
      } catch {
        // Serialization fallback
      }
    }

    return {
      activeBeatId: this.activeBeatId,
      completedBeats: Array.from(this.completedBeats),
      visitedKnotIds: Array.from(this.visitedKnotIds),
      flags: flagsObj,
      storyStateJson,
    };
  }

  public restoreState(state: NarrativeEngineState): void {
    this.activeBeatId = state.activeBeatId;
    this.completedBeats = new Set(state.completedBeats || []);
    this.visitedKnotIds = new Set(state.visitedKnotIds || []);
    this.flags.clear();
    if (state.flags) {
      for (const [k, v] of Object.entries(state.flags)) {
        this.flags.set(k, v);
      }
    }

    if (state.storyStateJson && this.story) {
      try {
        this.story.state.LoadJson(state.storyStateJson);
      } catch (err) {
        console.warn('Failed to restore story state JSON:', err);
      }
    }
  }
}
