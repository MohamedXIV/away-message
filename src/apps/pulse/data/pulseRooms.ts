import { seedCharacterWithRole } from '../../../engine/seedCharacters';

export interface PulseRoom {
  id: string;
  name: string;
  topic: string;
  description: string;
  participantIds: string[];
  color: string;
  seedMessages: Array<{ senderId: string; text: string; minute: number }>;
}

function actorForRole(role: string): string | null {
  return seedCharacterWithRole(role)?.id ?? null;
}

function roleIds(...roles: string[]): string[] {
  return roles.map(actorForRole).filter((id): id is string => !!id);
}

function seedMessage(role: string, text: string, minute: number): Array<{ senderId: string; text: string; minute: number }> {
  const senderId = actorForRole(role);
  return senderId ? [{ senderId, text, minute }] : [];
}

export const PULSE_GROUPS: Record<string, { label: string; memberIds: string[] }> = {
  friends: { label: 'Friends & People', memberIds: roleIds('diner-staff', 'cart-owner', 'canal-regular') },
  work: { label: 'Work / Property', memberIds: roleIds('landlord') },
};

export const PULSE_ROOMS: PulseRoom[] = [
  {
    id: 'orion-lounge',
    name: 'Orion Lounge',
    topic: 'general chat · no caps unless urgent',
    description: 'The default lobby for people who are online too late.',
    participantIds: roleIds('diner-staff', 'cart-owner', 'canal-regular'),
    color: '#6b4c9a',
    seedMessages: [
      ...seedMessage('cart-owner', 'welcome to the lounge ppl', 1324),
      ...seedMessage('canal-regular', 'the room is quiet tonight.', 1326),
    ],
  },
  {
    id: 'pc-help',
    name: 'PC Help & Tweaks',
    topic: 'hardware · drivers · overclocking · no warranty',
    description: 'A noisy little help room for modders and desperate downloaders.',
    participantIds: roleIds('cart-owner', 'landlord'),
    color: '#26736a',
    seedMessages: [
      ...seedMessage('cart-owner', 'anyone got a driver mirror that isnt crawling?', 1302),
      ...seedMessage('landlord', 'Please keep file names descriptive.', 1304),
    ],
  },
  {
    id: 'night-shift',
    name: 'Night Shift Radio',
    topic: 'music · streetlights · things heard after midnight',
    description: 'For people who keep the lights on while everyone else sleeps.',
    participantIds: roleIds('diner-staff', 'canal-regular'),
    color: '#315a8c',
    seedMessages: [
      ...seedMessage('diner-staff', 'sending a playlist link in a sec...', 1288),
      ...seedMessage('canal-regular', 'heard the low hum again by the canal.', 1291),
    ],
  },
];

export function getPulseRoom(roomId: string): PulseRoom | undefined {
  return PULSE_ROOMS.find((room) => room.id === roomId);
}
