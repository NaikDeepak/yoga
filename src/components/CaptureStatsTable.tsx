import type { CaptureStatsSummary } from '@/lib/capture-stats';
import { isFlexShot } from '@/lib/capture-shots';
import type { Translations } from '@/lib/i18n/translations';

/** Settings → Posture capture health: per photo type, what blocked a capture and which hints were needed. */
export function CaptureStatsTable({ summary, t }: { summary: CaptureStatsSummary; t: Translations }) {
  const s = t.settings.captureStats;
  if (!summary.shots.length && !summary.session.saveTapped && !summary.session.modelLoadFailed) {
    return <p className="text-sm text-muted-foreground">{s.empty}</p>;
  }
  const label = (shot: CaptureStatsSummary['shots'][number]['shot']) =>
    (isFlexShot(shot) ? t.posture.flex.shots[shot] : t.posture.views[shot]);
  const cols = s.columns;
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              {[cols.shot, cols.attempts, cols.captured, cols.notLevel, cols.noPerson, cols.model, cols.hintInFrame, cols.hintFacing, cols.hintStill, cols.retake]
                .map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {summary.shots.map(({ shot, counts: c }) => (
              <tr key={shot} className="border-t">
                <td className="px-3 py-2 font-medium">{label(shot)}</td>
                <td className="px-3 py-2">{c.attemptAuto} / {c.attemptManual}</td>
                <td className="px-3 py-2">{c.captured}</td>
                <td className="px-3 py-2">{c.blockedNotLevel}</td>
                <td className="px-3 py-2">{c.blockedNoPerson}</td>
                <td className="px-3 py-2">{c.blockedModel}</td>
                <td className="px-3 py-2">{c.hintInFrame}</td>
                <td className="px-3 py-2">{c.hintFacing}</td>
                <td className="px-3 py-2">{c.hintStill}</td>
                <td className="px-3 py-2">{c.retake}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">
        {s.saveTapped}: {summary.session.saveTapped} · {s.modelLoadFailed}: {summary.session.modelLoadFailed}
      </p>
    </div>
  );
}
