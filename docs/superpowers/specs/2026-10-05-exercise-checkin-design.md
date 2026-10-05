# Daily Exercise Check-in — Design

Date: 2026-10-05 · Branch: `feat/exercise-checkin` · Status: Approved 2026-10-05 (all five decisions kept; refinements: adherence window starts at the first share link, save redirects back and refreshes the Treatment tab)
Roadmap item: **C2** (client features). Builds on C1's share link (`docs/superpowers/specs/2026-10-05-client-exercise-link-design.md`).

## Goal

On their home-exercise page, the client taps once a day to say whether they did their exercises and how much pain they're in. The physio sees adherence and the home pain trend on the Treatment tab, so the next session starts from facts ("you did 3 of the last 7 days, and pain went from 6 to 3") instead of memory.

## Scope

**In:** check-in form on `/s/[token]`; `exercise_checkins` table; adherence card on the Treatment tab.
**Out (later):** per-exercise ticks, reminders/notifications, dashboard alerts for clients who stopped (roadmap P3), check-ins without a share link.

## What the client sees (`/s/[token]`, above the exercise list)

**Today, not yet logged:**
> **Did you do your exercises today?**
> [ ✅ All of them ] [ 🟡 Some ] [ ⏭️ Skipped today ]
> **Pain right now** (0 = none, 10 = worst): [0] [1] … [10] (optional)
> [ Save ]

**Today, already logged:** "Saved for today ✓ — All of them · pain 3/10" with a **Change** link that reopens the form, prefilled. Saving again overwrites today's entry (one entry per day).

**Last 7 days:** a row of 7 dots (green = all, amber = some, grey = skipped, empty = nothing logged) with "4 of the last 7 days". The client sees only their own **done** status here, never past pain scores or anything else.

- Works without JavaScript: a plain `<form>` posting to a server action, so it's light on budget phones and old browsers.
- After saving, the action **redirects back to the page** (same `lang`), so a reload doesn't re-submit, and it revalidates `/patients/<id>` so the Treatment tab is current.
- Bilingual like the rest of the page (English default, मराठी toggle).

## What the physio sees (Treatment tab, next to the Progress charts)

**Home exercise card:**
- Adherence: "Last 7 days: 5/7 · Last 30 days: 18/30". **All** counts as 1 day and **Some** as ½.
- **New clients:** the window starts at the client's **first exercise link** (they can't check in before it), so a client shared 4 days ago who logged every day shows "4/4 days (since 1 Oct)", not 4/30. Not the prescription date: saving a prescription replaces its rows, so their `created_at` moves on every edit.
- A 30-day strip of the same dots, with dates on hover.
- **Home pain** line chart over the last 30 days, reusing `VisitLineChart`. Kept separate from visit pain, which is a different setting and scale (visits 1–10, check-ins 0–10).
- "Last check-in: 7 Oct". When nothing has been logged for 3+ days and a link is active: "No check-in for N days".
- Empty state: "No check-ins yet. Share the exercise link so the client can log their practice."

## Data model (migration 0017)

`exercise_checkins`:
| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `patient_id` | uuid FK → patients, cascade | |
| `share_link_id` | uuid FK → share_links, `ON DELETE SET NULL` | which link it came through (audit) |
| `checkin_date` | date not null | clinic day (IST), computed on the server — never sent by the client |
| `done` | text not null, CHECK `IN ('all','some','none')` | |
| `pain_scale` | integer null, CHECK `0–10` | |
| `created_at`, `updated_at` | timestamp | house pattern |

UNIQUE `(patient_id, checkin_date)`; saving upserts. `enableRLS()`.

## Safety of a public write

This is the first unauthenticated **write** in the app, so:
- **The token is the only key.** The action re-resolves the token on every submit (unknown, expired or revoked → the same expired page). The patient id comes from the link, never from the form.
- **Validated input only:** `done` ∈ {all, some, none}; `pain` an integer 0–10 or empty. No free text, so no PHI the client could paste, nothing to sanitise, and nothing for abuse to store.
- **The date is server-side** (IST today). The client can't backfill or write future dates.
- **Bounded:** one row per client per day (upsert), so a leaked or scripted link can overwrite today's entry but can't flood the table.
- **CSRF:** Next.js server actions already reject cross-origin POSTs (Origin vs Host check).
- **No new PHI on the page.** It receives a whitelisted `{ today, last7: done[] }` view model added to `SharedExerciseProgramme`.
- Link-preview bots can't check in, because a check-in needs a POST.

## Code layout

- `src/lib/adherence.ts` (pure): `adherence(checkins, today, days, since)` → `{ score, days }` (All = 1, Some = ½; `days` = min(window, days since `since`)); `dayStrip(checkins, today, days)` → `[{ date, done | null }]`; `daysSinceLastCheckin`.
- `src/lib/validation.ts`: `checkinSchema`.
- `src/data/checkins.ts`: `saveCheckin(db, link, input, today)` (upsert), `listCheckins(db, patientId, from, to)`.
- `src/data/share-links.ts`: `firstShareDate(db, patientId, kind)` (earliest link, revoked ones included) for the adherence window.
- `src/data/exercises.ts`: `getSharedExerciseProgramme` gains `checkins: { today: { done, pain } | null, last7: (Done | null)[] }`.
- `src/actions/checkins.ts`: `saveCheckinAction(token, formData)`. It is public (no `requireUser`, the token is the auth), so it is listed as the documented exception to the "every mutation calls `requireUser()`" invariant.
- UI: `src/app/s/[token]/CheckinForm.tsx` (server-rendered form), `src/components/HomeExerciseCard.tsx` (Treatment tab).
- i18n keys in `en.ts` / `mr.ts`.

## Tests

- `tests/lib/adherence.test.ts`: scoring (all/some/none/missing), window edges, window shortened for a new client (first link 4 days ago → out of 4), strip order, days since last, empty input.
- `tests/data/checkins.test.ts`: upsert on the same day, one row per day, cascade on client delete, the link deleted → `share_link_id` null, date range.
- `tests/actions/checkins.test.ts`: valid save; bad, expired and revoked token rejected; invalid `done` or pain rejected; the form can't set the date or patient; revoking the link blocks further check-ins.
- `tests/data/exercises.test.ts`: the public view model gets exactly `{ today, last7 }` with no pain history.

## Known limitations (from code review, 2026-10-05)
- The adherence window starts at the client's **first** exercise link and doesn't subtract periods when no link was live (stopped, then re-shared later). Rare today — production had no links before this feature — so it's left simple; revisit if clinics often pause programmes.
- The quiet flag counts from the later of the last check-in and the **current** link's share day, so a fresh re-share isn't flagged for an old gap, and a client who never checked in is.
- A form shown before midnight and saved within 60 minutes after it is logged for the day it showed; any other day the form claims is ignored.

## Decisions (approved 2026-10-05: all kept as proposed)

1. **Three answers (All / Some / Skipped) rather than a single "Done" tick.** "Some" captures partial practice honestly, and adherence counts it as half a day. OK?
2. **Pain 0–10 on check-ins**, where visits use 1–10 (0 = no pain makes sense at home). Shown on its own chart. OK?
3. **No free-text note from the client.** Safer and simpler; they can still message the clinic on WhatsApp. Or do you want a short optional note (max 200 characters)?
4. **The client sees their own last 7 days as dots** (done status only), as motivation. Keep it, or show nothing beyond today?
5. **Today only.** No logging for yesterday if they forgot. OK?

## Docs

`docs/architecture.md`: module map, the new table, and the public-write exception to the `requireUser()` invariant (with its safeguards). Updated in the same commit as the code.
