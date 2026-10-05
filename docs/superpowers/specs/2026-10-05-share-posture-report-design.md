# Share the Posture Report with the Client — Design

Date: 2026-10-05 · Branch: `feat/share-posture-report` · Status: Approved 2026-10-05 (photos off by default; one live posture link per client; pattern titles only, English; wellbeing included)
Roadmap item: **C3** (= posture follow-up plan item C2). Builds on the C1 share-link groundwork (`2026-10-05-client-exercise-link-design.md`).

## Goal

From a posture report, the physio taps **"Share with client"**, and the client gets a WhatsApp link to a mobile-friendly version of **that** report: score, body-region bars, posture figures with measurement lines, findings, and the physio-approved AI explanation. No login.

## Scope

**In:** a `posture` kind of share link pointing at one assessment; a public page for it; a share panel on the report page.
**Out:** before/after comparison links (C4 progress report), PDF download, sharing several assessments at once.

## What the client sees (`/s/<token>`)

- Header: clinic, "Namaskar {first name}", "Your posture report · {assessed on}". English / मराठी toggle (English default), like the exercise page.
- **Score:** ring + grade, body-region bars.
- **Posture figures** for each view with the measurement lines. **Photos only if the physio ticked "Include photos"** when sharing; otherwise the same skeleton and lines on a plain background.
- **Findings** in plain words: each mild/marked measure ("Right shoulder 3.2° lower — mild").
- **Pattern titles** (e.g. "Forward head posture"), **English in both languages** (2026-10-04 rule for clinical posture text). The detailed cause/effect text is **not** shown; the physio explains it.
- **Wellbeing** as on the physio's report: age/gender, weight, BMI, pain, main goal, and the BMI + stress gauges (hidden when there's no data).
- **AI analysis, only if the physio approved it:** summary and recommendations. Drafts never appear.
- Footer: "Your therapist will go through this with you", plus the clinic phone number and the same safety line as the exercise page.

**Never shown:** the physio's private note, AI drafts, camera/level checks, low-confidence/retake hints, client code, contact details, any other assessment.

## Photos

The capture consent reads "posture photos being taken and **stored with their record**", which doesn't cover sending them out. So:
- **Default: no photos.** The figure still shows the skeleton and measurement lines, which is the useful part.
- **"Include photos (client agreed)"** checkbox on the share panel. It is stored on the link (`include_photos`) and shown in the status line.
- With photos, the page gets **short-lived signed R2 URLs (10 minutes)** generated on each load. They are never public, and the page already sends `no-referrer`.

## Data model (migration 0018)

`share_links` gains:
| column | type | notes |
|---|---|---|
| `posture_assessment_id` | uuid null, FK → posture_assessments `ON DELETE CASCADE` | deleting the assessment kills its link |
| `include_photos` | boolean not null default false | |

- `kind` CHECK widened to `IN ('exercises','posture')`.
- New CHECK: `(kind = 'posture') = (posture_assessment_id IS NOT NULL)`.
- The existing partial unique index (one unrevoked link per client and kind) means **one live posture link per client**: sharing another report replaces the previous link, exactly like "Share again".

## Physio UI (posture report page, top, hidden in print)

The panel follows the exercise share panel:
- "Share with client" button, plus the **Include photos (client agreed)** checkbox.
- The new link is shown once, with Copy and **Send on WhatsApp** ("Your posture report from Pawar's Yog Therapy: <link>"; no health details).
- Status: "Shared on … · expires … · opened N times · with/without photos". If the live link points to a *different* assessment: "The client's link shows the report from {date}", and Share replaces it.
- **Stop sharing.**
- Shown only when `isPostureEnabled()` (same as the rest of posture).

## Code layout

- `src/db/schema.ts`: the columns and checks above; `ShareLinkKind = 'exercises' | 'posture'`.
- `src/data/share-links.ts`: `createShareLink(db, patientId, kind, now, opts?: { postureAssessmentId, includePhotos })`; `resolveAnyShareLink(db, token, now)` (any kind, for the page to branch on).
- `src/data/posture.ts`: `getSharedPostureReport(db, storage, link, lang, now)` → a whitelisted `SharedPostureReport` view model. Metrics are recomputed (the existing invariant), photo URLs are signed only if `include_photos`, and only an approved AI report is included.
- `src/actions/share-links.ts`: `createPostureShareLinkAction(assessmentId, includePhotos)` checks that the assessment belongs to the client; `revokePostureShareLinkAction(patientId)`.
- `src/lib/whatsapp.ts`: `postureShareMessage(url)`.
- `src/app/s/[token]/page.tsx` branches on `link.kind` → `ExercisePage` (existing) or `PostureReportPage` (new). The expired page is shared.
- `src/components/SharePanel.tsx`: generalises `ShareExercisesPanel` (kind, labels, optional photos checkbox).

## Tests

- **Data:** posture link requires an assessment id (CHECK); a second posture share revokes the first; deleting the assessment removes its link; the exercise link is unaffected.
- **View model:** exact whitelisted keys; no note, no draft AI (an approved one appears); `photoUrl` null without `include_photos`, signed with a 10-minute expiry with it; metrics recomputed.
- **Actions:** auth required; an assessment belonging to another client is rejected; no client name in the WhatsApp text.
- **Page routing:** an exercise token still renders the exercise page; a posture token renders the report; unknown, expired and revoked give the same 404.

## Decisions (approved 2026-10-05)

1. **Photos off by default**, opt-in per share with "client agreed". Or include them by default?
2. **One live posture link per client:** sharing a newer report replaces the old link. OK?
3. **The client sees pattern titles but not the detailed clinical cause/effect text** (which stays English-only and is for you to explain). OK?
4. ~~Wellbeing left off~~ → **Included** (Deepak).

## Docs

`docs/architecture.md` (module map, schema, public view models) and `docs/environments.md` (no change expected), in the same commit as the code.
