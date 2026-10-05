# Client Progress Report Link — Design

Date: 2026-10-05 · Branch: `feat/progress-report-link` · Status: Draft (awaiting Deepak's review)
Roadmap item: **C4** (client features). Builds on the share-link groundwork (C1), check-ins (C2) and posture sharing (C3).

## Goal

The physio taps **"Share progress"**, and the client gets a WhatsApp link to a one-page "your progress so far" report: pain and weight over time, how regularly they've practised at home, and (when posture analysis is on) their posture before vs now. It's motivating for the client and helps retention. No login.

## What the client sees (`/s/<token>`, English default with a मराठी toggle)

1. **Header:** "Namaskar {first name} · Your progress since {first visit date}" and their **main goal** (from the lifestyle form, if filled).
2. **Headline numbers:**
   - **Pain** at the clinic: first recorded → latest, e.g. "7 → 3".
   - **Weight**: first → latest, e.g. "82 → 78 kg".
   - **Sessions** attended: visit count.
   - **Home practice** in the last 30 days: e.g. "18/30 days" (C2's adherence, All = 1, Some = ½).
3. **Charts:** clinic pain and weight over time (from visits), and home pain from check-ins when there are 2+ entries. These are **server-rendered SVG** line charts, with no JavaScript, so they stay light on budget phones. Each hides itself without enough data.
4. **Posture: before vs now.** Only when posture analysis is switched on **and** the client has 2+ assessments. It compares the first and latest assessments: score "72 → 88", region bars before and after, and the measures that got better or worse (C3's rules: low-confidence readings left out). **No photos and no figures:** this is numbers only, so no photo consent is involved.
5. Footer: "Keep going 🙏", the clinic phone number, and the same safety line.

**Live, not a snapshot:** the link always shows progress **up to today**, so the same link keeps working as the client improves, like the exercise link.

**Never shown:** visit progress notes (clinical, private), ailments, the treatment plan, fees and payments, the client code, contact details, posture photos, AI analysis, or the physio's posture notes.

## Physio UI

- A **"Share progress"** panel (the same `SharePanel`, kind `progress`) on the **Treatment tab**, next to the Progress charts: Share / Copy / WhatsApp ("Your progress report from Pawar's Yog Therapy: <link>"; link only) / Stop sharing, plus the status line.
- Shown once the client has at least one visit with pain or weight recorded. Otherwise the panel explains there's nothing to show yet.

## Data model (migration 0020)

- `share_links.kind` CHECK widened to `('exercises','posture','progress')`. No new columns: a progress link points only at the client, and the existing rule keeps one live progress link per client.

## Code layout

- `src/data/shared-progress.ts`: `getSharedProgressReport(db, link, now)` → whitelisted `SharedProgressReport`:
  - `firstName`, `since`, `goal`;
  - `pain` / `weight` series and first → latest values (from `listVisitsWithData`);
  - `sessions` (visit count);
  - `home: { adherence30, painSeries }` (C2 helpers);
  - `posture: { before, after, regions, changes } | null`, only when `isPostureEnabled()` and there are 2+ assessments, using `compareScores` / `compareMetrics` without low-confidence readings.
- `src/lib/progress.ts` (pure): `firstLatest(series)` (and the change), `sparklinePoints(values, width, height)` for the SVG charts.
- `src/components/TrendChart.tsx`: a server-rendered SVG line chart (axis labels, dots, gaps for missing days).
- `src/app/s/[token]/ProgressReportBody.tsx`, with the page routing on `kind === 'progress'`.
- `src/actions/share-links.ts`: `createProgressShareLinkAction(patientId)` / `revokeProgressShareLinkAction(patientId)`.
- `src/lib/whatsapp.ts`: `progressShareMessage(url)`.

## Tests

- **Pure:** first/latest with gaps, a single point, and empty input; sparkline scaling (flat series, min = max, gaps).
- **View model:**
  - exactly the whitelisted keys;
  - no visit notes, fees or ailments in the JSON;
  - first/latest pain and weight; sessions; home adherence;
  - the posture section null when posture is off or there's only 1 assessment, and the comparison present when there are 2+;
  - low-confidence readings excluded.
- **Actions:** auth required; nothing to share without visit data; no name in the WhatsApp text.
- **Page routing:** a progress token renders the progress page; the other kinds are unaffected; revoked links give the same 404.

## Decisions for Deepak

1. **Live report (always up to today)**, not a frozen snapshot. OK?
2. **Show weight?** Some clients are sensitive about weight. Include it, or leave it off the client's copy?
3. **Posture before/after: numbers only** (score, regions, better/worse measures), with no photos or figures. OK?
4. **Leave visit notes off.** They're written for clinicians. OK?

## Docs

`docs/architecture.md` (module map, the public view models, kind list), in the same commit as the code.
