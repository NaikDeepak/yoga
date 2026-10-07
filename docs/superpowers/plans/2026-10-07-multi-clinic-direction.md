# Direction: one codebase, one copy per clinic, configured rather than forked

Date: 2026-10-07 · Status: agreed with Deepak. **The Pawar pilot comes first.** Only the "now" items below happen
before a second clinic is real.

## Model
- **Each clinic gets its own copy:** its own Vercel project, Neon database and R2 storage. Data isolation comes from separate copies, not from multi-tenant code.
- **There is one codebase, and never a per-clinic fork.** Clinics differ only by **configuration**, plus the rare optional module that lives in core behind a switch.

## Layers
| Layer | Contents | Lives in |
|---|---|---|
| **1. Core** | Data model, business rules, actions, tests: identical for every clinic | `src/` |
| **2. Clinic profile** | Identity and look: name (en/mr), logo, contact, founder signature, branches and addresses, client-code prefix, message wording, languages; later colours and report template | `src/clinics/<slug>.ts`, chosen by the `CLINIC_PROFILE` env var (default `pawar`) |
| **3. Feature switches** | Whole modules on or off: posture, flexibility, AI, client share links, check-ins, fees | `features` in the clinic profile; env vars can still force a module off as a kill switch |
| **4. Extensions** (rare) | A need only some clinics have: a module in core behind its own switch. Simple per-clinic data uses configurable "extra fields" (later), not code. | `src/`, switched by profile |

## Triage rule for every new requirement
Ask: who is it for?
1. **Everyone** → core.
2. **Some clinics** → core, behind a feature switch, **default off** for clinics that didn't ask.
3. **One clinic, and only wording or look** → that clinic's profile.
4. **One clinic, real behaviour** → extension: discuss first, still in core behind a switch, never a fork.

Tag backlog items with `[core]`, `[switch]`, `[profile]` or `[extension]`.

## Testing
- **Core tests run once,** as today.
- **Every clinic profile is validated** by a schema test, so a bad profile fails CI, not the clinic.
- **Feature switches are tested on and off,** so turning a module off never breaks a page.
- **A guard test:** no clinic-specific text (name, phone, founder, logo path) outside `src/clinics/`.
- **Release:** the same migrations for every clinic database. Roll out to **Pawar first (the canary)**, then the others; per-clinic smoke test.

## Now (helps the pilot; small)
1. **Clinic profile:** move every Pawar-specific string, logo, signature, branch and prefix into `src/clinics/pawar.ts`, behind a typed, validated `clinicProfile`. Spec: `docs/superpowers/specs/2026-10-07-clinic-profile.md`. Built by Antigravity.
2. **Feature switches** live in the profile (today only posture is switchable).
3. **The triage rule** lives in `CLAUDE.md` and `AGENTS.md`.

## Later: only when a second clinic is real
- A deploy and migrate script that loops over clinics.
- Colour themes and report templates per profile.
- Configurable extra fields on clients and assessments.
- A settings screen to edit the profile.
- Per-clinic exercise library seeds.
