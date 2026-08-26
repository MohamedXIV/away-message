export interface AvatarOption {
  id: string;
  name: string;
  glyph: string;
  bgColor: string;
  textColor: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: 'av_terminal', name: 'CRT Terminal', glyph: '💻', bgColor: '#1e293b', textColor: '#38bdf8' },
  { id: 'av_camera', name: '35mm Camera', glyph: '📉', bgColor: '#3b0764', textColor: '#f472b6' },
  { id: 'av_guitar', name: 'Electric Guitar', glyph: '🎹', bgColor: '#14532d', textColor: '#4ade80' },
  { id: 'av_owl', name: 'Nocturnal Owl', glyph: '🥉', bgColor: '#0f172a', textColor: '#cbd5e1' },
  { id: 'av_coffee', name: 'Lukewarm Coffee', glyph: '☕︎', bgColor: '#451a03', textColor: '#fcd34d' },
  { id: 'av_retroamp', name: 'Audio Tape', glyph: '📪', bgColor: '#18181b', textColor: '#22c55e' },
  { id: 'av_cloud', name: 'Storm Cloud', glyph: '🌧/️', bgColor: '#1e3a8a', textColor: '#93c5fd' },
  { id: 'av_diner', name: 'Diner Breakfast', glyph: '🥳', bgColor: '#7c2d12', textColor: '#fed7aa' },
];
