import type { SharedPostureReport } from '@/data/shared-posture';
import { formatFullDate } from '@/lib/dates';
import { en } from '@/lib/i18n/en';
import type { Translations } from '@/lib/i18n/en';
import { REGIONS } from '@/lib/posture-insights';
import { formatMetric } from '@/lib/posture-format';
import { bmiBand, painBand, stressBand } from '@/lib/wellbeing';
import { PostureFigure } from '@/components/posture/PostureFigure';
import { BRAND, RegionBars, ScoreRing, SectionHeader, SeverityDot } from '@/components/posture/ReportParts';
import { BmiGauge, StressGauge } from '@/components/posture/WellbeingGauges';

/** Client's copy of one posture report (share link kind 'posture'). Only SharedPostureReport fields. */
export function PostureReportBody({ report, t }: { report: SharedPostureReport; t: Translations }) {
  const s = t.sharedPage;
  const p = t.posture;
  const ins = p.insights;
  const wb = p.wellbeing;
  const w = report.wellbeing;
  const bmiKey = bmiBand(w.bmi);
  const pain = painBand(w.painScale);
  const stress = stressBand(w.stressLevel);
  const gender = { male: t.form.genderMale, female: t.form.genderFemale, other: t.form.genderOther }[w.gender ?? ''];
  const profile = [
    [p.profile.ageGender, [w.age, gender].filter((x) => x != null && x !== '').join(' / ') || null],
    [p.profile.weight, w.weightKg ? `${w.weightKg} kg` : null],
    [p.profile.bmi, w.bmi !== null && bmiKey ? `${w.bmi} · ${wb.bmiBands[bmiKey]}` : null],
    [p.profile.pain, pain ? `${w.painScale}/10 · ${wb.painBands[pain]}` : null],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <>
      <section>
        <h1 className="text-2xl font-bold">{s.greeting.replace('{name}', report.firstName)} 🙏</h1>
        <p className="text-muted-foreground">{s.postureTitle.replace('{date}', formatFullDate(report.assessedOn))}</p>
      </section>

      <section className="grid items-center gap-5 rounded-2xl p-4 sm:grid-cols-[auto_1fr]" style={{ backgroundColor: BRAND.sandLight }}>
        <div className="flex flex-col items-center">
          {report.score.overall !== null && report.score.grade !== null
            ? <ScoreRing score={report.score.overall} grade={report.score.grade} gradeLabel={ins.grades[report.score.grade]} outOf={ins.scoreOutOf} />
            : <p className="text-sm text-muted-foreground">{ins.notMeasured}</p>}
        </div>
        <RegionBars rows={REGIONS.map((r) => ({ label: ins.regions[r], region: report.score.regions[r] }))} notMeasured={ins.notMeasured} />
      </section>

      {report.patterns.length > 0 && (
        <section>
          <SectionHeader>{s.patternsTitle}</SectionHeader>
          <ul className="space-y-1.5">
            {report.patterns.map((pt) => (
              <li key={pt.key} className="flex items-center gap-2 text-sm">
                <SeverityDot severity={pt.severity} />
                {/* Clinical pattern text is English in both languages (2026-10-04); the physio explains it. */}
                <span className="font-medium">{en.posture.insights.patterns[pt.key].title}</span>
                <span className="text-muted-foreground">· {p.severity[pt.severity]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">{s.patternsNote}</p>
        </section>
      )}

      {report.ai && (
        <section>
          <SectionHeader>{s.aiTitle}</SectionHeader>
          <p className="text-sm leading-relaxed">{report.ai.summary}</p>
          {(['exercises', 'ergonomics', 'yogaAndBreathing'] as const).map((k) => report.ai!.recommendations[k].length > 0 && (
            <div key={k} className="mt-3">
              <h3 className="text-sm font-semibold">{p.ai.sections[k]}</h3>
              <ul className="ml-5 list-disc space-y-0.5 text-sm">{report.ai!.recommendations[k].map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
          ))}
        </section>
      )}

      <section>
        <SectionHeader>{s.findingsTitle}</SectionHeader>
        <div className="grid grid-cols-2 gap-3">
          {report.views.map((v) => (
            <figure key={v.view}>
              <PostureFigure overlay={v.overlay} photoUrl={v.photoUrl} metrics={v.metrics} alt={ins.viewNames[v.view]} noPhotoLabel={s.noPhotoShared} />
              <figcaption className="mt-1.5">
                <p className="text-center text-sm font-semibold" style={{ color: BRAND.green }}>{ins.viewNames[v.view]}</p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {v.metrics.filter((m) => m.severity === 'mild' || m.severity === 'marked').map((m, i) => {
                    const f = formatMetric(m, p);
                    return (
                      <li key={`${m.key}-${m.side ?? i}`} className="flex gap-1.5">
                        <SeverityDot severity={m.severity} />
                        <span>{f.label} <span className="font-medium tabular-nums">{f.value}</span>{f.detail && <span className="text-muted-foreground"> · {f.detail}</span>}</span>
                      </li>
                    );
                  })}
                </ul>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {(profile.length > 0 || bmiKey || stress || w.goal) && (
        <section>
          <SectionHeader>{wb.title}</SectionHeader>
          {profile.length > 0 && (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {profile.map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>)}
            </dl>
          )}
          {w.goal && <p className="mt-2 text-sm"><span className="text-muted-foreground">{p.profile.goal}:</span> {w.goal}</p>}
          {(bmiKey || stress) && (
            <div className="mt-3 flex flex-wrap justify-around gap-4 rounded-xl p-3" style={{ backgroundColor: BRAND.sandLight }}>
              {w.bmi !== null && bmiKey && <BmiGauge bmi={w.bmi} caption={wb.bmiBands[bmiKey]} label={wb.bmi} />}
              {stress && w.stressLevel !== null && <StressGauge level={w.stressLevel} caption={wb.stressBands[stress]} label={wb.stress} />}
            </div>
          )}
        </section>
      )}
    </>
  );
}
