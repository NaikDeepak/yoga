# AI Posture Analysis — Gaps & Follow-up Plan
Date: 2026-10-04 · Feature PR: #27 (`feat/ai-posture-analysis`) · Spec: `docs/superpowers/specs/2026-10-04-ai-posture-analysis-design.md`

State at PR time: 4-view guided capture (phone + laptop), enforced camera level, metrics, score, patterns, report, averaging + retake, history and comparison. Tested on a MacBook webcam and a phone (2 real captures). Code review findings fixed except the two deferred below.

## What's missing

### A. Must happen before / right after merge (no code)
| # | Gap | Why it matters |
|---|---|---|
| A1 | Therapist sign-off on thresholds (forward head 10°/20°, head shift 2.5°/5°, levels 2°/4°, trunk 2°/4°, knees 5°/10°) and on the clinical pattern text | They decide what the client is told is "mild" / "marked" |
| A2 | Real-device checklist: level bubble direction on iOS **and** Android, model load time on clinic Wi-Fi, back-view capture after the stillness fix | Sensor sign conventions differ per platform; untested |
| A3 | `npm run db:migrate` on production (0012, 0013) | Feature fails without the tables |
| A4 | Seed the exercise library in production if not already (`scripts/seed-db.ts`) | Focus-area cards list exercises from it |

### B. Capture & accuracy
| # | Gap |
|---|---|
| B1 | **No audible countdown / voice prompts.** In the back and side views the client can't see the screen; the therapist is behind the camera. |
| B2 | **Point editor can't place missed points** (visibility < 0.5 points have no handle) — review finding #4. |
| B3 | **Live loop re-renders every frame** (30–60/s) — battery and frame rate on mid-range phones — review finding #7. |
| B4 | Residual camera roll is recorded, not corrected. |
| B5 | Lenient checks: front vs back not distinguished; head-in-frame from behind is approximate; body fill is advisory only. |
| B6 | Laptop pitch (lid lean) can't be measured. |
| B7 | Models (~36 MB) re-download if the browser evicts cache; no offline support. |

### C. Report & workflow
| # | Gap |
|---|---|
| C1 | No **"Prescribe these exercises"** action from the focus areas (the library and prescription form exist). |
| C2 | No **share with client** (WhatsApp is already integrated elsewhere; report is print-only). |
| C3 | Posture score not shown on the client Overview or client list. |
| C4 | No **ideal-posture reference** figure (FlexifyMe shows one next to each view). |
| C5 | No therapist "reviewed" state; note can't be edited after save. |
| C6 | Spinal curves (kyphosis / lordosis) not estimated; FlexifyMe gives a qualitative read. |

### D. Scope beyond posture (FlexifyMe parity)
| # | Gap |
|---|---|
| D1 | **Flexibility tests** (shoulder extension, standing forward fold, butterfly) with 0–100 scores — FlexifyMe's overall 206/300 includes these. |
| D2 | Gait analysis (video). |
| D3 | Optional AI-written narrative (Gemini client exists in `src/lib/gemini.ts`). |

### E. Data & operations
| # | Gap |
|---|---|
| E1 | Deleting a client leaves posture photos (and documents — same pre-existing gap) in storage. |
| E2 | No consent withdrawal flow (delete photos, keep or drop numbers). |
| E3 | Local mock mode doesn't seed the exercise library. |
| E4 | No capture-failure telemetry (how often checks block, model load failures). |
| E5 | No component/e2e tests for `PostureCapture` (logic is unit-tested in `src/lib`; UI verified manually). |

## Plan

Ordered by value ÷ effort. Each item follows the repo pattern (TDD in `src/lib` / `src/data` / `src/actions`, docs/architecture.md in the same commit).

### Phase 1 — before clinic rollout (≈2–3 days)
1. **A1–A4** (people/ops). Thresholds live in `THRESHOLDS` in `src/lib/posture.ts`; clinical text in `src/lib/i18n/en.ts` → `posture.insights.patterns`.
2. ✅ **B1 Audible guidance** (done — branch `feat/posture-voice-guidance`) — Web Speech API (`speechSynthesis`) + short beep on 3-2-1 and on capture; spoken view instruction ("turn your back to the camera"), en/mr voices with beep fallback. Mute toggle. Pure: none; UI only.
3. ✅ **B2 Place missed points** (done — branch `feat/posture-place-missed-points`) — editor shows handles for every landmark used by that view's metrics; low-visibility ones in a distinct colour at their guessed position (clamped into frame), labelled; dragging sets visibility 1. Test: `computeViewMetrics` measures a previously hidden point after edit.

### Phase 2 — workflow (≈3–4 days)
5. **C1 Prescribe from report** — "Add to prescription" per focus category (pre-selects library exercises of that category in the existing prescription form / `savePrescribedExercisesAction`).
6. **C2 Share** — signed short-lived link or PDF; WhatsApp deep link via `src/lib/whatsapp.ts` (no PHI in the message text beyond the link).
7. **C3 Score on Overview** — latest score chip + trend vs previous on the Overview tab; optional column in the client list.
8. **E1 + E2 storage cleanup** — delete posture + document files when a client is deleted (collect paths before the cascade); "withdraw photo consent" deletes photos and blanks `file_path` while keeping metrics if the client agrees.
9. **E3** — seed exercises in mock mode (`seedMockData`).

### Phase 3 — accuracy (needs real-device data)
10. **B4 Roll correction** — after A2 confirms sensor signs per platform, rotate landmarks by recorded roll before metrics (frontal views); re-score history automatically (reads already recompute).
11. **B5 Stricter checks, one at a time** (lenient-first policy): front/back discrimination, confident head-in-frame from behind, then make body-fill blocking — each behind a quick device test.
12. **B7 Offline models** — service-worker cache (PWA already installable) for `/mediapipe/*` and the two `.task` models.
13. **C4 Ideal-posture figure** and **C6 curve estimate** (qualitative, from shoulder/hip/ear offsets; flagged approx).

### Phase 4 — scope expansion (separate spec each)
14. **D1 Flexibility tests** — new capture mode per pose with MediaPipe angles (e.g. hip-flexion angle in forward fold, knee height in butterfly, shoulder extension angle), 0–100 score bands, combined "overall /300"-style score next to posture.
15. ✅ **D3 AI analysis** (done — `feat/posture-ai-analysis`, spec `2026-10-04-posture-ai-analysis.md`) and and **D2 gait** — scope separately.

### Low priority
- **B3 Render throttling** (deprioritised 2026-10-04: the clinic uses recent phones) — keep landmarks in a ref; draw the live overlay via a ref'd SVG/canvas each frame; `setState` only when check results or countdown change. Revisit only if a device shows lag or heat.

### Ongoing
- **E4** add lightweight counters (capture attempts, blocks by check, model load failures) — no images, no PHI.
- **E5** component test for the capture state machine with a fake detector.
