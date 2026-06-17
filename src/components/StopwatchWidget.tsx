'use client';

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type Mode = 'session' | 'pulse';
type SessionStatus = 'idle' | 'running' | 'paused';
type PulseStep = 'ready' | 'countdown' | 'enter' | 'result';
type PulseDuration = 15 | 30;

export function StopwatchWidget() {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<Mode>('session');

  // Session timer
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [elapsed, setElapsed] = useState(0); // seconds
  const sessionRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulse checker
  const [pulseDuration, setPulseDuration] = useState<PulseDuration>(15);
  const [pulseStep, setPulseStep] = useState<PulseStep>('ready');
  const [countdown, setCountdown] = useState(0);
  const [beats, setBeats] = useState('');
  const [bpm, setBpm] = useState<number | null>(null);
  const pulseRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) clearInterval(sessionRef.current);
      if (pulseRef.current) clearInterval(pulseRef.current);
    };
  }, []);

  // Session controls
  function startSession() {
    sessionRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    setSessionStatus('running');
  }

  function pauseSession() {
    if (sessionRef.current) clearInterval(sessionRef.current);
    setSessionStatus('paused');
  }

  function resetSession() {
    if (sessionRef.current) clearInterval(sessionRef.current);
    setElapsed(0);
    setSessionStatus('idle');
  }

  // Pulse controls
  function startPulse() {
    let remaining = pulseDuration;
    setCountdown(remaining);
    setPulseStep('countdown');
    pulseRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(pulseRef.current!);
        pulseRef.current = null;
        setPulseStep('enter');
      }
    }, 1000);
  }

  function calculateBpm() {
    const b = parseInt(beats, 10);
    if (!isNaN(b) && b > 0) {
      setBpm(Math.round(b * (60 / pulseDuration)));
      setPulseStep('result');
    }
  }

  function resetPulse() {
    if (pulseRef.current) clearInterval(pulseRef.current);
    setPulseStep('ready');
    setBeats('');
    setBpm(null);
    setCountdown(0);
  }

  // Switching modes resets the outgoing mode's state
  function switchMode(newMode: Mode) {
    if (newMode === 'session') resetPulse();
    else resetSession();
    setMode(newMode);
  }

  // Collapsed chip label
  const chipLabel =
    mode === 'session' && sessionStatus === 'running' ? `● ${elapsed}s`
    : mode === 'pulse' && pulseStep === 'countdown' ? `♡ ${countdown}`
    : '⏱ Timer';

  // --- Collapsed state ---
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-lg transition-all hover:shadow-xl',
          mode === 'session' && sessionStatus === 'running' && 'text-primary',
        )}
      >
        {chipLabel}
      </button>
    );
  }

  // --- Expanded state ---
  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 rounded-2xl border border-border bg-card shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-sm font-semibold">Timer</span>
        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex overflow-hidden rounded-lg border border-border text-xs">
            <button
              onClick={() => switchMode('session')}
              className={cn(
                'px-2.5 py-1 transition-colors',
                mode === 'session' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
              )}
            >
              Session
            </button>
            <button
              onClick={() => switchMode('pulse')}
              className={cn(
                'px-2.5 py-1 transition-colors',
                mode === 'pulse' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
              )}
            >
              Pulse
            </button>
          </div>
          <button
            onClick={() => setExpanded(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Collapse timer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pb-4">
        {mode === 'session' ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <span
              className={cn(
                'text-5xl font-mono font-bold tabular-nums',
                sessionStatus === 'idle' ? 'text-muted-foreground/40'
                : sessionStatus === 'running' ? 'text-primary'
                : 'text-foreground',
              )}
            >
              {elapsed}s
            </span>
            <div className="flex gap-2">
              {sessionStatus === 'idle' && (
                <Button size="sm" onClick={startSession} className="rounded-full w-24">Start</Button>
              )}
              {sessionStatus === 'running' && (
                <>
                  <Button size="sm" onClick={pauseSession} className="rounded-full w-20">Pause</Button>
                  <Button size="sm" variant="outline" onClick={resetSession} className="rounded-full">Reset</Button>
                </>
              )}
              {sessionStatus === 'paused' && (
                <>
                  <Button size="sm" onClick={startSession} className="rounded-full w-20">Resume</Button>
                  <Button size="sm" variant="outline" onClick={resetSession} className="rounded-full">Reset</Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-4">
            {pulseStep === 'ready' && (
              <>
                <div className="flex gap-2">
                  {([15, 30] as PulseDuration[]).map(d => (
                    <button
                      key={d}
                      onClick={() => setPulseDuration(d)}
                      className={cn(
                        'rounded-full border px-4 py-1 text-sm font-medium transition-colors',
                        pulseDuration === d
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
                <span className="text-5xl font-mono font-bold text-muted-foreground/30">{pulseDuration}</span>
                <Button size="sm" onClick={startPulse} className="rounded-full w-36">Start Countdown</Button>
              </>
            )}

            {pulseStep === 'countdown' && (
              <span className="text-6xl font-mono font-bold tabular-nums text-primary">{countdown}</span>
            )}

            {pulseStep === 'enter' && (
              <>
                <span className="text-5xl font-bold text-primary">✓</span>
                <div className="flex w-full gap-2">
                  <input
                    type="number"
                    min="0"
                    max="250"
                    value={beats}
                    onChange={e => setBeats(e.target.value)}
                    placeholder="Beats counted"
                    className="h-9 flex-1 rounded-md border border-border px-3 text-center text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    autoFocus
                  />
                  <Button size="sm" onClick={calculateBpm} className="rounded-full shrink-0">BPM</Button>
                </div>
              </>
            )}

            {pulseStep === 'result' && (
              <>
                <div className="text-center">
                  <div className="text-5xl font-bold tabular-nums text-primary">{bpm}</div>
                  <div className="mt-1 text-sm text-muted-foreground">BPM</div>
                </div>
                <Button size="sm" variant="outline" onClick={resetPulse} className="rounded-full w-24">Redo</Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
