// Small fetch helpers for the clinic login scripts. Nothing here logs.

/** `name=value` pairs from every Set-Cookie (getSetCookie: Expires dates contain commas). Empty values skipped. */
export function setCookiePairs(res: Response): Map<string, string> {
  const pairs = new Map<string, string>();
  for (const line of res.headers.getSetCookie()) {
    const first = line.split(';', 1)[0];
    const eq = first.indexOf('=');
    if (eq <= 0) continue;
    const value = first.slice(eq + 1).trim();
    if (value) pairs.set(first.slice(0, eq).trim(), value);
  }
  return pairs;
}

export const cookieHeader = (pairs: Map<string, string>) => [...pairs].map(([k, v]) => `${k}=${v}`).join('; ');

/** Better Auth's error `code` from a JSON body, if any. Never throws, never returns the message. */
export async function errorCode(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as { code?: unknown };
    return typeof body?.code === 'string' && /^[A-Z0-9_]+$/.test(body.code) ? body.code : undefined;
  } catch {
    return undefined;
  }
}
