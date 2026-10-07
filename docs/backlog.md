# Backlog

> Tag new items `[core]` / `[switch]` / `[profile]` / `[extension]` (see `plans/2026-10-07-multi-clinic-direction.md`).

Open items, newest decisions first. Pick from here when starting new work; tick items off (or move them
to their spec) when done. Last updated 2026-10-07.

## Waiting on people (not code)
| Item | Who | Notes |
|---|---|---|
| Test posture + flexibility on the clinic phone, in production | Deepak | `FEATURE_POSTURE` is on since 2026-10-06. Use a throwaway client: 4 posture views → 4 flexibility shots → AI analysis → share → withdraw consent → delete client (also proves R2 delete works in prod). Report any capture check that stays red; loosening a check is a one-line change (lenient first). |
| Tune flexibility score cut-offs | Dr Pawar | `FLEX_SCORING` in `src/lib/flexibility.ts`: shoulder 60° = 100, fold hip angle 45° = 100, butterfly knees ≤ 0.15 × shoulder width = 100. History re-scores automatically, because scores are recomputed from landmarks. |
| Shoulder-extension reference photo | Clinic | The AI model never reached 60°, so that card shows no reference. A clinic photo (consent for use with all clients) → `public/ideal/` + `src/lib/ideal-photos.ts`. See `scripts/ideal-photos/README.md`. |
| Tighten the R2 API token | Deepak | Currently Admin-level ("Workers R2 Storage Write"). Make a new **Object Read & Write** token for `patient-files` only, swap the `R2_*` vars in Vercel, deploy, and delete the old token. Do this before adding more clinics. |

## Done recently
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
| E4 | Lightweight capture counters (attempts, blocks per check, model-load failures), with no images and no PHI. |
| E5 | Component test for the capture state machine with a fake detector. |

Source of the posture/flexibility items: `docs/superpowers/plans/2026-10-04-posture-followups.md`.

## Low priority / parked
| ID | Item | Size | Notes |
|---|---|---|---|
| C9 | Phased programme on the report (Initiation wk 1–6 → Adoption 7–10 → Alleviation 11–16 → Retention 17–18) with a reassessment booked at each phase end | L | Parked 2026-10-07 (Deepak): too big, and 18 weeks is longer than most clients stay, so it would rarely be used. Revisit only if the clinic asks. |
