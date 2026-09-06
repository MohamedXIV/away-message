import { CORE_IDS } from '../../../engine/coreBuddies';

export interface PulseRoom {
  id: string;
  name: string;
  topic: string;
  description: string;
  participantIds: string[];
  color: string;
  seedMessages: Array<{ senderId: string; text: string; minute: number }>;
}

export const PULSE_GROUPS: Record<string, { label: string; memberIds: string[] }> = {
  friends: { label: 'Friends & People', memberIds: [CORE_IDS.MAYA, CORE_IDS.RYAN, CORE_IDS.NORA] },
  work: { label: 'Work / Motel', memberIds: [CORE_IDS.HENDERSON] },
};

export const PULSE_ROOMS: PulseRoom[] = [
  {
    id: 'orion-lounge',
    name: 'Orion Lounge',
    topic: 'general chat · no caps unless urgent',
    description: 'The default lobby for people who are online too late.',
    participantIds: [CORE_IDS.MAYA, CORE_IDS.RYAN, CORE_IDS.NORA],
    color: '#6b4c9a',
    seedMessages: [
      { senderId: CORE_IDS.RYAN, text: 'welcome to the lounge ppl', minute: 1324 },
      { senderId: CORE_IDS.NORA, text: 'the room is quiet tonight.', minute: 1326 },
    ],
  },
  {
    id: 'pc-help',
    name: 'PC Help & Tweaks',
    topic: 'hardware · drivers · overclocking · no warranty',
    description: 'A noisy little help room for modders and desperate downloaders.',
    participantIds: [CORE_IDS.RYAN, CORE_IDS.HENDERSON],
    color: '#26736a',
    seedMessages: [
      { senderId: CORE_IDS.RYAN, text: 'anyone got a driver mirror that isnt crawling?', minute: 1302 },
      { senderId: CORE_IDS.HENDERSON, text: 'Please keep file names descriptive.', minute: 1304 },
    ],
  },
  {
    id: 'night-shift',
    name: 'Night Shift Radio',
    topic: 'music · streetlights · things heard after midnight',
    description: 'For people who keep the lights on while everyone else sleeps.',
    participantIds: [CORE_IDS.MAYA, CORE_IDS.NORA],
    color: '#315a8c',
    seedMessages: [
      { senderId: CORE_IDS.MAYA, text: 'sending a playlist link in a sec...', minute: 1288 },
      { senderId: CORE_IDS.NORA, text: 'heard the low hum again by the canal.', minute: 1291 },
    ],
  },
];

export function getPulseRoom(roomId: string): PulseRoom | undefined {
  return PULSE_ROOMS.find((room) => room.id === roomId);
}
