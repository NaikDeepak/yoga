/** First word of a client's full name — the only part of the name client-facing pages use. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0];
}

const normName = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/** Typed confirmation of a client's name (e.g. before deleting them): case and extra spaces ignored. */
export function sameName(typed: string, fullName: string): boolean {
  return normName(typed) !== '' && normName(typed) === normName(fullName);
}
