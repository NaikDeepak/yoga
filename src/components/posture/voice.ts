// Browser speech + beeps for posture capture. Voice choice and hint timing are pure logic in
// src/lib/posture-voice.ts; this file only talks to speechSynthesis and Web Audio.
import { pickVoice } from '@/lib/posture-voice';

export type Beep = 'tick' | 'shutter';

const BEEPS: Record<Beep, { freq: number; ms: number }> = {
  tick: { freq: 880, ms: 120 },     // 3 · 2 · 1
  shutter: { freq: 1320, ms: 260 }, // photo taken
};

type AudioCtor = typeof AudioContext;

export interface VoiceGuide {
  /** Call from a tap (Start camera): iOS/Safari only allow audio + speech after a user gesture. */
  unlock(): void;
  /**
   * Speaks the text for the current locale (falls back to English when no suitable voice exists).
   * `interrupt` (instructions) replaces anything being said; otherwise (hints) it's skipped while
   * something is still being spoken, so a hint never cuts off an instruction.
   */
  say(text: { en: string; mr: string }, opts?: { interrupt?: boolean }): void;
  beep(kind: Beep): void;
  setMuted(muted: boolean): void;
  stop(): void;
}

export function createVoiceGuide(locale: 'en' | 'mr', initiallyMuted: boolean): VoiceGuide {
  let muted = initiallyMuted;
  let audio: AudioContext | null = null;
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

  return {
    unlock() {
      try {
        const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext);
        if (Ctor && !audio) audio = new Ctor();
        audio?.resume().catch(() => {}); // audio refused: beeps stay silent, speech may still work
        // A silent utterance inside the gesture primes speech on iOS.
        if (synth) synth.speak(new SpeechSynthesisUtterance(''));
      } catch {
        // No audio support: guidance stays visual only.
      }
    },

    say(text, { interrupt = false } = {}) {
      if (muted || !synth) return;
      if (!interrupt && (synth.speaking || synth.pending)) return;
      const { voice, useMarathiText } = pickVoice(synth.getVoices(), locale);
      const utterance = new SpeechSynthesisUtterance(useMarathiText ? text.mr : text.en);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = useMarathiText ? 'mr-IN' : 'en-IN';
      }
      utterance.rate = 0.95;
      synth.cancel(); // never queue stale speech behind the new utterance
      synth.speak(utterance);
    },

    beep(kind) {
      if (muted || !audio) return;
      const { freq, ms } = BEEPS[kind];
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const t = audio.currentTime;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + ms / 1000 + 0.02);
    },

    setMuted(m) {
      muted = m;
      if (m) synth?.cancel();
    },

    stop() {
      synth?.cancel();
      void audio?.close();
      audio = null;
    },
  };
}

const MUTE_KEY = 'posture-voice-muted';

/** Per-device preference; storage can be unavailable (private mode), so never throw. */
export function loadMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // ignore
  }
}
