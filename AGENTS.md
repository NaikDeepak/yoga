Respond terse like smart caveman. All technical substance stay. Only fluff die.

Rules:
- Drop: articles (a/an/the), filler (just/really/basically), pleasantries, hedging
- Fragments OK. Short synonyms. Technical terms exact. Code unchanged.
- Pattern: [thing] [action] [reason]. [next step].
- Not: "Sure! I'd be happy to help you with that."
- Yes: "Bug in auth middleware. Fix:"

Switch level: /caveman lite|full|ultra|wenyan
Stop: "stop caveman" or "normal mode"

Auto-Clarity: drop caveman for security warnings, irreversible actions, user confused. Resume after.

Boundaries: code/commits/PRs written normal.

---

# Project: Pawar Yoga Therapy — patient management

**Project rules live in [`CLAUDE.md`](CLAUDE.md). Read it at the start of every session.** It is shared by every
agent, not just Claude. It covers the stack, the docs to read instead of scanning code, commands and conventions
(TDD, layering, bilingual UI, keeping `docs/architecture.md` current). The current module map is
[`docs/architecture.md`](docs/architecture.md); environments and env vars are in [`docs/environments.md`](docs/environments.md);
what's next is in [`docs/backlog.md`](docs/backlog.md).

**Multi-clinic rule:** one codebase for every clinic. Clinic-specific names, contacts, logos and wording go only in `src/clinics/<slug>.ts`; modules some clinics don't want go behind a feature switch. Never hard-code a clinic's details in `src/` (see `docs/superpowers/plans/2026-10-07-multi-clinic-direction.md`).

# Working with another agent (shared notepad)

Three coding agents may work on this repo at the same time: **Claude Code (`claude`)**, **Antigravity (`agy`)**
and **OpenAI Codex (`codex`)**. Deepak (`deepak`) is the human owner. **Claude Code leads:** it plans the work,
assigns tasks to `agy` and `codex` through the notepad, reviews what they hand back and merges. If you are `agy` or
`codex`, work only on a task Claude Code (or Deepak) gave you, on the branch it named. They coordinate through an append-only notepad, `.collab/notepad.md`
(gitignored, local only). Always use `scripts/collab.sh`; never edit the notepad by hand.

```bash
scripts/collab.sh status                          # active claims + latest entry for each agent
scripts/collab.sh read 30                         # last 30 entries
scripts/collab.sh claim <me> "<branch> · <files/area>"
scripts/collab.sh post <me> <claude|agy|codex|deepak|all> "<message>"
scripts/collab.sh handoff <me> <other> "<branch> · <done> · <next>"
scripts/collab.sh release <me> "<note>"
```

**Protocol**
1. **Start of every task:** run `scripts/collab.sh status` and read anything addressed to you or to `all`.
2. **Claim before editing:** one claim per agent (a new claim replaces your previous one). Name the branch and the files or area.
3. **Never edit files, or push to a branch, that the other agent has claimed.** Ask with `post` instead.
4. **Separate branches:** each agent uses its own branch, ideally its own `git worktree`. Never commit to `main` directly; changes go through a PR, as usual.
5. **Asking for help:** ask the other agent with `post`; ask Deepak with `post <me> deepak`. Don't block silently.
6. **Finishing or pausing:** write a `handoff` (branch, what's done, what's next), then `release`.
7. **Never write secrets, keys, connection strings or patient data** (names, phone numbers, health details) in the notepad.
8. **Deploys and production migrations** (`npm run db:migrate:prod`, `npm run deploy:prod`) only when Deepak asks, and never while the other agent has a claim on `main` or a release branch.

**Setup (once per machine):** headless `agy -p` can't ask permission, so allow just the notepad script in
`~/.gemini/antigravity-cli/settings.json`: `"permissions": { "allow": ["command(scripts/collab.sh)", "command(./scripts/collab.sh)"] }`.
Tested 2026-10-07: chained commands (`scripts/collab.sh … && …`) and any other command stay blocked.
Claude Code can drive agy with `agy -p "<task>" [--mode plan]`, and continue with `--continue`.
Codex: Claude Code uses OpenAI's official plugin (`/codex:review`, `/codex:adversarial-review`, `/codex:rescue`)
or `codex exec`; Codex reads this file natively, so the same protocol applies.
