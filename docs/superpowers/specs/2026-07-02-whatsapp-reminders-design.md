# WhatsApp Reminders (wa.me Deep Links) — Design Spec

Date: 2026-07-02
Status: Approved for implementation

## Purpose

Staff have no consistent way to remind patients about upcoming follow-ups. The dashboard's Reminders card already carries an ad-hoc wa.me "Send Msg" button (local helper in `dashboard/page.tsx`, untested, first 3 follow-ups only), but the Week's Schedule card and the calendar day dialog — the two places listing *all* follow-ups — have none. There is also no way to get "tomorrow's list" onto the clinic phone as an actionable checklist.

This feature makes reminders a first-class, zero-cost capability using free WhatsApp click-to-chat deep links (`https://wa.me/<digits>?text=<prefilled>`): no Meta Cloud API, no BSP fees, no business verification. Staff tap a button, WhatsApp opens with the number and bilingual message prefilled, they hit send.

## Scope

**In scope:**
- Pure lib `src/lib/whatsapp.ts` for URL/message construction (extracting the existing ad-hoc dashboard helper).
- Per-patient reminder buttons in: dashboard Reminders card (existing, refactored), dashboard Week's Schedule rows (new), calendar day-dialog rows (new).
- On-demand "tomorrow's appointments digest" button on the Reminders card header: opens wa.me addressed to the clinic's **own** number with a numbered list of tomorrow's follow-ups (name, code, mobile, branch). On a phone logged into the clinic's WhatsApp this is the "Message yourself" chat.
- Shared clinic identity constant `src/lib/clinic.ts` (name, phone, wa.me digits), consumed by the letterhead and the digest.

**Out of scope (not this feature):**
- WhatsApp Cloud API / Twilio / any BSP integration; automated or scheduled sending (cron); delivery/read tracking; a send-log table; opt-out management. If automation is wanted later, the message builders here are the reusable half — only the delivery mechanism changes.
- SMS fallback.
- Per-patient language preference for the message (patient language is unknown; the message is bilingual in one body, matching the existing button).

## Pure lib

`src/lib/whatsapp.ts` — no React/DB imports, under the `src/lib` coverage gate:

- `waMeUrl(mobile, text)` — strips non-digits; 10-digit numbers get the `91` prefix, 12-digit `91…` numbers pass through; text is `encodeURIComponent`ed.
- `buildReminderMessage(fullName, nextVisitDate)` — byte-for-byte the message the dashboard produces today (bilingual EN + MR in one body; short brand string "Pawar's Yog Therapy" intentionally unchanged).
- `reminderUrl(mobile, fullName, nextVisitDate)` — composition used by all three button sites.
- `buildDigestMessage(entries, dateISO)` — header `Tomorrow's appointments / उद्याच्या भेटी — <dd MMM>` + numbered lines `<i>. <name> (<code>) — <mobile> — <branch|—>`.
- `digestUrl(entries, dateISO)` — digest addressed to `CLINIC.whatsappDigits`.
- `DigestEntry` is a local structural type (`fullName`, `patientCode`, `mobile`, `branch`); `FollowUp` from `src/data/visits` is assignable to it — the lib must not import from `src/data` (layering).

`src/lib/clinic.ts` — `CLINIC` constant: display name/phone/email/hours (moved from `ReportLetterhead.tsx`) plus `whatsappDigits` (`918550921037`).

`src/lib/dates.ts` — gains `formatDueDate` (moved from the dashboard page, which used it for three non-WhatsApp displays too).

## UI touchpoints

All buttons are plain anchors (`<Button asChild><a target="_blank" rel="noopener noreferrer">`) — no client island is added anywhere; the dashboard stays a server component.

- **Reminders card** (`dashboard/page.tsx`): existing button now calls `reminderUrl` — no visual or textual change.
- **Week's Schedule rows**: ghost icon button (lucide `MessageCircle`) after the date, `aria-label` = existing `t.dashboard.sendMsg`.
- **Calendar day dialog** (`CalendarMonthGrid.tsx`, already a client island): same icon button per row.
- **Digest button** (Reminders card header): rendered only when tomorrow (IST) has ≥ 1 follow-up; label shows the count. It filters the *already-fetched* `followUps`, so an active branch filter scopes the digest — deliberate: a per-branch checklist.

## Configuration

The digest target is a per-user preference, not a clinic-wide setting: the digest is a message-to-self, so it should reach the WhatsApp of whoever is looking at the dashboard — different staff can each get the checklist on their own phone. Stored as nullable `user_preferences.whatsapp_number` (10-digit form, same shape as `patients.mobile`, DB check constraint), edited on the Settings page via `saveWhatsappNumberAction`; `null`/unset falls back to `CLINIC.whatsappDigits`, so the digest works before anyone opens Settings. The language and number upserts each `set` only their own column, so they never clobber each other.

## i18n

One new key pair, `dashboard.whatsappDigest`: `"Tomorrow's list → WhatsApp ({count})"` / `'उद्याची यादी → WhatsApp ({count})'`. Icon buttons reuse `dashboard.sendMsg`. The reminder/digest message bodies are bilingual-in-one and live in the lib, not the i18n tree (they are patient-facing, not UI-locale-dependent).

## Testing

- `tests/lib/whatsapp.test.ts`: URL prefixing/stripping/encoding (incl. Devanagari); `buildReminderMessage` exact-string equality against the pre-refactor literal (locks the pure-refactor guarantee); `reminderUrl` verbatim-equal to the old `whatsappUrl` output; digest with 0/1/many entries, numbering, order, `branch: null`; `digestUrl` targets the clinic digits.
- `tests/lib/dates.test.ts`: `formatDueDate` (padding, month abbreviation, December); `getISTDateString` offset with injected base date.
- No data/action tests: no new queries or mutations.
- UI: manual checklist entries in `docs/setup.md` (see Verification there).

## Edge cases / accepted limitations

- **Digest URL length**: ~30 Marathi entries ≈ 4–6 KB URL — fine for modern browsers and WhatsApp; no truncation logic (speculative complexity at single-clinic scale).
- **Message-to-self**: only a phone logged into the clinic number gets the "Message yourself" chat; other phones open a normal chat *to* the clinic number — still a usable checklist (lands in the clinic inbox).
- **`branch: null`** renders as `—` in digest lines.
- **Zero follow-ups tomorrow**: button hidden; `buildDigestMessage([])` still returns a sane header + "No appointments / भेटी नाहीत" defensively.
- **Date format**: `dd MMM` with English month abbreviation in both message halves — matches existing behavior; digits + short month are readable in both scripts.
- **wa.me does not send anything** — it only prefills; the human always reviews and taps send. No PHI leaves the app unattended.
