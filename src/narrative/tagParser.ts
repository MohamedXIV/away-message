import { ParsedNarrativeTag, SocialActionType } from './types';
import { CORE_IDS } from '../engine/coreBuddies';

/**
 * Parses raw Ink or story tags into typed semantic commands.
 */
export function parseNarrativeTag(rawTag: string, fallbackBuddyId?: string): ParsedNarrativeTag {
  const trimmed = rawTag.trim();
  const cleanTag = trimmed.startsWith('#') ? trimmed.substring(1).trim() : trimmed;

  // 1. # beat:<beatId>
  if (cleanTag.startsWith('beat:')) {
    const beatId = cleanTag.substring('beat:'.length).trim();
    return {
      type: 'beat',
      beatId,
      raw: trimmed,
    };
  }

  // 2. # effect:...
  if (cleanTag.startsWith('effect:')) {
    const rest = cleanTag.substring('effect:'.length).trim();
    const parts = rest.split(':');

    if (parts[0] === 'flag') {
      const key = parts[1] || '';
      const rawVal = parts.slice(2).join(':');
      let value: boolean | number | string = rawVal;
      if (rawVal === 'true') value = true;
      else if (rawVal === 'false') value = false;
      else if (!isNaN(Number(rawVal)) && rawVal !== '') value = Number(rawVal);

      return {
        type: 'effect_flag',
        key,
        value,
        raw: trimmed,
      };
    }

    if (parts[0] === 'money') {
      const action = parts[1] === 'earn' ? 'earn' : 'spend';
      const amount = parts[2] ? parseFloat(parts[2]) : 0;
      const reason = parts[3] || 'narrative_event';
      return {
        type: 'effect_money',
        action,
        amount: isNaN(amount) ? 0 : amount,
        reason,
        raw: trimmed,
      };
    }

    if (parts[0] === 'file') {
      const action = parts[1] === 'delete' ? 'delete' : 'create';
      const remaining = parts.slice(2);
      const knownKinds = ['text', 'image', 'audio', 'archive', 'installer', 'executable', 'shortcut', 'system'];
      
      let kind = 'text';
      let path = '';

      if (remaining.length > 1 && knownKinds.includes(remaining[remaining.length - 1] ?? '')) {
        kind = remaining[remaining.length - 1] ?? 'text';
        path = remaining.slice(0, -1).join(':');
      } else {
        path = remaining.join(':');
      }

      return {
        type: 'effect_file',
        action,
        path,
        kind,
        raw: trimmed,
      };
    }

    if (parts[0] === 'view') {
      // effect:view:switch:<view> or effect:view:<view>
      let view = parts[1] === 'switch' ? (parts[2] || 'pc') : (parts[1] || 'pc');
      if (view !== 'room' && view !== 'cafe' && view !== 'work' && view !== 'pc') {
        view = 'pc';
      }
      return {
        type: 'effect_view',
        view: view as 'pc' | 'room' | 'cafe' | 'work',
        raw: trimmed,
      };
    }
  }

  // 3. # social:<buddyId>:<action>
  if (cleanTag.startsWith('social:')) {
    const parts = cleanTag.substring('social:'.length).trim().split(':');
    const buddyId = parts[0] || fallbackBuddyId || CORE_IDS.MAYA;
    const action = (parts[1] || 'empathy') as SocialActionType;
    return {
      type: 'social',
      buddyId,
      action,
      raw: trimmed,
    };
  }

  // 4. # schedule:appointment:<id>:<day>:<sMin>:<eMin>:<loc>:<desc>
  if (cleanTag.startsWith('schedule:')) {
    const rest = cleanTag.substring('schedule:'.length).trim();
    const parts = rest.split(':');
    if (parts[0] === 'appointment') {
      const appointmentId = parts[1] || 'appt_' + Date.now();
      const day = parts[2] ? parseInt(parts[2], 10) : 1;
      const startMinute = parts[3] ? parseInt(parts[3], 10) : 900;
      const endMinute = parts[4] ? parseInt(parts[4], 10) : 960;
      const location = parts[5] || 'cafe';
      const description = parts.slice(6).join(':') || 'Appointment';

      return {
        type: 'schedule_appointment',
        appointmentId,
        day: isNaN(day) ? 1 : day,
        startMinute: isNaN(startMinute) ? 900 : startMinute,
        endMinute: isNaN(endMinute) ? 960 : endMinute,
        location,
        description,
        raw: trimmed,
      };
    }
  }

  // 5. # unlock:<target_type>:<target_id>
  if (cleanTag.startsWith('unlock:')) {
    const parts = cleanTag.substring('unlock:'.length).trim().split(':');
    const targetType = (parts[0] || 'website') as 'website' | 'app' | 'search_term' | 'file';
    const targetId = parts.slice(1).join(':');
    return {
      type: 'unlock',
      targetType,
      targetId,
      raw: trimmed,
    };
  }

  return {
    type: 'unknown',
    raw: trimmed,
  };
}

export function parseAllNarrativeTags(tags?: string[]): ParsedNarrativeTag[] {
  if (!tags || tags.length === 0) return [];
  return tags.map((tag) => parseNarrativeTag(tag));
}
