/** Small deterministic authored eight-second WAV, not a fictional MP3.
 * The Worker owns file creation; the browser only decodes selected WAV bytes.
 */
export const RETROAMP_SAMPLE_PATH = 'C:/Music/Motel Night Loop.wav';
const RATE = 8000;
const SECONDS = 8;
const NOTES = [220, 261.63, 329.63, 293.66, 261.63, 220, 196, 164.81,
  220, 261.63, 329.63, 392, 329.63, 293.66, 261.63, 220];

export function createRetroAmpSample(): { content: string; sizeBytes: number } {
  const pcmLength = RATE * SECONDS;
  const bytes = new Uint8Array(44 + pcmLength);
  const header = new DataView(bytes.buffer);
  const ascii = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++) bytes[at + i] = text.charCodeAt(i);
  };
  ascii(0, 'RIFF'); header.setUint32(4, bytes.length - 8, true);
  ascii(8, 'WAVE'); ascii(12, 'fmt ');
  header.setUint32(16, 16, true); header.setUint16(20, 1, true);
  header.setUint16(22, 1, true); header.setUint32(24, RATE, true);
  header.setUint32(28, RATE, true); header.setUint16(32, 1, true);
  header.setUint16(34, 8, true); ascii(36, 'data'); header.setUint32(40, pcmLength, true);
  for (let i = 0; i < pcmLength; i++) {
    const time = i / RATE;
    const step = Math.min(NOTES.length - 1, Math.floor(time * 2));
    const note = NOTES[step]!;
    const phase = time * Math.PI * 2;
    const gate = Math.pow(Math.max(0, 1 - (time * 2 % 1)), 0.65);
    const signal = Math.sin(phase * note) * 0.38 * gate +
      Math.sin(phase * (step % 4 < 2 ? 110 : 82.41)) * 0.17 +
      Math.sin(phase * note * 2) * 0.1 * gate;
    const fade = Math.min(1, time * 3, (SECONDS - time) * 4);
    bytes[44 + i] = Math.round(128 + 105 * signal * fade);
  }
  // 3072 is divisible by 3, so base64 chunks concatenate without padding.
  let encoded = '';
  for (let at = 0; at < bytes.length; at += 3072) {
    encoded += btoa(String.fromCharCode(...bytes.subarray(at, at + 3072)));
  }
  return { content: 'data:audio/wav;base64,' + encoded, sizeBytes: bytes.length };
}
