// Error text that is safe to write to server logs. A failed Drizzle query's message is the full SQL
// plus its parameters (patient ids, photo paths, landmarks, names…), so only the Postgres error code
// and constraint name are kept for those.
import { DrizzleQueryError } from 'drizzle-orm/errors';

export function safeErrorMessage(err: unknown): string {
  if (err instanceof DrizzleQueryError || (err instanceof Error && err.message.startsWith('Failed query:'))) {
    const cause = (err as { cause?: { code?: unknown; constraint?: unknown } }).cause;
    const code = typeof cause?.code === 'string' ? cause.code : null;
    const constraint = typeof cause?.constraint === 'string' ? cause.constraint : null;
    return ['Database error', code, constraint && `(${constraint})`].filter(Boolean).join(' ');
  }
  return err instanceof Error ? err.message : String(err);
}
