// src/engine/BoardDirector.ts
// P5.6 living board & mail — pure deterministic generators for NPC-authored
// NightBoard threads (with cross-talk replies) and NPC mail chains.
// No state, no AI, no persistence: outputs are pure functions of (day + roster +
// affinities + world events + appointment history), so reloads render identically.

import {
  pickBoardTopic,
  pickBoardEventThread,
  pickBoardReply,
  pickMailThanks,
  pickMailApology,
  pickMailFarewell,
  pickMailWelcome,
  resolveArchetype,
} from './characterTemplates';
import { CORE_IDS } from './coreBuddies';
import type { CharacterArchetype } from './types';

function hashStr(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

export interface BoardBuddy {
  id: string;
  displayName: string;
  handle: string;
  archetype?: CharacterArchetype;
  stage: string;
  status?: string;
  roles?: string[];
}

export interface NpcThreadReply {
  author: string;
  authorHandle: string;
  text: string;
  day: number;
}

export interface NpcThread {
  key: string;
  numericId: number;
  title: string;
  author: string;
  authorHandle: string;
  day: number;
  body: string;
  replies: NpcThreadReply[];
}

/** Which 7-day week a game day belongs to (week 0 = days 1..7). */
export function npcThreadWeek(day: number): number {
  return Math.floor((Math.max(1, Math.floor(day) || 1) - 1) / 7);
}

function activeSorted(buddies: BoardBuddy[]): BoardBuddy[] {
  return buddies
    .filter((b) => b.status !== 'distant' && b.status !== 'gone' && b.status !== 'blocked')
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

function buildThreadReplies(
  eligible: BoardBuddy[],
  authorId: string,
  seedBase: string,
  count: number,
  affinities: (a: string, b: string) => number,
  opDay: number,
  weekStartDay: number
): NpcThreadReply[] {
  const out: NpcThreadReply[] = [];
  const replierPool = eligible.filter((b) => b.id !== authorId);
  if (replierPool.length === 0) return out;
  for (let i = 0; i < count; i++) {
    const replier = replierPool[hashStr(`${seedBase}:r${i}`) % replierPool.length]!;
    // Cross-talk: address the present buddy this replier feels strongest about (50%)
    let addressName: string | undefined;
    const others = eligible.filter((b) => b.id !== replier.id && b.id !== authorId);
    if (others.length > 0 && hashStr(`${seedBase}:x${i}`) % 100 < 50) {
      let best = others[0]!;
      for (const o of others) {
        if (Math.abs(affinities(replier.id, o.id)) > Math.abs(affinities(replier.id, best.id))) best = o;
      }
      if (Math.abs(affinities(replier.id, best.id)) >= 10) addressName = best.displayName;
    }
    out.push({
      author: replier.displayName,
      authorHandle: replier.handle,
      text: pickBoardReply(`${seedBase}:reply${i}`, addressName),
      // P6.5 timed posts: replies land 1..3 days after the OP, inside the same week
      day: Math.min(opDay + 1 + i, weekStartDay + 6),
    });
  }
  return out;
}

/**
 * Weekly NPC threads for the week containing `day`: 2 archetype-flavoured
 * starters (2 cross-talk replies each) + 1 world-event thread when there is
 * fresh news. Deterministic per (week, roster).
 */
export function buildWeeklyNpcThreads(
  day: number,
  buddies: BoardBuddy[],
  affinities: (a: string, b: string) => number,
  worldTitles: string[]
): NpcThread[] {
  const eligible = activeSorted(buddies);
  if (eligible.length === 0) return [];
  const week = npcThreadWeek(day);
  const weekStartDay = week * 7 + 1;
  const threads: NpcThread[] = [];

  const makeReplies = (authorId: string, seedBase: string, count: number, opDay: number): NpcThreadReply[] =>
    buildThreadReplies(eligible, authorId, seedBase, count, affinities, opDay, weekStartDay);

  for (let slot = 0; slot < 2; slot++) {
    const author = eligible[hashStr(`w${week}:a${slot}`) % eligible.length]!;
    const topic = pickBoardTopic(resolveArchetype(author.id, author.archetype), week, slot);
    const key = `npcweek_${week}_${slot}`;
    // P6.5 timed OPs: threads open across the first two days of their week
    const opDay = weekStartDay + (hashStr(`${key}:op`) % 2);
    threads.push({
      key,
      numericId: 9000 + week * 10 + slot,
      title: topic.title,
      author: author.displayName,
      authorHandle: author.handle,
      day: opDay,
      body: topic.body,
      replies: makeReplies(author.id, `${key}:${author.id}`, 2, opDay),
    });
  }

  const freshTitles = worldTitles.map((t) => t.trim()).filter((t) => t.length > 3);
  if (freshTitles.length > 0) {
    const author = eligible[hashStr(`w${week}:ea`) % eligible.length]!;
    const title = freshTitles[hashStr(`w${week}:et`) % freshTitles.length]!;
    const evt = pickBoardEventThread(`w${week}:eb`, title);
    const key = `npcevent_${week}`;
    const opDay = weekStartDay + (hashStr(`${key}:op`) % 2);
    threads.push({
      key,
      numericId: 9500 + week,
      title: evt.title,
      author: author.displayName,
      authorHandle: author.handle,
      day: opDay,
      body: evt.body,
      replies: makeReplies(author.id, `${key}:${author.id}`, 1, opDay),
    });
  }
  return threads;
}

// ==========================================
// NPC MAIL CHAINS (due-date driven, max 2/day)
// ==========================================

export interface MeetingRecord {
  buddyId: string;
  targetDay: number;
  status?: string;
  npcShowed?: boolean;
  playerShowed?: boolean;
  locationLabel: string;
}

export interface SharpRecord {
  buddyId: string;
  /** current sharp flag: confronted/distant/gone/returned (or empty) */
  state: string;
  /** game day of the latest sharp transition */
  stateDay: number;
}

export interface NpcMail {
  key: string;
  buddyId: string;
  sender: string;
  senderEmail: string;
  subject: string;
  body: string;
  day: number;
}

export interface MailContext {
  day: number;
  buddies: BoardBuddy[];
  sharps: SharpRecord[];
  meetings: MeetingRecord[];
}

function buddyById(buddies: BoardBuddy[], id: string): BoardBuddy | undefined {
  return buddies.find((b) => b.id === id);
}

/**
 * NPC mail due exactly on ctx.day (call per day 1..today, collect, cap):
 * farewell/welcome on sharp-transition days, thanks/apology the morning after
 * a resolved meeting. Priority: farewell > welcome > apology > thanks. Max 2/day.
 */
export function buildNpcMailForDay(ctx: MailContext): NpcMail[] {
  const day = Math.max(1, Math.floor(ctx.day) || 1);
  const out: Array<NpcMail & { priority: number }> = [];
  const push = (mail: NpcMail, priority: number): void => {
    const buddy = buddyById(ctx.buddies, mail.buddyId);
    if (!buddy) return;
    out.push({
      ...mail,
      sender: buddy.displayName,
      senderEmail: `${buddy.handle}@myplace.local`,
      priority,
    });
  };

  for (const sharp of ctx.sharps) {
    if (sharp.stateDay !== day) continue;
    if (sharp.state === 'distant' || sharp.state === 'gone') {
      push({
        key: `npcmail_farewell_${sharp.buddyId}_${day}`,
        buddyId: sharp.buddyId,
        sender: '', senderEmail: '',
        subject: sharp.state === 'gone' ? 'goodbye for now' : 'need some space',
        body: pickMailFarewell(`${sharp.buddyId}:${day}:farewell`),
        day,
      }, 0);
    } else if (sharp.state === 'returned') {
      push({
        key: `npcmail_welcome_${sharp.buddyId}_${day}`,
        buddyId: sharp.buddyId,
        sender: '', senderEmail: '',
        subject: 'im back',
        body: pickMailWelcome(`${sharp.buddyId}:${day}:welcome`),
        day,
      }, 1);
    }
  }

  for (const meeting of ctx.meetings) {
    if (meeting.targetDay !== day - 1) continue;
    if (meeting.status === 'happened' && meeting.npcShowed && meeting.playerShowed) {
      push({
        key: `npcmail_thanks_${meeting.buddyId}_${day}`,
        buddyId: meeting.buddyId,
        sender: '', senderEmail: '',
        subject: 're: last night',
        body: `${pickMailThanks(`${meeting.buddyId}:${day}:thanks`, meeting.locationLabel)}\n\n(reply on Pulse — i check it way more than mail lol)`,
        day,
      }, 3);
    } else if (meeting.status === 'missed' && !meeting.npcShowed && meeting.playerShowed) {
      push({
        key: `npcmail_apology_${meeting.buddyId}_${day}`,
        buddyId: meeting.buddyId,
        sender: '', senderEmail: '',
        subject: 'about yesterday — im sorry',
        body: `${pickMailApology(`${meeting.buddyId}:${day}:apology`, meeting.locationLabel)}\n\n(reply on Pulse — i check it way more than mail lol)`,
        day,
      }, 2);
    }
  }

  out.sort((a, b) => a.priority - b.priority || (a.buddyId < b.buddyId ? -1 : 1));
  return out.slice(0, 2).map(({ priority: _priority, ...mail }) => mail);
}

/** Game day → display date (day 1 = Aug 22, 2006, matching the static inbox). */
export function gameDayToMailDate(day: number): string {
  const date = new Date(2006, 7, 21 + Math.max(1, Math.floor(day) || 1));
  const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${label} 08:00 PM`;
}

// ==========================================
// P6.4 RENT MAIL (paper trail for the escalation ladder)
// ==========================================

export interface RentMailContext {
  day: number;
  dueDay: number;
  paid: boolean;
  amount: number;
}

/**
 * P6.4 rent paper trail, reconstructed from world flags so notices survive
 * payment: processRentDaily stamps `rentmail_due_{dueDay}` on the reminder
 * and `rentmail_overdue_{dueDay}` on the second notice (values: amount cents).
 */
export function buildRentMailHistory(flags: Record<string, boolean | number | string>, landlordId?: string): NpcMail[] {
  const out: NpcMail[] = [];
  for (const [key, value] of Object.entries(flags)) {
    const match = key.match(/^rentmail_(due|overdue)_(\d+)$/);
    if (!match || typeof value !== 'number') continue;
    const kind = match[1]!;
    const dueDay = Math.max(1, parseInt(match[2]!, 10) || 1);
    const amount = value / 100;
    const day = kind === 'due' ? dueDay : dueDay + 1;
    out.push({
      key: `rentmail_${kind}_${dueDay}`,
      buddyId: landlordId ?? CORE_IDS.HENDERSON,
      sender: 'Mr. Henderson',
      senderEmail: 'desk@starlitemotel.local',
      subject: kind === 'due' ? `Room 104 rent due — $${amount.toFixed(2)}` : 'Second notice — Room 104',
      body: kind === 'due'
        ? `Dear occupant of Room 104,\n\nThis is a reminder that your weekly rent of $${amount.toFixed(2)} is due today. Please settle at the front desk before 8pm to avoid a late fee.\n\nNote: the DSL wall port stays active regardless. Downloads, however, nap until we settle.\n\n- Front Desk Management`
        : `Dear occupant,\n\nRoom 104 remains unpaid ($${amount.toFixed(2)} plus any late fee). Your download line is paused until we settle — browsing still works, patience still free.\n\nCome see me at the desk.\n\n- Front Desk Management`,
      day,
    });
  }
  out.sort((a, b) => a.day - b.day);
  return out;
}

// ==========================================
// P6.2 WEEKLY WEATHER THREAD (deterministic forecast chat)
// ==========================================

const WEATHER_SEVERITY: Record<string, number> = {
  storm: 6, rain: 5, heat: 4, fog: 3, drizzle: 2, overcast: 1, clear: 0,
};

/**
 * One weather thread per week: the most dramatic day leads, the 7-day strip
 * is the body. Authors rotate to whoever loves (or hates) it most:
 * wet weeks → Maya, heat → Ryan, fog → Nora, else round-robin.
 */
export function buildWeeklyWeatherThread(
  day: number,
  buddies: BoardBuddy[],
  getWeather: (day: number) => { condition: string; label: string; icon: string; highF: number },
  dayName: (day: number) => string,
  affinities: (a: string, b: string) => number = () => 0
): NpcThread | null {
  const eligible = activeSorted(buddies);
  if (eligible.length === 0) return null;
  const week = npcThreadWeek(day);
  const firstDay = week * 7 + 1;
  const strip = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ day: firstDay + i, weather: getWeather(firstDay + i) }));
  let lead = strip[0]!;
  for (const entry of strip) {
    if ((WEATHER_SEVERITY[entry.weather.condition] ?? 0) > (WEATHER_SEVERITY[lead.weather.condition] ?? 0)) lead = entry;
  }
  const severe = lead.weather.condition;
  let author = eligible[hashStr(`wx${week}:a`) % eligible.length]!;
  const lover = severe === 'heat'
    ? eligible.find((b) => b.archetype === 'coworker')
    : severe === 'fog'
      ? eligible.find((b) => b.archetype === 'nightowl')
      : (severe === 'rain' || severe === 'drizzle' || severe === 'storm')
        ? eligible.find((b) => (b.roles ?? []).includes('rain-lover')) ?? eligible.find((b) => b.archetype === 'artist')
        : undefined;
  if (lover) author = lover;
  const key = `npcweather_${week}`;
  const body = strip.map((s) => `${dayName(s.day)} ${s.weather.icon} ${s.weather.highF}F`).join(' / ');
  const title = severe === 'storm'
    ? `STORM incoming ${dayName(lead.day)} ${lead.weather.icon} — megathread`
    : `week ahead: ${lead.weather.label.toLowerCase()} ${lead.weather.icon} (peak ${dayName(lead.day)})`;
  const opDay = firstDay + (hashStr(`${key}:op`) % 2);
  return {
    key,
    numericId: 9600 + week,
    title,
    author: author.displayName,
    authorHandle: author.handle,
    day: opDay,
    body: `forecast strip, take it or leave it: ${body}. plan accordingly, people.`,
    replies: buildThreadReplies(eligible, author.id, `${key}:${author.id}`, 1, affinities, opDay, firstDay),
  };
}
