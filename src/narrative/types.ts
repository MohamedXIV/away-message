import {
  OsVersion,
  ConnectionType,
  TimeOfDay,
} from '../engine/types';

export type SocialActionType =
  | 'empathy'
  | 'remembered_detail'
  | 'tease_playful'
  | 'dismissive'
  | 'vulnerable_share'
  | 'work_camaraderie'
  | 'intellectual_curiosity';

export interface DialogueLine {
  id: string;
  speaker: string; // 'player' | 'ryan' | 'maya' | 'nora' | 'henderson' | 'system'
  text: string;
  delaySeconds?: number;
  tags?: string[];
}

export type NarrativeConditionType =
  | 'flag'
  | 'day'
  | 'time'
  | 'cash'
  | 'os'
  | 'ram'
  | 'installed'
  | 'relationship'
  | 'beat_completed'
  | 'custom';

export interface NarrativeCondition {
  type: NarrativeConditionType;
  key?: string;
  op?: '==' | '!=' | '>=' | '<=' | '>' | '<';
  value?: unknown;
  buddyId?: string;
  dimension?: 'familiarity' | 'trust' | 'comfort' | 'respect' | 'annoyance';
  appId?: string;
  beatId?: string;
}

export interface StoryChoice {
  id: string;
  text: string;
  targetKnot?: string;
  socialAction?: SocialActionType;
  conditions?: NarrativeCondition[];
  tags?: string[];
  requiredFamiliarity?: number;
  requiredTrust?: number;
  conditionFlag?: string;
  nextScriptId?: string;
}

export interface StoryKnot {
  id: string;
  characterId: string;
  title?: string;
  day?: number;
  timeWindow?: {
    startMinute: number; // 0..1439
    endMinute: number;   // 0..1439
  };
  prerequisites?: NarrativeCondition[];
  requiredBeatId?: string;
  lines: DialogueLine[];
  choices?: StoryChoice[];
  defaultNextKnot?: string;
  tags?: string[];
}

export type ParsedNarrativeTag =
  | { type: 'beat'; beatId: string; raw: string }
  | { type: 'effect_flag'; key: string; value: boolean | number | string; raw: string }
  | { type: 'effect_money'; action: 'spend' | 'earn'; amount: number; reason: string; raw: string }
  | { type: 'effect_file'; action: 'create' | 'delete'; path: string; kind?: string; raw: string }
  | { type: 'effect_view'; view: 'pc' | 'room' | 'cafe' | 'work'; raw: string }
  | { type: 'social'; buddyId: string; action: SocialActionType; raw: string }
  | {
      type: 'schedule_appointment';
      appointmentId: string;
      day: number;
      startMinute: number;
      endMinute: number;
      location: string;
      description: string;
      characterId?: string;
      raw: string;
    }
  | { type: 'unlock'; targetType: 'website' | 'app' | 'search_term' | 'file'; targetId: string; raw: string }
  | { type: 'unknown'; raw: string };

export interface NarrativeContextSnapshot {
  sim_current_day: number;
  sim_current_time_minute: number;
  sim_time_of_day: TimeOfDay;
  sim_player_cash: number;
  sim_player_energy: number;
  sim_player_fatigue: number;
  sim_os_version: OsVersion;
  sim_ram_mb: number;
  sim_connection_type: ConnectionType;
  sim_photobox_installed: boolean;
  sim_weatherbuddy_installed: boolean;
  sim_safesweep_installed: boolean;
  sim_flashfetch_installed: boolean;
  sim_zipmate_installed: boolean;
  sim_retroamp_installed: boolean;
  sim_rent_paid: boolean;
  sim_internet_paid: boolean;
  sim_buddies_familiarity: Record<string, number>;
  sim_buddies_trust: Record<string, number>;
  sim_buddies_comfort: Record<string, number>;
  sim_buddies_respect: Record<string, number>;
  sim_buddies_annoyance: Record<string, number>;
  // Character individual metrics
  sim_maya_familiarity: number;
  sim_maya_trust: number;
  sim_maya_comfort: number;
  sim_maya_respect: number;
  sim_maya_annoyance: number;
  sim_ryan_familiarity: number;
  sim_ryan_trust: number;
  sim_ryan_comfort: number;
  sim_ryan_respect: number;
  sim_ryan_annoyance: number;
  sim_nora_familiarity: number;
  sim_nora_trust: number;
  sim_nora_comfort: number;
  sim_nora_respect: number;
  sim_nora_annoyance: number;
  sim_henderson_familiarity: number;
  sim_henderson_trust: number;
  sim_henderson_comfort: number;
  sim_henderson_respect: number;
  sim_henderson_annoyance: number;
  flags: Record<string, boolean | number | string>;
  completedBeats: string[];
}

export interface NarrativeEngineState {
  activeBeatId: string | null;
  completedBeats: string[];
  visitedKnotIds: string[];
  flags: Record<string, boolean | number | string>;
}

export interface BeatTriggerEvaluationResult {
  knot: StoryKnot;
  characterId: string;
  eligible: boolean;
  reason?: string;
}
