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
  friends: { label: 'Friends & People', memberIds: ['maya', 'ryan', 'nora'] },
  work: { label: 'Work / Motel', memberIds: ['henderson'] },
};

export const PULSE_ROOMS: PulseRoom[] = [
  {
    id: 'orion-lounge',
    name: 'Orion Lounge',
    topic: 'general chat · no caps unless urgent',
    description: 'The default lobby for people who are online too late.',
    participantIds: ['maya', 'ryan', 'nora'],
    color: '#6b4c9a',
    seedMessages: [
      { senderId: 'ryan', text: 'welcome to the lounge ppl', minute: 1324 },
      { senderId: 'nora', text: 'the room is quiet tonight.', minute: 1326 },
    ],
  },
  {
    id: 'pc-help',
    name: 'PC Help & Tweaks',
    topic: 'hardware · drivers · overclocking · no warranty',
    description: 'A noisy little help room for modders and desperate downloaders.',
    participantIds: ['ryan', 'henderson'],
    color: '#26736a',
    seedMessages: [
      { senderId: 'ryan', text: 'anyone got a driver mirror that isnt crawling?', minute: 1302 },
      { senderId: 'henderson', text: 'Please keep file names descriptive.', minute: 1304 },
    ],
  },
  {
    id: 'night-shift',
    name: 'Night Shift Radio',
    topic: 'music · streetlights · things heard after midnight',
    description: 'For people who keep the lights on while everyone else sleeps.',
    participantIds: ['maya', 'nora'],
    color: '#315a8c',
    seedMessages: [
      { senderId: 'maya', text: 'sending a playlist link in a sec...', minute: 1288 },
      { senderId: 'nora', text: 'heard the low hum again by the canal.', minute: 1291 },
    ],
  },
];

export function getPulseRoom(roomId: string): PulseRoom | undefined {
  return PULSE_ROOMS.find((room) => room.id === roomId);
}
