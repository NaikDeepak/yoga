# Setup (one-time)

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
7. Deploy: push to GitHub → import in Vercel → set the same 4 env vars → deploy.

## Manual pre-handover checklist
- [ ] Register patient with photo on a phone-sized viewport
- [ ] Each tab works: add/remove problem, upload/view/delete document, save plan, add visit
- [ ] Search by name and by mobile
- [ ] Print view → Save as PDF produces clean A4
- [ ] Logged-out user hitting /patients is redirected to /login
- [ ] With signups disabled, /register shows an error instead of creating a user
