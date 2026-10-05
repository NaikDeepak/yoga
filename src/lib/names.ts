/** First word of a client's full name — the only part of the name client-facing pages use. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0];
}
