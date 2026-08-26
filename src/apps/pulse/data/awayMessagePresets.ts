export interface AwayPreset {
  id: string;
  name: string;
  category: 'status' | 'quote' | 'activity' | 'retro';
  message: string;
}

export const AWAY_MESSAGE_PRESETS: AwayPreset[] = [
  {
    id: 'away_afk',
    name: 'Stepped Away (Default)',
    category: 'status',
    message: 'Stepped away from the desk for a minute. Leave a message and I will get back to you!',
  },
  {
    id: 'away_retroamp',
    name: 'Listening to RetroAmp',
    category: 'activity',
    message: '♫ Currently listening to: Track 03 - Rain Over Motel (Lo-Fi Mix) ♩',
  },
  {
    id: 'away_diner',
    name: 'Working Shift at 4th St Diner',
    category: 'activity',
    message: 'Working the dinner shift at 4th Street Diner. Back late tonight. Don\'t burn the city down.',
  },
  {
    id: 'away_window',
    name: 'Watching the Motel Rain',
    category: 'quote',
    message: 'Watching the neon signs flicker through the motel blinds while the rain pours over the canal...',
  },
  {
    id: 'away_foodcart',
    name: 'Grabbing Tacos with Ryan',
    category: 'activity',
    message: 'afk grabbin tacos at the corner cart. Brb with extra salsa.',
  },
  {
    id: 'away_ascii',
    name: 'ASCII Art Banner',
    category: 'retro',
    message: '[~*~ AFK - In Search of Lost Time ~*~]\nLeave an IM at the beep: *BEEP*',
  },
  {
    id: 'away_sleeping',
    name: 'Sleeping / Night Mode',
    category: 'status',
    message: 'Zzz... Sleeping until morning alarm. Do not disturb unless the building is on fire.',
  },
  {
    id: 'away_overclock',
    name: 'Tuning SDRAM Timings',
    category: 'retro',
    message: 'Flashing custom motherboard BIOS & overclocking SDRAM to 150MHz. If I vanish, the board caught fire.',
  },
  {
    id: 'away_canal',
    name: 'Recording Audio at Canal',
    category: 'activity',
    message: 'Capturing field recordings of the 60Hz resonant sub-canal frequency. Check NightBoard thread #104.',
  },
  {
    id: 'away_busy',
    name: 'Do Not Disturb / Editing Photos',
    category: 'status',
    message: 'Batch processing 35mm film scans in PhotoBox Pro. IMs muted.',
  },
  {
    id: 'away_quote_lofi',
    name: 'Dust & Magnetic Tape',
    category: 'quote',
    message: '"Some memories are meant to stay wrapped in 128kbps compression artifacts."',
  },
  {
    id: 'away_dialup',
    name: 'Tied Up on 56k Dialup',
    category: 'status',
    message: 'Downloading massive 14MB archive over 56k modem. Do not pick up the landline phone!',
  },
];
