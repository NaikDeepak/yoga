export function getISTDateString(offsetDays = 0): string {
  const ms = Date.now() + 330 * 60_000 + offsetDays * 86_400_000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
