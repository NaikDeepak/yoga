# Setup (one-time)

## Run locally without Supabase (local mock mode)

No accounts or keys needed — fully offline:

1. `npm install`
2. Copy `.env.example` → `.env` and set only `LOCAL_MOCK=true` (all other vars may stay blank).
3. `npm run dev` → sign in at `/login` as **dr.pawar@example.com** / **password**.

What you get: a file-backed PGlite Postgres at `.local-db/` (migrated + seeded with demo
patients, visits, fees on first start), file uploads under `public/uploads/`, and a canned AI
treatment draft (set `GEMINI_API_KEY` to use the real API). Both dirs are gitignored.
Reset everything by deleting `.local-db/` and `public/uploads/`.
Mock mode refuses to run in production (`isLocalMock()` throws).

## Real Supabase setup

1. Create a Supabase project (free tier, region ap-south-1).
2. SQL editor → run nothing manually; locally run `npm run db:migrate` with `DATABASE_URL` set to the
   **session pooler** connection string (drizzle migrations need it once), then switch `DATABASE_URL`
   in the app env to the transaction pooler string.
3. Storage → create **private** bucket `patient-files`.
4. Copy `.env.example` → `.env`, fill all four values (Project Settings → API / Database).
   `.env` is gitignored — never commit real keys.
5. `npm install && npm run dev` → create the admin account at `/register`, then sign in at `/login`.
6. **After the admin account exists, disable public signups** (Auth → Sign In / Up →
   turn off "Allow new users to sign up"). The `/register` page stays reachable but Supabase
   will reject further signups — this app has no roles, so any signed-up user gets full access.
7. Deploy: push to GitHub → import in Vercel → set env vars → deploy.

## Switching to Neon (free Postgres, never pauses)

1. Create a free project at [neon.tech](https://neon.tech).
2. Copy the **pooled connection string** (Neon dashboard → Connection Details → Pooled).
3. Run migrations once against Neon: `DATABASE_URL=<neon-pooled-url> npm run db:migrate`
4. Set `DATABASE_URL` to the Neon pooled URL in Vercel (and locally in `.env`).
5. Migrate existing data manually via pg_dump/pg_restore if needed.
6. Keep the three Supabase env vars — Auth still runs on Supabase.

## Switching to Cloudflare R2 (10 GB free storage, zero egress)

1. Cloudflare dashboard → R2 → Create bucket named `patient-files` (or any name).
2. R2 → Manage API Tokens → Create token with Read/Write on the bucket.
3. Add four env vars (Vercel + `.env`):
   - `R2_ACCOUNT_ID` — your Cloudflare account ID
   - `R2_ACCESS_KEY_ID` — token key
   - `R2_SECRET_ACCESS_KEY` — token secret
   - `R2_BUCKET` — bucket name
4. When `R2_ACCOUNT_ID` is set, the app automatically uses R2; Supabase Storage is ignored.
5. Migrate existing files: `rclone copy supabase-remote:patient-files r2-remote:patient-files`

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
