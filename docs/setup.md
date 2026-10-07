# Setup (one-time)

## Run locally (mock mode — the default for development)

No accounts or keys needed — fully offline:

1. `npm install`
2. Copy `.env.example` → `.env` and set only `LOCAL_MOCK=true` (all other vars may stay blank).
3. `npm run dev` → sign in at `/login` as **dr.demo@example.com** / **password**.

What you get: a file-backed PGlite Postgres at `.local-db/` (migrated + seeded with demo
patients, visits, fees on first start), file uploads under `public/uploads/`, and a canned AI
treatment draft (set `GEMINI_API_KEY` to use the real API). Both dirs are gitignored.
Reset everything by deleting `.local-db/` and `public/uploads/`.
Mock mode refuses to run in production (`isLocalMock()` throws).

## Dockerized local Postgres (pooler parity with prod)

Native local Postgres has no pooler in front of it; prod (Neon) does — a transaction-mode
PgBouncer, which is why `src/db/client.ts` sets `prepare:false`. This stack reproduces that
locally instead of just avoiding it:

1. `npm run docker:up` — starts `postgres:18-alpine` (direct, port `5433`, migrations only) +
   `pgbouncer` in transaction mode (port `6432`, the app connects here).
2. `npm run docker:migrate` — applies migrations via the direct port (`5433`), mirroring the
   "direct/session connection for migrate, pooled connection for the app" split used in production.
3. Point `.env` `DATABASE_URL` at `postgresql://postgres@localhost:6432/yoga_local` to run the
   app through the pooler.
4. `npm run docker:down` to stop, `npm run docker:reset` to wipe the volume and start clean.

Runs alongside a native Homebrew Postgres without conflict (different ports). Catches
pooler-specific bugs (session state, `SET`, temp tables, LISTEN/NOTIFY) that a direct local
connection can't — those are broken by Neon in prod regardless of what `prepare:false` avoids
at the prepared-statement level.

## Production: what runs where
| Piece | Service | Configured by |
|---|---|---|
| App | Vercel project `yoga` → https://yoga-ten-tau.vercel.app | Vercel env vars (Production) |
| **Database** | **Neon** (pooled connection) | Vercel `DATABASE_URL`; locally `PROD_DATABASE_URL` in `.env` |
| **Files** (documents, posture photos) | **Cloudflare R2** | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` |
| **Login only** | **Supabase Auth** (project `yabzxeetzihtnbumampg`) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (+ `_PUBLISHABLE_KEY`), `SUPABASE_SERVICE_ROLE_KEY` |
| Client share links | — | `APP_URL` |

Supabase holds **no app data**: its old database is unused (abandoned after the move to Neon) and the
Supabase Storage fallback was removed — the app refuses to start outside mock mode without the four R2
vars. The Supabase project is kept only for sign-in; `/api/ping` (daily Vercel cron) stops it auto-pausing.
After creating the admin account, keep **public signups disabled** (Auth → Sign In / Up → turn off
"Allow new users to sign up"): the app has no roles, so any signed-up user gets full access.

## Working with production
Vercel is **not** connected to GitHub: merging to `main` does not deploy. These scripts are the way in.
They read only `PROD_DATABASE_URL` / `PROD_SITE_URL` from `.env` (never the rest, so `LOCAL_MOCK` can't
leak in) and never print a connection string.

| Command | What it does | Guards |
|---|---|---|
| `npm run dev` | Local app on mock data (`.local-db`) | Never touches production |
| `npm run db:status:prod` | **Read-only**: applied / pending migrations on Neon, a few row counts | Read-only transaction |
| `npm run db:migrate:prod` | Applies pending migrations to Neon | Clean, pushed, up-to-date `main` only; shows what's pending; type `migrate prod` |
| `npm run deploy:prod` | Deploys `main` to Vercel production, smoke-tests the live site, **rolls back** on failure | Same `main` checks; refuses while migrations are pending; builds from a temporary worktree with no `.env` |
| `npm run dev:prod-db` | Local app on `http://127.0.0.1:3000` against the **production** database (debugging only) | Loud warning; localhost only. Login needs the real Supabase values in `.env` |

**Release flow:** merge the PR → `git checkout main && git pull` → `npm run db:status:prod` →
`npm run db:migrate:prod` (if anything is pending) → `npm run deploy:prod`.
Smoke test = `/login` 200, `/api/ping` 200, an unknown `/s/<token>` 404. After a manual `vercel rollback`,
Vercel stops pointing the domain at new deployments until one is promoted; `deploy:prod` always promotes.

### First-time setup of a new environment (reference)
1. **Neon**: create a project; copy the **pooled** connection string → Vercel `DATABASE_URL` and local
   `PROD_DATABASE_URL`; run `npm run db:migrate:prod`, then seed the exercise library once with
   `DATABASE_URL=<neon url> npx tsx scripts/seed-db.ts` (idempotent upsert).
2. **R2**: create bucket `patient-files` and an API token with read/write on it → the four `R2_*` vars.
3. **Supabase (login)**: create a project; Project Settings → API → URL, anon/publishable key, service-role
   key → the auth vars; create the admin account at `/register`; then disable signups.
4. `npm run deploy:prod`.

## Client share links (`APP_URL`)
"Share with client" on the Treatment tab creates a link like `https://<app>/s/<token>`. Set `APP_URL` to the
public address (e.g. `https://yoga.example.com`) in Vercel env vars so links always use it; without it the
link uses the address the physio is browsing from (fine locally, but on a phone via LAN IP the link only
works on the same Wi-Fi). Links last 90 days; "Share again" replaces the old link.
Note: the token is part of the URL, so hosting request logs (Vercel) record it. Only the account owner can
read those logs; a logged token stops working when the link expires or is replaced.

## Feature flag: AI posture analysis
Posture analysis is a premium feature still in development. The "Posture Assessment" card (add button +
history) on a client's Assessment tab shows in local dev and is **hidden in production** unless
`FEATURE_POSTURE=true` is set (e.g. in Vercel env vars). `FEATURE_POSTURE=false` hides it locally.
Only the entry point is hidden; posture URLs still work for signed-in staff.

## AI posture analysis (Gemini)
"Generate AI analysis" on a posture report uses the same `GEMINI_API_KEY` as AI treatment drafts. It sends the
measurements, score/patterns and a de-identified profile (age, gender, height, weight, BMI, ailments, posture-relevant
lifestyle answers) — **no name, contact details or photos**. Without a key in local mock mode it returns a canned analysis.
The result is a draft until the physio clicks "Edit & approve".

## Testing posture capture on a phone (HTTPS on the local network)
Browsers only allow camera access on HTTPS pages (or `localhost`), so a phone needs HTTPS.

1. Mac and phone on the same Wi-Fi.
2. `LOCAL_MOCK=true npm run dev:phone` — prints `https://<mac-ip>:3000`. It refuses to run without mock mode
   (it exposes the dev server to the whole network); `DEV_PHONE_ALLOW_REAL_DB=1` overrides deliberately.
   It creates a 30-day self-signed cert in `certificates/` (gitignored) for localhost + the Mac's current IP;
   rerun if the IP changes.
3. Open the printed URL on the phone, accept the certificate warning, sign in.
4. Client → Assessment tab → **Add posture assessment**.

Camera level: phones use the gravity sensor (iPhone asks for "Motion & Orientation" permission when you tap
*Start camera*). Laptops have no tilt sensor, so the app asks you to drag a line onto a door frame or wall corner
to measure camera roll; pitch (lid lean) cannot be measured there and the report says so.
Pose models (~6 MB live, ~30 MB accurate) download from Google's CDN on first use and are then cached. The MediaPipe
WASM runtime is served from our own origin (`public/mediapipe/`, copied from node_modules on `npm install`; gitignored).

## Manual pre-handover checklist
- [ ] Register patient with photo on a phone-sized viewport
- [ ] Each tab works: add/remove problem, upload/view/delete document, save plan, add visit
- [ ] Search by name and by mobile
- [ ] Global search box in the top nav finds a patient by name, patient code, or mobile and jumps to their profile
- [ ] Branch filter on the dashboard scopes stats, agenda, and recent activity to the selected branch
- [ ] Calendar page shows a month grid; days with follow-ups show a count badge, days without do not open a dialog
- [ ] Clicking a day with follow-ups opens a dialog listing those patients, each linking to their profile
- [ ] Prev/Next/Today controls on the calendar navigate months and update the URL's `month` query param
- [ ] Branch filter on the calendar page scopes the visible follow-ups to the selected branch
- [ ] Today's date is visually highlighted in the calendar grid
- [ ] Dashboard follow-ups are grouped under Today/Tomorrow/weekday headers
- [ ] Reminders card "Send Msg" opens WhatsApp with the bilingual reminder prefilled for the right patient and number
- [ ] Week's Schedule row WhatsApp icon opens wa.me for that patient with their follow-up date
- [ ] Calendar day-dialog row WhatsApp icon opens wa.me for that patient
- [ ] Digest button appears on the Reminders card only when tomorrow has follow-ups, shows the count, and opens wa.me addressed to the configured digest number (or the clinic number when unset) with one numbered line per patient (name, code, mobile, branch)
- [ ] Settings → WhatsApp digest number saves a 10-digit number, rejects invalid input with a bilingual error, and clearing it falls back to the clinic number
- [ ] With a branch filter active, the digest lists only that branch's patients
- [ ] On a phone logged into the clinic's WhatsApp number, the digest opens the "Message yourself" chat
- [ ] Print view → Save as PDF produces clean A4
- [ ] Logged-out user hitting /patients is redirected to /login
- [ ] With signups disabled, /register shows an error instead of creating a user
- [ ] PWA: on Android Chrome, the deployed site offers "Add to Home Screen" / install prompt
- [ ] PWA: installed icon renders the logo correctly (including the maskable circle/squircle shape)
- [ ] PWA: launching from the home-screen icon opens standalone (no browser chrome) and the status bar matches the app background
- [ ] Posture (phone): Add posture assessment → consent → level bubble turns green only when phone is upright → all four checks go green → 3-2-1 auto-capture for each of the 4 views → drag a misplaced point → save → report shows "Level verified by sensor" per view
- [ ] Posture (laptop): no-sensor path shows door-frame calibration; continue is blocked while the line reads > 1.5°; report shows "door frame (roll only)"
- [ ] Posture voice: instruction spoken at each view, 3 beeps + shutter on capture, "Please hold still" after ~2.5 s of movement; the Voice guidance toggle silences it immediately and is remembered on the device; Marathi UI speaks Marathi (or Hindi voice) where available
- [ ] Posture review: a point the detector missed shows as a dashed orange handle with a hint; dragging it onto the joint fills in the measures that needed it
- [ ] Posture AI: Generate → draft badge + sections; Edit & approve → "Reviewed by the therapist on …"; Regenerate resets to draft; print shows "AI draft — not yet reviewed" for drafts
- [ ] Posture report: "Add to prescription" on a focus area / "Add recommended exercises" in the AI analysis → "N added · View prescription"; existing prescriptions and their custom reps are untouched
- [ ] Posture: wrong facing (e.g. back to camera on the Front step) keeps "Facing correctly" red; manual "Capture now" still works
