# Total Score (posture + flexibility) — Design

Date: 2026-10-07 · Branch: `feat/total-score` · Status: Approved (Deepak, 2026-10-07)
Roadmap: **C8** (backlog). Note: FlexifyMe's "206/300" is the three flexibility tests summed (78 + 48 + 80); our total adds posture.

## Decisions (Deepak)
- **Total = posture score + shoulder extension + forward fold + butterfly, out of 400.**
- **Only when complete:** the total appears only when the posture score and all three flexibility scores exist. No partial totals, so the number is always comparable between sessions.
- **"Complete" also means each part is complete** (added in review): both shoulder sides captured and measured, both butterfly knees measured, and every posture region measured. A score averaged from partial data doesn't count.

## Rules
- The parts are the same scores the report already shows:
  - posture overall, 0–100;
  - each flexibility test, 0–100.

  They're recomputed on every read, so tuning `FLEX_SCORING` or the posture thresholds re-totals history.
- **Trend:** against the previous assessment's total. It uses the same `scoreTrend` as the posture score, with band 12, and the compare page colours its total row from the same rule, so the Overview and compare never disagree.
  - A change under **12 points** (3% of 400, the same tolerance as the posture score's 3/100) is "steady".
  - If the previous assessment has no total, there's no trend.
- **Not on client share links:** they don't show flexibility.

## Where
- **Posture report:** a "Total score" strip under the posture score: `288/400 · Posture 82 · Shoulder extension 78 · Forward fold 48 · Butterfly 80`.
- **Overview tab posture card:** the total and its trend, under the posture score.
- **Assessment history list:** `· Total 288/400` per assessment.
- **Compare page:** a total row (before → after, change).

## Code
- `src/lib/total-score.ts` (pure): `totalScore(posture, flexScores)` gives `{ total, parts } | null`; `TOTAL_MAX`; `totalTrend(latest, previous)`.
- `src/lib/flexibility.ts`: `scoreShots(rows)` (measure + score stored shots), shared by `src/data/flexibility.ts` and `src/data/posture.ts`.
- `src/data/posture.ts`: `listPostureAssessments` / `latestPostureScores` gain `total` (and `previousTotal`), **only with `{ totals: true }`**. That's the Overview and the Assessment history; the client list and the progress report skip loading the flexibility landmarks.
- UI: a `TotalScore` strip component; the Overview card, history list and compare row.

## Tests
- **Pure:** a complete total; null when any part is missing; the trend band (11 = steady, 12 = better or worse).
- **Data:** a total in the list and the latest scores; null without flexibility or with a partial set; `previousTotal`.
- **Components:** the strip shows the parts; the card shows the total and trend; hidden when there's no total.
