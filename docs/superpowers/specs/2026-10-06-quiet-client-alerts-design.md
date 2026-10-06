# Quiet-Client Alerts — Design

Date: 2026-10-06 · Branch: `feat/quiet-client-alerts` · Status: Approved (Deepak, 2026-10-06)
Roadmap: **P3** (physio features). Builds on the exercise link (C1) and daily check-ins (C2).

## Goal
A **dashboard card** listing clients who have stopped logging their home exercises, so the physio can nudge
them with one tap, before they drop out.

## Rules
- **Who's quiet:** clients with a **live** exercise link (not revoked, not expired) and **no check-in for 3+ days**, counted from the later of their last check-in and the day the current link was shared.
  - This is the same `quietDays` rule and the same **3-day** threshold as the Treatment tab's Home exercise card. The constant `QUIET_AFTER_DAYS` now lives in `src/lib/adherence.ts` so the two can't drift.
  - A client who never checked in is listed 3 days after the link was shared.
- **Order and limit:** quietest first, then by name. The card respects the dashboard's branch filter and shows up to 8, with "+N more".
- **WhatsApp nudge:**
  - Opens WhatsApp with a gentle bilingual reminder: first name, "do your home exercises and tick them off on the link we sent". There are no ailments or health details, and no link (only the token's hash is stored).
  - Tapping it records `nudged_at` on the client's live exercise link, and the card shows "Nudged today" or "Nudged N days ago" so two people don't nudge the same client twice.
  - Sharing a new link starts with no nudge recorded.
- **Clearing:** a client leaves the list as soon as they check in, or when the link is stopped or expires.
- **Empty state:** when nobody is quiet, the card says "Everyone with an exercise link has checked in recently."

## Data model (migration 0023)
- `share_links.nudged_at timestamp` (nullable), used only for exercise links.

## Code
- `src/lib/adherence.ts`: `QUIET_AFTER_DAYS` (moved from `HomeExerciseCard`).
- `src/data/quiet-clients.ts`: `listQuietClients(db, today, now, { branch, limit })` → `{ clients, total }`.
- `src/data/share-links.ts`: `recordNudge(db, patientId, now)`, which stamps the live exercise link.
- `src/actions/share-links.ts`: `recordNudgeAction(patientId)` (auth, uuid check).
- `src/lib/whatsapp.ts`: `quietNudgeMessage(firstName)`.
- `src/components/QuietClientsCard.tsx`: a client island for the nudge button (records, then opens WhatsApp). Placed on the dashboard.

## Tests
- **Data:**
  - quiet after 3 days and not at 2;
  - never checked in;
  - a check-in today clears it;
  - revoked or expired links excluded;
  - branch filter, order, limit and total;
  - `nudgedAt` is returned, and a fresh link has none.
- **Action:** auth, invalid id, stamps only the live exercise link.
- **Message:** bilingual, first name only, no health words.
- **Card:** the list with nudge state, and the empty state.

## Out
- Automatic or scheduled WhatsApp sending (needs the WhatsApp Business API).
- Snoozing a client.
- Quiet alerts for clients without a link.
