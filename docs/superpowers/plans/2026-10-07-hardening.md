# Hardening plan (feature freeze from 2026-10-07)

Deepak's decision: no new features. Make the current product safe, validated and bug-free for the pilot clinic.
Rule for every fix: failing test first that reproduces the bug → fix → regression test stays.

## Where we start (measured 2026-10-07)
- 898 unit/component tests, 80% coverage gate on `src/lib`, `src/data`, `src/actions`. Typecheck + build clean.
- **No CI on pull requests.** The only workflow is `keepalive.yml`; tests run only when an agent remembers.
- **No end-to-end tests.** No test clicks through the real app in a browser.
- **`npm audit --omit=dev`: 5 issues (1 critical in `next` 15.5.19, high in `sharp`, `postcss`, `nanoid`)**, all with fixes available.
- **No `error.tsx` / `global-error.tsx`** in the app; a server error shows Next's bare default page, not a bilingual message.
- Every server action and API route except `auth.ts` and `/api/ping` checks the session (grep). Ownership and
  validation depth not yet audited.

## Status (2026-10-08)
H1–H4 merged (#57–#61) and deployed (812189a). Branch protection (H2) waits on Deepak. Next: H5.

## Phases (in order; each is one PR)
| ID | Work | Who | Done when |
|---|---|---|---|
| H1 | **Security patches.** `npm audit fix` (Next patch release, sharp, postcss, nanoid); no major-version jumps. | Claude | audit clean for prod deps; tests + build pass; deployed. |
| H2 | **CI on every PR.** GitHub Action: `npm ci` → typecheck → `npm run coverage` → `LOCAL_MOCK=false` build with dummy env. Branch protection on main needs it green. | Antigravity, Claude reviews | a PR shows the check; a broken test blocks merge. |
| H3 | **Friendly error pages.** `src/app/error.tsx`, `global-error.tsx`, `(app)/not-found.tsx`, bilingual, with a "try again" and a way home; errors logged via `safeErrorMessage` (no patient data). | Claude | component tests; a thrown error in dev shows the page. |
| H4 | **Validation + access audit** (findings below). For each action and API route: session check, zod on every input (lengths, dates, numbers ≥ 0, Marathi text), the record belongs to this clinic, file type/size limits on uploads, share-link expiry/withdrawal. Findings list → fixes, each with a test. | Codex audits (read-only), Claude triages and fixes | findings list in this file, every item fixed or consciously accepted. |
| H5 | **End-to-end smoke tests** (Playwright, local mock mode): login → add client → visit → fee + receipt → exercises → share link opens → withdraw → delete. Runs in CI. | Antigravity, Claude reviews | 1 happy path per main area green in CI. |
| H6 | **Bug bash in the clinic.** Deepak and staff use the app for real for 1–2 weeks; bugs go into the Bugs table in `docs/backlog.md` (what you did, what you saw, phone). Includes the production posture/flexibility phone test and the manual QA list in `docs/setup.md`. | Deepak + clinic, Claude fixes | table empty or all accepted. |
| H7 | **Data safety.** Confirm Neon point-in-time restore window; do one restore drill to a branch; check R2 has nothing orphaned; tighten the R2 token (Deepak). | Claude + Deepak | restore proven once; steps written in `docs/environments.md`. |
| H8 | **Speed + phone polish.** Lighthouse on login, client list, client page, report, share page on a phone profile; fix anything slow or broken at phone width. | Claude | no red Lighthouse scores on those pages. |

## Not in scope
New features, the parked C9, posture accuracy items B3–B7 (they wait on real capture data from E4).

## H4 findings (Codex audit 2026-10-07, triaged by Claude)
| # | Finding | Outcome |
|---|---|---|
| 1 | `/api/ping` is open when `CRON_SECRET` is unset | Fixed (PR #61, 2026-10-08): Deepak set `CRON_SECRET` in Vercel + GitHub; the route now refuses every call without it. Live check: no secret → 401, keepalive workflow → success. |
| 2–3 | Document / problem delete not scoped to the client | Fixed: scoped by client id; nothing logged when nothing deleted. |
| 4 | Editing a client that no longer exists reported success | Fixed: "This client no longer exists" error, nothing logged. |
| 5 | Payment / charge delete logged even when nothing deleted | Fixed. Unknown id stays `ok` on purpose (a double tap must not show an error). |
| 2–5 | Ids only checked as non-empty | Fixed: `isId` (UUID) on every delete/edit id → "Invalid parameters" before the database. |
| 6 | No upper bound on amounts | Fixed: `MAX_AMOUNT` ₹10 lakh on fee, payment, charge. |
| 7 | Payment double submit | Accepted: forms lock while saving (`InlineForm` fieldset). Only a retry after a dropped connection could duplicate; visible in the list and deletable. Revisit if it happens. |
| 8 | Client name unbounded | Fixed: max 120. |
| 9 | Search query unbounded | Fixed: over 100 characters → no results, no query. |
| 10 | Check-in token / day loosely checked | Fixed: over-long token refused before lookup; day must be a real date. |
| 11 | Ping logged raw errors | Fixed: `safeErrorMessage`. |
