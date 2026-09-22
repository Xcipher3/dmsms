const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
const EAT_OFFSET = "+03:00";

export function toEatIso(date: Date = new Date()): string {
  const shifted = new Date(date.getTime() + EAT_OFFSET_MS);
  return `${shifted.toISOString().replace("Z", "")}${EAT_OFFSET}`;
}
