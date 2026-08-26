/**
 * Convert minute-of-day integer (0..1439) to standard 12-hour AM/PM string.
 * Example: 75 -> "1:15 AM", 720 -> "12:00 PM", 1380 -> "11:00 PM"
 */
export function formatSimulationMinutes(minuteOfDay: number): string {
  const normalized = Math.max(0, minuteOfDay % 1440);
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  const period = hours24 >= 12 ? 'PM' : 'AM';
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;

  const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours12 < 10 ? '0' : ''}${hours12}:${minStr} ${period}`;
}

export const formatSimulationTime = formatSimulationMinutes;
