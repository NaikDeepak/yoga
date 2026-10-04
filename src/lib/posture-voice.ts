// Spoken guidance for posture capture: when to speak a hint, and which voice to use. Pure logic;
// the browser speech/beep code lives in src/components/posture/voice.ts.

/** Checks the client can fix themselves (camera level is the therapist's job, so it isn't spoken). */
export type HintKey = 'inFrame' | 'facing' | 'still';

export function firstFailingCheck(c: { inFrame: boolean; facing: boolean; still: boolean }): HintKey | null {
  if (!c.inFrame) return 'inFrame';
  if (!c.facing) return 'facing';
  return c.still ? null : 'still';
}

export const HINT_AFTER_MS = 2500;   // a check must keep failing this long before we say anything
export const HINT_REPEAT_MS = 6000;  // the same hint is not repeated more often than this
const QUIET_AFTER_SPEECH_MS = 2000;  // don't talk over the previous announcement

export interface HintState {
  failing: HintKey | null;
  since: number | null;
  lastSpokenAt: number | null;
  lastHint?: HintKey | null;
}

/** Advance once per frame; `speak` is the hint to announce now, if any. */
export function advanceHint(state: HintState, failing: HintKey | null, now: number): { state: HintState; speak: HintKey | null } {
  if (failing === null) return { state: { ...state, failing: null, since: null }, speak: null };
  if (failing !== state.failing) return { state: { ...state, failing, since: now }, speak: null };

  const longEnough = now - (state.since ?? now) >= HINT_AFTER_MS;
  const quietEnough = state.lastSpokenAt === null || now - state.lastSpokenAt >= QUIET_AFTER_SPEECH_MS;
  const notRepeating = state.lastHint !== failing || state.lastSpokenAt === null || now - state.lastSpokenAt >= HINT_REPEAT_MS;
  if (longEnough && quietEnough && notRepeating) {
    return { state: { ...state, lastSpokenAt: now, lastHint: failing }, speak: failing };
  }
  return { state, speak: null };
}

const langOf = (v: Pick<SpeechSynthesisVoice, 'lang'>) => v.lang.toLowerCase().replace('_', '-');

/**
 * Voice for the app locale. Marathi: a Marathi voice, else a Hindi voice reading the Marathi text
 * (same Devanagari script, broadly understood — though Hindi voices mispronounce some Marathi sounds
 * such as ळ; still clearer to most clients than English), else English text. English: Indian English first.
 */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  locale: 'en' | 'mr',
): { voice: SpeechSynthesisVoice | null; useMarathiText: boolean } {
  const find = (prefix: string) => voices.find((v) => langOf(v).startsWith(prefix)) ?? null;
  const english = find('en-in') ?? find('en');
  if (locale === 'mr') {
    const devanagari = find('mr') ?? find('hi');
    if (devanagari) return { voice: devanagari, useMarathiText: true };
  }
  return { voice: english ?? voices[0] ?? null, useMarathiText: false };
}
