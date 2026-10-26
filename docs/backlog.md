# Backlog

> Tag new items `[core]` / `[switch]` / `[profile]` / `[extension]` (see `plans/2026-10-07-multi-clinic-direction.md`).

**The feature freeze (2026-10-07) ended 2026-10-25 for the second-clinic work** — roadmap `docs/superpowers/plans/2026-10-25-second-clinic-roadmap.md`. Phase 1 (product ready for any clinic) is done; next: Project 2 = Phase 2 "Sunrise's own copy, login off Supabase, backups, release to all", then Project 3 = Phase 3 "Admin site". Other new features stay on hold; F1 (pain body map + questionnaires) is parked. The Features table below is on hold.

Open items, newest decisions first. Pick from here when starting new work; tick items off (or move them
to their spec) when done. Last updated 2026-10-25.

## Waiting on people (not code)
| Item | Who | Notes |
|---|---|---|
| Test posture + flexibility on the clinic phone, in production | Deepak | `FEATURE_POSTURE` is on since 2026-10-06. Use a throwaway client: 4 posture views → 4 flexibility shots → AI analysis → share → withdraw consent → delete client (also proves R2 delete works in prod). Report any capture check that stays red; loosening a check is a one-line change (lenient first). |
| Tune flexibility score cut-offs | Dr Pawar | `FLEX_SCORING` in `src/lib/flexibility.ts`: shoulder 60° = 100, fold hip angle 45° = 100, butterfly knees ≤ 0.15 × shoulder width = 100. History re-scores automatically, because scores are recomputed from landmarks. |
| Shoulder-extension reference photo | Clinic | The AI model never reached 60°, so that card shows no reference. A clinic photo (consent for use with all clients) → `public/ideal/` + `src/lib/ideal-photos.ts`. See `scripts/ideal-photos/README.md`. |
| Facial palsy clients? | Dr Pawar | Decides whether F4 (facial palsy tracking) is worth building. |
| Tighten the R2 API token | Deepak | Currently Admin-level ("Workers R2 Storage Write"). **Deepak:** Cloudflare → R2 Object Storage → Manage API tokens → Create Account API token, named `yoga-patient-files-rw`, permission **Object Read & Write**, buckets: specific → `patient-files`, TTL Forever. Put the two values in `~/.config/yoga-r2-token` (`chmod 600`, lines `R2_ACCESS_KEY_ID=…` / `R2_SECRET_ACCESS_KEY=…`), never in chat. **Claude:** tests the token (patient-files only), updates `.env` + Vercel Production, `deploy:prod`, checks upload/delete live, deletes the file. **Then Deepak** deletes the old Admin token. Do this before adding more clinics. |

## Done recently
- **Restore window decided**, 2026-10-25 (Deepak): keep the 6-hour Neon window for now; no paid plan, no nightly dump. Revisit before adding clinics or if a mistake older than 6 h ever needs undoing. Options were A (paid Neon plan) or B (nightly `pg_dump` into private R2).
- **R2 orphans deleted**, 2026-10-24 (Deepak's OK): re-checked against production first (9 files, 4 deleted clients, none referenced), deleted; bucket now holds only the 3 files the database points to.
- **Branch protection on `main`**, 2026-10-22: PR required (0 approvals), checks **Typecheck, Test & Build** + **End-to-end smoke (mock mode)**; admins can still bypass in an emergency.
- **H7 restore drill**, 2026-10-22: Neon point-in-time branch matched production; steps in `docs/environments.md`. Window is 6 h (free plan).
- **E4 capture counters**, 2026-10-07: Settings → Posture capture health (last 30 days per photo type). Migration 0025.
- **E5 capture screen test**, 2026-10-07: fake camera + detector walk the whole capture flow. Built by Antigravity.
- **Clinic profile**, 2026-10-07: all clinic identity (names, logo, icons, colours, branches, signature, messages) in `src/clinics/`; guard test. Built by Antigravity, reviewed by Claude and Codex.
- **App manifest public + colour-proof deploy script**, 2026-10-07; install checked on a phone.
- **CSV export + audit log**, 2026-10-07: export built by Antigravity, audit log by Claude, integrated together.
- **Old profile photo removed on replacement**, 2026-10-07: built by Antigravity in the multi-agent pilot.
- **C8 Total score** /400 (posture + 3 flexibility tests), 2026-10-07: spec `2026-10-07-total-score-design.md`.

## Features
| ID | Item | Size | Notes |
|---|---|---|---|
| C6 | Spinal curve read (kyphosis / lordosis), qualitative and flagged approx | M | From shoulder/hip/ear offsets. |
| D2 | Gait analysis (video) | L | Scope separately. |

## Assessment ideas — post-freeze candidates (added 2026-10-15)
Optional add-on tests, each behind a feature switch `[switch]`. Revisit once production posture data shows the
current pipeline is reliable. Listed in recommended order.
| ID | Item | Size | Notes |
|---|---|---|---|
| F1 | Pain body map + validated questionnaires (Oswestry, Neck Disability Index, stress scale) | M | No camera, no accuracy risk; strong before/after outcome measures for the report. |
| F2 | Neck range of motion via MediaPipe Face Landmarker | M | Head yaw/pitch/roll from the face transform. Also gives a more precise head tilt for posture. |
| F3 | Single-leg balance (30 s sway + foot-down time) and 30 s sit-to-stand rep count | M | Reuses live capture + stillness detection. Fall-risk / strength measures. |
| F4 | Facial palsy tracking (rest, raise brows, close eyes, smile, puff cheeks; left vs right movement) | M | Only if Dr Pawar sees these clients. Includes eyelid-opening asymmetry. Face photos need their own consent line. |
| F5 | Jaw (TMJ) opening + sideways drift | S | Face landmarks; standard physio check. |
| F6 | Flat feet / ankle roll-in (heel–ankle angle, back view) | S | Approximate; trend over time. After B4/B5. |
| F7 | Overhead squat video (dynamic knee collapse, heel lift) | M | Catches what static photos miss. |
| F8 | More ROM tests (shoulder flexion/abduction, trunk side bend, hip flexion) | M | Extend the flexibility score. |
| F9 | Breathing pattern (shoulder vs belly rise) | M | Pranayama interest; accuracy unproven — research first. |
| F10 | Wrist / finger ROM (Hand Landmarker) | S | Only if the clinic sees arthritis clients. |

Rejected: eye alignment / squint / vision screening (unreliable from a phone photo, needs an eye specialist);
nose deviation (cosmetic; breathing obstruction isn't visible externally).

## Posture accuracy (needs real-device data first)
| ID | Item |
|---|---|
| B4 | Correct the recorded camera roll before metrics (frontal views), after confirming sensor signs per platform. |
| B5 | Stricter capture checks, one at a time (front vs back, head-in-frame from behind, body fill blocking), each behind a device test. |
| B7 | Offline models: service-worker cache for `/mediapipe/*` and the `.task` models. |
| B3 | Live-overlay render throttling. Low priority: the clinic uses recent phones. |

## Quality / ops
| ID | Item |
|---|---|
| H1–H8 | Hardening phase: plan `docs/superpowers/plans/2026-10-07-hardening.md`. H1–H5 done (H5 e2e smoke 2026-10-21); H7 restore drill done 2026-10-22 (orphans deleted 2026-10-24; R2 token waits on Deepak); H8 done 2026-10-24 (no red Lighthouse; report gold darkened; prod check after deploy). |

Source of the posture/flexibility items: `docs/superpowers/plans/2026-10-04-posture-followups.md`.

## Bugs (found in real use)
| Date | What you did | What you saw | Phone / browser | Status |
|---|---|---|---|---|
| 2026-10-21 | Treatment tab → Add visit with a progress note → Add visit (found by the H5 e2e test) | Visit saved, but the note stays in the textarea, so a second tap could save a duplicate visit | Pixel 7 Chromium (Playwright), mock mode | Fixed 2026-10-24: note and pain now clear after a saved visit (both kept React state that `form.reset()` never touched); e2e smoke checks it |

## Low priority / parked
| ID | Item | Size | Notes |
|---|---|---|---|
| C9 | Phased programme on the report (Initiation wk 1–6 → Adoption 7–10 → Alleviation 11–16 → Retention 17–18) with a reassessment booked at each phase end | L | Parked 2026-10-07 (Deepak): too big, and 18 weeks is longer than most clients stay, so it would rarely be used. Revisit only if the clinic asks. |
