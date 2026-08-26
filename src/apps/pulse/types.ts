export interface PulseFontFormatting {
  fontFamily: 'Tahoma' | 'Arial' | 'Comic Sans MS' | 'Times New Roman' | 'Courier New';
  fontSize: '11px' | '12px' | '14px';
  color: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
}

export interface EmoticonDefinition {
  code: string;
  altCodes?: string[];
  label: string;
  glyph: string;
  isOrion60Only?: boolean;
}

export interface DialogueChoiceOption {
  id: string;
  text: string;
  socialAction: 'empathy' | 'remembered_detail' | 'tease_playful' | 'dismissive' | 'vulnerable_share' | 'work_camaraderie' | 'intellectual_curiosity';
  requiredFamiliarity?: number;
  requiredTrust?: number;
  conditionFlag?: string;
  nextScriptId?: string;
}

export interface NpcDialogueScript {
  id: string;
  buddyId: string;
  day?: number;
  triggerMinuteMin?: number;
  triggerMinuteMax?: number;
  requiredBeatId?: string;
  messages: Array<{
    text: string;
    delaySeconds?: number;
    tags?: string[];
  }>;
  playerChoices?: DialogueChoiceOption[];
}

export interface PulseNotification {
  id: string;
  buddyId: string;
  buddyName: string;
  buddyHandle: string;
  avatarUrl?: string;
  textSnippet: string;
  timestamp: string;
  createdAt: number;
}
