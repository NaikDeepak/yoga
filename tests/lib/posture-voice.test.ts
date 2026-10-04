import { describe, it, expect } from 'vitest';
import { advanceHint, firstFailingCheck, pickVoice, HINT_AFTER_MS, HINT_REPEAT_MS, type HintState } from '@/lib/posture-voice';

const fresh = (now = 0): HintState => ({ failing: null, since: null, lastSpokenAt: now });
const run = (steps: [number, ReturnType<typeof firstFailingCheck>][], start = fresh()) => {
  let state = start;
  const spoken: [number, string][] = [];
  for (const [now, failing] of steps) {
    const r = advanceHint(state, failing, now);
    state = r.state;
    if (r.speak) spoken.push([now, r.speak]);
  }
  return spoken;
};

describe('firstFailingCheck', () => {
  it('reports the first client-fixable check that fails, in priority order', () => {
    expect(firstFailingCheck({ inFrame: false, facing: false, still: false })).toBe('inFrame');
    expect(firstFailingCheck({ inFrame: true, facing: false, still: false })).toBe('facing');
    expect(firstFailingCheck({ inFrame: true, facing: true, still: false })).toBe('still');
    expect(firstFailingCheck({ inFrame: true, facing: true, still: true })).toBeNull();
  });
});

describe('advanceHint', () => {
  it('waits until a check has been failing for a while before speaking', () => {
    expect(run([[0, 'still'], [HINT_AFTER_MS - 1, 'still']])).toEqual([]);
    expect(run([[0, 'still'], [HINT_AFTER_MS, 'still']])).toEqual([[HINT_AFTER_MS, 'still']]);
  });

  it('does not repeat a hint too often', () => {
    const t1 = HINT_AFTER_MS;
    const spoken = run([[0, 'inFrame'], [t1, 'inFrame'], [t1 + 1000, 'inFrame'], [t1 + HINT_REPEAT_MS, 'inFrame']]);
    expect(spoken).toEqual([[t1, 'inFrame'], [t1 + HINT_REPEAT_MS, 'inFrame']]);
  });

  it('restarts the wait when a different check starts failing', () => {
    const spoken = run([[0, 'inFrame'], [2000, 'still'], [2000 + HINT_AFTER_MS - 1, 'still'], [2000 + HINT_AFTER_MS, 'still']]);
    expect(spoken).toEqual([[2000 + HINT_AFTER_MS, 'still']]);
  });

  it('resets when everything passes', () => {
    expect(run([[0, 'still'], [2000, null], [3000, 'still'], [3000 + HINT_AFTER_MS - 1, 'still']])).toEqual([]);
  });

  it('keeps quiet right after another announcement (e.g. the view instruction)', () => {
    // Instruction spoken at t=10000; a failing check from t=0 shouldn't talk over it.
    const spoken = run([[0, 'facing'], [10000 + 500, 'facing']], fresh(10000));
    expect(spoken).toEqual([]);
  });
});

describe('pickVoice', () => {
  const v = (lang: string, name = lang) => ({ lang, name }) as SpeechSynthesisVoice;
  const voices = [v('en-US'), v('en-IN'), v('hi-IN'), v('mr-IN')];

  it('prefers the locale voice, Indian English for English', () => {
    expect(pickVoice(voices, 'mr')).toEqual({ voice: voices[3], useMarathiText: true });
    expect(pickVoice(voices, 'en')).toEqual({ voice: voices[1], useMarathiText: false });
  });

  it('reads Marathi text with a Hindi voice when there is no Marathi voice (same script)', () => {
    expect(pickVoice([v('en-US'), v('hi-IN')], 'mr')).toEqual({ voice: expect.objectContaining({ lang: 'hi-IN' }), useMarathiText: true });
  });

  it('falls back to English text when neither Marathi nor Hindi is available', () => {
    expect(pickVoice([v('en-GB'), v('fr-FR')], 'mr')).toEqual({ voice: expect.objectContaining({ lang: 'en-GB' }), useMarathiText: false });
  });

  it('matches language tags case-insensitively and with underscores (Android)', () => {
    expect(pickVoice([v('mr_IN')], 'mr').voice?.lang).toBe('mr_IN');
  });

  it('returns no voice when none are installed', () => {
    expect(pickVoice([], 'en')).toEqual({ voice: null, useMarathiText: false });
  });
});
