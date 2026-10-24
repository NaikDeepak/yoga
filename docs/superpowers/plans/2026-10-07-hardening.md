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

## Status (2026-10-21)
H1–H4 merged (#57–#61) and deployed (812189a). Branch protection (H2) waits on Deepak. H5 built by Claude
(headless Antigravity can't install browsers or run commands beyond `npm run`). No second review: Codex CLI broken
(native binary missing), Kilo rate-limited; CI green. "Withdraw" is covered as stop-sharing the exercise link; photo-consent
withdrawal needs camera capture (E5 covers capture). Next: H7, H8.
2026-10-22: branch protection on `main` set (H2 complete). H7: Neon access via CLI org key; restore drill passed (6 h window,
free plan); 9 R2 orphans from clients deleted before 2026-10-06 await Deepak's OK to delete; R2 token tightening waits on Deepak.
2026-10-24: H8 measured and fixed (findings below). No red Lighthouse score on any page. Production check after deploy waits on Deepak.

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

## H8 findings (Lighthouse 12.6.1, mobile, 2026-10-24)
Measured on a local production build (`next build` + `next start`, local docker Postgres, real Supabase login) with a
seeded test client: fee, payments, a visit, a shared exercise. Medians of 3 runs. Mock mode can't be used for speed
because it only runs under `next dev`. Reports stay out of the repo: their screenshots show client data.

| Page | Before (perf / a11y / best / SEO) | After |
|---|---|---|
| Login | 92 / 100 / 96 / 83 | 89 / 100 / 100 / 100 |
| Client list | 87 / 96 / 100 / 91 | 88 / 100 / 100 / 100 |
| Client page | 81 / 91 / 100 / 91 | 82 / 100 / 100 / 100 |
| Client page, treatment tab | 82 / 89 / 100 / 91 | 84 / 100 / 100 / 100 |
| Dashboard | 80 / 95 / 100 / 91 | 82 / 100 / 100 / 100 |
| Report (print) | 78 / 96 / 100 / 91 | 79 / 96 / 100 / 100 |
| Client share page | 84 / 100 / 96 / 54 | 92 / 100 / 100 / 66 |

| # | Finding | Outcome |
|---|---|---|
| 1 | Exercise photos (1024 px PNG, ~130 KB each) and the logo (533 px) were sent full size to phones; share page shifted as photos loaded (CLS 0.155) | Fixed: `next/image` everywhere they show. Plank photo on the share page 120 KB → 10 KB (WebP, phone size), CLS 0. Report images load eagerly so printing never misses one. |
| 2 | Amber badges (client code, dashboard) used the decorative amber as text: contrast 3.3–3.6 | Fixed: `--brand-accent-text` (same hue, 5.3:1 on cream). |
| 3 | Client-section and branch dropdowns, and the exercise expand button, had no name for screen readers | Fixed: bilingual `aria-label`s. Exercise category headings h3 → h2 (no skipped level). |
| 4 | No description, no icon link (every first visit asked for a missing `/favicon.ico`), `/robots.txt` redirected to login | Fixed: description + clinic icon in root metadata; `robots.txt` is public and allows everything. Not `Disallow: /`: crawlers would then never see the share page's `noindex` header, and a leaked link could be listed from the link alone. |
| 5 | Share page SEO: "page is blocked from indexing" | Accepted: the `noindex` header on share links is intentional. |
| 6 | Signed-in pages show LCP 4–5.5 s and perf ~80 | Accepted: an artefact of Lighthouse's simulated throttling (it charges the JS download to the streamed page content). With real throttling (`--throttling-method=devtools`), client page, report, dashboard and login score 94–98 with LCP 1.6–2.4 s. |
| 7 | Report: gold name line and initials circle (clinic accent `#C8962E`) contrast 2.7 | Open: it's the clinic's brand colour on a printed page. Deepak to decide whether to darken it. |
| 8 | Phone width | No page scrolls sideways at 360 px or 390 px (15 pages, including all client tabs, report, receipt, share page). `e2e/phone-width.spec.ts` keeps it that way in CI. |

