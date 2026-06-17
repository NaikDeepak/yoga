# Stopwatch Widget — Design Spec
_2026-06-17_

## Overview

A collapsible floating stopwatch widget available on every page of the app. Gives Dr. Pawar two tools during patient sessions: a session timer (how long the consultation has run) and a pulse checker (countdown + BPM calculator). Display only — no data is saved.

---

## Placement & Persistence

- Fixed position: `bottom-6 right-6 z-50`
- Mounted once in `AppShell.tsx` so it survives page navigation without resetting
- Single component: `src/components/StopwatchWidget.tsx` (client component)
- No schema changes, server actions, or data layer touches

---

## Widget States

### Collapsed (default)
A small pill (~120px × 36px):
- Idle: `⏱ Timer`
- Session running: `● 02` (pulsing green dot + elapsed seconds)
- Pulse countdown active: `♡ 12` (current countdown value)
- Click anywhere on the pill to expand

### Expanded (~280px wide card with shadow)
- Header: "Timer" title | mode toggle (Session / Pulse) | collapse button (`✕`)
- Body: switches between Session and Pulse views
- Clicking outside does NOT close it — stays open while the doctor works

---

## Mode 1 — Session Timer

Tracks consultation duration as a simple seconds counter.

**Display:** Large monospace number — `42 s`

**States:**
| State | Display | Buttons |
|-------|---------|---------|
| Idle | `0 s` (muted) | Start |
| Running | counting up, green dot | Pause · Reset |
| Paused | frozen | Resume · Reset |

Reset always returns to `0 s` idle. No laps.

**Collapsed chip while running:** `● 42` (updates every second)

---

## Mode 2 — Pulse Checker

Four sequential states in a single panel:

| Step | What the doctor sees |
|------|----------------------|
| 1. Ready | 15s / 30s pill selector · large greyed duration · "Start Countdown" button |
| 2. Counting down | Large number ticking down (e.g. `14 → 13 → …`) · no skip |
| 3. Enter beats | `✓` replaces countdown · numeric input "Beats counted" · "Calculate BPM" button |
| 4. Result | Large BPM number (`78 BPM`) · "Redo" button |

**BPM formula:** `beats × (60 / duration)` — e.g. 20 beats in 15s = 80 BPM

**No indicator labels, no save, no clipboard copy.** Just the number.

**Collapsed chip while counting down:** `♡ 12`

---

## Mode Switching

Switching tabs (Session ↔ Pulse) while a timer is active resets that mode's state. The running state is not preserved across mode switches — switching is an intentional interrupt.

---

## Component Internals

```
StopwatchWidget
  state: expanded (bool)
  state: mode ('session' | 'pulse')

  SessionTimer (sub-view)
    state: elapsed (seconds, integer)
    state: status ('idle' | 'running' | 'paused')
    ref: intervalId

  PulseChecker (sub-view)
    state: duration (15 | 30)
    state: step ('ready' | 'countdown' | 'enter' | 'result')
    state: countdown (integer)
    state: beats (string input)
    state: bpm (integer | null)
    ref: intervalId
```

All state is local — no context, no store, no prop drilling.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/StopwatchWidget.tsx` | New client component |
| `src/components/AppShell.tsx` | Mount `<StopwatchWidget />` once inside the shell |
