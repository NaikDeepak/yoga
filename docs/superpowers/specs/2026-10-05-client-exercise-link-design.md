# Client Home-Exercise Link (+ Share-Link Foundation) — Design

Date: 2026-10-05 · Branch: `feat/client-exercise-link` · Status: Approved 2026-10-05 (90-day links; Share again revokes the old link; page defaults to English with a Marathi toggle; first-name greeting)
Roadmap item: **C1** (client features). Foundation for **C2** (daily check-in), **C3** (share the posture report) and **C4** (progress report link).

## Goal

The physio taps **"Share with client"** on the prescription, and the client gets a WhatsApp message with a link. The link opens a mobile page with their home exercises: picture, steps, reps and days per week (with the physio's per-client changes), the physio's note, in English or Marathi. No login and no app.

The client always sees the **current** prescription: when the physio changes it on the Treatment tab, the same link shows the new programme.

## Why a foundation

Clients have no accounts, so every client-facing feature (C1–C4) reaches them through a link. This spec builds that once: an unguessable token, a public route, expiry and revocation, view tracking, and a strict rule for what a public page may show. Later features add a new `kind` of link, not a new mechanism.

## Scope

**In:**
- `share_links` table + repo + server actions (create, revoke).
- Public page `/s/[token]` showing the exercise programme.
- Physio UI on the Treatment tab's prescription card: Share, Copy link, WhatsApp, Stop sharing, "opened N times, last on …".
- WhatsApp deep link via the existing `waMeUrl` (no health details in the message text).

**Out (later items):** daily check-in / adherence (C2), posture report sharing (C3), progress report (C4), exercise videos, push notifications, client accounts.

## Data model (migration 0015)

`share_links`:
| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `patient_id` | uuid FK → patients, `ON DELETE CASCADE` | deleting a client kills their links |
| `kind` | text, CHECK `IN ('exercises')` | widened by later specs (`posture`, `progress`) |
| `token_hash` | text, UNIQUE | SHA-256 of the token (hex). **The token itself is never stored.** |
| `expires_at` | timestamp not null | house pattern (no tz), like every other table |
| `revoked_at` | timestamp null | |
| `view_count` | integer not null default 0 | |
| `last_viewed_at` | timestamp null | |
| `created_at` | timestamptz | house pattern |

Index on `(patient_id, kind)`. `enableRLS()` (house pattern; the app uses the service role).

**Token:** 32 random bytes from `crypto.randomBytes`, base64url → 43 characters (256 bits; guessing is not feasible, so no rate limiting is needed). The URL carries the token; the database only has its hash, so a leaked database backup can't be turned into working links.

**One active link per client per kind.** Because only the hash is stored, the app can't show an old link again. "Share" therefore always **creates a new link and revokes the previous one** in the same transaction. The physio sends the newest link; an older message's link stops working.

## Public page `/s/[token]`

- Route group outside `(app)`: `src/app/s/[token]/page.tsx`, with its own minimal layout (clinic logo + name, no sidebar, no session).
- `isPublicPath` allows `/s/` so the middleware doesn't redirect to `/login`.
- **Shows only:** clinic name/logo/phone; the client's **first name** ("Namaskar Asha"); for each prescribed exercise: name, picture (static file from `public/images/exercises`), description, steps, reps and days per week (`override ?? library default`), tip, the physio's custom note. A disclaimer: "Stop and call the clinic if an exercise causes sharp pain."
- **Never shows:** surname, client code, mobile, address, ailments, documents, visit notes, fees, posture data, or anything else from the record. The page's data function returns a whitelisted view model, so a later edit to the page can't leak fields it never receives.
- **Language:** an English / Marathi toggle on the page (`?lang=en|mr`), no cookie. Default **English**.
- **Invalid, expired or revoked token:** one generic page, "This link has expired. Please ask the clinic for a new one", with the clinic phone number. HTTP 404. It doesn't say which of the three it was.
- **Headers/meta:** `robots: noindex, nofollow`; `Referrer-Policy: no-referrer` (so exercise images and outbound links don't leak the token); `Cache-Control: private, no-store`.
- **Views:** each page load increments `view_count` and sets `last_viewed_at` (best-effort; a failure here doesn't stop the page).
- **No prescription yet:** the page says "Your therapist hasn't added exercises yet."
- Light on the client's phone: server-rendered, and the language toggle is a plain link, so the page needs no client JavaScript. (Not available offline.)

## Physio UI (Treatment tab, prescription card)

- **No active link:** button "Share with client".
- **After sharing (and on later visits while active):** "Shared on 5 Oct · expires 3 Jan · opened 3 times, last 7 Oct", plus **Share again** (new link, old one stops) and **Stop sharing**.
- **Right after creating:** the new link is shown once with **Copy** and **Send on WhatsApp** (opens `wa.me/<client mobile>?text=…`). Message: "Namaskar 🙏 Your home exercises from Pawar Yog Therapy: <link>". No name, ailment or clinical detail in the text.
- Disabled with a hint when the client has no prescribed exercises.

## Code layout (house layering)

- `src/lib/share-token.ts`: `newShareToken()` → `{ token, hash }`, `hashShareToken(token)`, `SHARE_LINK_TTL_DAYS`. Pure, unit-tested.
- `src/lib/auth-paths.ts`: allow `/s/`.
- `src/lib/whatsapp.ts`: `exerciseShareMessage(url)`.
- `src/data/share-links.ts`: `createShareLink(db, patientId, kind, now)` (revokes the previous active one, inserts the new one, returns `{ token, link }`), `resolveShareLink(db, token, kind, now)` (null if missing/expired/revoked), `revokeShareLinks(db, patientId, kind, now)`, `recordShareView(db, id, now)`, `activeShareLink(db, patientId, kind, now)` (for the status line).
- `src/data/exercises.ts`: `getSharedExerciseProgramme(db, token, now)` → whitelisted view model `{ firstName, exercises: [...] } | null`.
- `src/actions/share-links.ts`: `createExerciseShareLinkAction(patientId)` → `{ ok, url, whatsappUrl, expiresAt }`; `revokeExerciseShareLinkAction(patientId)`. Both `requireUser()` + zod + `revalidatePath`. The absolute URL comes from `APP_URL` if set, otherwise the request's host and protocol.
- UI: `src/app/s/[token]/page.tsx` + layout; `src/components/ShareExercisesPanel.tsx` (client island on the Treatment tab).
- i18n: new keys in `en.ts` / `mr.ts`.

## Tests

- `tests/lib/share-token.test.ts`: token length/alphabet, uniqueness across many calls, hash is deterministic and differs from the token.
- `tests/lib/auth-paths.test.ts`: `/s/abc` is public; `/settings` isn't; `/sx` isn't.
- `tests/data/share-links.test.ts` (PGlite): create stores only the hash; second create revokes the first; resolve fails for unknown, expired, revoked and wrong-kind tokens; view counter increments; links disappear when the client is deleted.
- `tests/data/exercises.test.ts`: the shared programme has exactly the whitelisted keys (snapshot of keys, so adding a field is a conscious change), uses dose overrides, reflects prescription edits, and returns null for a bad token.
- `tests/actions/share-links.test.ts`: requires a session; invalid patient id rejected; returns a URL containing the token and a `wa.me` link with no client name in it; revoke works.

## Security review checklist (run `phi-security-reviewer` and `migration-reviewer` before the PR)

- Token never logged or stored in plaintext; only the hash is in the DB.
- Public page's data is whitelisted; no PHI beyond first name + exercise programme.
- Expired/revoked/unknown are indistinguishable.
- `noindex`, `no-referrer`, `no-store`.
- WhatsApp text has no health information.

## Decisions for Deepak

1. **Link lifetime: 90 days**, renewable with "Share again". Long enough for a full programme; short enough that forgotten links die. Or 30 days?
2. **"Share again" kills the old link.** It's the price of storing only a hash, which keeps links safe if the database leaks. OK?
3. **Client page defaults to Marathi**, with an English toggle. Or should it follow the language the physio is using when they share?
4. **First name on the page** ("Namaskar Asha"). It makes the page feel personal; it's the only personal detail shown. Keep, or show no name at all?

## Docs

Update `docs/architecture.md` (module map, the public route, and a new invariant: "public pages receive whitelisted view models only") and `docs/setup.md` (the optional `APP_URL` env var) in the same commit as the code.
